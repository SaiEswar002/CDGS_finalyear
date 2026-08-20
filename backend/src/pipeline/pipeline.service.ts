import { getSupabaseClient } from '../db/supabaseClient'
import { HttpError } from '../middleware/errorHandler'
import { logger } from '../logger'
import type {
  PipelineRun,
  CreatePipelineRunInput,
  UpdateStageProgressInput,
  CompletePipelineRunInput,
  PipelineStageLog,
} from './pipeline.types'

/**
 * Pipeline Service — Sole Writer to pipeline_runs and pipeline_stage_logs.
 * Encapsulates database transactions, status transitions, idempotency checks,
 * stage logging, and ChangeSet persistence.
 */

/**
 * Creates or retrieves a pipeline run (Idempotent).
 * If a run already exists for (repository_id, commit_sha, branch):
 * - queued/running/success: returns existing run (no duplicate work)
 * - failed: resets run to queued, sets stage to webhook, increments retry_count
 */
export async function createPipelineRun(
  input: CreatePipelineRunInput,
): Promise<PipelineRun> {
  const supabase = getSupabaseClient()

  // 1. Check for existing run (Idempotency)
  const { data: existing } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('repository_id', input.repositoryId)
    .eq('commit_sha', input.commitSha)
    .eq('branch', input.branch ?? 'main')
    .maybeSingle()

  if (existing) {
    // If webhook triggered and already active/successful, skip to maintain webhook idempotency
    if (input.triggerType !== 'manual' && ['queued', 'running', 'success'].includes(existing.status)) {
      logger.info(
        { runId: existing.id, commitSha: input.commitSha, status: existing.status },
        'Idempotent check: pipeline run already exists in active/success state for webhook',
      )
      return existing as unknown as PipelineRun
    }

    // Reset run to queued & increment retry_count for manual re-execution
    const { data: updated, error: updateErr } = await supabase
      .from('pipeline_runs')
      .update({
        status: 'queued',
        current_stage: 'webhook',
        queued_at: new Date().toISOString(),
        started_at: null,
        finished_at: null,
        duration_ms: null,
        error_message: null,
        retry_count: (existing.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (updateErr || !updated) {
      logger.error({ err: updateErr }, 'Failed to reset pipeline run for re-execution')
      throw new HttpError(500, 'DB_ERROR', `Failed to update pipeline run: ${updateErr?.message || 'DB Error'}`)
    }

    // Log stage transition
    await logStageTransition(existing.id, 'webhook', 'queued')

    // Upsert into documentation_runs for backwards-compatible DB schemas
    try {
      await supabase.from('documentation_runs').upsert({
        id: existing.id,
        repository_id: input.repositoryId,
        triggered_by: input.triggeredBy ?? null,
        trigger_type: input.triggerType ?? 'webhook',
        commit_sha: input.commitSha,
        branch: input.branch ?? 'main',
        status: 'queued',
      })
    } catch {
      // Optional fallback
    }

    return updated as unknown as PipelineRun
  }

  // 2. Insert new run
  const { data: newRun, error: insertErr } = await supabase
    .from('pipeline_runs')
    .insert({
      repository_id: input.repositoryId,
      commit_sha: input.commitSha,
      before_sha: input.beforeSha ?? null,
      branch: input.branch ?? 'main',
      triggered_by: input.triggeredBy ?? null,
      trigger_type: input.triggerType ?? 'webhook',
      status: 'queued',
      current_stage: 'webhook',
      queued_at: new Date().toISOString(),
      retry_count: 0,
    })
    .select('*')
    .single()

  if (insertErr || !newRun) {
    // Fallback: If unique constraint matched, update existing record instead of throwing error
    const { data: fallbackExisting } = await supabase
      .from('pipeline_runs')
      .select('*')
      .eq('repository_id', input.repositoryId)
      .eq('commit_sha', input.commitSha)
      .maybeSingle()

    if (fallbackExisting) {
      const { data: updated } = await supabase
        .from('pipeline_runs')
        .update({
          status: 'queued',
          current_stage: 'webhook',
          queued_at: new Date().toISOString(),
          started_at: null,
          finished_at: null,
          duration_ms: null,
          error_message: null,
          retry_count: (fallbackExisting.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fallbackExisting.id)
        .select('*')
        .single()

      if (updated) {
        return updated as unknown as PipelineRun
      }
    }

    logger.error({ err: insertErr }, 'Failed to create pipeline run')
    const msg = insertErr?.code === 'PGRST205'
      ? "Database table 'pipeline_runs' is missing. Please run migrations in Supabase SQL Editor (see db/migrations/apply_all_migrations.sql)."
      : `Failed to create pipeline run: ${insertErr?.message || 'DB Error'}`
    throw new HttpError(500, 'DB_ERROR', msg)
  }

  // Upsert into documentation_runs for backwards-compatible DB schemas
  try {
    await supabase.from('documentation_runs').upsert({
      id: newRun.id,
      repository_id: input.repositoryId,
      triggered_by: input.triggeredBy ?? null,
      trigger_type: input.triggerType ?? 'webhook',
      commit_sha: input.commitSha,
      branch: input.branch ?? 'main',
      status: 'queued',
    })
  } catch {
    // Optional fallback
  }

  // Log initial webhook stage
  await logStageTransition(newRun.id, 'webhook', 'queued')

  logger.info({ runId: newRun.id, commitSha: input.commitSha }, 'Pipeline run created')

  return newRun as unknown as PipelineRun
}

/**
 * Updates stage progress (called by Hari's webhook or Lokesh's worker).
 */
export async function updateStageProgress(
  input: UpdateStageProgressInput,
): Promise<PipelineRun> {
  const supabase = getSupabaseClient()

  // Fetch current run
  const { data: current, error: fetchErr } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('id', input.runId)
    .single()

  if (fetchErr || !current) {
    throw new HttpError(404, 'RUN_NOT_FOUND', 'Pipeline run not found.')
  }

  const updateData: Record<string, any> = {
    current_stage: input.stage,
    status: input.status,
    updated_at: new Date().toISOString(),
  }

  if (input.errorMessage !== undefined) {
    updateData.error_message = input.errorMessage
  }

  if (input.retryCount !== undefined) {
    updateData.retry_count = input.retryCount
  }

  // Mark started_at when first entering 'running' status
  if (input.status === 'running' && !current.started_at) {
    updateData.started_at = new Date().toISOString()
  }

  let { data: updated, error: updateErr } = await supabase
    .from('pipeline_runs')
    .update(updateData)
    .eq('id', input.runId)
    .select('*')
    .single()

  // Fallback: If DB constraint on current_stage fails, retry updating status & error without stage field
  if (updateErr) {
    logger.warn({ err: updateErr, runId: input.runId, stage: input.stage }, 'Failed to update current_stage on pipeline_runs, attempting status fallback update')
    const fallbackData = { ...updateData }
    delete fallbackData.current_stage

    const fallbackResult = await supabase
      .from('pipeline_runs')
      .update(fallbackData)
      .eq('id', input.runId)
      .select('*')
      .single()

    if (!fallbackResult.error && fallbackResult.data) {
      updated = fallbackResult.data
      updateErr = null
    }
  }

  if (updateErr || !updated) {
    logger.error({ err: updateErr, runId: input.runId }, 'Failed to update stage progress')
    const detailMsg = updateErr?.message ? `: ${updateErr.message}` : ''
    throw new HttpError(500, 'DB_ERROR', `Failed to update stage progress${detailMsg}`)
  }

  // Log stage transition
  await logStageTransition(input.runId, input.stage, input.status, input.errorMessage)

  return updated as unknown as PipelineRun
}

/**
 * Completes a pipeline run and persists the ChangeSet.
 */
export async function completePipelineRun(
  input: CompletePipelineRunInput,
): Promise<PipelineRun> {
  const supabase = getSupabaseClient()

  const { data: current, error: fetchErr } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('id', input.runId)
    .single()

  if (fetchErr || !current) {
    throw new HttpError(404, 'RUN_NOT_FOUND', 'Pipeline run not found.')
  }

  const finishedAt = new Date()
  const startedAt = current.started_at ? new Date(current.started_at) : new Date(current.queued_at)
  const durationMs = finishedAt.getTime() - startedAt.getTime()

  const updateData: Record<string, any> = {
    status: input.status,
    finished_at: finishedAt.toISOString(),
    duration_ms: durationMs,
    updated_at: finishedAt.toISOString(),
  }

  if (input.changeset) {
    updateData.changeset = input.changeset
  }

  if (input.errorMessage) {
    updateData.error_message = input.errorMessage
  }

  const { data: updated, error: updateErr } = await supabase
    .from('pipeline_runs')
    .update(updateData)
    .eq('id', input.runId)
    .select('*')
    .single()

  if (updateErr || !updated) {
    logger.error({ err: updateErr, runId: input.runId }, 'Failed to complete pipeline run')
    const detailMsg = updateErr?.message ? `: ${updateErr.message}` : ''
    throw new HttpError(500, 'DB_ERROR', `Failed to complete pipeline run${detailMsg}`)
  }

  // Log final stage completed
  await logStageTransition(input.runId, current.current_stage, input.status, input.errorMessage, durationMs)

  logger.info({ runId: input.runId, status: input.status, durationMs }, 'Pipeline run completed')

  return updated as unknown as PipelineRun
}

/**
 * Lists pipeline runs for a user (or specific repository).
 */
export async function listPipelineRuns(
  userId: string,
  options: { repositoryId?: string; status?: string; limit?: number; offset?: number } = {},
): Promise<{ runs: PipelineRun[]; total: number }> {
  const supabase = getSupabaseClient()

  // First verify user repository ownership filter if repositoryId provided
  let repoFilterIds: string[] = []

  const { data: userRepos } = await supabase
    .from('repositories')
    .select('id')
    .eq('user_id', userId)

  repoFilterIds = (userRepos ?? []).map((r) => r.id)

  if (options.repositoryId) {
    if (!repoFilterIds.includes(options.repositoryId)) {
      throw new HttpError(403, 'FORBIDDEN', 'Access denied for requested repository.')
    }
    repoFilterIds = [options.repositoryId]
  }

  if (repoFilterIds.length === 0) {
    return { runs: [], total: 0 }
  }

  let query = supabase
    .from('pipeline_runs')
    .select('*, repository:repositories(id, full_name, owner, name)', { count: 'exact' })
    .in('repository_id', repoFilterIds)
    .order('created_at', { ascending: false })

  if (options.status) {
    query = query.eq('status', options.status)
  }

  const limit = options.limit ?? 20
  const offset = options.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    logger.error({ err: error }, 'Failed to list pipeline runs')
    throw new HttpError(500, 'DB_ERROR', 'Failed to list pipeline runs.')
  }

  return {
    runs: (data ?? []) as unknown as PipelineRun[],
    total: count ?? 0,
  }
}

/**
 * Gets a single pipeline run by ID, enforcing user ownership.
 */
export async function getPipelineRunById(
  userId: string,
  runId: string,
): Promise<{ run: PipelineRun; stageLogs: PipelineStageLog[] }> {
  const supabase = getSupabaseClient()

  const { data: run, error } = await supabase
    .from('pipeline_runs')
    .select('*, repository:repositories(id, user_id, full_name, owner, name)')
    .eq('id', runId)
    .single()

  if (error || !run) {
    throw new HttpError(404, 'RUN_NOT_FOUND', 'Pipeline run not found.')
  }

  // Enforce repository ownership
  if ((run as any).repository?.user_id !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied for requested pipeline run.')
  }

  // Fetch stage logs
  const { data: stageLogs } = await supabase
    .from('pipeline_stage_logs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })

  return {
    run: run as unknown as PipelineRun,
    stageLogs: (stageLogs ?? []) as unknown as PipelineStageLog[],
  }
}

/** Helper: Log stage transitions */
async function logStageTransition(
  runId: string,
  stage: string,
  status: string,
  errorMessage?: string,
  durationMs?: number,
) {
  try {
    const supabase = getSupabaseClient()
    await supabase.from('pipeline_stage_logs').insert({
      run_id: runId,
      stage,
      status,
      error_message: errorMessage ?? null,
      duration_ms: durationMs ?? null,
    })
  } catch (err) {
    logger.warn({ err, runId, stage }, 'Failed to write stage log')
  }
}
