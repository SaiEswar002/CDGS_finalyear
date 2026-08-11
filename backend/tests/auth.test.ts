import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { issueJwt } from '../src/auth/auth.service'

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../src/db/supabaseClient', () => ({
  getSupabaseClient: () => mockSupabase,
}))

vi.mock('../src/github/service', () => ({
  exchangeCodeForToken: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  listUserRepositories: vi.fn(),
  getRepository: vi.fn(),
}))

// Shared supabase mock — configure per test
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
}

const mockGitHub = await import('../src/github/service')

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  github_id: 12345,
  github_login: 'testuser',
  github_name: 'Test User',
  github_avatar_url: 'https://avatars.github.com/u/12345',
  email: 'test@example.com',
  is_active: true,
}

function makeApp() {
  return createApp()
}

function validJwt() {
  return issueJwt(MOCK_USER.id)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/github', () => {
  it('redirects to GitHub authorize URL with state cookie set', async () => {
    // Mock state storage
    mockSupabase.from.mockReturnThis()
    mockSupabase.insert.mockResolvedValue({ data: null, error: null })

    const app = makeApp()
    const res = await request(app).get('/api/v1/auth/github')

    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('github.com/login/oauth/authorize')
    expect(res.headers.location).toContain('state=')
    expect(res.headers['set-cookie']).toBeDefined()
  })
})

describe('GET /api/v1/auth/github/callback', () => {
  it('returns 400 when state is missing', async () => {
    const app = makeApp()
    const res = await request(app).get('/api/v1/auth/github/callback?code=abc123')

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when state cookie does not match query state', async () => {
    const app = makeApp()
    const res = await request(app)
      .get('/api/v1/auth/github/callback?code=abc123&state=wrongstate')
      .set('Cookie', 'docops_oauth_state=differentstate')

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toContain('state')
  })

  it('returns 400 when state is valid cookie match but not in DB', async () => {
    const state = 'a'.repeat(64)
    mockSupabase.select.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const app = makeApp()
    const res = await request(app)
      .get(`/api/v1/auth/github/callback?code=abc123&state=${state}`)
      .set('Cookie', `docops_oauth_state=${state}`)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

describe('GET /api/v1/auth/me', () => {
  beforeEach(() => {
    // Mock getUserById to return our mock user
    mockSupabase.from.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.single.mockResolvedValue({ data: MOCK_USER, error: null })
  })

  it('returns 401 when no cookie is provided', async () => {
    const app = makeApp()
    const res = await request(app).get('/api/v1/auth/me')

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toContain('Authentication required')
  })

  it('returns 401 when JWT is malformed', async () => {
    const app = makeApp()
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'docops_token=not.a.valid.jwt')

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toContain('Invalid')
  })

  it('returns 401 when JWT is expired', async () => {
    const { sign } = await import('jsonwebtoken')
    const expiredToken = sign(
      { sub: MOCK_USER.id },
      process.env.JWT_SECRET!,
      { expiresIn: -1, issuer: 'docops' },
    )

    const app = makeApp()
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `docops_token=${expiredToken}`)

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toContain('expired')
  })

  it('returns 200 with user data when JWT is valid', async () => {
    const app = makeApp()
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `docops_token=${validJwt()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user.id).toBe(MOCK_USER.id)
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('clears the JWT cookie and returns success', async () => {
    mockSupabase.single.mockResolvedValue({ data: MOCK_USER, error: null })

    const app = makeApp()
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `docops_token=${validJwt()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Cookie should be cleared (set with empty value / expired)
    const cookies = res.headers['set-cookie'] as string[] | undefined
    if (cookies) {
      const tokenCookie = cookies.find((c) => c.startsWith('docops_token='))
      expect(tokenCookie).toBeDefined()
      expect(tokenCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i)
    }
  })

  it('returns 401 when not authenticated', async () => {
    const app = makeApp()
    const res = await request(app).post('/api/v1/auth/logout')

    expect(res.status).toBe(401)
  })
})
