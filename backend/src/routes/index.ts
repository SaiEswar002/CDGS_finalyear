import { Router } from 'express'
import { healthRouter } from './health'

/**
 * Root API router.
 * Mounted at /api/v1 in app.ts.
 * Add new sub-routers here as phases are implemented.
 *
 * Current routes:
 *   GET  /api/v1/health
 */
export const apiRouter = Router()

apiRouter.use('/health', healthRouter)

// Phase 2+: mount more sub-routers here
// apiRouter.use('/auth',  authRouter)
// apiRouter.use('/repos', reposRouter)
// apiRouter.use('/runs',  runsRouter)
