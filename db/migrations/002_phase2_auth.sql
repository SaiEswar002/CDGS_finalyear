-- =============================================================
-- CDGS — Phase 2 Migration: Auth & Repo Import
-- Run AFTER 001 (Phase 1 schema.sql) in Supabase SQL Editor.
-- This migration is additive — no Phase 1 tables are dropped or
-- destructively altered.
-- =============================================================

BEGIN;

-- =============================================================
-- users: add encrypted GitHub access token column
-- =============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS github_access_token_enc TEXT;

COMMENT ON COLUMN users.github_access_token_enc IS
  'AES-256-GCM encrypted GitHub access token. '
  'Format: iv_hex:authTag_hex:ciphertext_hex. '
  'Decrypted only inside github/service.ts — never logged.';

-- =============================================================
-- repositories: add Phase 2 required columns
-- =============================================================
ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS owner            TEXT,
  ADD COLUMN IF NOT EXISTS name             TEXT,
  ADD COLUMN IF NOT EXISTS selected_branch  TEXT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS language         TEXT,
  ADD COLUMN IF NOT EXISTS clone_url        TEXT,
  ADD COLUMN IF NOT EXISTS html_url         TEXT;

-- =============================================================
-- repositories: fix uniqueness constraint
--
-- Phase 1 had github_repo_id globally unique (one repo across
-- all users). Phase 2 allows the same GitHub repo to be imported
-- by different users, but a single user cannot import it twice.
-- =============================================================

-- Drop old global unique constraint if it exists
ALTER TABLE repositories
  DROP CONSTRAINT IF EXISTS repositories_github_repo_id_key;

-- Drop new constraint if it exists first, then add it
ALTER TABLE repositories
  DROP CONSTRAINT IF EXISTS repositories_user_repo_unique;

ALTER TABLE repositories
  ADD CONSTRAINT repositories_user_repo_unique
    UNIQUE (user_id, github_repo_id);

-- =============================================================
-- oauth_states: short-lived CSRF state store for OAuth flow
-- Rows are deleted on use or after 10 minutes.
-- =============================================================
CREATE TABLE IF NOT EXISTS oauth_states (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state      TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE oauth_states IS
  'Short-lived OAuth CSRF state tokens. Deleted on use or expiry.';

CREATE INDEX IF NOT EXISTS idx_oauth_states_state      ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

-- Auto-cleanup: delete expired states (Postgres cron or manual sweep)
-- A simple approach: delete on INSERT when count > 1000
-- Real cleanup is done by auth.service.ts on callback.

COMMIT;
