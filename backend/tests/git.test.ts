import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { getWorkspacePath, sanitizeGitOutput, cleanupWorkspace } from '../src/git/git.service'
import { generateChangeSet } from '../src/git/diff.service'

describe('Git Service & Diff Service', () => {
  const mockRunId1 = '11111111-1111-1111-1111-111111111111'
  const mockRunId2 = '22222222-2222-2222-2222-222222222222'

  describe('Workspace Isolation (§16)', () => {
    it('creates unique namespaced workspace paths per pipelineRunId', () => {
      const path1 = getWorkspacePath(mockRunId1)
      const path2 = getWorkspacePath(mockRunId2)

      expect(path1).toContain(mockRunId1)
      expect(path2).toContain(mockRunId2)
      expect(path1).not.toBe(path2)
    })

    it('cleans up workspace directory safely without affecting others', async () => {
      const testWorkspace = path.join(os.tmpdir(), 'cdgs-pipeline', 'test-cleanup-run')
      await fs.mkdir(testWorkspace, { recursive: true })
      await fs.writeFile(path.join(testWorkspace, 'dummy.txt'), 'hello')

      expect(await fs.stat(testWorkspace).catch(() => null)).not.toBeNull()

      await cleanupWorkspace(testWorkspace)

      expect(await fs.stat(testWorkspace).catch(() => null)).toBeNull()
    })
  })

  describe('Credential Redaction & Security (§21)', () => {
    it('sanitizes token-bearing URLs and Bearer headers', () => {
      const sensitive1 = 'https://x-access-token:ghp_1234567890secrettoken@github.com/owner/repo.git'
      const sensitive2 = 'x-access-token:ghp_1234567890secrettoken'
      const sensitive3 = 'Authorization: Bearer ghp_secret123456'

      const sanitized1 = sanitizeGitOutput(sensitive1)
      const sanitized2 = sanitizeGitOutput(sensitive2)
      const sanitized3 = sanitizeGitOutput(sensitive3)

      expect(sanitized1).toBe('https://[REDACTED]@github.com/owner/repo.git')
      expect(sanitized2).toBe('x-access-token:[REDACTED]')
      expect(sanitized3).toBe('Authorization: Bearer [REDACTED]')
    })
  })

  describe('ChangeSet Structure (§23 & §24)', () => {
    it('constructs ChangeSet object with summary counts matching Shared Contract #2', async () => {
      // Mock diff services
      const mockGitModule = await import('../src/git/git.service')
      const spyRunGit = vi.spyOn(mockGitModule, 'runGitCommand')

      spyRunGit.mockImplementation(async (args) => {
        if (args.includes('--name-status')) {
          return {
            stdout: 'A\tsrc/new.ts\nM\tsrc/index.ts\nD\tsrc/old.ts\n',
            stderr: '',
          }
        }
        if (args.includes('--numstat')) {
          return {
            stdout: '15\t0\tsrc/new.ts\n5\t2\tsrc/index.ts\n0\t30\tsrc/old.ts\n',
            stderr: '',
          }
        }
        return { stdout: '', stderr: '' }
      })

      const changeset = await generateChangeSet('/tmp/fake-workspace', 'before123', 'after456')

      expect(changeset.beforeSha).toBe('before123')
      expect(changeset.afterSha).toBe('after456')
      expect(changeset.summary.added).toBe(1)
      expect(changeset.summary.modified).toBe(1)
      expect(changeset.summary.deleted).toBe(1)

      expect(changeset.files).toHaveLength(3)

      const newFile = changeset.files.find((f) => f.path === 'src/new.ts')
      expect(newFile).toBeDefined()
      expect(newFile?.status).toBe('added')
      expect(newFile?.additions).toBe(15)
      expect(newFile?.deletions).toBe(0)

      spyRunGit.mockRestore()
    })
  })
})
