import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { issueJwt } from '../src/auth/auth.service'

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
  id: '242036a7-c80a-4317-846b-4b8a3e06af38',
  github_id: 123456,
  github_login: 'SaiEswar002',
  is_active: true,
}

const MOCK_REPO = {
  id: '39ad410b-b754-40a0-94c8-d51e04b1168c',
  user_id: MOCK_USER.id,
  full_name: 'SaiEswar002/Hospital-Management-System',
  owner: 'SaiEswar002',
  name: 'Hospital-Management-System',
}

const MOCK_RUN = {
  id: '11111111-2222-3333-4444-555555555555',
  repository_id: MOCK_REPO.id,
  commit_sha: 'abc123def456',
  before_sha: '000000000000',
  branch: 'main',
  status: 'queued',
  current_stage: 'webhook',
  queued_at: new Date().toISOString(),
  retry_count: 0,
  changeset: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

function makeApp() {
  return createApp()
}

function validJwt() {
  return issueJwt(MOCK_USER.id)
}

describe('Pipeline Service & API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.insert.mockReturnThis()
    mockSupabase.update.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.in.mockReturnThis()
    mockSupabase.order.mockReturnThis()
    mockSupabase.range.mockReturnThis()
  })

  describe('GET /api/v1/pipeline-runs', () => {
    it('returns 401 when not authenticated', async () => {
      const app = makeApp()
      const res = await request(app).get('/api/v1/pipeline-runs')
      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('returns list of pipeline runs for authenticated user', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: MOCK_USER, error: null }),
          } as any
        }
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
          range: vi.fn().mockResolvedValue({ data: [MOCK_RUN], count: 1, error: null }),
        } as any
      })

      const app = makeApp()
      const res = await request(app)
        .get('/api/v1/pipeline-runs')
        .set('Cookie', `cdgs_token=${validJwt()}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.runs).toHaveLength(1)
      expect(res.body.data.runs[0].commit_sha).toBe(MOCK_RUN.commit_sha)
    })
  })

  describe('POST /api/v1/pipeline-runs/create', () => {
    it('creates pipeline run successfully with valid input', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: MOCK_USER, error: null }),
          } as any
        }
        if (table === 'pipeline_runs') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: MOCK_RUN, error: null }),
          } as any
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any
      })

      const app = makeApp()
      const res = await request(app)
        .post('/api/v1/pipeline-runs/create')
        .set('Cookie', `cdgs_token=${validJwt()}`)
        .send({
          repositoryId: MOCK_REPO.id,
          commitSha: 'abc123def456',
          branch: 'main',
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.run.commit_sha).toBe('abc123def456')
    })
  })

  describe('POST /api/v1/pipeline-runs/complete', () => {
    it('saves ChangeSet and completes pipeline run', async () => {
      const completedRun = { ...MOCK_RUN, status: 'success', finished_at: new Date().toISOString() }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: MOCK_USER, error: null }),
          } as any
        }
        if (table === 'pipeline_runs') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: MOCK_RUN, error: null }),
            update: vi.fn().mockReturnThis(),
          } as any
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any
      })

      mockSupabase.single
        .mockResolvedValueOnce({ data: MOCK_USER, error: null })
        .mockResolvedValueOnce({ data: MOCK_RUN, error: null })
        .mockResolvedValueOnce({ data: completedRun, error: null })

      const app = makeApp()
      const res = await request(app)
        .post('/api/v1/pipeline-runs/complete')
        .set('Cookie', `cdgs_token=${validJwt()}`)
        .send({
          runId: MOCK_RUN.id,
          status: 'success',
          changeset: {
            beforeSha: '000000000000',
            afterSha: 'abc123def456',
            files: [{ path: 'src/index.ts', status: 'modified', additions: 10, deletions: 2 }],
            summary: { added: 0, modified: 1, deleted: 0 },
          },
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })
})
