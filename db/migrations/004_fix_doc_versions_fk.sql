-- =============================================================
-- CDGS — Migration 004: Fix Foreign Key Constraint on documentation_versions
-- Run in Supabase SQL Editor to update FK constraint from documentation_runs to pipeline_runs
-- =============================================================

BEGIN;

-- Drop legacy FK constraint referencing Phase 1 documentation_runs table
ALTER TABLE documentation_versions DROP CONSTRAINT IF EXISTS documentation_versions_run_id_fkey;

-- Re-create FK constraint referencing Phase 3 pipeline_runs table
ALTER TABLE documentation_versions
  ADD CONSTRAINT documentation_versions_run_id_fkey
  FOREIGN KEY (run_id) REFERENCES pipeline_runs(id) ON DELETE CASCADE;

COMMIT;
