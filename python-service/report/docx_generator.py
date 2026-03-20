"""
DOCX Report Generator — Generates formal DOCX reports from templates using
python-docx-template + Jinja2 rendering.
"""
import os
import logging
import json
from datetime import datetime
from typing import Optional

from docxtpl import DocxTemplate

logger = logging.getLogger(__name__)


def generate_report_from_template(
  template_path: str,
  output_path: str,
  context: dict,
) -> dict:
  """
  Generate a DOCX report by filling a Jinja2 template with data.

  Args:
    template_path: Path to the DOCX template file containing Jinja2 tags.
    output_path: Path to save the generated DOCX file.
    context: Dictionary of variables to fill into the template.

  Returns:
    Dict with output path, file size, and generation info.
  """
  if not os.path.exists(template_path):
    raise FileNotFoundError(f'Template not found: {template_path}')

  # Ensure output directory exists
  output_dir = os.path.dirname(output_path)
  if output_dir:
    os.makedirs(output_dir, exist_ok=True)

  # Enrich context with metadata
  enriched_context = {
    **context,
    'generated_at': datetime.now().strftime('%d %B %Y, %H:%M'),
    'generated_date': datetime.now().strftime('%d/%m/%Y'),
    'generated_year': datetime.now().strftime('%Y'),
  }

  doc = DocxTemplate(template_path)
  doc.render(enriched_context)
  doc.save(output_path)

  file_size = os.path.getsize(output_path)

  logger.info('Report generated: %s (%d bytes)', output_path, file_size)

  return {
    'output_path': output_path,
    'file_size': file_size,
    'template_used': os.path.basename(template_path),
    'generated_at': enriched_context['generated_at'],
  }


def generate_report_from_analysis(
  template_path: str,
  output_path: str,
  analysis_data: dict,
  project_name: str,
  report_name: str,
) -> dict:
  """
  Generate a DOCX report from analysis data.
  Maps analysis results to template context variables.

  Args:
    template_path: Path to DOCX template.
    output_path: Path to save output.
    analysis_data: Analysis results from data_analyzer.
    project_name: Name of the project.
    report_name: Name of the report.

  Returns:
    Generation result dict.
  """
  context = _build_report_context(analysis_data, project_name, report_name)
  return generate_report_from_template(template_path, output_path, context)


def _build_report_context(
  analysis_data: dict,
  project_name: str,
  report_name: str,
) -> dict:
  """Build template context from analysis data."""
  stats = analysis_data.get('statistics', {})
  columns = stats.get('columns', {})
  sentiment = analysis_data.get('sentiment', {})
  overall_sentiment = sentiment.get('overall', {})
  themes = analysis_data.get('themes', [])
  findings = analysis_data.get('key_findings', [])
  recommendations = analysis_data.get('recommendations', [])

  # Build analysis items for template iteration
  hasil_analisis = []
  for col_name, col_stats in columns.items():
    item = {
      'aspek': col_name,
      'tipe': col_stats.get('type', 'text'),
    }

    if col_stats.get('type') == 'number':
      item['skor_rata_rata'] = col_stats.get('mean', 0)
      item['nilai_min'] = col_stats.get('min', 0)
      item['nilai_max'] = col_stats.get('max', 0)
      item['std_deviasi'] = col_stats.get('std', 0)
      item['kesimpulan'] = _generate_column_conclusion(col_name, col_stats)
    elif col_stats.get('type') == 'category':
      item['modus'] = col_stats.get('mode', '')
      dist = col_stats.get('distribution', {})
      item['distribusi'] = [
        {'kategori': k, 'jumlah': v['count'], 'persentase': v['percentage']}
        for k, v in dist.items()
      ]
      item['kesimpulan'] = _generate_column_conclusion(col_name, col_stats)

    hasil_analisis.append(item)

  return {
    'nama_survey': project_name,
    'nama_laporan': report_name,
    'periode': datetime.now().strftime('%B %Y'),
    'total_responden': analysis_data.get('record_count', 0),
    'ringkasan': analysis_data.get('summary', ''),
    'hasil_analisis': hasil_analisis,
    'sentimen_positif': overall_sentiment.get('distribution', {}).get('positive', 0),
    'sentimen_netral': overall_sentiment.get('distribution', {}).get('neutral', 0),
    'sentimen_negatif': overall_sentiment.get('distribution', {}).get('negative', 0),
    'tema_utama': [t['theme'] for t in themes[:10]],
    'temuan_kunci': findings,
    'rekomendasi': recommendations if recommendations else [
      'Lakukan survey lanjutan untuk validasi temuan.',
      'Tindak lanjuti temuan negatif dengan perbaikan layanan.',
      'Pertahankan aspek-aspek yang mendapat respon positif.',
    ],
  }


def _generate_column_conclusion(col_name: str, col_stats: dict) -> str:
  """Generate a textual conclusion for a specific column analysis."""
  col_type = col_stats.get('type', '')

  if col_type == 'number':
    mean = col_stats.get('mean', 0)
    max_val = col_stats.get('max', 0)
    if max_val > 0:
      ratio = mean / max_val
      if ratio >= 0.8:
        return f'{col_name} menunjukkan nilai yang sangat baik (rata-rata {mean}).'
      elif ratio >= 0.6:
        return f'{col_name} menunjukkan nilai yang cukup baik (rata-rata {mean}).'
      else:
        return f'{col_name} memerlukan perhatian lebih (rata-rata {mean}).'
    return f'Rata-rata {col_name}: {mean}.'

  elif col_type == 'category':
    mode = col_stats.get('mode', '')
    unique = col_stats.get('unique_values', 0)
    return f'Kategori terbanyak: {mode} ({unique} kategori unik).'

  return ''


def get_template_variables(template_path: str) -> list[str]:
  """
  Extract Jinja2 variable names from a DOCX template.

  Args:
    template_path: Path to the DOCX template.

  Returns:
    List of variable names found in the template.
  """
  if not os.path.exists(template_path):
    raise FileNotFoundError(f'Template not found: {template_path}')

  doc = DocxTemplate(template_path)
  variables = doc.get_undeclared_template_variables()
  return sorted(list(variables))
