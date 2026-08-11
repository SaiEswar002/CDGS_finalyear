import { type Request, type Response, type NextFunction } from 'express'
import { validate } from '../middleware/validate'
import {
  importRepositorySchema,
  repositoryIdParamSchema,
} from './repositories.schema'
import { HttpError } from '../middleware/errorHandler'
import {
  importRepository,
  listRepositories,
  getRepository,
  deleteRepository,
} from './repositories.service'

// ── Validation middleware instances ────────────────────────────────────────

export const validateImportBody = validate({ body: importRepositorySchema })
export const validateRepoIdParam = validate({ params: repositoryIdParamSchema })

// ── Controllers ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/repositories
 * Import a GitHub repository for the authenticated user.
 */
export async function importRepositoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repo = await importRepository(req.user!.id, req.body as import('./repositories.schema').ImportRepositoryBody)

    res.status(201).json({
      success: true,
      message: 'Repository imported successfully.',
      data: { repository: repo },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/repositories
 * List all repositories imported by the authenticated user.
 */
export async function listRepositoriesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repos = await listRepositories(req.user!.id)

    res.json({
      success: true,
      message: 'Repositories retrieved.',
      data: { repositories: repos, count: repos.length },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/repositories/:id
 * Get a single repository (must be owned by authenticated user).
 */
export async function getRepositoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repo = await getRepository(req.user!.id, req.params.id)

    res.json({
      success: true,
      message: 'Repository retrieved.',
      data: { repository: repo },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/repositories/:id
 * Disconnect a repository (local record only — never deletes from GitHub).
 */
export async function deleteRepositoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteRepository(req.user!.id, req.params.id)

    res.json({
      success: true,
      message: 'Repository disconnected successfully.',
      data: {},
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/repositories/:id/languages
 */
export async function getRepositoryLanguagesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { getRepositoryLanguagesService } = await import('./repositories.service')
    const result = await getRepositoryLanguagesService(req.user!.id, req.params.id)

    res.json({
      success: true,
      message: 'Languages retrieved successfully.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/repositories/:id/commits
 */
export async function getRepositoryCommitsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { getRepositoryCommitsService } = await import('./repositories.service')
    const result = await getRepositoryCommitsService(req.user!.id, req.params.id)

    res.json({
      success: true,
      message: 'Commits retrieved successfully.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/repositories/:id/tree
 */
export async function getRepositoryTreeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { getRepositoryTreeService } = await import('./repositories.service')
    const result = await getRepositoryTreeService(req.user!.id, req.params.id)

    res.json({
      success: true,
      message: 'Repository tree retrieved successfully.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/repositories/:id/file?path=...
 */
export async function getRepositoryFileHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filePath = req.query.path as string
    if (!filePath) {
      throw new HttpError(400, 'PATH_REQUIRED', 'Query parameter "path" is required.')
    }

    const { getRepositoryFileService } = await import('./repositories.service')
    const result = await getRepositoryFileService(req.user!.id, req.params.id, filePath)

    res.json({
      success: true,
      message: 'File content retrieved successfully.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}


