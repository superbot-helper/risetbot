"""OCR module — PaddleOCR service and PDF parser."""
from .paddle_ocr_service import extract_text_from_image, extract_text_from_image_bytes
from .pdf_parser import extract_text_from_pdf, extract_text_from_pdf_bytes, get_pdf_metadata
