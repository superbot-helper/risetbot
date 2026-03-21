-- ============================================
-- RisetBot Database Schema
-- Ref: docs/blueprint.md section 6
-- Extended for:
-- - knowledge file size tracking
-- - default schema selection
-- - report pipeline status/progress metadata
-- - observability for agent latency and LLM token usage
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Core Tables
-- ============================================

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Schemas (FK → projects)
CREATE TABLE IF NOT EXISTS schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  columns JSONB NOT NULL, -- [{name, type, aiGuidance, required}]
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Templates (FK → projects)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  is_default BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge / Survey Files (FK → projects, schemas)
CREATE TABLE IF NOT EXISTS knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  schema_id UUID REFERENCES schemas(id),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- pending, extracting, compiling, awaiting_confirmation, done, error
  extracted_data JSONB,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reports (FK → projects, templates)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id),
  name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- queued, collecting, analyzing, generating, done, error
  source_ids JSONB, -- [knowledge_id, ...]
  analysis_data JSONB, -- includes pipeline progress, verified facts, report metadata
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat History (FK → projects)
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  message TEXT NOT NULL,
  sources JSONB, -- [{file, page, section}]
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent Memory (Long-term, FK → projects)
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  memory_type VARCHAR(50) NOT NULL, -- 'analysis', 'pattern', 'preference'
  content JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Log (for dashboard recent activity)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Observability Tables
-- ============================================

-- Agent execution log
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  trace_id UUID,
  observation_id UUID,
  agent_name VARCHAR(100) NOT NULL,
  operation VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'running', -- running, success, error
  latency_ms INTEGER,
  input_payload JSONB,
  output_summary JSONB,
  metadata JSONB,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- LLM usage / token monitoring
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
);

-- ============================================
-- Backward-Compatible ALTERs
-- Safe to run on existing databases
-- ============================================

ALTER TABLE schemas
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE knowledge
  ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS source_ids JSONB;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ============================================
-- Indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);

CREATE INDEX IF NOT EXISTS idx_schemas_project ON schemas(project_id);
CREATE INDEX IF NOT EXISTS idx_schemas_default ON schemas(project_id, is_default);

CREATE INDEX IF NOT EXISTS idx_templates_project ON templates(project_id);
CREATE INDEX IF NOT EXISTS idx_templates_default ON templates(project_id, is_default);

CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_schema ON knowledge(schema_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_created_at ON knowledge(created_at);

CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_template ON reports(template_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON reports(updated_at);

CREATE INDEX IF NOT EXISTS idx_chat_history_project ON chat_history(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_memory_project ON agent_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(memory_type);

CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_runs_project ON agent_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_trace ON agent_runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at);

CREATE INDEX IF NOT EXISTS idx_llm_request_log_project ON llm_request_log(project_id);
CREATE INDEX IF NOT EXISTS idx_llm_request_log_trace ON llm_request_log(trace_id);
CREATE INDEX IF NOT EXISTS idx_llm_request_log_agent ON llm_request_log(agent_name);
CREATE INDEX IF NOT EXISTS idx_llm_request_log_model ON llm_request_log(model);
CREATE INDEX IF NOT EXISTS idx_llm_request_log_created_at ON llm_request_log(created_at);

-- ============================================
-- Updated_at trigger function
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers for tables with updated_at
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_projects_updated_at'
  ) THEN
    CREATE TRIGGER set_projects_updated_at
      BEFORE UPDATE ON projects
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_schemas_updated_at'
  ) THEN
    CREATE TRIGGER set_schemas_updated_at
      BEFORE UPDATE ON schemas
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_templates_updated_at'
  ) THEN
    CREATE TRIGGER set_templates_updated_at
      BEFORE UPDATE ON templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_knowledge_updated_at'
  ) THEN
    CREATE TRIGGER set_knowledge_updated_at
      BEFORE UPDATE ON knowledge
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_reports_updated_at'
  ) THEN
    CREATE TRIGGER set_reports_updated_at
      BEFORE UPDATE ON reports
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ============================================
-- Optional data integrity helpers
-- ============================================

-- Ensure only one default schema per project
CREATE OR REPLACE FUNCTION enforce_single_default_schema()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE schemas
    SET is_default = FALSE
    WHERE project_id = NEW.project_id
      AND id <> NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_single_default_schema'
  ) THEN
    CREATE TRIGGER set_single_default_schema
      BEFORE INSERT OR UPDATE ON schemas
      FOR EACH ROW EXECUTE FUNCTION enforce_single_default_schema();
  END IF;
END;
$$;

-- Ensure only one default template per project
CREATE OR REPLACE FUNCTION enforce_single_default_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE templates
    SET is_default = FALSE
    WHERE project_id = NEW.project_id
      AND id <> NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_single_default_template'
  ) THEN
    CREATE TRIGGER set_single_default_template
      BEFORE INSERT OR UPDATE ON templates
      FOR EACH ROW EXECUTE FUNCTION enforce_single_default_template();
  END IF;
END;
$$;
