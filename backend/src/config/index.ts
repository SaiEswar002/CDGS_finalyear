import path from 'path'
import dotenv from 'dotenv'
import { z } from 'zod'

// Load .env from cwd or parent root directory
dotenv.config({ override: true })
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: true })

/**
 * Zod schema for all environment variables.
 * The app will throw at startup if any required var is missing or malformed.
 */
const envSchema = z.object({
  // Server
  PORT: z.string().default('3000'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Supabase
  SUPABASE_URL: z
    .string()
    .url('SUPABASE_URL must be a valid URL')
    .refine(
      (val) => !/placeholder|your-project|example/i.test(val),
      'SUPABASE_URL contains a placeholder value',
    ),
  SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'SUPABASE_ANON_KEY is required')
    .refine(
      (val) => !/placeholder|your-supabase|example/i.test(val),
      'SUPABASE_ANON_KEY contains a placeholder value',
    ),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required')
    .refine(
      (val) => !/placeholder|your-supabase|example/i.test(val),
      'SUPABASE_SERVICE_ROLE_KEY contains a placeholder value',
    ),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth — JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Auth — Cookie signing secret
  COOKIE_SECRET: z
    .string()
    .min(32, 'COOKIE_SECRET must be at least 32 characters'),

  // Auth — AES-256-GCM encryption key for GitHub tokens
  // Must be exactly 64 hex chars = 32 bytes.
  // Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-f]{64}$/i,
      'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)',
    ),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z
    .string()
    .min(1, 'GITHUB_CLIENT_SECRET is required'),
  GITHUB_WEBHOOK_SECRET: z.string().default(''),

  // AI Providers (used in later phases)
  OPENAI_API_KEY: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),

  // CORS / Frontend
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Logging
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
})

type EnvConfig = z.infer<typeof envSchema>

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `[Config] Environment variable validation failed:\n${formatted}\n\n` +
        'Copy .env.example to .env and fill in the required values.',
    )
  }

  return result.data
}

const parsed = loadConfig()

/**
 * Validated, typed application configuration.
 * Throws at import time if env vars are invalid.
 */
export const config = {
  port: parseInt(parsed.PORT, 10),
  nodeEnv: parsed.NODE_ENV,
  isProduction: parsed.NODE_ENV === 'production',
  isTest: parsed.NODE_ENV === 'test',

  supabase: {
    url: parsed.SUPABASE_URL,
    anonKey: parsed.SUPABASE_ANON_KEY,
    serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
  },

  redis: {
    url: parsed.REDIS_URL,
  },

  auth: {
    jwtSecret: parsed.JWT_SECRET,
    jwtExpiresIn: parsed.JWT_EXPIRES_IN,
    cookieSecret: parsed.COOKIE_SECRET,
    /** Raw 32-byte Buffer derived from the 64-char hex ENCRYPTION_KEY */
    encryptionKey: Buffer.from(parsed.ENCRYPTION_KEY, 'hex'),
  },

  github: {
    clientId: parsed.GITHUB_CLIENT_ID,
    clientSecret: parsed.GITHUB_CLIENT_SECRET,
    webhookSecret: parsed.GITHUB_WEBHOOK_SECRET,
    /** OAuth scopes — least privilege, do not expand */
    scopes: 'read:user user:email repo',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    apiBase: 'https://api.github.com',
  },

  ai: {
    openaiApiKey: parsed.OPENAI_API_KEY,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
  },

  frontendUrl: parsed.FRONTEND_URL,
  logLevel: parsed.LOG_LEVEL,
} as const

export type Config = typeof config
