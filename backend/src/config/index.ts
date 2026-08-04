import { z } from 'zod'

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
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // GitHub OAuth (required from config, used in later phases)
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_WEBHOOK_SECRET: z.string().default(''),

  // AI Providers (used in later phases)
  OPENAI_API_KEY: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),

  // CORS
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
  },

  github: {
    clientId: parsed.GITHUB_CLIENT_ID,
    clientSecret: parsed.GITHUB_CLIENT_SECRET,
    webhookSecret: parsed.GITHUB_WEBHOOK_SECRET,
  },

  ai: {
    openaiApiKey: parsed.OPENAI_API_KEY,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
  },

  frontendUrl: parsed.FRONTEND_URL,
  logLevel: parsed.LOG_LEVEL,
} as const

export type Config = typeof config
