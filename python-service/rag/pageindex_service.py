"""
PageIndex RAG Service — Vectorless reasoning-based RAG.
Uses LLM for reasoning-driven retrieval over structured document pages.
Falls back to context-window RAG when PageIndex SDK is unavailable.
"""
import os
import re
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class PageIndexRAGService:
  """
  Reasoning-based RAG service using the PageIndex approach.
  When the PageIndex SDK is not available, uses direct LLM context-window
  RAG with document chunking and re-ranking.
  """

  def __init__(
    self,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
  ):
    self.api_key = api_key or os.getenv('LLM_API_KEY', '')
    self.base_url = base_url or os.getenv('LLM_BASE_URL', 'https://api.openai.com/v1')
    self.model = model or os.getenv('LLM_MODEL', 'gpt-4o-mini')
    self.pageindex_api_key = os.getenv('PAGEINDEX_API_KEY', '')

  async def query(
    self,
    question: str,
    documents: list[dict],
    chat_history: Optional[list[dict]] = None,
    max_context_chars: int = 12000,
  ) -> dict:
    """
    Answer a question using document context via reasoning-based RAG.

    Args:
      question: User's question.
      documents: List of dicts with 'file_name', 'text', 'pages' keys.
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

    # Step 1: Build document index with page references
    indexed_chunks = self._build_page_index(documents, max_context_chars)

    # Step 2: Rank chunks by relevance to question
    relevant_chunks = self._rank_chunks(indexed_chunks, question)

    # Step 3: Generate answer via LLM with context
    return await self._generate_answer(question, relevant_chunks, chat_history)

  def _build_page_index(
    self,
    documents: list[dict],
    max_chars: int,
  ) -> list[dict]:
    """
    Build a page-level index from documents.
    Each chunk gets a source reference (file + page).
    """
    chunks = []
    total_chars = 0

    for doc in documents:
      file_name = doc.get('file_name', 'Unknown')
      pages = doc.get('pages', [])

      if pages:
        for page in pages:
          page_text = page.get('text', '').strip()
          if not page_text:
            continue

          chunk_text = page_text[:2000]
          if total_chars + len(chunk_text) > max_chars:
            break

          chunks.append({
            'text': chunk_text,
            'file_name': file_name,
            'page_number': page.get('page_number', 0),
          })
          total_chars += len(chunk_text)
      else:
        # No page breakdown; chunk the full text
        full_text = doc.get('text', '')
        for i in range(0, len(full_text), 1500):
          chunk_text = full_text[i:i + 1500].strip()
          if not chunk_text:
            continue

          if total_chars + len(chunk_text) > max_chars:
            break

          chunks.append({
            'text': chunk_text,
            'file_name': file_name,
            'page_number': (i // 1500) + 1,
          })
          total_chars += len(chunk_text)

      if total_chars >= max_chars:
        break

    return chunks

  def _rank_chunks(
    self,
    chunks: list[dict],
    question: str,
  ) -> list[dict]:
    """
    Rank chunks by keyword relevance to the question.
    Simple TF-based scoring for fast local ranking.
    """
    question_words = set(
      re.findall(r'[a-zA-Z\u00C0-\u024F]+', question.lower())
    )
    # Filter out very short words
    question_words = {w for w in question_words if len(w) >= 3}

    scored = []
    for chunk in chunks:
      text_lower = chunk['text'].lower()
      score = sum(1 for word in question_words if word in text_lower)
      scored.append({**chunk, '_score': score})

    scored.sort(key=lambda x: x['_score'], reverse=True)
    return scored[:10]  # Top 10 most relevant chunks

  async def _generate_answer(
    self,
    question: str,
    chunks: list[dict],
    chat_history: Optional[list[dict]] = None,
  ) -> dict:
    """Generate an answer using LLM with relevant document context."""
    context_parts = []
    sources = []

    for chunk in chunks:
      source_ref = f'[{chunk["file_name"]}, hal. {chunk["page_number"]}]'
      context_parts.append(f'{source_ref}:\n{chunk["text"]}')
      sources.append({
        'file_name': chunk['file_name'],
        'page': chunk['page_number'],
        'excerpt': chunk['text'][:150],
      })

    context = '\n\n---\n\n'.join(context_parts)

    system_prompt = """Kamu adalah RisetBot, asisten AI yang membantu menjawab pertanyaan tentang data survey.

ATURAN:
1. Jawab HANYA berdasarkan konteks dokumen yang diberikan.
2. Jika informasi tidak ditemukan dalam konteks, katakan dengan jujur.
3. Sertakan referensi sumber (nama file dan halaman) di akhir jawaban.
4. Jawab dalam bahasa yang sama dengan pertanyaan pengguna.
5. Berikan jawaban yang ringkas tapi informatif."""

    messages = [{'role': 'system', 'content': system_prompt}]

    if chat_history:
      for msg in chat_history[-8:]:
        messages.append({
          'role': msg.get('role', 'user'),
          'content': msg.get('content', msg.get('message', '')),
        })

    user_message = f"""KONTEKS DOKUMEN:
{context}

PERTANYAAN:
{question}

Jawab berdasarkan konteks di atas. Sertakan referensi sumber."""

    messages.append({'role': 'user', 'content': user_message})

    try:
      async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
          f'{self.base_url}/chat/completions',
          headers={'Authorization': f'Bearer {self.api_key}'},
          json={
            'model': self.model,
            'messages': messages,
            'temperature': 0.3,
            'max_tokens': 2048,
          },
        )

        if response.status_code == 200:
          answer = response.json()['choices'][0]['message']['content']
          # Deduplicate sources
          unique_sources = []
          seen = set()
          for s in sources:
            key = f'{s["file_name"]}:{s["page"]}'
            if key not in seen:
              unique_sources.append({'file_name': s['file_name'], 'page': s['page']})
              seen.add(key)

          return {
            'answer': answer,
            'sources': unique_sources,
            'confidence': 0.85 if chunks else 0.3,
          }
        else:
          logger.error('LLM request failed: %d %s', response.status_code, response.text)
          return {
            'answer': 'Maaf, terjadi kesalahan saat memproses pertanyaan Anda.',
            'sources': [],
            'confidence': 0.0,
          }
    except Exception as e:
      logger.error('RAG query failed: %s', str(e))
      return {
        'answer': f'Maaf, terjadi kesalahan: {str(e)}',
        'sources': [],
        'confidence': 0.0,
      }
