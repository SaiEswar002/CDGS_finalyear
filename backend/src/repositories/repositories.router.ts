import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import {
  validateImportBody,
  validateRepoIdParam,
  importRepositoryHandler,
  listRepositoriesHandler,
  getRepositoryHandler,
  deleteRepositoryHandler,
  getRepositoryLanguagesHandler,
  getRepositoryCommitsHandler,
  getRepositoryTreeHandler,
  getRepositoryFileHandler,
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
 * @desc  Get a single repository by DocOps UUID
 */
repositoriesRouter.get('/:id', validateRepoIdParam, getRepositoryHandler)

/**
 * @route GET /api/v1/repositories/:id/languages
 * @desc  Get repository language breakdown
 */
repositoriesRouter.get('/:id/languages', validateRepoIdParam, getRepositoryLanguagesHandler)

/**
 * @route GET /api/v1/repositories/:id/commits
 * @desc  Get recent commit history
 */
repositoriesRouter.get('/:id/commits', validateRepoIdParam, getRepositoryCommitsHandler)

/**
 * @route GET /api/v1/repositories/:id/tree
 * @desc  Get full file & folder tree
 */
repositoriesRouter.get('/:id/tree', validateRepoIdParam, getRepositoryTreeHandler)

/**
 * @route GET /api/v1/repositories/:id/file
 * @desc  Get file content
 */
repositoriesRouter.get('/:id/file', validateRepoIdParam, getRepositoryFileHandler)

/**
 * @route DELETE /api/v1/repositories/:id
 * @desc  Disconnect (delete local record only)
 */
repositoriesRouter.delete('/:id', validateRepoIdParam, deleteRepositoryHandler)

