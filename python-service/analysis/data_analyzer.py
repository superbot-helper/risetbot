"""
Data Analyzer — Main orchestration module for survey data analysis.
Combines statistics, sentiment, and theme analysis into unified results.
"""
import logging
from typing import Optional

import pandas as pd

from .statistics import compute_descriptive_stats, compute_cross_tabulation
from .sentiment import analyze_sentiment_basic, analyze_sentiment_llm

logger = logging.getLogger(__name__)


async def analyze_survey_data(
  data: list[dict],
  schema_columns: list[dict],
  options: Optional[dict] = None,
) -> dict:
  """
  Perform comprehensive analysis on survey data.

  Args:
    data: List of row dicts from extracted survey data.
    schema_columns: Schema columns defining data structure.
    options: Analysis options (include_statistics, include_sentiment, include_themes).

  Returns:
    Complete analysis result dict.
  """
  opts = options or {}
  include_stats = opts.get('include_statistics', True)
  include_sentiment = opts.get('include_sentiment', True)
  include_themes = opts.get('include_themes', True)

  result = {
    'record_count': len(data),
    'summary': '',
    'statistics': {},
    'sentiment': {},
    'themes': [],
    'key_findings': [],
    'recommendations': [],
  }

  if not data:
    result['summary'] = 'Tidak ada data untuk dianalisis.'
    return result

  # Descriptive statistics
  if include_stats:
    result['statistics'] = compute_descriptive_stats(data, schema_columns)

  # Sentiment analysis on text/comment columns
  if include_sentiment:
    text_columns = [
      col['name'] for col in schema_columns
      if col.get('type') in ('text',) and col['name'] in data[0]
    ]
    result['sentiment'] = await _analyze_text_sentiments(data, text_columns)

  # Theme extraction
  if include_themes:
    text_columns = [
      col['name'] for col in schema_columns
      if col.get('type') in ('text',) and col['name'] in data[0]
    ]
    result['themes'] = _extract_themes(data, text_columns)

  # Key findings
  result['key_findings'] = _generate_key_findings(result)

  # Summary
  result['summary'] = _generate_summary(result, len(data))

  return result


async def _analyze_text_sentiments(
  data: list[dict],
  text_columns: list[str],
) -> dict:
  """Analyze sentiment for all text columns."""
  sentiments = {}

  for col_name in text_columns:
    texts = [
      str(row.get(col_name, '')).strip()
      for row in data
      if row.get(col_name) and str(row[col_name]).strip()
    ]

    if not texts:
      continue

    sentiments[col_name] = analyze_sentiment_basic(texts)

  # Overall sentiment across all text columns
  all_texts = []
  for col_name in text_columns:
    for row in data:
      val = row.get(col_name)
      if val and str(val).strip():
        all_texts.append(str(val).strip())

  if all_texts:
    sentiments['overall'] = analyze_sentiment_basic(all_texts)

  return sentiments


def _extract_themes(data: list[dict], text_columns: list[str]) -> list[dict]:
  """
  Extract common themes from text data using word frequency analysis.

  Args:
    data: Survey data rows.
    text_columns: Column names containing text data.

  Returns:
    List of theme dicts with 'theme', 'count', 'percentage'.
  """
  # Common Indonesian stopwords to filter out
  stopwords = {
    'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk',
    'pada', 'adalah', 'dalam', 'tidak', 'juga', 'ada', 'akan', 'sudah',
    'saya', 'kami', 'mereka', 'bisa', 'lebih', 'sangat', 'masih', 'harus',
    'kalau', 'karena', 'oleh', 'atau', 'tetapi', 'namun', 'tersebut',
    'saat', 'agar', 'bagi', 'secara', 'semua', 'telah', 'belum', 'lagi',
    'seperti', 'the', 'and', 'is', 'are', 'was', 'were', 'be', 'to',
    'of', 'in', 'for', 'on', 'with', 'a', 'an', 'it', 'this', 'that',
  }

  word_freq = {}
  total_docs = 0

  for row in data:
    for col_name in text_columns:
      text = str(row.get(col_name, '')).strip().lower()
      if not text:
        continue
      total_docs += 1

      import re
      words = re.findall(r'[a-zA-Z\u00C0-\u024F]+', text)
      seen_in_doc = set()

      for word in words:
        if len(word) < 3 or word in stopwords:
          continue
        if word not in seen_in_doc:
          word_freq[word] = word_freq.get(word, 0) + 1
          seen_in_doc.add(word)

  if not word_freq or total_docs == 0:
    return []

  # Get top themes by document frequency
  sorted_themes = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
  themes = []

  for word, count in sorted_themes[:15]:
    themes.append({
      'theme': word.capitalize(),
      'count': count,
      'percentage': round(count / total_docs * 100, 1),
    })

  return themes


def _generate_key_findings(analysis: dict) -> list[str]:
  """Generate key findings from analysis results."""
  findings = []

  stats = analysis.get('statistics', {})
  columns = stats.get('columns', {})

  for col_name, col_stats in columns.items():
    col_type = col_stats.get('type', '')

    if col_type == 'number':
      mean_val = col_stats.get('mean')
      if mean_val is not None:
        findings.append(f'Rata-rata {col_name}: {mean_val}')

    elif col_type == 'category':
      mode = col_stats.get('mode')
      if mode:
        findings.append(f'Kategori terbanyak untuk {col_name}: {mode}')

  # Sentiment findings
  sentiment = analysis.get('sentiment', {})
  overall = sentiment.get('overall', {})
  dist = overall.get('distribution', {})
  if dist:
    dominant = max(dist, key=dist.get)
    findings.append(
      f'Sentimen dominan: {dominant} ({dist[dominant]}%)'
    )

  # Theme findings
  themes = analysis.get('themes', [])
  if themes:
    top_themes = [t['theme'] for t in themes[:5]]
    findings.append(f'Tema utama: {", ".join(top_themes)}')

  return findings


def _generate_summary(analysis: dict, record_count: int) -> str:
  """Generate executive summary from analysis results."""
  parts = [f'Analisis dilakukan terhadap {record_count} record data survey.']

  stats = analysis.get('statistics', {})
  cols = stats.get('columns', {})
  numeric_cols = [
    (name, s) for name, s in cols.items()
    if s.get('type') == 'number'
  ]

  if numeric_cols:
    for name, s in numeric_cols:
      parts.append(
        f'{name}: rata-rata {s.get("mean", "N/A")}, '
        f'rentang {s.get("min", "N/A")} - {s.get("max", "N/A")}.'
      )

  sentiment = analysis.get('sentiment', {})
  overall = sentiment.get('overall', {})
  dist = overall.get('distribution', {})
  if dist:
    parts.append(
      f'Sentimen: {dist.get("positive", 0)}% positif, '
      f'{dist.get("neutral", 0)}% netral, '
      f'{dist.get("negative", 0)}% negatif.'
    )

  themes = analysis.get('themes', [])
  if themes:
    top = [t['theme'] for t in themes[:3]]
    parts.append(f'Tema-tema yang sering muncul: {", ".join(top)}.')

  return ' '.join(parts)
