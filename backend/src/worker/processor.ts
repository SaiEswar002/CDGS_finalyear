import type { Job } from 'bullmq'
import { getSupabaseClient } from '../db/supabaseClient'
import { updateStageProgress, completePipelineRun } from '../pipeline/pipeline.service'
import { checkoutRepository, cleanupWorkspace, getWorkspacePath } from '../git/git.service'
import { generateChangeSet } from '../git/diff.service'
import { generateAndPersistDocumentation } from '../docgen/docgen.service'
import type { DocumentationPipelineJob } from '../pipeline/pipeline.types'
import { logger } from '../logger'

/**
 * Processes a DocumentationPipelineJob in the BullMQ worker.
 *
 * Workflow (Phase 3 + Phase 4):
 * 1. Validate payload & fetch repository token
 * 2. Update stage = clone, status = running
 * 3. Checkout repo into isolated workspace
 * 4. Update stage = diff, status = running
 * 5. Generate ChangeSet via git diff
 * 6. Update stage = docgen, generate documentation artifacts
 * 7. Update stage = publish, complete pipeline run (status = success)
 * 8. ALWAYS cleanup workspace in finally block
 */
export async function processPipelineJob(job: Job<DocumentationPipelineJob>): Promise<void> {
  const data = job.data
  const runId = data.pipelineRunId
  // Parent workspace container: /tmp/cdgs-pipeline/<runId>/
  const workspacePath = getWorkspacePath(runId)

  logger.info(
    { jobId: job.id, pipelineRunId: runId, repo: `${data.owner}/${data.repo}`, attemptsMade: job.attemptsMade },
    'Processing DocumentationPipelineJob in worker',
  )

  try {
    const supabase = getSupabaseClient()

    // 1. Fetch encrypted GitHub access token from repository relation
    const { data: repoRecord, error: repoErr } = await supabase
      .from('repositories')
      .select('id, user_id, users(github_access_token_enc)')
      .eq('id', data.repositoryId)
      .single()

    if (repoErr || !repoRecord) {
      throw new Error(`Repository ${data.repositoryId} not found in database.`)
    }

    const encryptedToken = (repoRecord as any).users?.github_access_token_enc || null

    // 2. Update stage: clone
    await updateStageProgress({
      runId,
      stage: 'clone',
      status: 'running',
      retryCount: job.attemptsMade,
    })

    // 3. Checkout repository into namespaced isolated workspace
    const checkoutResult = await checkoutRepository(
      {
        pipelineRunId: runId,
        owner: data.owner,
        repo: data.repo,
        branch: data.branch,
        beforeSha: data.beforeSha,
        afterSha: data.afterSha,
        encryptedToken,
      },
      120000, // 2 minute clone timeout
    )

    // 4. Update stage: diff
    await updateStageProgress({
      runId,
      stage: 'diff',
      status: 'running',
    })

    // 5. Generate ChangeSet from git diff
    const changeset = await generateChangeSet(
      checkoutResult.workspaceDir,
      checkoutResult.beforeSha,
      checkoutResult.afterSha,
    )

    // 6. Phase 4 — Documentation Generation & AI Synthesis
    await updateStageProgress({ runId, stage: 'docgen', status: 'running' })

    await generateAndPersistDocumentation(
      data.repositoryId,
      `${data.owner}/${data.repo}`,
      runId,
      data.afterSha,
      checkoutResult.workspaceDir,
      changeset,
    )

    // 7. Mark publish stage running then complete the run
    await updateStageProgress({ runId, stage: 'publish', status: 'running' })

    await completePipelineRun({
      runId,
      status: 'success',
      changeset,
    })

    logger.info(
      { pipelineRunId: runId, filesChanged: changeset.files.length },
      'Pipeline run & Phase 4 documentation generation completed successfully',
    )
  } catch (err: any) {
    const errorMessage = err.message || 'Worker pipeline job execution failed'
    logger.error({ pipelineRunId: runId, err: errorMessage }, 'Pipeline run failed in worker')

    // Report failure to pipeline service (best-effort, do not throw)
    await completePipelineRun({
      runId,
      status: 'failed',
      errorMessage,
    }).catch(() => {})

    throw err // Re-throw so BullMQ handles retry/attempts
  } finally {
    // ALWAYS cleanup workspace directory (§16)
    // workspacePath is the parent container: /tmp/cdgs-pipeline/<runId>/
    await cleanupWorkspace(workspacePath).catch(() => {})
  }
}
