import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { issueJwt } from '../src/auth/auth.service'
import { encrypt } from '../src/lib/crypto'

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../src/db/supabaseClient', () => ({
  getSupabaseClient: () => mockSupabase,
}))

vi.mock('../src/github/service', () => ({
  getRepository: vi.fn(),
  listUserRepositories: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}))

// Build the chain mock: each method returns `this` by default unless overridden
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
}

const mockGitHub = await import('../src/github/service')

// ── Fixtures ───────────────────────────────────────────────────────────────

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001'
const MOCK_REPO_ID = '00000000-0000-0000-0000-000000000002'

const MOCK_USER = {
  id: MOCK_USER_ID,
  github_id: 12345,
  github_login: 'testuser',
  github_name: 'Test User',
  github_avatar_url: 'https://avatars.github.com/u/12345',
  email: 'test@example.com',
  is_active: true,
}

const MOCK_GITHUB_REPO = {
  id: 987654321,
  name: 'my-repo',
  full_name: 'testuser/my-repo',
  owner: { login: 'testuser' },
  private: false,
  description: 'A test repo',
  language: 'TypeScript',
  default_branch: 'main',
  clone_url: 'https://github.com/testuser/my-repo.git',
  html_url: 'https://github.com/testuser/my-repo',
}

const MOCK_DB_REPO = {
  id: MOCK_REPO_ID,
  user_id: MOCK_USER_ID,
  github_repo_id: 987654321,
  owner: 'testuser',
  name: 'my-repo',
  full_name: 'testuser/my-repo',
  default_branch: 'main',
  selected_branch: 'main',
  is_private: false,
  description: 'A test repo',
  language: 'TypeScript',
  clone_url: 'https://github.com/testuser/my-repo.git',
  html_url: 'https://github.com/testuser/my-repo',
  is_active: true,
  last_synced_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const IMPORT_BODY = {
  github_repo_id: 987654321,
  owner: 'testuser',
  name: 'my-repo',
}

beforeEach(() => {
  vi.clearAllMocks()
  // Re-apply chain returns after clearing
  mockSupabase.from.mockReturnThis()
  mockSupabase.select.mockReturnThis()
  mockSupabase.insert.mockReturnThis()
  mockSupabase.upsert.mockReturnThis()
  mockSupabase.delete.mockReturnThis()
  mockSupabase.eq.mockReturnThis()
  mockSupabase.order.mockReturnThis()
})

function makeApp() { return createApp() }
function validJwt() { return issueJwt(MOCK_USER_ID) }

/** Mock getUserById: .from().select().eq().eq().single() → user */
function mockAuthUser() {
  mockSupabase.single.mockResolvedValueOnce({ data: MOCK_USER, error: null })
}

/** Mock getEncryptedTokenForUser: .from().select().eq().single() → token */
function mockEncryptedToken() {
  const enc = encrypt('gho_fake_token')
  mockSupabase.single.mockResolvedValueOnce({
    data: { github_access_token_enc: enc },
    error: null,
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/v1/repositories — import', () => {
  it('returns 401 when not authenticated', async () => {
    const app = makeApp()
    const res = await request(app).post('/api/v1/repositories').send(IMPORT_BODY)

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when github_repo_id is not numeric', async () => {
    mockAuthUser()
    const app = makeApp()
    const res = await request(app)
      .post('/api/v1/repositories')
      .set('Cookie', `docops_token=${validJwt()}`)
      .send({ github_repo_id: 'not-a-number', owner: 'a', name: 'b' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 409 when repository is already imported', async () => {
    mockAuthUser()
    // Duplicate check: maybeSingle → existing record
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: MOCK_REPO_ID }, error: null })

    const app = makeApp()
    const res = await request(app)
      .post('/api/v1/repositories')
      .set('Cookie', `docops_token=${validJwt()}`)
      .send(IMPORT_BODY)

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toContain('already been imported')
  })

  it('returns 403 when user cannot access the repo on GitHub', async () => {
    mockAuthUser()
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null }) // no duplicate
    mockEncryptedToken() // encrypted token lookup
    vi.mocked(mockGitHub.getRepository).mockResolvedValueOnce(null) // repo not accessible

    const app = makeApp()
    const res = await request(app)
      .post('/api/v1/repositories')
      .set('Cookie', `docops_token=${validJwt()}`)
      .send(IMPORT_BODY)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('returns 201 with repo data on success', async () => {
    mockAuthUser()
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null }) // no duplicate
    mockEncryptedToken() // encrypted token lookup
    vi.mocked(mockGitHub.getRepository).mockResolvedValueOnce(MOCK_GITHUB_REPO)
    // insert().select().single()
    mockSupabase.single.mockResolvedValueOnce({ data: MOCK_DB_REPO, error: null })

    const app = makeApp()
    const res = await request(app)
      .post('/api/v1/repositories')
      .set('Cookie', `docops_token=${validJwt()}`)
      .send(IMPORT_BODY)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.repository.full_name).toBe('testuser/my-repo')
  })
})

describe('GET /api/v1/repositories — list', () => {
  it('returns 401 when not authenticated', async () => {
    const app = makeApp()
    const res = await request(app).get('/api/v1/repositories')

    expect(res.status).toBe(401)
  })

  it('returns 200 with repos array when authenticated', async () => {
    mockAuthUser()
    // listRepositories: from().select().eq().eq().order() → array
    mockSupabase.order.mockResolvedValueOnce({ data: [MOCK_DB_REPO], error: null })

    const app = makeApp()
    const res = await request(app)
      .get('/api/v1/repositories')
      .set('Cookie', `docops_token=${validJwt()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.repositories)).toBe(true)
  })
})

describe('GET /api/v1/repositories/:id', () => {
  it('returns 400 when id is not a valid UUID', async () => {
    mockAuthUser()
    const app = makeApp()
    const res = await request(app)
      .get('/api/v1/repositories/not-a-uuid')
      .set('Cookie', `docops_token=${validJwt()}`)

    expect(res.status).toBe(400)
  })

  it('returns 404 when repo is not owned by user', async () => {
    mockAuthUser()
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const app = makeApp()
    const res = await request(app)
      .get(`/api/v1/repositories/${MOCK_REPO_ID}`)
      .set('Cookie', `docops_token=${validJwt()}`)

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('returns 200 with repo data when found', async () => {
    mockAuthUser()
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: MOCK_DB_REPO, error: null })

    const app = makeApp()
    const res = await request(app)
      .get(`/api/v1/repositories/${MOCK_REPO_ID}`)
      .set('Cookie', `docops_token=${validJwt()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.repository.id).toBe(MOCK_REPO_ID)
  })
})

describe('DELETE /api/v1/repositories/:id', () => {
  it('returns 401 when not authenticated', async () => {
    const app = makeApp()
    const res = await request(app).delete(`/api/v1/repositories/${MOCK_REPO_ID}`)

    expect(res.status).toBe(401)
  })

  it('returns 404 when repo is not owned by user', async () => {
    mockAuthUser()
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const app = makeApp()
    const res = await request(app)
      .delete(`/api/v1/repositories/${MOCK_REPO_ID}`)
      .set('Cookie', `docops_token=${validJwt()}`)

    expect(res.status).toBe(404)
  })

  it('returns 200 and only deletes the local record', async () => {
    mockAuthUser()
    // getRepository check (ownership) — maybeSingle
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: MOCK_DB_REPO, error: null })
    // delete().eq().eq() — the final call resolves the promise
    // Override delete to return a thenable at the end of the chain
    mockSupabase.delete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const app = makeApp()
    const res = await request(app)
      .delete(`/api/v1/repositories/${MOCK_REPO_ID}`)
      .set('Cookie', `docops_token=${validJwt()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // Verify GitHub service was NOT called for deletion — local only
    expect(mockGitHub.getRepository).not.toHaveBeenCalled()
  })
})
