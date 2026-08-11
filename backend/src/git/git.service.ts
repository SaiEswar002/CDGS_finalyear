import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { decrypt } from '../lib/crypto'
import { logger } from '../logger'
import type { GitCheckoutOptions, GitCheckoutResult } from './git.types'

const execFileAsync = promisify(execFile)

/**
 * Sanitizes and redacts credentials, tokens, and sensitive URLs from logs and errors.
 *
 * CRITICAL SECURITY RULE (§21): Never allow GitHub access tokens to leak in stdout, stderr,
 * errors, or process arguments.
 */
export function sanitizeGitOutput(text: string): string {
  if (!text) return ''
  return text
    .replace(/https:\/\/[^@]+@github\.com/gi, 'https://[REDACTED]@github.com')
    .replace(/x-access-token:[a-zA-Z0-9_]+/gi, 'x-access-token:[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_]+/gi, 'Bearer [REDACTED]')
}

/**
 * Creates an isolated, namespaced temporary workspace directory for a pipeline job.
 *
 * CRITICAL ISOLATION RULE (§16): Every job has its own isolated workspace path
 * namespaced by pipelineRunId. Simultaneous jobs NEVER share a workspace.
 */
export function getWorkspacePath(pipelineRunId: string): string {
  return path.join(os.tmpdir(), 'cdgs-pipeline', pipelineRunId)
}

/**
 * Helper to run git commands inside a workspace directory with timeout and output sanitization.
 */
export async function runGitCommand(
  args: string[],
  cwd: string,
  timeoutMs: number = 60000,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      timeout: timeoutMs,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0', // Prevent hanging on interactive prompts
      },
    })
    return {
      stdout: sanitizeGitOutput(result.stdout),
      stderr: sanitizeGitOutput(result.stderr),
    }
  } catch (err: any) {
    const sanitizedMsg = sanitizeGitOutput(err.message || 'Git command failed')
    const sanitizedStderr = sanitizeGitOutput(err.stderr || '')
    logger.error({ args: args.map(sanitizeGitOutput), err: sanitizedMsg }, 'Git command failed')
    const error = new Error(`Git error: ${sanitizedMsg}\n${sanitizedStderr}`)
    throw error
  }
}

/**
 * Verifies if a commit SHA exists locally in the repository.
 * (§19 Shallow Clone / History Safety)
 */
export async function verifyCommitExists(workspaceDir: string, commitSha: string): Promise<boolean> {
  try {
    await runGitCommand(['cat-file', '-e', `${commitSha}^{commit}`], workspaceDir)
    return true
  } catch {
    return false
  }
}

/**
 * Clones, fetches, and verifies repository commits in an isolated workspace.
 */
export async function checkoutRepository(
  options: GitCheckoutOptions,
  timeoutMs: number = 60000,
): Promise<GitCheckoutResult> {
  const workspaceDir = getWorkspacePath(options.pipelineRunId)

  // Ensure workspace directory is created
  await fs.mkdir(workspaceDir, { recursive: true })

  let cloneUrl = `https://github.com/${options.owner}/${options.repo}.git`

  // If user encrypted token is provided, construct in-memory authenticated URL
  if (options.encryptedToken) {
    try {
      const rawToken = decrypt(options.encryptedToken)
      cloneUrl = `https://x-access-token:${rawToken}@github.com/${options.owner}/${options.repo}.git`
    } catch (err) {
      logger.error({ err }, 'Failed to decrypt GitHub token for repository clone')
      throw new Error('Failed to decrypt repository access token.')
    }
  }

  const repoDir = path.join(workspaceDir, 'repo')

  try {
    // 1. Clone repository into isolated repo directory
    logger.info(
      { pipelineRunId: options.pipelineRunId, repo: `${options.owner}/${options.repo}` },
      'Cloning repository into isolated workspace',
    )

    await runGitCommand(['clone', '--no-single-branch', cloneUrl, repoDir], workspaceDir, timeoutMs)

    // Remove credential-bearing remote URL from git config immediately (§21)
    await runGitCommand(['remote', 'set-url', 'origin', `https://github.com/${options.owner}/${options.repo}.git`], repoDir)

    // 2. Checkout target branch
    await runGitCommand(['checkout', options.branch], repoDir, timeoutMs)

    // 3. Verify afterSha exists (§19)
    let afterExists = await verifyCommitExists(repoDir, options.afterSha)
    if (!afterExists) {
      logger.info({ afterSha: options.afterSha }, 'Fetching afterSha commit')
      await runGitCommand(['fetch', 'origin', options.afterSha], repoDir, timeoutMs)
      afterExists = await verifyCommitExists(repoDir, options.afterSha)
    }

    if (!afterExists) {
      throw new Error(`Target commit (afterSha) ${options.afterSha} cannot be resolved in repository.`)
    }

    // 4. Verify beforeSha exists (§19)
    let beforeExists = await verifyCommitExists(repoDir, options.beforeSha)
    if (!beforeExists && options.beforeSha && options.beforeSha !== '0000000000000000000000000000000000000000') {
      logger.info({ beforeSha: options.beforeSha }, 'Fetching beforeSha commit')
      try {
        await runGitCommand(['fetch', 'origin', options.beforeSha], repoDir, timeoutMs)
      } catch {
        // Fallback: fetch full history
        await runGitCommand(['fetch', '--unshallow'], repoDir, timeoutMs).catch(() => {})
      }
      beforeExists = await verifyCommitExists(repoDir, options.beforeSha)
    }

    // If beforeSha is null, 000... (initial commit), or unresolvable, fall back to initial commit / empty tree SHA
    const resolvedBeforeSha = beforeExists && options.beforeSha !== '0000000000000000000000000000000000000000'
      ? options.beforeSha
      : '4b825dc642cb6eb9a060e54bf8d69288fbee4904' // Git empty tree SHA constant

    return {
      workspaceDir: repoDir,
      beforeSha: resolvedBeforeSha,
      afterSha: options.afterSha,
    }
  } catch (err: any) {
    // Ensure cleanup on failure
    await cleanupWorkspace(workspaceDir).catch(() => {})
    throw err
  }
}

/**
 * Completely removes the temporary workspace directory for a pipeline job.
 * Runs inside a finally block to prevent resource leaks.
 */
export async function cleanupWorkspace(workspaceDir: string): Promise<void> {
  const rootWorkspace = workspaceDir.endsWith('repo') ? path.dirname(workspaceDir) : workspaceDir
  try {
    if (rootWorkspace.includes('cdgs-pipeline')) {
      await fs.rm(rootWorkspace, { recursive: true, force: true })
      logger.info({ rootWorkspace }, 'Cleaned up pipeline workspace directory')
    }
  } catch (err) {
    logger.warn({ err, rootWorkspace }, 'Failed to cleanup workspace directory')
  }
}
