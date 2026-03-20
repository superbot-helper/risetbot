"""Report module — DOCX report generation via Jinja2 templates."""
from .docx_generator import (
  generate_report_from_template,
  generate_report_from_analysis,
  get_template_variables,
)
