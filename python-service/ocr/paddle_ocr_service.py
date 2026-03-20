"""
PaddleOCR Service — Extracts text from images using PaddleOCR.
Supports multiple languages (Indonesian + English by default).
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-loaded PaddleOCR instance
_ocr_instance = None


def _get_ocr_instance():
  """Lazy-initialize PaddleOCR to avoid slow startup."""
  global _ocr_instance
  if _ocr_instance is None:
    from paddleocr import PaddleOCR
    _ocr_instance = PaddleOCR(
      use_angle_cls=True,
      lang='id',
      show_log=False,
      use_gpu=False,
    )
  return _ocr_instance


def extract_text_from_image(image_path: str) -> str:
  """
  Extract text from a single image file using PaddleOCR.

  Args:
    image_path: Path to the image file.

  Returns:
    Extracted text as a single string.
  """
  if not os.path.exists(image_path):
    raise FileNotFoundError(f'Image file not found: {image_path}')

  ocr = _get_ocr_instance()
  result = ocr.ocr(image_path, cls=True)

  lines = []
  if result and result[0]:
    for line_info in result[0]:
      text = line_info[1][0]
      confidence = line_info[1][1]
      if confidence >= 0.5:
        lines.append(text)

  return '\n'.join(lines)


def extract_text_from_image_bytes(image_bytes: bytes) -> str:
  """
  Extract text from image bytes using PaddleOCR.

  Args:
    image_bytes: Raw image bytes.

  Returns:
    Extracted text as a single string.
  """
  import tempfile
  with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
    tmp.write(image_bytes)
    tmp_path = tmp.name

  try:
    return extract_text_from_image(tmp_path)
  finally:
    os.unlink(tmp_path)


def get_ocr_confidence(image_path: str) -> list[dict]:
  """
  Get detailed OCR results with confidence scores per line.

  Args:
    image_path: Path to the image file.

  Returns:
    List of dicts with 'text', 'confidence', and 'bbox' keys.
  """
  ocr = _get_ocr_instance()
  result = ocr.ocr(image_path, cls=True)

  details = []
  if result and result[0]:
    for line_info in result[0]:
      bbox = line_info[0]
      text = line_info[1][0]
      confidence = line_info[1][1]
      details.append({
        'text': text,
        'confidence': round(confidence, 4),
        'bbox': bbox,
      })

  return details
