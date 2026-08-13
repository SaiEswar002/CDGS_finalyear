import type { Request, Response } from 'express'
import { verifyGitHubSignature } from './webhook.crypto'
import type { GitHubPushPayload } from './webhook.types'
import { getSupabaseClient } from '../db/supabaseClient'
import { createPipelineRun } from '../pipeline/pipeline.service'
import { enqueuePipelineJob } from '../queue/queue.service'
import { createNotification } from '../notifications/notifications.service'
import { logger } from '../logger'

/**
 * POST /api/v1/webhooks/github
 *
 * Receives GitHub push events, verifies HMAC signature,
 * matches the repository to a CDGS-connected repository,
 * creates a pipeline run, and enqueues a BullMQ job.
 */
export async function githubWebhookHandler(req: Request, res: Response): Promise<void> {
  // 1. Verify X-Hub-Signature-256 (HMAC-SHA256)
  const signature = req.headers['x-hub-signature-256'] as string | undefined
  const eventType = req.headers['x-github-event'] as string | undefined

  if (!signature) {
    logger.warn('Webhook received without X-Hub-Signature-256 header')
    res.status(401).json({ success: false, error: 'Missing webhook signature' })
    return
  }

  // Handle Buffer, string, or parsed JSON object
  const isValid = verifyGitHubSignature(req.body, signature)
  if (!isValid) {
    logger.warn({ eventType }, 'Webhook signature verification failed')
    res.status(401).json({ success: false, error: 'Invalid webhook signature' })
    return
  }

  // 2. Parse JSON body safely
  let payload: GitHubPushPayload
  try {
    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse(req.body.toString('utf8'))
    } else if (typeof req.body === 'object' && req.body !== null) {
      payload = req.body as GitHubPushPayload
    } else {
      payload = JSON.parse(String(req.body))
    }
  } catch (err) {
    logger.error({ err }, 'Failed to parse webhook payload JSON')
    res.status(400).json({ success: false, error: 'Invalid JSON payload' })
    return
  }

  // 3. Only process push events
  if (eventType !== 'push') {
    logger.info({ eventType }, 'Ignoring non-push webhook event')
    res.status(200).json({ success: true, message: `Event type '${eventType}' ignored.` })
    return
  }

  // 4. Ignore branch deletions (after = 000...000)
  const NULL_SHA = '0000000000000000000000000000000000000000'
  if (payload.after === NULL_SHA) {
    logger.info({ ref: payload.ref }, 'Ignoring branch deletion push event')
    res.status(200).json({ success: true, message: 'Branch deletion ignored.' })
    return
  }

  // 5. Extract branch name from ref (refs/heads/main -> main)
  const branch = payload.ref.replace('refs/heads/', '')
  const owner = payload.repository.owner.login
  const repo = payload.repository.name
  const githubRepositoryId = payload.repository.id
  const afterSha = payload.after
  const beforeSha = payload.before === NULL_SHA ? NULL_SHA : payload.before

  logger.info(
    { owner, repo, branch, afterSha: afterSha.slice(0, 7), beforeSha: beforeSha.slice(0, 7) },
    'Received GitHub push event',
  )

  // 6. Look up connected repository in CDGS database
  const supabase = getSupabaseClient()
  const { data: repoRecord, error: repoErr } = await supabase
    .from('repositories')
    .select('id, user_id, name, owner')
    .eq('github_repo_id', githubRepositoryId)
    .maybeSingle()

  if (repoErr) {
    logger.error({ err: repoErr, githubRepositoryId }, 'Database error looking up repository')
    res.status(500).json({ success: false, error: 'Database error' })
    return
  }

  if (!repoRecord) {
    logger.info(
      { owner, repo, githubRepositoryId },
      'Push event received for repository not connected to CDGS — ignoring',
    )
    res.status(200).json({ success: true, message: 'Repository not connected to CDGS.' })
    return
  }

  // Notify user: push received
  void createNotification({
    userId: repoRecord.user_id,
    repositoryId: repoRecord.id,
    type: 'push_received',
    title: `Push received — ${repoRecord.owner}/${repoRecord.name}`,
    body: `New commit ${afterSha.slice(0, 7)} pushed to \`${branch}\`. Documentation pipeline is queuing.`,
    commitSha: afterSha,
    branch,
  })

  // 7. Create pipeline run (idempotent — returns existing run if already queued/running)
  let pipelineRun
  try {
    pipelineRun = await createPipelineRun({
      repositoryId: repoRecord.id,
      commitSha: afterSha,
      beforeSha,
      branch,
      triggeredBy: repoRecord.user_id,
      triggerType: 'webhook',
    })
  } catch (err: any) {
    logger.error({ err: err.message, repositoryId: repoRecord.id }, 'Failed to create pipeline run')
    res.status(500).json({ success: false, error: 'Failed to create pipeline run' })
    return
  }

  // 8. Enqueue BullMQ job (jobId = pipelineRunId for canonical identity)
  try {
    await enqueuePipelineJob({
      pipelineRunId: pipelineRun.id,
      repositoryId: repoRecord.id,
      githubRepositoryId,
      owner,
      repo,
      branch,
      beforeSha,
      afterSha,
      triggeredBy: repoRecord.user_id,
    })
  } catch (err: any) {
    logger.error({ err: err.message, pipelineRunId: pipelineRun.id }, 'Failed to enqueue pipeline job')
    // Don't fail the webhook — run was created, can be retried
    res.status(202).json({
      success: true,
      message: 'Pipeline run created but job queuing failed.',
      data: { pipelineRunId: pipelineRun.id },
    })
    return
  }

  // Notify user: pipeline queued
  void createNotification({
    userId: repoRecord.user_id,
    repositoryId: repoRecord.id,
    pipelineRunId: pipelineRun.id,
    type: 'pipeline_queued',
    title: `Pipeline queued — ${repoRecord.owner}/${repoRecord.name}`,
    body: `Documentation pipeline for commit ${afterSha.slice(0, 7)} on \`${branch}\` is now running.`,
    commitSha: afterSha,
    branch,
  })

  logger.info(
    { pipelineRunId: pipelineRun.id, owner, repo, branch, afterSha: afterSha.slice(0, 7) },
    'Pipeline run created and job enqueued from webhook',
  )

  res.status(202).json({
    success: true,
    message: 'Push event received. Pipeline run queued.',
    data: {
      pipelineRunId: pipelineRun.id,
      repositoryId: repoRecord.id,
      commitSha: afterSha,
      branch,
    },
  })
}
