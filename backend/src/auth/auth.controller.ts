import { type Request, type Response, type NextFunction } from 'express'
import { config } from '../config'
import {
  generateAndStoreState,
  validateAndConsumeState,
  upsertUser,
  getUserById,
  issueJwt,
  JWT_COOKIE_NAME,
  STATE_COOKIE_NAME,
} from './auth.service'
import {
  exchangeCodeForToken,
  getAuthenticatedUser,
} from '../github/service'
import { encrypt } from '../lib/crypto'
import { HttpError } from '../middleware/errorHandler'
import { logger } from '../logger'

/** Cookie options shared across auth cookies */
const baseCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProduction,
  path: '/',
}

const JWT_MAX_AGE = 7 * 24 * 60 * 60 * 1000  // 7 days in ms
const STATE_MAX_AGE = 10 * 60 * 1000           // 10 minutes in ms

/**
 * GET /api/v1/auth/github
 * Initiates the GitHub OAuth flow.
 * Generates a random state, stores it, sets a state cookie, redirects to GitHub.
 */
export async function startOAuth(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const state = await generateAndStoreState()

    // Store state in a short-lived httpOnly cookie for callback validation
    res.cookie(STATE_COOKIE_NAME, state, {
      ...baseCookieOptions,
      maxAge: STATE_MAX_AGE,
    })

    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: `${config.isProduction ? 'https' : 'http'}://localhost:${config.port}/api/v1/auth/github/callback`,
      scope: config.github.scopes,
      state,
    })

    res.redirect(`${config.github.authorizeUrl}?${params.toString()}`)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/auth/github/callback
 * Handles the GitHub OAuth callback.
 * Validates state, exchanges code for token, upserts user, issues JWT cookie.
 */
export async function handleOAuthCallback(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { code, state } = req.query as { code?: string; state?: string }

    // Validate state to prevent CSRF
    const cookieState = req.cookies?.[STATE_COOKIE_NAME] as string | undefined
    res.clearCookie(STATE_COOKIE_NAME, baseCookieOptions)

    if (!state || !cookieState || state !== cookieState) {
      logger.warn('OAuth callback: state mismatch')
      throw new HttpError(400, 'INVALID_STATE', 'OAuth state parameter is invalid or missing.')
    }

    const stateValid = await validateAndConsumeState(state)
    if (!stateValid) {
      logger.warn('OAuth callback: state not found in DB or expired')
      throw new HttpError(400, 'INVALID_STATE', 'OAuth state has expired or was already used.')
    }

    if (!code) {
      throw new HttpError(400, 'MISSING_CODE', 'Authorization code is missing.')
    }

    // Exchange code → raw token (immediately encrypted, never stored raw)
    const rawToken = await exchangeCodeForToken(code)

    // Encrypt the token immediately so we can pass it to getAuthenticatedUser
    const encryptedTokenTemp = encrypt(rawToken)
    const githubUser = await getAuthenticatedUser(encryptedTokenTemp)

    // Upsert user — stores the encrypted token
    const { user } = await upsertUser(githubUser, rawToken)

    // Issue JWT containing only user ID
    const jwt = issueJwt(user.id)

    res.cookie(JWT_COOKIE_NAME, jwt, {
      ...baseCookieOptions,
      maxAge: JWT_MAX_AGE,
    })

    logger.info({ userId: user.id, login: user.githubLogin }, 'User authenticated via GitHub OAuth')

    // Redirect browser to the frontend dashboard
    res.redirect(`${config.frontendUrl}/dashboard`)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/auth/logout
 * Clears the JWT cookie. Stateless — no server-side session to destroy.
 */
export function logout(req: Request, res: Response): void {
  res.clearCookie(JWT_COOKIE_NAME, baseCookieOptions)

  logger.info(
    { userId: req.user?.id ?? 'unknown' },
    'User logged out',
  )

  res.json({
    success: true,
    message: 'Logged out successfully.',
    data: {},
  })
}

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user.
 * Protected by the `authenticate` middleware — req.user is always set here.
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getUserById(req.user!.id)

    if (!user) {
      throw new HttpError(401, 'USER_NOT_FOUND', 'User not found or inactive.')
    }

    res.json({
      success: true,
      message: 'Current user retrieved.',
      data: { user },
    })
  } catch (err) {
    next(err)
  }
}
