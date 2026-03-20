"""
Statistics Module — Descriptive statistics computation using Pandas.
Handles numeric, categorical, and date-type columns.
"""
import logging
from typing import Any

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


def compute_descriptive_stats(data: list[dict], schema_columns: list[dict]) -> dict:
  """
  Compute descriptive statistics for survey data based on schema.

  Args:
    data: List of row dicts from extracted survey data.
    schema_columns: Schema columns with 'name', 'type', 'aiGuidance'.

  Returns:
    Dict with per-column statistics.
  """
  if not data:
    return {'error': 'No data provided', 'columns': {}}

  df = pd.DataFrame(data)
  stats = {}

  for col_def in schema_columns:
    col_name = col_def.get('name', '')
    col_type = col_def.get('type', 'text')

    if col_name not in df.columns:
      continue

    series = df[col_name].dropna()
    if series.empty:
      stats[col_name] = {'count': 0, 'missing': len(df)}
      continue

    if col_type == 'number':
      stats[col_name] = _numeric_stats(series, len(df))
    elif col_type == 'category':
      stats[col_name] = _category_stats(series, len(df))
    elif col_type == 'date':
      stats[col_name] = _date_stats(series, len(df))
    elif col_type == 'boolean':
      stats[col_name] = _boolean_stats(series, len(df))
    else:
      stats[col_name] = _text_stats(series, len(df))

  return {
    'total_records': len(df),
    'columns': stats,
  }


def _numeric_stats(series: pd.Series, total: int) -> dict:
  """Compute statistics for numeric columns."""
  numeric = pd.to_numeric(series, errors='coerce').dropna()
  if numeric.empty:
    return {'count': 0, 'missing': total, 'type': 'number'}

  return {
    'type': 'number',
    'count': int(len(numeric)),
    'missing': int(total - len(numeric)),
    'min': round(float(numeric.min()), 2),
    'max': round(float(numeric.max()), 2),
    'mean': round(float(numeric.mean()), 2),
    'median': round(float(numeric.median()), 2),
    'std': round(float(numeric.std()), 2),
    'q1': round(float(numeric.quantile(0.25)), 2),
    'q3': round(float(numeric.quantile(0.75)), 2),
  }


def _category_stats(series: pd.Series, total: int) -> dict:
  """Compute frequency distribution for category columns."""
  counts = series.value_counts()
  return {
    'type': 'category',
    'count': int(len(series)),
    'missing': int(total - len(series)),
    'unique_values': int(counts.nunique()),
    'distribution': {
      str(k): {
        'count': int(v),
        'percentage': round(float(v / len(series) * 100), 1),
      }
      for k, v in counts.items()
    },
    'mode': str(counts.index[0]) if not counts.empty else None,
  }


def _date_stats(series: pd.Series, total: int) -> dict:
  """Compute date range statistics."""
  dates = pd.to_datetime(series, errors='coerce').dropna()
  if dates.empty:
    return {'count': 0, 'missing': total, 'type': 'date'}

  return {
    'type': 'date',
    'count': int(len(dates)),
    'missing': int(total - len(dates)),
    'earliest': str(dates.min().date()),
    'latest': str(dates.max().date()),
    'range_days': int((dates.max() - dates.min()).days),
  }


def _boolean_stats(series: pd.Series, total: int) -> dict:
  """Compute boolean distribution."""
  bool_series = series.map(
    lambda x: True if str(x).lower() in ('true', 'yes', '1', 'ya') else False
  )
  true_count = int(bool_series.sum())
  return {
    'type': 'boolean',
    'count': int(len(series)),
    'missing': int(total - len(series)),
    'true_count': true_count,
    'false_count': int(len(series) - true_count),
    'true_percentage': round(float(true_count / len(series) * 100), 1) if len(series) > 0 else 0,
  }


def _text_stats(series: pd.Series, total: int) -> dict:
  """Compute text column statistics."""
  text_series = series.astype(str)
  lengths = text_series.str.len()

  return {
    'type': 'text',
    'count': int(len(series)),
    'missing': int(total - len(series)),
    'unique_values': int(text_series.nunique()),
    'avg_length': round(float(lengths.mean()), 1) if not lengths.empty else 0,
    'min_length': int(lengths.min()) if not lengths.empty else 0,
    'max_length': int(lengths.max()) if not lengths.empty else 0,
  }


def compute_cross_tabulation(
  data: list[dict],
  row_column: str,
  col_column: str,
) -> dict:
  """
  Compute cross-tabulation between two categorical columns.

  Args:
    data: Survey data rows.
    row_column: Column name for rows.
    col_column: Column name for columns.

  Returns:
    Cross-tabulation matrix as a nested dict.
  """
  df = pd.DataFrame(data)
  if row_column not in df.columns or col_column not in df.columns:
    return {'error': f'Column(s) not found: {row_column}, {col_column}'}

  ct = pd.crosstab(df[row_column], df[col_column])
  return {
    'index': ct.index.tolist(),
    'columns': ct.columns.tolist(),
    'values': ct.values.tolist(),
    'row_totals': ct.sum(axis=1).tolist(),
    'col_totals': ct.sum(axis=0).tolist(),
  }
