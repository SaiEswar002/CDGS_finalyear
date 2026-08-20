-- =============================================================
-- CDGS — Cumulative Migrations SQL Script
-- Combined migrations 003, 004, 005
--
-- Instructions:
-- Copy the entire contents of this file, open your Supabase Project Dashboard,
-- go to the SQL Editor, paste this script and click RUN.
-- =============================================================

BEGIN;

-- =============================================================
-- 1. pipeline_runs
-- =============================================================
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id   UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  triggered_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  trigger_type    TEXT        NOT NULL DEFAULT 'webhook' CHECK (trigger_type IN ('webhook', 'manual', 'scheduled')),
  commit_sha      TEXT        NOT NULL,
  before_sha      TEXT,
  branch          TEXT        NOT NULL DEFAULT 'main',
  status          TEXT        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued', 'running', 'success', 'failed', 'retrying')),
  current_stage   TEXT        NOT NULL DEFAULT 'webhook'
                              CHECK (current_stage IN ('webhook', 'clone', 'diff', 'docgen', 'ai', 'publish')),
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  duration_ms     INTEGER,
  error_message   TEXT,
  retry_count     INTEGER     NOT NULL DEFAULT 0,
  changeset       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pipeline_runs_repo_commit_branch_unique UNIQUE (repository_id, commit_sha, branch)
);

COMMENT ON TABLE pipeline_runs IS 'Tracks Phase 3 change detection and Phase 4 documentation pipeline executions';

-- =============================================================
-- 2. pipeline_stage_logs
-- =============================================================
CREATE TABLE IF NOT EXISTS pipeline_stage_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID        NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage         TEXT        NOT NULL CHECK (stage IN ('webhook', 'clone', 'diff', 'docgen', 'ai', 'publish')),
  status        TEXT        NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed', 'retrying')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  duration_ms   INTEGER,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pipeline_stage_logs IS 'Granular stage timing and status logs for each pipeline run';

-- =============================================================
-- 3. documentation_versions
-- =============================================================
CREATE TABLE IF NOT EXISTS documentation_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID        NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  repository_id   UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  version_number  INTEGER     NOT NULL DEFAULT 1,
  commit_sha      TEXT        NOT NULL,
  is_published    BOOLEAN     NOT NULL DEFAULT true,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT documentation_versions_repo_version_unique UNIQUE (repository_id, version_number)
);

COMMENT ON TABLE documentation_versions IS 'Versioned documentation snapshots produced by Phase 4 docgen engine';

-- Drop legacy FK constraint referencing old documentation_runs table if it exists
ALTER TABLE documentation_versions DROP CONSTRAINT IF EXISTS documentation_versions_run_id_fkey;

-- Ensure FK constraint references pipeline_runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'documentation_versions_run_id_fkey'
  ) THEN
    ALTER TABLE documentation_versions
      ADD CONSTRAINT documentation_versions_run_id_fkey
      FOREIGN KEY (run_id) REFERENCES pipeline_runs(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- =============================================================
-- 4. documents
-- =============================================================
CREATE TABLE IF NOT EXISTS documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      UUID        NOT NULL REFERENCES documentation_versions(id) ON DELETE CASCADE,
  repository_id   UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path       TEXT        NOT NULL,
  doc_type        TEXT        NOT NULL CHECK (doc_type IN ('readme', 'api', 'module', 'function', 'class', 'other')),
  title           TEXT        NOT NULL,
  content         TEXT        NOT NULL,
  content_hash    TEXT        NOT NULL,
  ai_model        TEXT,
  token_count     INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE documents IS 'Individual generated documentation files per version';

-- =============================================================
-- 5. notifications
-- =============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id   UUID        REFERENCES repositories(id) ON DELETE CASCADE,
  pipeline_run_id UUID        REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  type            TEXT        NOT NULL
                              CHECK (type IN (
                                'push_received',
                                'pipeline_queued',
                                'pipeline_success',
                                'pipeline_failed',
                                'docs_generated'
                              )),
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  commit_sha      TEXT,
  branch          TEXT,
  is_read         BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'In-app notifications for push events, pipeline status changes, and doc generation';

-- =============================================================
-- Indexes
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_repo_id     ON pipeline_runs(repository_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status      ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created_at  ON pipeline_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_logs_run_id         ON pipeline_stage_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_repo_id      ON documentation_versions(repository_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_run_id       ON documentation_versions(run_id);
CREATE INDEX IF NOT EXISTS idx_documents_version_id      ON documents(version_id);
CREATE INDEX IF NOT EXISTS idx_documents_repo_id         ON documents(repository_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id       ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread   ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at    ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_repo_id       ON notifications(repository_id);

-- Auto-update trigger for pipeline_runs.updated_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_updated_at') THEN
    CREATE OR REPLACE TRIGGER trg_pipeline_runs_updated_at
      BEFORE UPDATE ON pipeline_runs
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END;
$$;

COMMIT;
