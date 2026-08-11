/**
 * Phase 3 Pipeline Shared Contracts & Types
 * Single source of truth across Webhook (Hari), Worker (Lokesh), and Pipeline Service (Eswar).
 */

/** Shared Contract #3: Pipeline Statuses & Stages */
export type PipelineStatus = 'queued' | 'running' | 'success' | 'failed' | 'retrying'
export type PipelineStage = 'webhook' | 'clone' | 'diff' | 'docgen' | 'ai' | 'publish'

/** Shared Contract #1: Queue Job Payload (Hari produces, Lokesh consumes) */
export interface DocumentationPipelineJob {
  pipelineRunId: string
  repositoryId: string
  githubRepositoryId: number
  owner: string
  repo: string
  branch: string
  beforeSha: string
  afterSha: string
}

/** Shared Contract #2: ChangeSet Output (Lokesh produces, Eswar stores, Phase 4 consumes) */
export interface ChangedFile {
  path: string
  status: 'added' | 'modified' | 'deleted'
  additions: number
  deletions: number
}

export interface ChangeSet {
  beforeSha: string
  afterSha: string
  files: ChangedFile[]
  summary: {
    added: number
    modified: number
    deleted: number
  }
}

/** Database shape for pipeline_runs record */
export interface PipelineRun {
  id: string
  repository_id: string
  triggered_by: string | null
  trigger_type: 'webhook' | 'manual' | 'scheduled'
  commit_sha: string // NOTE: Represents afterSha (the new commit head)
  before_sha: string | null
  branch: string
  status: PipelineStatus
  current_stage: PipelineStage
  queued_at: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  error_message: string | null
  retry_count: number
  changeset: ChangeSet | null
  created_at: string
  updated_at: string
  // Optional expanded repository relation
  repository?: {
    id: string
    full_name: string
    owner: string
    name: string
  }
}

/** Database shape for pipeline_stage_logs record */
export interface PipelineStageLog {
  id: string
  run_id: string
  stage: PipelineStage
  status: PipelineStatus
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  error_message: string | null
  created_at: string
}

/** Input DTO for creating a pipeline run */
export interface CreatePipelineRunInput {
  repositoryId: string
  commitSha: string // afterSha
  beforeSha?: string
  branch: string
  triggeredBy?: string
  triggerType?: 'webhook' | 'manual' | 'scheduled'
}

/** Input DTO for updating stage progress */
export interface UpdateStageProgressInput {
  runId: string
  stage: PipelineStage
  status: PipelineStatus
  errorMessage?: string
  retryCount?: number
}

/** Input DTO for completing a pipeline run */
export interface CompletePipelineRunInput {
  runId: string
  status: 'success' | 'failed'
  changeset?: ChangeSet
  errorMessage?: string
}
