import { type Request, type Response, type NextFunction } from 'express'
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken'
import { verifyJwt, getUserById, JWT_COOKIE_NAME } from '../auth/auth.service'
import { logger } from '../logger'

/**
 * Authentication middleware.
 *
 * Reads the `cdgs_token` httpOnly cookie, verifies the JWT, loads the user
 * from the database, and attaches it to `req.user`.
 *
 * On any failure — missing cookie, expired token, invalid token, deactivated
 * user — responds with 401. Never 500.
 *
 * Usage:
 * ```ts
 * router.get('/protected', authenticate, handler)
 * ```
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[JWT_COOKIE_NAME] as string | undefined

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.',
      errors: [],
    })
    return
  }

  try {
    const payload = verifyJwt(token)
    const userId = payload.sub

    if (!userId) {
      throw new JsonWebTokenError('Token has no subject')
    }

    const user = await getUserById(userId)

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found or account is inactive.',
        errors: [],
      })
      return
    }

    req.user = user
    next()
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      logger.debug('JWT expired')
      res.status(401).json({
        success: false,
        message: 'Session expired. Please sign in again.',
        errors: [],
      })
      return
    }

    if (err instanceof JsonWebTokenError) {
      logger.debug({ msg: err.message }, 'Invalid JWT')
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
        errors: [],
      })
      return
    }

    // Unexpected error — pass to error handler
    next(err)
  }
}
