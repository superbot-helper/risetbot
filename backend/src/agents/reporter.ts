/**
 * Reporter Agent — Generates DOCX reports from analysis data.
 * Connects to Python service for template-based Jinja2 report generation.
 * Falls back to LLM-generated text report when Python service unavailable.
 */
import { generateDocxReport, type ReportResult } from '../lib/pythonService.js';
import { reporterAgent as llmReporterAgent } from '../lib/agents.js';
import { logger } from '../lib/logger.js';

/**
 * Generate a formal report from analysis data.
 * Priority: Python DOCX template → LLM text report fallback.
 *
 * @param templatePath - Path to DOCX template (if available).
 * @param analysisData - Analysis results from Analyst Agent.
 * @param projectName - Project name.
 * @param reportName - Report name.
 * @returns Report generation result.
 */
export async function generateReport(
  templatePath: string | undefined,
  analysisData: Record<string, unknown>,
  projectName: string,
  reportName: string
): Promise<Record<string, unknown>> {
  logger.info(
    { projectName, reportName },
    'Reporter: Starting report generation'
  );

  // Try Python service DOCX generation first
  if (templatePath) {
    try {
      const outputPath = `reports/${projectName.replace(/[^a-z0-9]/gi, '_')}/${reportName.replace(/[^a-z0-9]/gi, '_')}.docx`;

      const result = await generateDocxReport(
        templatePath,
        outputPath,
        analysisData,
        projectName,
        reportName,
      );

      logger.info(
        { outputPath: result.output_path, fileSize: result.file_size },
        'Reporter: DOCX report generated via Python service'
      );

      return {
        ...analysisData,
        reportType: 'docx',
        reportPath: result.output_path,
        fileSize: result.file_size,
        templateUsed: result.template_used,
        generatedAt: result.generated_at,
      };
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Reporter: Python DOCX generation failed, falling back to LLM text report'
      );
    }
  }

  // Fallback: LLM-generated text report
  const reportContent = await llmReporterAgent(analysisData, projectName, reportName);

  logger.info('Reporter: LLM text report generated');

  return {
    ...analysisData,
    reportContent,
    reportType: 'text',
    generatedAt: new Date().toISOString(),
  };
}
