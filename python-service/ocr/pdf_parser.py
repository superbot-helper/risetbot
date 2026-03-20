"""
PDF Parser — Extracts text from PDF files using PyMuPDF.
Falls back to PaddleOCR for scanned/image-based PDFs.
"""
import os
import logging
from typing import Optional

import fitz  # PyMuPDF

from .paddle_ocr_service import extract_text_from_image_bytes

logger = logging.getLogger(__name__)

# Minimum chars per page to consider text extraction successful
MIN_TEXT_THRESHOLD = 50


def extract_text_from_pdf(pdf_path: str) -> dict:
  """
  Extract text from a PDF file. Uses native text extraction first,
  then falls back to OCR for scanned pages.

  Args:
    pdf_path: Absolute path to the PDF file.

  Returns:
    Dict with 'text', 'page_count', 'method', and 'pages' keys.
  """
  if not os.path.exists(pdf_path):
    raise FileNotFoundError(f'PDF file not found: {pdf_path}')

  doc = fitz.open(pdf_path)
  pages = []
  full_text_parts = []
  methods_used = set()

  for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    page_text = page.get_text('text').strip()

    if len(page_text) >= MIN_TEXT_THRESHOLD:
      methods_used.add('native')
    else:
      logger.info(
        'Page %d has insufficient text (%d chars), using OCR',
        page_num + 1,
        len(page_text),
      )
      page_text = _ocr_page(page, page_num)
      methods_used.add('ocr')

    pages.append({
      'page_number': page_num + 1,
      'text': page_text,
      'char_count': len(page_text),
    })
    full_text_parts.append(page_text)

  doc.close()

  method = 'hybrid' if len(methods_used) > 1 else methods_used.pop() if methods_used else 'native'

  return {
    'text': '\n\n--- Page Break ---\n\n'.join(full_text_parts),
    'page_count': len(pages),
    'method': method,
    'pages': pages,
  }


def _ocr_page(page, page_num: int) -> str:
  """
  Render a PDF page to image and perform OCR.

  Args:
    page: PyMuPDF page object.
    page_num: Zero-based page index.

  Returns:
    OCR-extracted text from the rendered page.
  """
  try:
    # Render page at 300 DPI for good OCR quality
    mat = fitz.Matrix(300 / 72, 300 / 72)
    pix = page.get_pixmap(matrix=mat)
    image_bytes = pix.tobytes('png')
    return extract_text_from_image_bytes(image_bytes)
  except Exception as e:
    logger.error('OCR failed for page %d: %s', page_num + 1, str(e))
    return f'[OCR Error on page {page_num + 1}: {str(e)}]'


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> dict:
  """
  Extract text from PDF bytes (e.g., from uploaded file).

  Args:
    pdf_bytes: Raw PDF file bytes.

  Returns:
    Same format as extract_text_from_pdf().
  """
  import tempfile
  with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
    tmp.write(pdf_bytes)
    tmp_path = tmp.name

  try:
    return extract_text_from_pdf(tmp_path)
  finally:
    os.unlink(tmp_path)


def get_pdf_metadata(pdf_path: str) -> dict:
  """
  Extract metadata from a PDF file.

  Args:
    pdf_path: Path to the PDF file.

  Returns:
    Dict with PDF metadata fields.
  """
  doc = fitz.open(pdf_path)
  metadata = doc.metadata or {}
  page_count = len(doc)
  doc.close()

  return {
    'title': metadata.get('title', ''),
    'author': metadata.get('author', ''),
    'subject': metadata.get('subject', ''),
    'creator': metadata.get('creator', ''),
    'page_count': page_count,
  }
