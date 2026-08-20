import { Queue } from 'bullmq'
import { createRedisConnection } from './queue.config'
import { DOCUMENTATION_PIPELINE_QUEUE_NAME, type DocumentationPipelineJob } from './queue.types'
import { logger } from '../logger'
import { config } from '../config'

let queueInstance: Queue<DocumentationPipelineJob> | null = null

/**
 * Returns the singleton BullMQ Queue instance for documentation pipeline jobs.
 */
export function getDocumentationPipelineQueue(): Queue<DocumentationPipelineJob> {
  if (!queueInstance) {
    const connection = createRedisConnection()
    queueInstance = new Queue<DocumentationPipelineJob>(DOCUMENTATION_PIPELINE_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s
        },
        removeOnComplete: { age: 86400, count: 1000 }, // Keep completed jobs for 24h
        removeOnFail: { age: 604800, count: 1000 },    // Keep failed jobs for 7d
      },
    })
  }
  return queueInstance
}

/**
 * Enqueues a DocumentationPipelineJob into BullMQ.
 *
 * CRITICAL RULE (§11): jobId MUST equal job.pipelineRunId for canonical identity and idempotency.
 */
/**
 * Enqueues a DocumentationPipelineJob into BullMQ.
 * Falls back to in-process execution if Redis server is unavailable in dev environment.
 */
export async function enqueuePipelineJob(job: DocumentationPipelineJob) {
  logger.info(
    { pipelineRunId: job.pipelineRunId, repo: `${job.owner}/${job.repo}`, commitSha: job.afterSha },
    'Enqueueing DocumentationPipelineJob into BullMQ',
  )

  try {
    const queue = getDocumentationPipelineQueue()
    const uniqueJobId = `${job.pipelineRunId}-${Date.now()}`

    const enqueuePromise = queue.add('documentation-pipeline-job', job, {
      jobId: uniqueJobId,
    })

    const timeoutMs = 3000
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Redis connection timeout (${timeoutMs}ms). Could not reach Redis at ${config.redis.url}.`,
          ),
        )
      }, timeoutMs)
      if (typeof timer.unref === 'function') timer.unref()
    })

    return await Promise.race([enqueuePromise, timeoutPromise])
  } catch (err: any) {
    logger.warn(
      { err: err?.message, pipelineRunId: job.pipelineRunId },
      'Redis queue unavailable or timed out; falling back to in-process pipeline execution engine',
    )

    // Execute in-process asynchronously so API returns immediately while pipeline runs
    const { executePipelineJobDirectly } = await import('../worker/processor')
    setImmediate(() => {
      executePipelineJobDirectly(job).catch((inProcErr: any) => {
        logger.error({ err: inProcErr?.message, pipelineRunId: job.pipelineRunId }, 'In-process pipeline execution failed')
      })
    })

    return { id: job.pipelineRunId, fallback: true }
  }
}

/**
 * Gracefully closes the Queue connection (used during shutdown/tests).
 */
export async function closePipelineQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close()
    queueInstance = null
  }
}
