/**
 * Activity logging utility — writes to activity_log table via raw SQL.
 */
import { query } from './db.js';
import { logger } from './logger.js';

export type ActivityType = 'upload' | 'process' | 'report' | 'chat' | 'error';

/**
 * Log a user or system activity to the activity_log table.
 */
export async function logActivity(
  projectId: string,
  action: string,
  details?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_log (project_id, action, details) VALUES ($1, $2, $3)`,
      [projectId, action, details ? JSON.stringify({ description: details }) : null]
    );
  } catch (e) {
    logger.warn({ error: e }, 'Failed to log activity');
  }
}
