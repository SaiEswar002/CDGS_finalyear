import express, { type Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { logger } from './logger'
import { config } from './config'
import { apiRouter } from './routes'
import { errorHandler } from './middleware/errorHandler'
import { mountSwagger } from './swagger/swagger'

/**
 * Creates and configures the Express application.
 * Exported as a factory to make testing easier (no side effects at import time).
 *
 * @returns Configured Express app instance
 */
export function createApp(): Application {
  const app = express()

  // ── Security ──────────────────────────────────────────────
  app.use(helmet())
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
    }),
  )

  // ── Request parsing ───────────────────────────────────────
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Structured HTTP logging (pino-http) ───────────────────
  app.use(
    pinoHttp({
      logger,
      // Don't log health check pings in production to reduce noise
      autoLogging: {
        ignore: (req) =>
          config.nodeEnv === 'production' &&
          req.url === '/api/v1/health',
      },
    }),
  )

  // ── API routes ────────────────────────────────────────────
  app.use('/api/v1', apiRouter)

  // ── Swagger UI ────────────────────────────────────────────
  mountSwagger(app)

  // ── 404 catch-all ─────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
    })
  })

  // ── Centralized error handler (must be last) ──────────────
  app.use(errorHandler)

  return app
}
