-- =============================================================
-- CDGS -- Migration 005: Notifications
-- Stores per-user in-app notifications triggered by webhook
-- push events, pipeline completions, and doc generation.
-- Run AFTER 004 in Supabase SQL Editor.
-- =============================================================

BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_notifications_user_id       ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread   ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at    ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_repo_id       ON notifications(repository_id);

COMMIT;
