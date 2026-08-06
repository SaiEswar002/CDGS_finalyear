import type { JwtPayload } from 'jsonwebtoken'

/**
 * Authenticated user attached to the request by the `authenticate` middleware.
 */
export interface AuthUser {
  id: string
  githubId: number
  githubLogin: string
  githubName: string | null
  githubAvatarUrl: string | null
  email: string | null
}

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware on protected routes. */
      user?: AuthUser
    }
  }
}

export type JwtUserPayload = JwtPayload & { sub: string }
