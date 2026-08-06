import { randomBytes } from 'crypto'

/**
 * Global test setup.
 * Sets all required env vars before any module imports happen.
 * Uses valid placeholder values that pass zod validation.
 */

// Must be set before config/index.ts is imported
process.env.NODE_ENV = 'test'
process.env.PORT = '3001'
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars!!'
process.env.JWT_EXPIRES_IN = '1h'
process.env.COOKIE_SECRET = 'test-cookie-secret-must-be-at-least-32ch!!'
// Valid 64-char hex key for AES-256-GCM
process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')
process.env.GITHUB_CLIENT_ID = 'test-github-client-id'
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret'
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.LOG_LEVEL = 'error'
