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
  triggerPipelineHandler,
  triggerAllPipelinesHandler,
} from './repositories.controller'
import {
  getRepoDocVersionsHandler,
  getLatestRepoDocsHandler,
  getDocVersionByIdHandler,
  downloadLatestDocPdfHandler,
  downloadVersionDocPdfHandler,
} from './docgen.controller'

export const repositoriesRouter = Router()

// All repository routes require authentication
repositoriesRouter.use(authenticate)

/**
 * @route POST /api/v1/repositories
 * @desc  Import a GitHub repository
 */
repositoriesRouter.post('/', validateImportBody, importRepositoryHandler)

/**
 * @route POST /api/v1/repositories/trigger-all
 * @desc  Trigger pipeline runs for all user connected repositories
 */
repositoriesRouter.post('/trigger-all', triggerAllPipelinesHandler)

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
 * @route POST /api/v1/repositories/:id/trigger-pipeline
 * @desc  Trigger manual pipeline run for a repository (optionally for specific commit)
 */
repositoriesRouter.post('/:id/trigger-pipeline', validateRepoIdParam, triggerPipelineHandler)

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
 * @route GET /api/v1/repositories/:id/docs/latest/pdf
 * @desc  Export latest generated documentation snapshot as PDF
 */
repositoriesRouter.get('/:id/docs/latest/pdf', validateRepoIdParam, downloadLatestDocPdfHandler)

/**
 * @route GET /api/v1/repositories/:id/docs/latest
 * @desc  Get latest generated documentation version and artifacts
 */
repositoriesRouter.get('/:id/docs/latest', validateRepoIdParam, getLatestRepoDocsHandler)

/**
 * @route GET /api/v1/repositories/:id/docs/versions
 * @desc  List generated documentation version snapshots
 */
repositoriesRouter.get('/:id/docs/versions', validateRepoIdParam, getRepoDocVersionsHandler)

/**
 * @route GET /api/v1/repositories/:id/docs/versions/:versionId/pdf
 * @desc  Export specific generated documentation version snapshot as PDF
 */
repositoriesRouter.get('/:id/docs/versions/:versionId/pdf', validateRepoIdParam, downloadVersionDocPdfHandler)

/**
 * @route GET /api/v1/repositories/:id/docs/versions/:versionId
 * @desc  Get specific generated documentation version and artifacts
 */
repositoriesRouter.get('/:id/docs/versions/:versionId', validateRepoIdParam, getDocVersionByIdHandler)

/**
 * @route DELETE /api/v1/repositories/:id
 * @desc  Disconnect (delete local record only)
 */
repositoriesRouter.delete('/:id', validateRepoIdParam, deleteRepositoryHandler)


