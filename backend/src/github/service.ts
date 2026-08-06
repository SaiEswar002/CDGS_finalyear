import axios from 'axios'
import { config } from '../config'
import { decrypt } from '../lib/crypto'
import { logger } from '../logger'

/** GitHub user shape returned by GET /user */
export interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string
  email: string | null
}

/** GitHub repository shape returned by GET /user/repos and GET /repos/:owner/:repo */
export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  private: boolean
  description: string | null
  language: string | null
  default_branch: string
  clone_url: string
  html_url: string
}

/** Token exchange response from GitHub */
interface TokenResponse {
  access_token: string
  scope: string
  token_type: string
}

/**
 * Creates an Axios instance authenticated with a decrypted GitHub token.
 * This is the ONLY place tokens are decrypted.
 *
 * @param encryptedToken - The AES-256-GCM encrypted token from the DB
 * @internal
 */
function createGitHubClient(encryptedToken: string): ReturnType<typeof axios.create> {
  const token = decrypt(encryptedToken)

  return axios.create({
    baseURL: config.github.apiBase,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    timeout: 10_000,
  })
}

/**
 * Exchanges a GitHub OAuth authorization code for an access token.
 *
 * @param code - The code received in the OAuth callback query param
 * @returns The raw GitHub access token (will be encrypted before storing)
 * @throws On network failure or GitHub error response
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await axios.post<TokenResponse>(
    config.github.tokenUrl,
    {
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code,
    },
    {
      headers: { Accept: 'application/json' },
      timeout: 10_000,
    },
  )

  const { access_token } = response.data

  if (!access_token) {
    logger.warn('GitHub token exchange returned no access_token')
    throw new Error('GitHub token exchange failed — no access_token in response')
  }

  // NOTE: we return the raw token here ONLY so auth.service can encrypt it
  // immediately before storing. It is never logged.
  return access_token
}

/**
 * Fetches the authenticated GitHub user's profile.
 *
 * @param encryptedToken - Encrypted GitHub access token from the DB
 * @returns GitHub user profile
 */
export async function getAuthenticatedUser(
  encryptedToken: string,
): Promise<GitHubUser> {
  const client = createGitHubClient(encryptedToken)
  const { data } = await client.get<GitHubUser>('/user')
  return data
}

/**
 * Lists all repositories accessible to the authenticated user.
 * Fetches up to 100 repos per page (max allowed by GitHub).
 *
 * @param encryptedToken - Encrypted GitHub access token from the DB
 * @returns Array of GitHub repositories
 */
export async function listUserRepositories(
  encryptedToken: string,
): Promise<GitHubRepo[]> {
  const client = createGitHubClient(encryptedToken)
  const { data } = await client.get<GitHubRepo[]>('/user/repos', {
    params: { per_page: 100, sort: 'updated', affiliation: 'owner,collaborator' },
  })
  return data
}

/**
 * Fetches a single repository by owner and name.
 * Used to verify the user can access a repo before import.
 *
 * @param encryptedToken - Encrypted GitHub access token from the DB
 * @param owner - Repository owner (GitHub login)
 * @param repo - Repository name
 * @returns The repository, or null if not found / not accessible
 */
export async function getRepository(
  encryptedToken: string,
  owner: string,
  repo: string,
): Promise<GitHubRepo | null> {
  try {
    const client = createGitHubClient(encryptedToken)
    const { data } = await client.get<GitHubRepo>(`/repos/${owner}/${repo}`)
    return data
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 403)) {
      return null
    }
    throw err
  }
}

/**
 * Refreshes repository metadata from GitHub (name, description, language, etc.).
 *
 * @param encryptedToken - Encrypted GitHub access token from the DB
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Updated repository data, or null if no longer accessible
 */
export async function refreshRepositoryMetadata(
  encryptedToken: string,
  owner: string,
  repo: string,
): Promise<GitHubRepo | null> {
  return getRepository(encryptedToken, owner, repo)
}
