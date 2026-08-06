import express, { type Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { pinoHttp } from 'pino-http'
import rateLimit from 'express-rate-limit'
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

  // Trust proxy — required when behind nginx/load balancer for rate limiting
  app.set('trust proxy', 1)

  // ── Security ──────────────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false, // Allow Swagger UI to load
  }))

  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,               // Required for cookies
    }),
  )

  // ── Cookie parsing ────────────────────────────────────────
  // Parses signed and unsigned cookies.
  // JWT is unsigned (signature is inside the JWT itself).
  app.use(cookieParser(config.auth.cookieSecret))

  // ── Request parsing ───────────────────────────────────────
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Global rate limiter ───────────────────────────────────
  // Generous limit — OAuth routes have a tighter limiter in their router.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => config.isTest,  // Don't rate-limit in tests
    }),
  )

  // ── Structured HTTP logging (pino-http) ───────────────────
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) =>
          config.isProduction && req.url === '/api/v1/health',
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
      message: 'The requested resource was not found.',
      errors: [],
    })
  })

  // ── Centralized error handler (must be last) ──────────────
  app.use(errorHandler)

  return app
}
