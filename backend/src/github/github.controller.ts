import { type Request, type Response, type NextFunction } from 'express'
import { getEncryptedTokenForUser } from '../auth/auth.service'
import { listUserRepositories } from './service'
import { HttpError } from '../middleware/errorHandler'

/**
 * GET /api/v1/github/repos
 * Fetches the authenticated user's accessible repositories directly from GitHub API.
 */
export async function getGitHubRepositories(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required.')
    }

    const encryptedToken = await getEncryptedTokenForUser(userId)
    if (!encryptedToken) {
      throw new HttpError(401, 'NO_GITHUB_TOKEN', 'No GitHub access token found for user.')
    }

    const repos = await listUserRepositories(encryptedToken)

    res.json({
      success: true,
      message: 'GitHub repositories fetched successfully.',
      data: { repos },
    })
  } catch (err) {
    next(err)
  }
}
