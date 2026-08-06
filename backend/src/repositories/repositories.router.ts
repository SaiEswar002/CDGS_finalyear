import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import {
  validateImportBody,
  validateRepoIdParam,
  importRepositoryHandler,
  listRepositoriesHandler,
  getRepositoryHandler,
  deleteRepositoryHandler,
} from './repositories.controller'

export const repositoriesRouter = Router()

// All repository routes require authentication
repositoriesRouter.use(authenticate)

/**
 * @route POST /api/v1/repositories
 * @desc  Import a GitHub repository
 */
repositoriesRouter.post('/', validateImportBody, importRepositoryHandler)

/**
 * @route GET /api/v1/repositories
 * @desc  List imported repositories for the current user
 */
repositoriesRouter.get('/', listRepositoriesHandler)

/**
 * @route GET /api/v1/repositories/:id
 * @desc  Get a single repository by CDGS UUID
 */
repositoriesRouter.get('/:id', validateRepoIdParam, getRepositoryHandler)

/**
 * @route DELETE /api/v1/repositories/:id
 * @desc  Disconnect (delete local record only)
 */
repositoriesRouter.delete('/:id', validateRepoIdParam, deleteRepositoryHandler)
