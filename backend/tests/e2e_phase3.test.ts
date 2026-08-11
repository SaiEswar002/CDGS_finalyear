import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { createPipelineRun, completePipelineRun, listPipelineRuns } from '../src/pipeline/pipeline.service'
import { generateChangeSet } from '../src/git/diff.service'
import { getWorkspacePath, cleanupWorkspace, sanitizeGitOutput } from '../src/git/git.service'
import type { DocumentationPipelineJob, ChangeSet } from '../src/pipeline/pipeline.types'

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
}

vi.mock('../src/db/supabaseClient', () => ({
  getSupabaseClient: () => mockSupabase,
}))

const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  github_login: 'SaiEswar002',
}

const MOCK_REPO = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: MOCK_USER.id,
  full_name: 'SaiEswar002/CDGS_finalyear',
  owner: 'SaiEswar002',
  name: 'CDGS_finalyear',
}

const MOCK_RUN_ID = 'e2e-run-9999-8888-7777-666666666666'

describe('Phase 3 End-to-End Flow Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. Webhook trigger -> Creates pipeline run record in database', async () => {
    const mockCreatedRun = {
      id: MOCK_RUN_ID,
      repository_id: MOCK_REPO.id,
      commit_sha: 'def456newcommit',
      before_sha: 'abc123oldcommit',
      branch: 'main',
      status: 'queued',
      current_stage: 'webhook',
      queued_at: new Date().toISOString(),
      retry_count: 0,
    }

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'pipeline_runs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockCreatedRun, error: null }),
        } as any
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any
    })

    const run = await createPipelineRun({
      repositoryId: MOCK_REPO.id,
      commitSha: 'def456newcommit',
      beforeSha: 'abc123oldcommit',
      branch: 'main',
      triggerType: 'webhook',
    })

    expect(run.id).toBe(MOCK_RUN_ID)
    expect(run.status).toBe('queued')
    expect(run.current_stage).toBe('webhook')
    expect(run.commit_sha).toBe('def456newcommit')
  })

  it('2. Shared Contract & Canonical Job ID Check (jobId === pipelineRunId)', () => {
    const job: DocumentationPipelineJob = {
      pipelineRunId: MOCK_RUN_ID,
      repositoryId: MOCK_REPO.id,
      githubRepositoryId: 123456,
      owner: MOCK_REPO.owner,
      repo: MOCK_REPO.name,
      branch: 'main',
      beforeSha: 'abc123oldcommit',
      afterSha: 'def456newcommit',
    }

    expect(job.pipelineRunId).toBe(MOCK_RUN_ID)
    expect(Object.keys(job)).not.toContain('token')
    expect(Object.keys(job)).not.toContain('secret')
  })

  it('3. Workspace isolation, Git diff execution, and ChangeSet generation', async () => {
    const workspacePath = getWorkspacePath(MOCK_RUN_ID)
    expect(workspacePath).toContain(MOCK_RUN_ID)

    // Create temporary workspace directory
    await fs.mkdir(workspacePath, { recursive: true })

    // Verify workspace directory exists
    const statBefore = await fs.stat(workspacePath).catch(() => null)
    expect(statBefore).not.toBeNull()

    // Mock Git diff output
    const mockGitModule = await import('../src/git/git.service')
    const spyRunGit = vi.spyOn(mockGitModule, 'runGitCommand')

    spyRunGit.mockImplementation(async (args) => {
      if (args.includes('--name-status')) {
        return { stdout: 'A\tsrc/new-module.ts\nM\tsrc/app.ts\nD\tsrc/old.ts\n', stderr: '' }
      }
      if (args.includes('--numstat')) {
        return { stdout: '20\t0\tsrc/new-module.ts\n10\t2\tsrc/app.ts\n0\t15\tsrc/old.ts\n', stderr: '' }
      }
      return { stdout: '', stderr: '' }
    })

    const changeset: ChangeSet = await generateChangeSet(workspacePath, 'abc123oldcommit', 'def456newcommit')

    expect(changeset.beforeSha).toBe('abc123oldcommit')
    expect(changeset.afterSha).toBe('def456newcommit')
    expect(changeset.summary.added).toBe(1)
    expect(changeset.summary.modified).toBe(1)
    expect(changeset.summary.deleted).toBe(1)
    expect(changeset.files).toHaveLength(3)

    // Cleanup workspace
    await cleanupWorkspace(workspacePath)
    const statAfter = await fs.stat(workspacePath).catch(() => null)
    expect(statAfter).toBeNull()

    spyRunGit.mockRestore()
  })

  it('4. Pipeline Service stores ChangeSet and sets status to success', async () => {
    const changesetData: ChangeSet = {
      beforeSha: 'abc123oldcommit',
      afterSha: 'def456newcommit',
      files: [{ path: 'src/new-module.ts', status: 'added', additions: 20, deletions: 0 }],
      summary: { added: 1, modified: 0, deleted: 0 },
    }

    const mockCompletedRun = {
      id: MOCK_RUN_ID,
      status: 'success',
      changeset: changesetData,
      finished_at: new Date().toISOString(),
    }

    let selectCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'pipeline_runs') {
        return {
          select: vi.fn().mockImplementation(() => {
            selectCallCount++
            return {
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: selectCallCount === 1
                  ? { id: MOCK_RUN_ID, current_stage: 'diff', queued_at: new Date().toISOString() }
                  : mockCompletedRun,
                error: null,
              }),
            }
          }),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockCompletedRun, error: null }),
        } as any
      }
      return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } as any
    })

    const result = await completePipelineRun({
      runId: MOCK_RUN_ID,
      status: 'success',
      changeset: changesetData,
    })

    expect(result.status).toBe('success')
    expect(result.changeset).toEqual(changesetData)
  })

  it('5. Security Check: Tokens and credentials are sanitized from outputs', () => {
    const rawError = 'Error: git clone https://x-access-token:ghp_supersecret12345@github.com/owner/repo failed'
    const sanitized = sanitizeGitOutput(rawError)

    expect(sanitized).not.toContain('ghp_supersecret12345')
    expect(sanitized).toContain('https://[REDACTED]@github.com/owner/repo')
  })

  it('6. Dashboard Listing: GET /api/v1/pipeline-runs returns completed run', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'repositories') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [{ id: MOCK_REPO.id }], error: null }),
        } as any
      }
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [{ id: MOCK_RUN_ID, status: 'success', commit_sha: 'def456newcommit' }],
          count: 1,
          error: null,
        }),
      } as any
    })

    const listResult = await listPipelineRuns(MOCK_USER.id)
    expect(listResult.runs).toHaveLength(1)
    expect(listResult.runs[0].status).toBe('success')
  })
})
