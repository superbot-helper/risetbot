"""
PageIndex RAG Service — Self-hosted vectorless, reasoning-based RAG.

Uses the open-source PageIndex framework (https://github.com/VectifyAI/PageIndex)
to build tree-structured indexes from PDF documents, then performs
LLM reasoning-based tree search for context-aware retrieval.

Pipeline:
  1. PDF → PageIndex tree generation (hierarchical document index)
  2. Query → LLM tree search (reasoning over node summaries)
  3. Retrieved nodes → LLM answer generation with source citations
"""
import os
import json
import logging
from typing import Optional
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

# Directory to store generated tree indexes
TREE_INDEX_DIR = os.getenv('TREE_INDEX_DIR', './tree_indexes')


class PageIndexRAGService:
  """
  Self-hosted PageIndex RAG service.

  Builds tree-structured document indexes and uses LLM reasoning-based
  tree search for retrieval. No vector database or chunking required.
  """

  def __init__(
    self,
    llm_api_key: Optional[str] = None,
    llm_base_url: Optional[str] = None,
    llm_model: Optional[str] = None,
  ):
    self.llm_api_key = llm_api_key or os.getenv('LLM_API_KEY', '')
    self.llm_base_url = llm_base_url or os.getenv('LLM_BASE_URL', 'https://api.openai.com/v1')
    self.llm_model = llm_model or os.getenv('LLM_MODEL', 'gpt-4o-mini')
    self._pageindex_available = self._check_pageindex()
    os.makedirs(TREE_INDEX_DIR, exist_ok=True)

  def _check_pageindex(self) -> bool:
    """Check if pageindex package is installed locally."""
    try:
      import pageindex  # noqa: F401
      return True
    except ImportError:
      logger.warning('PageIndex package not installed. Using fallback context-window RAG.')
      return False

  async def build_tree_index(self, pdf_path: str) -> dict:
    """
    Build a PageIndex tree structure from a PDF document.

    Uses the self-hosted PageIndex library to generate a hierarchical
    tree index with node summaries, page references, and text content.

    Args:
      pdf_path: Absolute path to the PDF file.

    Returns:
      Dict with 'doc_id', 'tree', and 'status'.
    """
    if not self._pageindex_available:
      return await self._build_fallback_index(pdf_path)

    try:
      from pageindex import page_index_main
      from pageindex.utils import ConfigLoader

      opt = ConfigLoader().load({
        'model': self.llm_model,
        'if_add_node_id': 'yes',
        'if_add_node_summary': 'yes',
        'if_add_node_text': 'yes',
        'if_add_doc_description': 'no',
      })

      # Set LLM env vars for pageindex (uses litellm internally)
      os.environ['CHATGPT_API_KEY'] = self.llm_api_key
      if 'openai' not in self.llm_base_url:
        os.environ['OPENAI_API_BASE'] = self.llm_base_url

      tree = page_index_main(pdf_path, opt)

      # Save tree to disk for caching
      pdf_name = Path(pdf_path).stem
      tree_path = os.path.join(TREE_INDEX_DIR, f'{pdf_name}_structure.json')
      with open(tree_path, 'w', encoding='utf-8') as f:
        json.dump(tree, f, indent=2, ensure_ascii=False)

      logger.info('PageIndex tree built for %s: %s', pdf_name, tree_path)

      return {
        'doc_id': pdf_name,
        'tree': tree,
        'tree_path': tree_path,
        'status': 'completed',
      }
    except Exception as e:
      logger.error('PageIndex tree generation failed: %s', str(e))
      return await self._build_fallback_index(pdf_path)

  async def _build_fallback_index(self, pdf_path: str) -> dict:
    """
    Fallback: build a simple page-level index without PageIndex.
    Uses PyMuPDF to extract text per page.
    """
    try:
      import fitz  # PyMuPDF

      doc = fitz.open(pdf_path)
      pages = []
      for i, page in enumerate(doc):
        text = page.get_text('text').strip()
        if text:
          pages.append({
            'title': f'Page {i + 1}',
            'node_id': f'{i:04d}',
            'page_index': i + 1,
            'text': text,
            'summary': text[:200],
          })
      doc.close()

      pdf_name = Path(pdf_path).stem
      tree = [{'title': pdf_name, 'node_id': '0000', 'nodes': pages}]

      tree_path = os.path.join(TREE_INDEX_DIR, f'{pdf_name}_structure.json')
      with open(tree_path, 'w', encoding='utf-8') as f:
        json.dump(tree, f, indent=2, ensure_ascii=False)

      return {
        'doc_id': pdf_name,
        'tree': tree,
        'tree_path': tree_path,
        'status': 'completed_fallback',
      }
    except Exception as e:
      logger.error('Fallback index build failed: %s', str(e))
      return {'doc_id': '', 'tree': [], 'tree_path': '', 'status': 'failed'}

  def load_tree_index(self, doc_id: str) -> Optional[list]:
    """Load a previously generated tree index from disk."""
    tree_path = os.path.join(TREE_INDEX_DIR, f'{doc_id}_structure.json')
    if not os.path.exists(tree_path):
      return None
    with open(tree_path, 'r', encoding='utf-8') as f:
      return json.load(f)

  def list_indexed_documents(self) -> list[dict]:
    """List all indexed documents with their tree file paths."""
    docs = []
    for file in Path(TREE_INDEX_DIR).glob('*_structure.json'):
      doc_id = file.stem.replace('_structure', '')
      docs.append({'doc_id': doc_id, 'tree_path': str(file)})
    return docs

  async def query(
    self,
    question: str,
    documents: list[dict],
    chat_history: Optional[list[dict]] = None,
    max_context_chars: int = 16000,
  ) -> dict:
    """
    Answer a question using reasoning-based tree search RAG.

    Pipeline:
      1. Load or build tree indexes for provided documents.
      2. LLM tree search: identify relevant nodes via reasoning.
      3. Extract text from relevant nodes.
      4. LLM answer generation with source citations.

    Args:
      question: User's question.
      documents: List of dicts with 'file_name', 'text', 'pages', or 'tree' keys.
      chat_history: Previous conversation messages.
      max_context_chars: Maximum context characters to send to LLM.

    Returns:
      Dict with 'answer', 'sources', and 'confidence'.
    """
    if not documents:
      return {
        'answer': 'Tidak ada dokumen yang tersedia untuk menjawab pertanyaan Anda.',
        'sources': [],
        'confidence': 0.0,
      }

    # Step 1: Collect tree structures from documents
    all_trees = self._collect_trees(documents)

    if not all_trees:
      # No tree structures available; use direct context-window RAG
      return await self._context_window_rag(question, documents, chat_history, max_context_chars)

    # Step 2: LLM reasoning-based tree search
    relevant_nodes = await self._tree_search(question, all_trees)

    if not relevant_nodes:
      return await self._context_window_rag(question, documents, chat_history, max_context_chars)

    # Step 3: Generate answer from retrieved nodes
    return await self._generate_answer_from_nodes(
      question, relevant_nodes, chat_history, max_context_chars,
    )

  def _collect_trees(self, documents: list[dict]) -> list[dict]:
    """Collect tree structures from documents or load from disk."""
    trees = []
    for doc in documents:
      file_name = doc.get('file_name', 'Unknown')

      # If tree structure is embedded
      if 'tree' in doc and doc['tree']:
        trees.append({'file_name': file_name, 'tree': doc['tree']})
        continue

      # Try to load from disk via doc_id or file name stem
      doc_id = doc.get('doc_id', Path(file_name).stem if file_name else '')
      loaded_tree = self.load_tree_index(doc_id)
      if loaded_tree:
        trees.append({'file_name': file_name, 'tree': loaded_tree})
        continue

      # Build simple page-based nodes for tree search
      pages = doc.get('pages', [])
      if pages:
        nodes = []
        for page in pages:
          text = page.get('text', '').strip()
          if text:
            nodes.append({
              'title': f'Page {page.get("page_number", 0)}',
              'node_id': f'{page.get("page_number", 0):04d}',
              'page_index': page.get('page_number', 0),
              'text': text,
              'summary': text[:200],
            })
        if nodes:
          trees.append({
            'file_name': file_name,
            'tree': [{'title': file_name, 'node_id': 'root', 'nodes': nodes}],
          })

    return trees

  async def _tree_search(
    self,
    question: str,
    trees: list[dict],
  ) -> list[dict]:
    """
    LLM reasoning-based tree search following the PageIndex methodology.

    Sends the tree structure (without full text) to LLM,
    asks it to reason about which nodes likely contain the answer.
    """
    # Build simplified tree (summaries only, no full text) for LLM reasoning
    simplified_trees = []
    node_map = {}  # Map node_id → full node (with text)

    for tree_doc in trees:
      file_name = tree_doc['file_name']
      simplified, mapping = self._simplify_tree(tree_doc['tree'], file_name)
      simplified_trees.append({
        'file_name': file_name,
        'tree': simplified,
      })
      node_map.update(mapping)

    tree_json = json.dumps(simplified_trees, indent=2, ensure_ascii=False)

    search_prompt = f"""Kamu diberikan pertanyaan dan struktur tree dokumen.
Setiap node memiliki node_id, judul, dan ringkasan.
Tugasmu adalah menemukan SEMUA node yang kemungkinan berisi jawaban atas pertanyaan.

Pertanyaan: {question}

Struktur tree dokumen:
{tree_json}

Balas dalam format JSON berikut:
{{
    "thinking": "<Proses berpikirmu tentang node mana yang relevan dengan pertanyaan>",
    "node_list": ["node_id_1", "node_id_2", ..., "node_id_n"]
}}
Langsung kembalikan JSON. Jangan output apapun selain JSON."""

    try:
      result_text = await self._call_llm(search_prompt, temperature=0.0)

      # Parse JSON from LLM response
      result_text = result_text.strip()
      if result_text.startswith('```'):
        lines = result_text.split('\n')
        result_text = '\n'.join(lines[1:-1])

      search_result = json.loads(result_text)
      node_ids = search_result.get('node_list', [])

      # Collect full nodes with text
      relevant_nodes = []
      for node_id in node_ids:
        if node_id in node_map:
          relevant_nodes.append(node_map[node_id])

      logger.info(
        'Tree search found %d relevant nodes (reasoning: %s)',
        len(relevant_nodes),
        search_result.get('thinking', '')[:100],
      )
      return relevant_nodes

    except Exception as e:
      logger.error('Tree search failed: %s', str(e))
      return []

  def _simplify_tree(
    self,
    tree: list[dict],
    file_name: str,
    prefix: str = '',
  ) -> tuple[list[dict], dict]:
    """
    Remove 'text' fields from tree for LLM reasoning (keep summaries).
    Also builds a flat node mapping for later text retrieval.
    """
    simplified = []
    node_map = {}

    def _process_node(node: dict, depth: int = 0):
      node_id = node.get('node_id', '')
      simple_node = {
        'title': node.get('title', ''),
        'node_id': node_id,
      }

      # Include summary or prefix_summary
      summary = node.get('summary', node.get('prefix_summary', ''))
      if summary:
        simple_node['summary'] = summary[:300]

      # Include page reference
      if 'page_index' in node:
        simple_node['page_index'] = node['page_index']
      if 'start_index' in node:
        simple_node['start_index'] = node['start_index']

      # Store full node in map for later retrieval
      full_key = f'{file_name}:{node_id}' if node_id else node_id
      node_map[node_id] = {
        'node_id': node_id,
        'title': node.get('title', ''),
        'text': node.get('text', ''),
        'page_index': node.get('page_index', node.get('start_index', 0)),
        'file_name': file_name,
      }
      # Also map with file prefix for disambiguation
      if full_key != node_id:
        node_map[full_key] = node_map[node_id]

      # Process children
      children = node.get('nodes', [])
      if children:
        simple_node['nodes'] = []
        for child in children:
          child_simple = _process_node(child, depth + 1)
          simple_node['nodes'].append(child_simple)

      return simple_node

    for root in tree:
      simplified.append(_process_node(root))

    return simplified, node_map

  async def _generate_answer_from_nodes(
    self,
    question: str,
    nodes: list[dict],
    chat_history: Optional[list[dict]] = None,
    max_context_chars: int = 16000,
  ) -> dict:
    """Generate an answer using the text from retrieved tree nodes."""
    context_parts = []
    sources = []
    total_chars = 0

    for node in nodes:
      text = node.get('text', '').strip()
      if not text:
        continue

      # Trim if exceeding max context
      if total_chars + len(text) > max_context_chars:
        text = text[:max_context_chars - total_chars]

      source_ref = f'[{node["file_name"]}, hal. {node["page_index"]}]'
      context_parts.append(f'{source_ref} — {node["title"]}:\n{text}')
      total_chars += len(text)

      sources.append({
        'file_name': node['file_name'],
        'page': node['page_index'],
        'title': node.get('title', ''),
      })

      if total_chars >= max_context_chars:
        break

    context = '\n\n---\n\n'.join(context_parts)

    return await self._generate_answer(question, context, sources, chat_history)

  async def _context_window_rag(
    self,
    question: str,
    documents: list[dict],
    chat_history: Optional[list[dict]] = None,
    max_context_chars: int = 16000,
  ) -> dict:
    """
    Fallback: direct context-window RAG without tree search.
    Used when no tree structure is available.
    """
    context_parts = []
    sources = []
    total_chars = 0

    for doc in documents:
      file_name = doc.get('file_name', 'Unknown')
      pages = doc.get('pages', [])

      if pages:
        for page in pages:
          text = page.get('text', '').strip()
          if not text or total_chars >= max_context_chars:
            continue
          chunk = text[:2000]
          page_num = page.get('page_number', 0)
          context_parts.append(f'[{file_name}, hal. {page_num}]:\n{chunk}')
          sources.append({'file_name': file_name, 'page': page_num})
          total_chars += len(chunk)
      else:
        text = doc.get('text', '')
        if text:
          chunk = text[:max_context_chars - total_chars]
          context_parts.append(f'[{file_name}]:\n{chunk}')
          sources.append({'file_name': file_name, 'page': 1})
          total_chars += len(chunk)

    context = '\n\n---\n\n'.join(context_parts)
    return await self._generate_answer(question, context, sources, chat_history)

  async def _generate_answer(
    self,
    question: str,
    context: str,
    sources: list[dict],
    chat_history: Optional[list[dict]] = None,
  ) -> dict:
    """Generate final answer using LLM with retrieved context."""
    system_prompt = """Kamu adalah RisetBot, asisten AI yang membantu menjawab pertanyaan tentang data survey.

ATURAN:
1. Jawab HANYA berdasarkan konteks dokumen yang diberikan.
2. Jika informasi tidak ditemukan dalam konteks, katakan dengan jujur.
3. Sertakan referensi sumber (nama file dan halaman) inline di jawaban.
4. Jawab dalam bahasa yang sama dengan pertanyaan pengguna.
5. Berikan jawaban yang ringkas tapi informatif."""

    messages = [{'role': 'system', 'content': system_prompt}]

    if chat_history:
      for msg in chat_history[-8:]:
        messages.append({
          'role': msg.get('role', 'user'),
          'content': msg.get('content', msg.get('message', '')),
        })

    user_message = f"""KONTEKS DOKUMEN (dari tree-search retrieval):
{context}

PERTANYAAN:
{question}

Jawab berdasarkan konteks di atas. Sertakan referensi sumber inline."""

    messages.append({'role': 'user', 'content': user_message})

    try:
      answer = await self._call_llm_messages(messages)

      # Deduplicate sources
      unique_sources = []
      seen = set()
      for s in sources:
        key = f'{s["file_name"]}:{s["page"]}'
        if key not in seen:
          unique_sources.append(s)
          seen.add(key)

      return {
        'answer': answer,
        'sources': unique_sources,
        'confidence': 0.9 if len(sources) > 0 else 0.3,
      }
    except Exception as e:
      logger.error('Answer generation failed: %s', str(e))
      return {
        'answer': f'Maaf, terjadi kesalahan saat memproses pertanyaan Anda: {str(e)}',
        'sources': [],
        'confidence': 0.0,
      }

  async def _call_llm(self, prompt: str, temperature: float = 0.3) -> str:
    """Call LLM with a single prompt."""
    messages = [{'role': 'user', 'content': prompt}]
    return await self._call_llm_messages(messages, temperature)

  async def _call_llm_messages(
    self,
    messages: list[dict],
    temperature: float = 0.3,
  ) -> str:
    """Call LLM chat completions endpoint."""
    async with httpx.AsyncClient(timeout=90.0) as client:
      response = await client.post(
        f'{self.llm_base_url}/chat/completions',
        headers={'Authorization': f'Bearer {self.llm_api_key}'},
        json={
          'model': self.llm_model,
          'messages': messages,
          'temperature': temperature,
          'max_tokens': 4096,
        },
      )

      if response.status_code == 200:
        return response.json()['choices'][0]['message']['content']
      else:
        raise RuntimeError(f'LLM request failed ({response.status_code}): {response.text}')
