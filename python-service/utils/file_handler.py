"""
File Handler — Manages file uploads, validation, and cleanup for RisetBot.
"""
import os
import uuid
import shutil
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SERVICE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Allowed file extensions per purpose
ALLOWED_EXTENSIONS = {
  'knowledge': {'.pdf'},
  'template': {'.docx'},
}

# Max file sizes (in bytes)
MAX_FILE_SIZES = {
  'knowledge': 50 * 1024 * 1024,  # 50 MB
  'template': 10 * 1024 * 1024,   # 10 MB
}


def get_upload_dir() -> str:
  """Get the configured upload directory."""
  return _resolve_storage_dir('UPLOAD_DIR', 'uploads')


def get_report_dir() -> str:
  """Get the configured reports directory."""
  return _resolve_storage_dir('REPORT_DIR', 'reports')


def get_template_dir() -> str:
  """Get the configured templates directory."""
  return _resolve_storage_dir('TEMPLATE_DIR', 'templates')


def _resolve_storage_dir(env_var: str, default_subdir: str) -> str:
  """Resolve storage dir to an absolute path rooted at python-service."""
  configured = os.getenv(env_var, '').strip()
  if configured:
    if os.path.isabs(configured):
      return configured
    return os.path.normpath(os.path.join(SERVICE_ROOT, configured))

  return os.path.join(SERVICE_ROOT, default_subdir)


def validate_file(
  filename: str,
  file_size: int,
  purpose: str = 'knowledge',
) -> dict:
  """
  Validate a file's extension and size.

  Args:
    filename: Original filename.
    file_size: File size in bytes.
    purpose: 'knowledge' (PDF) or 'template' (DOCX).

  Returns:
    Dict with 'valid' bool, 'error' message if invalid.
  """
  ext = os.path.splitext(filename)[1].lower()
  allowed = ALLOWED_EXTENSIONS.get(purpose, set())
  max_size = MAX_FILE_SIZES.get(purpose, 50 * 1024 * 1024)

  if ext not in allowed:
    return {
      'valid': False,
      'error': f'File type "{ext}" not allowed. Allowed: {", ".join(allowed)}',
    }

  if file_size > max_size:
    return {
      'valid': False,
      'error': f'File too large ({file_size / 1024 / 1024:.1f} MB). Max: {max_size / 1024 / 1024:.0f} MB',
    }

  return {'valid': True}


def save_uploaded_file(
  file_bytes: bytes,
  original_filename: str,
  project_id: str,
  purpose: str = 'knowledge',
) -> dict:
  """
  Save an uploaded file to the appropriate directory.

  Args:
    file_bytes: Raw file content.
    original_filename: Original filename.
    project_id: Project UUID for subdirectory.
    purpose: 'knowledge' or 'template'.

  Returns:
    Dict with 'file_path', 'file_name', 'file_size'.
  """
  validation = validate_file(original_filename, len(file_bytes), purpose)
  if not validation['valid']:
    raise ValueError(validation['error'])

  if purpose == 'knowledge':
    base_dir = os.path.join(get_upload_dir(), project_id)
  elif purpose == 'template':
    base_dir = os.path.join(get_template_dir(), project_id)
  else:
    base_dir = os.path.join(get_upload_dir(), project_id)

  os.makedirs(base_dir, exist_ok=True)

  # Generate unique filename to avoid collisions
  ext = os.path.splitext(original_filename)[1]
  unique_name = f'{uuid.uuid4().hex[:8]}_{original_filename}'
  file_path = os.path.join(base_dir, unique_name)

  with open(file_path, 'wb') as f:
    f.write(file_bytes)

  logger.info('File saved: %s (%d bytes)', file_path, len(file_bytes))

  return {
    'file_path': file_path,
    'file_name': original_filename,
    'stored_name': unique_name,
    'file_size': len(file_bytes),
  }


def delete_file(file_path: str) -> bool:
  """
  Safely delete a file.

  Args:
    file_path: Path to the file to delete.

  Returns:
    True if successfully deleted, False otherwise.
  """
  try:
    if os.path.exists(file_path):
      os.remove(file_path)
      logger.info('File deleted: %s', file_path)
      return True
    logger.warning('File not found for deletion: %s', file_path)
    return False
  except Exception as e:
    logger.error('Failed to delete file %s: %s', file_path, str(e))
    return False


def cleanup_project_files(project_id: str) -> dict:
  """
  Remove all files associated with a project.

  Args:
    project_id: Project UUID.

  Returns:
    Dict with cleanup results.
  """
  removed = 0
  errors = 0

  dirs_to_clean = [
    os.path.join(get_upload_dir(), project_id),
    os.path.join(get_report_dir(), project_id),
    os.path.join(get_template_dir(), project_id),
  ]

  for dir_path in dirs_to_clean:
    if os.path.exists(dir_path):
      try:
        shutil.rmtree(dir_path)
        removed += 1
        logger.info('Cleaned project directory: %s', dir_path)
      except Exception as e:
        errors += 1
        logger.error('Failed to clean directory %s: %s', dir_path, str(e))

  return {
    'directories_removed': removed,
    'errors': errors,
    'project_id': project_id,
  }


def get_file_info(file_path: str) -> Optional[dict]:
  """
  Get metadata about a stored file.

  Args:
    file_path: Path to the file.

  Returns:
    Dict with file metadata or None if not found.
  """
  if not os.path.exists(file_path):
    return None

  stat = os.stat(file_path)
  return {
    'file_path': file_path,
    'file_name': os.path.basename(file_path),
    'file_size': stat.st_size,
    'modified_at': stat.st_mtime,
    'extension': os.path.splitext(file_path)[1].lower(),
  }


def ensure_directories() -> None:
  """Create all required storage directories if they don't exist."""
  dirs = [get_upload_dir(), get_report_dir(), get_template_dir()]
  for dir_path in dirs:
    os.makedirs(dir_path, exist_ok=True)
    logger.info('Ensured directory: %s', dir_path)
