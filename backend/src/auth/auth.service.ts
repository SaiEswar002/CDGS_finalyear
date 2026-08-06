import { randomBytes } from 'crypto'
import { sign, verify, type SignOptions } from 'jsonwebtoken'
import { config } from '../config'
import { encrypt } from '../lib/crypto'
import { getSupabaseClient } from '../db/supabaseClient'
import { logger } from '../logger'
import type { AuthUser, JwtUserPayload } from '../types/express'
import type { GitHubUser } from '../github/service'

const JWT_COOKIE_NAME = 'cdgs_token'
const STATE_COOKIE_NAME = 'cdgs_oauth_state'

export { JWT_COOKIE_NAME, STATE_COOKIE_NAME }

// ── State management (OAuth CSRF) ──────────────────────────────────────────

/**
 * Generates a cryptographically random state string for OAuth CSRF protection.
 * The state is stored in the DB (oauth_states table) and also in a short-lived
 * httpOnly cookie. Both must match on the callback.
 *
 * @returns 64-char hex state string
 */
export async function generateAndStoreState(): Promise<string> {
  const state = randomBytes(32).toString('hex')
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('oauth_states')
    .insert({ state })

  if (error) {
    logger.error({ err: error }, 'Failed to store OAuth state')
    throw new Error('Failed to initiate OAuth flow')
  }

  return state
}

/**
 * Validates and consumes an OAuth state token.
 * Deletes it from the DB after use to prevent replay.
 *
 * @returns true if the state was valid and not expired
 */
export async function validateAndConsumeState(state: string): Promise<boolean> {
  if (!state || state.length !== 64) return false

  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('oauth_states')
    .select('id, expires_at')
    .eq('state', state)
    .single()

  if (error || !data) return false

  // Delete whether valid or expired — single use
  await supabase.from('oauth_states').delete().eq('state', state)

  // Check expiry
  if (new Date(data.expires_at as string) < new Date()) return false

  return true
}

// ── User upsert ────────────────────────────────────────────────────────────

interface UpsertUserResult {
  user: AuthUser
}

/**
 * Creates or updates a user record after successful GitHub OAuth.
 * Stores the encrypted GitHub access token. Never logs the raw token.
 *
 * @param githubUser - User data from GitHub API
 * @param rawToken - Raw GitHub access token (encrypted immediately, never stored raw)
 */
export async function upsertUser(
  githubUser: GitHubUser,
  rawToken: string,
): Promise<UpsertUserResult> {
  const encryptedToken = encrypt(rawToken)
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        github_id: githubUser.id,
        github_login: githubUser.login,
        github_name: githubUser.name,
        github_avatar_url: githubUser.avatar_url,
        email: githubUser.email,
        is_active: true,
        github_access_token_enc: encryptedToken,
      },
      {
        onConflict: 'github_id',
        ignoreDuplicates: false,
      },
    )
    .select('id, github_id, github_login, github_name, github_avatar_url, email')
    .single()

  if (error || !data) {
    logger.error({ err: error }, 'Failed to upsert user')
    throw new Error('Failed to create or update user')
  }

  const user: AuthUser = {
    id: data.id as string,
    githubId: data.github_id as number,
    githubLogin: data.github_login as string,
    githubName: data.github_name as string | null,
    githubAvatarUrl: data.github_avatar_url as string | null,
    email: data.email as string | null,
  }

  return { user }
}

/**
 * Fetches a user by ID (used in the authenticate middleware).
 */
export async function getUserById(id: string): Promise<AuthUser | null> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, github_id, github_login, github_name, github_avatar_url, email, is_active')
    .eq('id', id)
    .single()

  if (error || !data) return null
  if (!(data.is_active as boolean)) return null

  return {
    id: data.id as string,
    githubId: data.github_id as number,
    githubLogin: data.github_login as string,
    githubName: data.github_name as string | null,
    githubAvatarUrl: data.github_avatar_url as string | null,
    email: data.email as string | null,
  }
}

/**
 * Retrieves the encrypted GitHub token for a user.
 * Only `github/service.ts` should call this to decrypt it.
 */
export async function getEncryptedTokenForUser(userId: string): Promise<string | null> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('users')
    .select('github_access_token_enc')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data.github_access_token_enc as string | null
}

// ── JWT ────────────────────────────────────────────────────────────────────

/**
 * Issues a signed JWT for the given user ID.
 * The JWT payload contains only `{ sub: userId }` — no sensitive data.
 *
 * @returns Signed JWT string
 */
export function issueJwt(userId: string): string {
  const options: SignOptions = {
    subject: userId,
    expiresIn: config.auth.jwtExpiresIn as SignOptions['expiresIn'],
    issuer: 'cdgs',
  }
  return sign({}, config.auth.jwtSecret, options)
}

/**
 * Verifies and decodes a JWT.
 *
 * @returns Decoded payload with `sub`
 * @throws `JsonWebTokenError` | `TokenExpiredError` if invalid
 */
export function verifyJwt(token: string): JwtUserPayload {
  return verify(token, config.auth.jwtSecret, {
    issuer: 'cdgs',
  }) as JwtUserPayload
}
