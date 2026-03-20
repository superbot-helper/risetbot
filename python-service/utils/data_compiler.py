"""
Data Compiler — Export survey data to CSV/XLSX formats using Pandas + openpyxl.
"""
import os
import io
import logging
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)


def compile_to_csv(
  data: list[dict],
  output_path: Optional[str] = None,
) -> dict:
  """
  Compile survey data rows into a CSV file or return as string.

  Args:
    data: List of row dicts.
    output_path: If provided, save to file; otherwise return CSV string.

  Returns:
    Dict with 'csv_content' (str) and optionally 'file_path'.
  """
  if not data:
    return {'csv_content': '', 'row_count': 0}

  df = pd.DataFrame(data)
  # Remove internal columns
  internal_cols = [c for c in df.columns if c.startswith('_')]
  df = df.drop(columns=internal_cols, errors='ignore')

  csv_content = df.to_csv(index=False, encoding='utf-8-sig')

  result = {
    'csv_content': csv_content,
    'row_count': len(df),
    'column_count': len(df.columns),
    'columns': df.columns.tolist(),
  }

  if output_path:
    output_dir = os.path.dirname(output_path)
    if output_dir:
      os.makedirs(output_dir, exist_ok=True)
    df.to_csv(output_path, index=False, encoding='utf-8-sig')
    result['file_path'] = output_path
    result['file_size'] = os.path.getsize(output_path)

  return result


def compile_to_xlsx(
  data: list[dict],
  output_path: str,
  sheet_name: str = 'Survey Data',
) -> dict:
  """
  Compile survey data rows into an XLSX file.

  Args:
    data: List of row dicts.
    output_path: Path to save the XLSX file.
    sheet_name: Name of the worksheet.

  Returns:
    Dict with file info.
  """
  if not data:
    return {'file_path': output_path, 'row_count': 0}

  df = pd.DataFrame(data)
  internal_cols = [c for c in df.columns if c.startswith('_')]
  df = df.drop(columns=internal_cols, errors='ignore')

  output_dir = os.path.dirname(output_path)
  if output_dir:
    os.makedirs(output_dir, exist_ok=True)

  with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
    df.to_excel(writer, sheet_name=sheet_name, index=False)

    # Auto-adjust column widths
    worksheet = writer.sheets[sheet_name]
    for col_idx, column in enumerate(df.columns, 1):
      max_length = max(
        df[column].astype(str).map(len).max(),
        len(str(column)),
      )
      adjusted_width = min(max_length + 4, 50)
      worksheet.column_dimensions[
        worksheet.cell(row=1, column=col_idx).column_letter
      ].width = adjusted_width

  return {
    'file_path': output_path,
    'file_size': os.path.getsize(output_path),
    'row_count': len(df),
    'column_count': len(df.columns),
    'columns': df.columns.tolist(),
    'sheet_name': sheet_name,
  }


def compile_to_xlsx_bytes(
  data: list[dict],
  sheet_name: str = 'Survey Data',
) -> bytes:
  """
  Compile survey data to XLSX and return as bytes (for HTTP response).

  Args:
    data: List of row dicts.
    sheet_name: Name of the worksheet.

  Returns:
    XLSX file content as bytes.
  """
  if not data:
    return b''

  df = pd.DataFrame(data)
  internal_cols = [c for c in df.columns if c.startswith('_')]
  df = df.drop(columns=internal_cols, errors='ignore')

  buffer = io.BytesIO()
  with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
    df.to_excel(writer, sheet_name=sheet_name, index=False)

    worksheet = writer.sheets[sheet_name]
    for col_idx, column in enumerate(df.columns, 1):
      max_length = max(
        df[column].astype(str).map(len).max(),
        len(str(column)),
      )
      adjusted_width = min(max_length + 4, 50)
      worksheet.column_dimensions[
        worksheet.cell(row=1, column=col_idx).column_letter
      ].width = adjusted_width

  return buffer.getvalue()


def compile_multi_sheet_xlsx(
  datasets: dict[str, list[dict]],
  output_path: str,
) -> dict:
  """
  Compile multiple datasets into separate sheets of one XLSX file.

  Args:
    datasets: Dict mapping sheet names to row data lists.
    output_path: Path to save the XLSX file.

  Returns:
    File info dict.
  """
  output_dir = os.path.dirname(output_path)
  if output_dir:
    os.makedirs(output_dir, exist_ok=True)

  total_rows = 0
  sheet_info = []

  with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
    for sheet_name, data in datasets.items():
      if not data:
        continue

      df = pd.DataFrame(data)
      internal_cols = [c for c in df.columns if c.startswith('_')]
      df = df.drop(columns=internal_cols, errors='ignore')

      # Truncate sheet name to Excel max (31 chars)
      safe_name = sheet_name[:31]
      df.to_excel(writer, sheet_name=safe_name, index=False)
      total_rows += len(df)

      sheet_info.append({
        'name': safe_name,
        'rows': len(df),
        'columns': len(df.columns),
      })

  return {
    'file_path': output_path,
    'file_size': os.path.getsize(output_path),
    'total_rows': total_rows,
    'sheets': sheet_info,
  }
