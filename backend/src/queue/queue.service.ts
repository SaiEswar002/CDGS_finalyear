import { Queue } from 'bullmq'
import { createRedisConnection } from './queue.config'
import { DOCUMENTATION_PIPELINE_QUEUE_NAME, type DocumentationPipelineJob } from './queue.types'
import { logger } from '../logger'

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
export async function enqueuePipelineJob(job: DocumentationPipelineJob) {
  const queue = getDocumentationPipelineQueue()

  logger.info(
    { pipelineRunId: job.pipelineRunId, repo: `${job.owner}/${job.repo}`, commitSha: job.afterSha },
    'Enqueueing DocumentationPipelineJob into BullMQ',
  )

  const uniqueJobId = `${job.pipelineRunId}-${Date.now()}`

  return queue.add('documentation-pipeline-job', job, {
    jobId: uniqueJobId, // Unique job ID per enqueue execution
  })
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
