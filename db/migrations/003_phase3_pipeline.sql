-- =============================================================
-- CDGS — Phase 3 Migration: Change Detection Pipeline & Stage Logs
-- Run AFTER 002 (002_phase2_auth.sql) in Supabase SQL Editor.
-- =============================================================

BEGIN;

-- =============================================================
-- 1. pipeline_runs
--    Pipeline execution records for Phase 3 change detection.
-- =============================================================
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id   UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  triggered_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  trigger_type    TEXT        NOT NULL DEFAULT 'webhook' CHECK (trigger_type IN ('webhook', 'manual', 'scheduled')),
  commit_sha      TEXT        NOT NULL, -- NOTE: Represents afterSha (the new commit head), not beforeSha
  before_sha      TEXT,
  branch          TEXT        NOT NULL DEFAULT 'main',
  status          TEXT        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued', 'running', 'success', 'failed', 'retrying')),
  current_stage   TEXT        NOT NULL DEFAULT 'webhook'
                              CHECK (current_stage IN ('webhook', 'clone', 'diff')),
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  duration_ms     INTEGER,
  error_message   TEXT,
  retry_count     INTEGER     NOT NULL DEFAULT 0,
  changeset       JSONB,      -- Persisted ChangeSet JSONB object
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotency constraint: Prevent duplicate runs for the same commit on the same branch
  CONSTRAINT pipeline_runs_repo_commit_branch_unique UNIQUE (repository_id, commit_sha, branch)
);

COMMENT ON TABLE pipeline_runs IS 'Tracks Phase 3 change detection pipeline executions';
COMMENT ON COLUMN pipeline_runs.commit_sha IS 'Represents afterSha (the new commit head), not beforeSha';
COMMENT ON COLUMN pipeline_runs.changeset IS 'Persisted ChangeSet JSONB output from Phase 3 git diff';

-- =============================================================
-- 2. pipeline_stage_logs
--    Granular stage timing and transition logs per run.
-- =============================================================
CREATE TABLE IF NOT EXISTS pipeline_stage_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID        NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage         TEXT        NOT NULL CHECK (stage IN ('webhook', 'clone', 'diff')),
  status        TEXT        NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed', 'retrying')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  duration_ms   INTEGER,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pipeline_stage_logs IS 'Granular stage timing and status logs for each pipeline run';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_repo_id    ON pipeline_runs(repository_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status     ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created_at ON pipeline_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_logs_run_id        ON pipeline_stage_logs(run_id);

-- Apply auto-updated_at trigger
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
