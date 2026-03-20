"""
Sentiment Analysis Module — Basic sentiment analysis for survey text data.
Uses keyword/pattern-based approach with LLM fallback.
"""
import logging
import os
import re
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Indonesian sentiment keyword dictionaries
POSITIVE_KEYWORDS = [
  'baik', 'bagus', 'puas', 'senang', 'memuaskan', 'cepat', 'ramah',
  'profesional', 'nyaman', 'bersih', 'efisien', 'mudah', 'membantu',
  'terima kasih', 'sangat baik', 'excellent', 'good', 'great', 'satisfied',
  'helpful', 'friendly', 'luar biasa', 'mantap', 'sempurna', 'positif',
]

NEGATIVE_KEYWORDS = [
  'buruk', 'jelek', 'lambat', 'lama', 'tidak puas', 'kurang', 'kecewa',
  'mengecewakan', 'kotor', 'sulit', 'rumit', 'mahal', 'tidak ramah',
  'tidak profesional', 'bad', 'poor', 'terrible', 'slow', 'disappointed',
  'kasar', 'payah', 'parah', 'negatif', 'ribet',
]


def analyze_sentiment_basic(texts: list[str]) -> dict:
  """
  Perform basic keyword-based sentiment analysis on a list of texts.

  Args:
    texts: List of text strings to analyze.

  Returns:
    Aggregated sentiment results with per-text breakdown.
  """
  if not texts:
    return {
      'overall': {'positive': 0, 'neutral': 0, 'negative': 0},
      'distribution': {'positive': 0, 'neutral': 0, 'negative': 0},
      'details': [],
    }

  results = []
  counts = {'positive': 0, 'neutral': 0, 'negative': 0}

  for text in texts:
    sentiment = _classify_text(text)
    results.append({
      'text': text[:200],
      'sentiment': sentiment['label'],
      'score': sentiment['score'],
    })
    counts[sentiment['label']] += 1

  total = len(texts)
  distribution = {
    'positive': round(counts['positive'] / total * 100, 1),
    'neutral': round(counts['neutral'] / total * 100, 1),
    'negative': round(counts['negative'] / total * 100, 1),
  }

  return {
    'overall': counts,
    'distribution': distribution,
    'total_analyzed': total,
    'details': results[:50],  # Limit detailed results
  }


def _classify_text(text: str) -> dict:
  """
  Classify a single text's sentiment using keyword matching.

  Args:
    text: Text to classify.

  Returns:
    Dict with 'label' and 'score'.
  """
  if not text or not text.strip():
    return {'label': 'neutral', 'score': 0.0}

  lower_text = text.lower()

  pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in lower_text)
  neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in lower_text)

  total_keywords = pos_count + neg_count
  if total_keywords == 0:
    return {'label': 'neutral', 'score': 0.0}

  score = (pos_count - neg_count) / total_keywords

  if score > 0.2:
    return {'label': 'positive', 'score': round(score, 2)}
  elif score < -0.2:
    return {'label': 'negative', 'score': round(score, 2)}
  else:
    return {'label': 'neutral', 'score': round(score, 2)}


async def analyze_sentiment_llm(
  texts: list[str],
  api_key: Optional[str] = None,
  base_url: Optional[str] = None,
  model: Optional[str] = None,
) -> dict:
  """
  Perform LLM-based sentiment analysis for more accurate results.
  Falls back to basic keyword analysis if LLM is unavailable.

  Args:
    texts: List of text strings to analyze.
    api_key: LLM API key (defaults to env var).
    base_url: LLM API base URL (defaults to env var).
    model: Model name (defaults to env var).

  Returns:
    Sentiment analysis results.
  """
  _api_key = api_key or os.getenv('LLM_API_KEY', '')
  _base_url = base_url or os.getenv('LLM_BASE_URL', 'https://api.openai.com/v1')
  _model = model or os.getenv('LLM_MODEL', 'gpt-4o-mini')

  if not _api_key or _api_key.startswith('sk-your'):
    logger.info('LLM API key not configured, using basic sentiment analysis')
    return analyze_sentiment_basic(texts)

  # Batch texts into chunks to avoid token limits
  batch_size = 20
  all_results = []

  for i in range(0, len(texts), batch_size):
    batch = texts[i:i + batch_size]
    numbered_texts = '\n'.join(
      f'{j + 1}. "{t[:300]}"' for j, t in enumerate(batch)
    )

    prompt = f"""Analisis sentimen teks-teks berikut. Untuk setiap teks, tentukan sentimen (positive/neutral/negative) dan skor (-1.0 sampai 1.0).

{numbered_texts}

Jawab HANYA dalam format JSON array:
[{{"index": 1, "sentiment": "positive", "score": 0.8}}, ...]"""

    try:
      async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
          f'{_base_url}/chat/completions',
          headers={'Authorization': f'Bearer {_api_key}'},
          json={
            'model': _model,
            'messages': [
              {'role': 'system', 'content': 'You are a sentiment analysis expert for Indonesian survey data.'},
              {'role': 'user', 'content': prompt},
            ],
            'temperature': 0.1,
            'max_tokens': 2048,
          },
        )

        if response.status_code == 200:
          content = response.json()['choices'][0]['message']['content']
          import json
          # Extract JSON from response
          json_match = re.search(r'\[[\s\S]*\]', content)
          if json_match:
            batch_results = json.loads(json_match.group())
            for j, result in enumerate(batch_results):
              idx = i + j
              if idx < len(texts):
                all_results.append({
                  'text': texts[idx][:200],
                  'sentiment': result.get('sentiment', 'neutral'),
                  'score': result.get('score', 0.0),
                })
            continue
    except Exception as e:
      logger.warning('LLM sentiment analysis failed for batch %d: %s', i, str(e))

    # Fallback for this batch
    for t in batch:
      classified = _classify_text(t)
      all_results.append({
        'text': t[:200],
        'sentiment': classified['label'],
        'score': classified['score'],
      })

  # Aggregate results
  counts = {'positive': 0, 'neutral': 0, 'negative': 0}
  for r in all_results:
    counts[r['sentiment']] += 1

  total = len(all_results)
  distribution = {
    'positive': round(counts['positive'] / total * 100, 1) if total > 0 else 0,
    'neutral': round(counts['neutral'] / total * 100, 1) if total > 0 else 0,
    'negative': round(counts['negative'] / total * 100, 1) if total > 0 else 0,
  }

  return {
    'overall': counts,
    'distribution': distribution,
    'total_analyzed': total,
    'method': 'llm',
    'details': all_results[:50],
  }
