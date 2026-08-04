-- =============================================================
-- CDGS — Core Database Schema
-- Supabase (PostgreSQL) — Phase 1
--
-- Run this in your Supabase project's SQL Editor.
-- All tables use UUID primary keys and timestamptz timestamps.
-- =============================================================

BEGIN;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- 1. users
--    GitHub OAuth users who have authenticated with CDGS.
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id         BIGINT      NOT NULL UNIQUE,
  github_login      TEXT        NOT NULL,
  github_name       TEXT,
  github_avatar_url TEXT,
  email             TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'GitHub OAuth users authenticated with CDGS';

-- =============================================================
-- 2. api_keys
--    Per-user programmatic API keys (hashed).
-- =============================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  key_hash    TEXT        NOT NULL UNIQUE,   -- bcrypt hash of the raw key
  last_used   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE api_keys IS 'Per-user API keys — only the hash is stored';

-- =============================================================
-- 3. settings
--    Per-user/org configuration key-value pairs.
-- =============================================================
CREATE TABLE IF NOT EXISTS settings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT        NOT NULL,
  value      JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT settings_user_key_unique UNIQUE (user_id, key)
);

COMMENT ON TABLE settings IS 'Per-user configuration stored as JSONB values';

-- =============================================================
-- 4. repositories
--    GitHub repositories connected to CDGS by a user.
-- =============================================================
CREATE TABLE IF NOT EXISTS repositories (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_repo_id    BIGINT      NOT NULL UNIQUE,
  full_name         TEXT        NOT NULL,           -- e.g. "owner/repo"
  default_branch    TEXT        NOT NULL DEFAULT 'main',
  is_private        BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE repositories IS 'GitHub repositories connected to CDGS';

-- =============================================================
-- 5. webhooks
--    Webhook registrations on GitHub for connected repos.
-- =============================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  github_hook_id BIGINT     NOT NULL UNIQUE,
  events        TEXT[]      NOT NULL DEFAULT '{"push"}',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  secret_hash   TEXT        NOT NULL,    -- bcrypt hash of the webhook secret
  last_received_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE webhooks IS 'GitHub webhook registrations — one per connected repository';

-- =============================================================
-- 6. documentation_runs
--    Each invocation of the documentation generation pipeline.
-- =============================================================
CREATE TABLE IF NOT EXISTS documentation_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id   UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  triggered_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  trigger_type    TEXT        NOT NULL CHECK (trigger_type IN ('webhook', 'manual', 'scheduled')),
  commit_sha      TEXT,
  branch          TEXT,
  status          TEXT        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued', 'running', 'success', 'failed', 'cancelled')),
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE documentation_runs IS 'Each execution of the doc generation pipeline';

-- =============================================================
-- 7. jobs
--    BullMQ job records — mirrors queue state for auditability.
-- =============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID        REFERENCES documentation_runs(id) ON DELETE SET NULL,
  queue_name    TEXT        NOT NULL,
  bull_job_id   TEXT        NOT NULL UNIQUE,   -- BullMQ job ID
  job_type      TEXT        NOT NULL,
  payload       JSONB       NOT NULL DEFAULT '{}',
  status        TEXT        NOT NULL DEFAULT 'waiting'
                            CHECK (status IN ('waiting', 'active', 'completed', 'failed', 'delayed', 'paused')),
  attempts      INTEGER     NOT NULL DEFAULT 0,
  error_message TEXT,
  result        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE jobs IS 'BullMQ job mirror for auditability and debugging';

-- =============================================================
-- 8. documentation_versions
--    A versioned snapshot produced by a successful run.
-- =============================================================
CREATE TABLE IF NOT EXISTS documentation_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID        NOT NULL REFERENCES documentation_runs(id) ON DELETE CASCADE,
  repository_id   UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  version_number  INTEGER     NOT NULL,
  commit_sha      TEXT,
  is_published    BOOLEAN     NOT NULL DEFAULT FALSE,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT doc_versions_repo_number_unique UNIQUE (repository_id, version_number)
);

COMMENT ON TABLE documentation_versions IS 'Versioned doc snapshots from successful generation runs';

-- =============================================================
-- 9. documents
--    Individual generated documentation artifacts within a version.
-- =============================================================
CREATE TABLE IF NOT EXISTS documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      UUID        NOT NULL REFERENCES documentation_versions(id) ON DELETE CASCADE,
  repository_id   UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path       TEXT        NOT NULL,          -- relative path in repo
  doc_type        TEXT        NOT NULL CHECK (doc_type IN ('readme', 'api', 'module', 'function', 'class', 'other')),
  title           TEXT,
  content         TEXT,                          -- generated markdown
  content_hash    TEXT,                          -- sha256 for change detection
  ai_model        TEXT,                          -- model used for generation
  token_count     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT documents_version_path_unique UNIQUE (version_id, file_path)
);

COMMENT ON TABLE documents IS 'Individual generated documentation artifacts per version';

-- =============================================================
-- 10. audit_logs
--     Immutable log of user and system actions.
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,     -- e.g. "repository.connected", "run.triggered"
  resource    TEXT,                     -- e.g. "repositories"
  resource_id UUID,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at — audit logs are immutable
);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all user and system actions';

-- =============================================================
-- Indexes for common query patterns
-- =============================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_github_id    ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_github_login ON users(github_login);

-- API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id  ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

-- Settings
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- Repositories
CREATE INDEX IF NOT EXISTS idx_repositories_user_id       ON repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_repositories_github_repo_id ON repositories(github_repo_id);

-- Webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_repository_id ON webhooks(repository_id);

-- Documentation runs
CREATE INDEX IF NOT EXISTS idx_doc_runs_repository_id ON documentation_runs(repository_id);
CREATE INDEX IF NOT EXISTS idx_doc_runs_status        ON documentation_runs(status);
CREATE INDEX IF NOT EXISTS idx_doc_runs_created_at    ON documentation_runs(created_at DESC);

-- Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_run_id     ON jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_queue_name ON jobs(queue_name);

-- Documentation versions
CREATE INDEX IF NOT EXISTS idx_doc_versions_repository_id ON documentation_versions(repository_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_run_id        ON documentation_versions(run_id);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_version_id    ON documents(version_id);
CREATE INDEX IF NOT EXISTS idx_documents_repository_id ON documents(repository_id);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =============================================================
-- updated_at auto-update trigger function
-- =============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'api_keys', 'settings', 'repositories', 'webhooks',
    'documentation_runs', 'jobs', 'documentation_versions', 'documents'
  ]
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

COMMIT;
