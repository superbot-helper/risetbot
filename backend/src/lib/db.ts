/**
 * Database connection pool using pg.
 * Replaces @workspace/db with direct PostgreSQL access.
 */
import pg, { type QueryResultRow } from "pg";
import dotenv from "dotenv";
import { logger } from "./logger.js";

dotenv.config({ path: "../.env" });

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@localhost:5432/risetbot",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected database error");
});

/**
 * Execute a parameterized query.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Execute a query and return only the rows.
 */
export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/**
 * Execute a query and return the first row or null.
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
): Promise<T | null> {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}

/**
 * Check database connectivity.
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure newer application columns/tables exist even on older databases.
 * This keeps runtime compatible without forcing a full schema reset.
 */
export async function ensureDatabaseCompatibility(): Promise<void> {
  const statements = [
    // App compatibility columns
    `ALTER TABLE schemas ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE templates ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`,
    `ALTER TABLE templates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1`,
    `ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS source_ids JSONB`,

    // Observability tables
    `
      CREATE TABLE IF NOT EXISTS agent_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        trace_id UUID,
        observation_id UUID,
        agent_name VARCHAR(100) NOT NULL,
        operation VARCHAR(100) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'running',
        latency_ms INTEGER,
        input_payload JSONB,
        output_summary JSONB,
        metadata JSONB,
        error_message TEXT,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS llm_request_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        trace_id UUID,
        observation_id UUID,
        agent_name VARCHAR(100),
        model VARCHAR(150) NOT NULL,
        provider VARCHAR(100) DEFAULT 'openai-compatible',
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        latency_ms INTEGER,
        success BOOLEAN DEFAULT TRUE,
        request_payload JSONB,
        response_payload JSONB,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_agent_runs_project ON agent_runs(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_runs_trace ON agent_runs(trace_id)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_name)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_llm_request_log_project ON llm_request_log(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_llm_request_log_trace ON llm_request_log(trace_id)`,
    `CREATE INDEX IF NOT EXISTS idx_llm_request_log_agent ON llm_request_log(agent_name)`,
    `CREATE INDEX IF NOT EXISTS idx_llm_request_log_created_at ON llm_request_log(created_at)`,
  ];

  for (const statement of statements) {
    await query(statement);
  }

  const triggerStatements = [
    `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'set_templates_updated_at'
        ) THEN
          CREATE TRIGGER set_templates_updated_at
            BEFORE UPDATE ON templates
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END
      $$;
    `,
    `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'set_reports_updated_at'
        ) THEN
          CREATE TRIGGER set_reports_updated_at
            BEFORE UPDATE ON reports
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END
      $$;
    `,
  ];

  for (const statement of triggerStatements) {
    await query(statement);
  }

  logger.info("Database compatibility bootstrap completed");
}
