import { type Request, type Response, type NextFunction } from 'express'
import { validate } from '../middleware/validate'
import {
  importRepositorySchema,
  repositoryIdParamSchema,
} from './repositories.schema'
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
