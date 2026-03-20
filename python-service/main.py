"""
RisetBot Python AI Service — FastAPI entry point.
Provides OCR, data analysis, report generation, and RAG endpoints.
"""
import os
import io
import logging
import base64
import tempfile
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv(dotenv_path='../.env')

# Configure logging
logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
)
logger = logging.getLogger('risetbot-python')

app = FastAPI(
  title='RisetBot Python Service',
  description='AI/Data Processing service for RisetBot',
  version='1.0.0',
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=['*'],
  allow_credentials=True,
  allow_methods=['*'],
  allow_headers=['*'],
)

# Ensure storage directories on startup
from utils.file_handler import ensure_directories
ensure_directories()


# ─── Request/Response Models ────────────────────────────────

class OCRRequest(BaseModel):
  """Request body for base64-encoded PDF extraction."""
  file_content: str  # base64-encoded PDF
  file_name: str = 'document.pdf'


class AnalysisRequest(BaseModel):
  """Request body for data analysis."""
  data: list[dict]
  schema_columns: list[dict]
  include_statistics: bool = True
  include_sentiment: bool = True
  include_themes: bool = True


class ReportRequest(BaseModel):
  """Request body for report generation."""
  template_path: str
  output_path: str
  analysis_data: dict
  project_name: str
  report_name: str


class RAGQueryRequest(BaseModel):
  """Request body for RAG query."""
  question: str
  documents: list[dict]
  chat_history: Optional[list[dict]] = None


class CompileRequest(BaseModel):
  """Request body for data compilation."""
  data: list[dict]
  format: str = 'csv'  # 'csv' or 'xlsx'
  output_path: Optional[str] = None
  sheet_name: str = 'Survey Data'


class FileValidationRequest(BaseModel):
  """Request body for file validation."""
  filename: str
  file_size: int
  purpose: str = 'knowledge'


# ─── Health Check ───────────────────────────────────────────

@app.get('/health')
async def health_check():
  """Health check endpoint."""
  return {'status': 'ok', 'service': 'python-service', 'version': '1.0.0'}


# ─── OCR Routes ─────────────────────────────────────────────

@app.post('/ocr/extract')
async def ocr_extract(request: OCRRequest):
  """Extract text from a base64-encoded PDF using PyMuPDF + PaddleOCR fallback."""
  try:
    pdf_bytes = base64.b64decode(request.file_content)
    from ocr.pdf_parser import extract_text_from_pdf_bytes
    result = extract_text_from_pdf_bytes(pdf_bytes)
    return {
      'status': 'success',
      'text': result['text'],
      'page_count': result['page_count'],
      'method': result['method'],
      'pages': result['pages'],
    }
  except Exception as e:
    logger.error('OCR extraction failed: %s', str(e))
    raise HTTPException(status_code=500, detail=f'OCR extraction failed: {str(e)}')


@app.post('/ocr/extract-file')
async def ocr_extract_file(file: UploadFile = File(...)):
  """Extract text from an uploaded PDF file."""
  if not file.filename or not file.filename.lower().endswith('.pdf'):
    raise HTTPException(status_code=400, detail='Only PDF files are accepted')

  try:
    content = await file.read()
    from ocr.pdf_parser import extract_text_from_pdf_bytes
    result = extract_text_from_pdf_bytes(content)
    return {
      'status': 'success',
      'file_name': file.filename,
      'text': result['text'],
      'page_count': result['page_count'],
      'method': result['method'],
      'pages': result['pages'],
    }
  except Exception as e:
    logger.error('OCR file extraction failed: %s', str(e))
    raise HTTPException(status_code=500, detail=f'OCR extraction failed: {str(e)}')


# ─── Analysis Routes ────────────────────────────────────────

@app.post('/analysis/analyze')
async def analyze_data(request: AnalysisRequest):
  """Analyze survey data using Pandas-based statistics and sentiment analysis."""
  try:
    from analysis.data_analyzer import analyze_survey_data
    result = await analyze_survey_data(
      data=request.data,
      schema_columns=request.schema_columns,
      options={
        'include_statistics': request.include_statistics,
        'include_sentiment': request.include_sentiment,
        'include_themes': request.include_themes,
      },
    )
    return {'status': 'success', **result}
  except Exception as e:
    logger.error('Analysis failed: %s', str(e))
    raise HTTPException(status_code=500, detail=f'Analysis failed: {str(e)}')


@app.post('/analysis/statistics')
async def compute_statistics(request: AnalysisRequest):
  """Compute descriptive statistics only."""
  try:
    from analysis.statistics import compute_descriptive_stats
    result = compute_descriptive_stats(request.data, request.schema_columns)
    return {'status': 'success', **result}
  except Exception as e:
    logger.error('Statistics computation failed: %s', str(e))
    raise HTTPException(status_code=500, detail=f'Statistics failed: {str(e)}')


@app.post('/analysis/sentiment')
async def analyze_sentiment(request: AnalysisRequest):
  """Analyze sentiment of text columns."""
  try:
    from analysis.sentiment import analyze_sentiment_basic
    text_columns = [
      col['name'] for col in request.schema_columns
      if col.get('type') == 'text'
    ]

    all_texts = []
    for row in request.data:
      for col_name in text_columns:
        val = row.get(col_name)
        if val and str(val).strip():
          all_texts.append(str(val).strip())

    result = analyze_sentiment_basic(all_texts)
    return {'status': 'success', **result}
  except Exception as e:
    logger.error('Sentiment analysis failed: %s', str(e))
    raise HTTPException(status_code=500, detail=f'Sentiment analysis failed: {str(e)}')


# ─── Report Routes ──────────────────────────────────────────

@app.post('/report/generate')
async def generate_report(request: ReportRequest):
  """Generate DOCX report from template + analysis data."""
  try:
    from report.docx_generator import generate_report_from_analysis
    result = generate_report_from_analysis(
      template_path=request.template_path,
      output_path=request.output_path,
      analysis_data=request.analysis_data,
      project_name=request.project_name,
      report_name=request.report_name,
    )
    return {'status': 'success', **result}
  except FileNotFoundError as e:
    raise HTTPException(status_code=404, detail=str(e))
  except Exception as e:
    logger.error('Report generation failed: %s', str(e))
    raise HTTPException(status_code=500, detail=f'Report generation failed: {str(e)}')


@app.post('/report/template-variables')
async def get_template_vars(file: UploadFile = File(...)):
  """Extract Jinja2 variable names from an uploaded DOCX template."""
  if not file.filename or not file.filename.lower().endswith('.docx'):
    raise HTTPException(status_code=400, detail='Only DOCX files are accepted')

  try:
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as tmp:
      tmp.write(content)
      tmp_path = tmp.name

    from report.docx_generator import get_template_variables
    variables = get_template_variables(tmp_path)
    os.unlink(tmp_path)

    return {'status': 'success', 'variables': variables}
  except Exception as e:
    logger.error('Template variable extraction failed: %s', str(e))
    raise HTTPException(status_code=500, detail=str(e))


# ─── RAG Routes ─────────────────────────────────────────────

@app.post('/rag/query')
async def rag_query(request: RAGQueryRequest):
  """Query knowledge base using reasoning-based RAG."""
  try:
    from rag.pageindex_service import PageIndexRAGService
    service = PageIndexRAGService()
    result = await service.query(
      question=request.question,
      documents=request.documents,
      chat_history=request.chat_history,
    )
    return {'status': 'success', **result}
  except Exception as e:
    logger.error('RAG query failed: %s', str(e))
    raise HTTPException(status_code=500, detail=f'RAG query failed: {str(e)}')


# ─── Data Compilation Routes ────────────────────────────────

@app.post('/compile/export')
async def compile_data(request: CompileRequest):
  """Compile data into CSV or XLSX format."""
  try:
    if request.format == 'xlsx':
      from utils.data_compiler import compile_to_xlsx_bytes
      xlsx_bytes = compile_to_xlsx_bytes(request.data, request.sheet_name)
      return StreamingResponse(
        io.BytesIO(xlsx_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
          'Content-Disposition': f'attachment; filename="survey_data.xlsx"',
        },
      )
    else:
      from utils.data_compiler import compile_to_csv
      result = compile_to_csv(request.data, request.output_path)
      return {'status': 'success', **result}
  except Exception as e:
    logger.error('Data compilation failed: %s', str(e))
    raise HTTPException(status_code=500, detail=f'Compilation failed: {str(e)}')


# ─── File Handling Routes ───────────────────────────────────

@app.post('/files/validate')
async def validate_uploaded_file(request: FileValidationRequest):
  """Validate file extension and size before upload."""
  from utils.file_handler import validate_file
  result = validate_file(request.filename, request.file_size, request.purpose)
  return result


@app.post('/files/upload/{project_id}')
async def upload_file(
  project_id: str,
  file: UploadFile = File(...),
  purpose: str = Form('knowledge'),
):
  """Upload and save a file (PDF for knowledge, DOCX for template)."""
  try:
    content = await file.read()
    from utils.file_handler import save_uploaded_file
    result = save_uploaded_file(
      file_bytes=content,
      original_filename=file.filename or 'unnamed',
      project_id=project_id,
      purpose=purpose,
    )
    return {'status': 'success', **result}
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
  except Exception as e:
    logger.error('File upload failed: %s', str(e))
    raise HTTPException(status_code=500, detail=f'Upload failed: {str(e)}')


if __name__ == '__main__':
  import uvicorn
  port = int(os.getenv('PYTHON_SERVICE_PORT', '9000'))
  uvicorn.run('main:app', host='0.0.0.0', port=port, reload=True)
