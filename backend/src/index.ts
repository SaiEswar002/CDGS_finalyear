import 'dotenv/config'
import { createApp } from './app'
import { config } from './config'
import { logger } from './logger'

/**
 * Application entrypoint.
 * Boots the Express server on the configured port.
 */
async function main(): Promise<void> {
  const app = createApp()

  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.nodeEnv },
      'DocOps backend started',
    )
  })

  // Graceful shutdown
  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Received shutdown signal — closing server')
    server.close(() => {
      logger.info('HTTP server closed')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => { shutdown('SIGTERM') })
  process.on('SIGINT',  () => { shutdown('SIGINT') })
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Fatal error during startup')
  process.exit(1)
})
