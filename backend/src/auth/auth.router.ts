import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { startOAuth, handleOAuthCallback, logout, getMe } from './auth.controller'
import { authenticate } from '../middleware/authenticate'

export const authRouter = Router()

/** Rate limiter for OAuth endpoints — 20 requests per 15 minutes per IP */
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    errors: [],
  },
})

/**
 * @route GET /api/v1/auth/github
 * @desc  Start GitHub OAuth flow
 */
authRouter.get('/github', oauthLimiter, startOAuth)

/**
 * @route GET /api/v1/auth/github/callback
 * @desc  GitHub OAuth callback — validates state, issues JWT
 */
authRouter.get('/github/callback', oauthLimiter, handleOAuthCallback)

/**
 * @route POST /api/v1/auth/logout
 * @desc  Clear JWT cookie
 */
authRouter.post('/logout', authenticate, logout)

/**
 * @route GET /api/v1/auth/me
 * @desc  Get current authenticated user
 */
authRouter.get('/me', authenticate, getMe)
