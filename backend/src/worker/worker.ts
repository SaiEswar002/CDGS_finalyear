import 'dotenv/config'
import { Worker } from 'bullmq'
import { createRedisConnection } from '../queue/queue.config'
import { DOCUMENTATION_PIPELINE_QUEUE_NAME, type DocumentationPipelineJob } from '../queue/queue.types'
import { processPipelineJob } from './processor'
import { logger } from '../logger'

/**
 * BullMQ Worker process entrypoint.
 * Listens to documentation-pipeline queue and processes jobs.
 */
export function startPipelineWorker() {
  const connection = createRedisConnection()
  const concurrency = Number(process.env.WORKER_CONCURRENCY || 2)

  logger.info({ concurrency, queue: DOCUMENTATION_PIPELINE_QUEUE_NAME }, 'Starting CDGS Pipeline Worker')

  const worker = new Worker<DocumentationPipelineJob>(
    DOCUMENTATION_PIPELINE_QUEUE_NAME,
    async (job) => {
      await processPipelineJob(job)
    },
    {
      connection,
      concurrency,
    },
  )

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, pipelineRunId: job.data.pipelineRunId }, 'Worker completed job')
  })

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, pipelineRunId: job?.data.pipelineRunId, err: err.message },
      'Worker job failed',
    )
  })

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker connection error')
  })

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal for worker — closing worker...')
    await worker.close()
    await connection.quit()
    logger.info('Worker closed gracefully')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  return worker
}

// Auto-run when this script is executed as the main module
// Works with ts-node-dev, ts-node, and compiled Node
startPipelineWorker()
