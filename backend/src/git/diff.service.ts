import { runGitCommand } from './git.service'
import type { ChangeSet, ChangedFile } from '../pipeline/pipeline.types'
import { logger } from '../logger'

/**
 * Computes git diff between beforeSha and afterSha inside a repository workspace.
 *
 * CRITICAL RULE (§23 & §24):
 * - Uses Git as source of truth (deterministic)
 * - Returns exact ChangeSet shape with summary (added, modified, deleted) and files array.
 */
export async function generateChangeSet(
  workspaceDir: string,
  beforeSha: string,
  afterSha: string,
): Promise<ChangeSet> {
  // 1. Run git diff --name-status to determine file status (A, M, D, R)
  const nameStatusRes = await runGitCommand(
    ['diff', '--name-status', beforeSha, afterSha],
    workspaceDir,
  )

  // 2. Run git diff --numstat to determine line additions and deletions
  const numstatRes = await runGitCommand(
    ['diff', '--numstat', beforeSha, afterSha],
    workspaceDir,
  )

  const statusMap = new Map<string, 'added' | 'modified' | 'deleted'>()

  // Parse name-status lines: e.g. "M\tsrc/index.ts" or "A\tREADME.md" or "R100\told.ts\tnew.ts"
  for (const line of nameStatusRes.stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split('\t')
    const statusCode = parts[0] ? parts[0][0] : ''
    const filePath = parts.length > 2 ? parts[2] : parts[1] // Handle rename (R)

    if (!filePath) continue

    let status: 'added' | 'modified' | 'deleted' = 'modified'
    if (statusCode === 'A') status = 'added'
    else if (statusCode === 'D') status = 'deleted'

    statusMap.set(filePath, status)
  }

  const files: ChangedFile[] = []
  let addedCount = 0
  let modifiedCount = 0
  let deletedCount = 0

  // Parse numstat lines: e.g. "10\t2\tsrc/index.ts" or "-\t-\tbinary.png"
  for (const line of numstatRes.stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split('\t')
    if (parts.length < 3) continue

    const rawAdditions = parts[0]
    const rawDeletions = parts[1]
    const filePath = parts[2]

    const additions = rawAdditions === '-' ? 0 : parseInt(rawAdditions, 10) || 0
    const deletions = rawDeletions === '-' ? 0 : parseInt(rawDeletions, 10) || 0
    const status = statusMap.get(filePath) || 'modified'

    files.push({
      path: filePath,
      status,
      additions,
      deletions,
    })

    if (status === 'added') addedCount++
    else if (status === 'modified') modifiedCount++
    else if (status === 'deleted') deletedCount++
  }

  const changeset: ChangeSet = {
    beforeSha,
    afterSha,
    files,
    summary: {
      added: addedCount,
      modified: modifiedCount,
      deleted: deletedCount,
    },
  }

  logger.info(
    { beforeSha, afterSha, totalFiles: files.length, summary: changeset.summary },
    'Generated ChangeSet from git diff',
  )

  return changeset
}
