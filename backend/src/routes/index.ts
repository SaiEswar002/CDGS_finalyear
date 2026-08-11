import { Router } from 'express'
import { healthRouter } from './health'
import { authRouter } from '../auth/auth.router'
import { repositoriesRouter } from '../repositories/repositories.router'
import { githubRouter } from '../github/github.router'
import { pipelineRouter } from '../pipeline/pipeline.router'
import { webhookRouter } from '../webhook/webhook.router'

/**
 * Root API router.
 * Mounted at /api/v1 in app.ts.
 *
 * Current routes:
 *   GET  /api/v1/health
 *   GET  /api/v1/auth/github
 *   GET  /api/v1/auth/github/callback
 *   POST /api/v1/auth/logout
 *   GET  /api/v1/auth/me
 *   GET  /api/v1/github/repos
 *   POST /api/v1/repositories
 *   GET  /api/v1/repositories
 *   GET  /api/v1/repositories/:id
 *   DELETE /api/v1/repositories/:id
 *   GET  /api/v1/pipeline-runs
 *   GET  /api/v1/pipeline-runs/:id
 */
export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/github', githubRouter)
apiRouter.use('/repositories', repositoriesRouter)
apiRouter.use('/pipeline-runs', pipelineRouter)
apiRouter.use('/webhooks', webhookRouter)


