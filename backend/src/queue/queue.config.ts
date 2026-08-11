import Redis from 'ioredis'
import { config } from '../config'
import { logger } from '../logger'

/**
 * Creates an IORedis connection instance for BullMQ queue/worker.
 */
export function createRedisConnection(): Redis {
  const connection = new Redis(config.redis.url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 500, 5000)
      logger.warn({ times, delay }, 'Reconnecting to Redis...')
      return delay
    },
  })

  connection.on('error', (err) => {
    logger.error({ err }, 'Redis connection error')
  })

  return connection
}
