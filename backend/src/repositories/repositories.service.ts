import { getSupabaseClient } from '../db/supabaseClient'
import { getEncryptedTokenForUser } from '../auth/auth.service'
import { getRepository as getGitHubRepo } from '../github/service'
import { HttpError } from '../middleware/errorHandler'
import { logger } from '../logger'
import type { ImportRepositoryBody } from './repositories.schema'

/** Shape of a repository record as stored/returned by DocOps */
export interface Repository {
  id: string
  user_id: string
  github_repo_id: number
  owner: string
  name: string
  full_name: string
  default_branch: string
  selected_branch: string | null
  private: boolean
  description: string | null
  language: string | null
  clone_url: string | null
  html_url: string | null
  is_active: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

const REPO_SELECT = '*'

/**
 * Imports a GitHub repository for the given user.
 *
 * Steps:
 * 1. Check for duplicate (user already imported this repo)
 * 2. Get the user's encrypted token → verify GitHub access via github/service.ts
 * 3. Insert the repository record
 *
 * @throws HttpError 409 on duplicate
 * @throws HttpError 403 if user cannot access the repo on GitHub
 */
export async function importRepository(
  userId: string,
  body: ImportRepositoryBody,
): Promise<Repository> {
  const supabase = getSupabaseClient()

  // 1. Duplicate check
  const { data: existing } = await supabase
    .from('repositories')
    .select('id')
    .eq('user_id', userId)
    .eq('github_repo_id', body.github_repo_id)
    .maybeSingle()

  if (existing) {
    throw new HttpError(409, 'DUPLICATE_REPOSITORY', 'This repository has already been imported.')
  }

  // 2. Verify the user can access this repo on GitHub
  const encryptedToken = await getEncryptedTokenForUser(userId)
  if (!encryptedToken) {
    throw new HttpError(401, 'NO_TOKEN', 'GitHub token not found. Please sign in again.')
  }

  const githubRepo = await getGitHubRepo(encryptedToken, body.owner, body.name)
  if (!githubRepo) {
    throw new HttpError(
      403,
      'REPO_NOT_ACCESSIBLE',
      'Repository not found or you do not have access to it on GitHub.',
    )
  }

  // Confirm the repo ID matches what the client sent
  if (githubRepo.id !== body.github_repo_id) {
    throw new HttpError(
      400,
      'REPO_ID_MISMATCH',
      'The provided github_repo_id does not match the repository found on GitHub.',
    )
  }

  // 3. Insert
  const { data, error } = await supabase
    .from('repositories')
    .insert({
      user_id: userId,
      github_repo_id: githubRepo.id,
      owner: githubRepo.owner.login,
      name: githubRepo.name,
      full_name: githubRepo.full_name,
      default_branch: githubRepo.default_branch,
      selected_branch: githubRepo.default_branch,
      is_private: githubRepo.private,
      description: githubRepo.description,
      language: githubRepo.language,
      clone_url: githubRepo.clone_url,
      html_url: githubRepo.html_url,
      is_active: true,
      last_synced_at: new Date().toISOString(),
    })
    .select(REPO_SELECT)
    .single()

  if (error || !data) {
    logger.error({ err: error }, 'Failed to insert repository')
    throw new HttpError(500, 'DB_ERROR', 'Failed to import repository.')
  }

  const repo = data as unknown as Repository
  logger.info({ userId, repoId: repo.id, fullName: repo.full_name }, 'Repository imported')
  return repo
}

/**
 * Lists all repositories imported by the given user.
 */
export async function listRepositories(userId: string): Promise<Repository[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('repositories')
    .select(REPO_SELECT)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })

  if (error) {
    logger.error({ err: error }, 'Failed to list repositories')
    throw new HttpError(500, 'DB_ERROR', 'Failed to retrieve repositories.')
  }

  return (data ?? []) as unknown as Repository[]
}

/**
 * Gets a single repository by DocOps ID, enforcing user ownership.
 *
 * @throws HttpError 404 if not found or not owned by this user
 */
export async function getRepository(
  userId: string,
  repoId: string,
): Promise<Repository> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('repositories')
    .select(REPO_SELECT)
    .eq('id', repoId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    logger.error({ err: error }, 'Failed to get repository')
    throw new HttpError(500, 'DB_ERROR', 'Failed to retrieve repository.')
  }

  if (!data) {
    throw new HttpError(404, 'REPO_NOT_FOUND', 'Repository not found.')
  }

  return data as unknown as Repository
}

/**
 * Deletes the local repository connection.
 * This NEVER touches GitHub — it only removes the DocOps record.
 *
 * @throws HttpError 404 if not found or not owned by this user
 */
export async function deleteRepository(
  userId: string,
  repoId: string,
): Promise<void> {
  const supabase = getSupabaseClient()

  // Verify ownership first
  await getRepository(userId, repoId)

  const { error } = await supabase
    .from('repositories')
    .delete()
    .eq('id', repoId)
    .eq('user_id', userId)

  if (error) {
    logger.error({ err: error }, 'Failed to delete repository')
    throw new HttpError(500, 'DB_ERROR', 'Failed to disconnect repository.')
  }

  logger.info({ userId, repoId }, 'Repository disconnected (local only)')
}

/**
 * Gets languages breakdown for a repository.
 */
export async function getRepositoryLanguagesService(
  userId: string,
  repoId: string,
) {
  const repo = await getRepository(userId, repoId)
  const encryptedToken = await getEncryptedTokenForUser(userId)
  if (!encryptedToken) {
    throw new HttpError(401, 'NO_TOKEN', 'GitHub token not found. Please sign in again.')
  }

  const { getRepositoryLanguages } = await import('../github/service')
  const rawLangs = await getRepositoryLanguages(encryptedToken, repo.owner, repo.name)

  const totalBytes = Object.values(rawLangs).reduce((acc, bytes) => acc + bytes, 0)
  const languages = Object.entries(rawLangs).map(([name, bytes]) => ({
    name,
    bytes,
    percentage: totalBytes > 0 ? Number(((bytes / totalBytes) * 100).toFixed(1)) : 0,
  }))

  return { languages, totalBytes }
}

/**
 * Gets commit history for a repository.
 */
export async function getRepositoryCommitsService(
  userId: string,
  repoId: string,
) {
  const repo = await getRepository(userId, repoId)
  const encryptedToken = await getEncryptedTokenForUser(userId)
  if (!encryptedToken) {
    throw new HttpError(401, 'NO_TOKEN', 'GitHub token not found. Please sign in again.')
  }

  const { getRepositoryCommits } = await import('../github/service')
  const branch = repo.selected_branch ?? repo.default_branch ?? 'main'
  const commits = await getRepositoryCommits(encryptedToken, repo.owner, repo.name, branch, 20)

  return { commits }
}

/**
 * Gets repository file & folder tree.
 */
export async function getRepositoryTreeService(
  userId: string,
  repoId: string,
) {
  const repo = await getRepository(userId, repoId)
  const encryptedToken = await getEncryptedTokenForUser(userId)
  if (!encryptedToken) {
    throw new HttpError(401, 'NO_TOKEN', 'GitHub token not found. Please sign in again.')
  }

  const { getRepositoryTree } = await import('../github/service')
  const branch = repo.selected_branch ?? repo.default_branch ?? 'main'
  const tree = await getRepositoryTree(encryptedToken, repo.owner, repo.name, branch)

  return { tree, count: tree.length }
}

/**
 * Reads file content from GitHub repository.
 */
export async function getRepositoryFileService(
  userId: string,
  repoId: string,
  filePath: string,
) {
  const repo = await getRepository(userId, repoId)
  const encryptedToken = await getEncryptedTokenForUser(userId)
  if (!encryptedToken) {
    throw new HttpError(401, 'NO_TOKEN', 'GitHub token not found. Please sign in again.')
  }

  const { getFileContent } = await import('../github/service')
  const branch = repo.selected_branch ?? repo.default_branch ?? 'main'
  const file = await getFileContent(encryptedToken, repo.owner, repo.name, filePath, branch)

  if (!file) {
    throw new HttpError(404, 'FILE_NOT_FOUND', 'File not found or not accessible on GitHub.')
  }

  // Construct edit URL on GitHub
  const editUrl = `https://github.com/${repo.owner}/${repo.name}/edit/${branch}/${filePath}`

  return { file, editUrl }
}


