import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config'
import { logger } from '../logger'

/**
 * Supabase client singleton using the service role key.
 *
 * The service role key bypasses Row Level Security — use it only in the
 * backend, never expose it to the browser.
 *
 * The client is created lazily on first access. No network call is made
 * at module load time, so the app starts up fast even if Supabase is
 * unreachable.
 */
let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    logger.debug({ url: config.supabase.url }, 'Supabase client initialised')
  }

  return _client
}

/**
 * Convenience export — the lazy Supabase client instance.
 *
 * @example
 * ```ts
 * import { supabase } from '../db/supabaseClient'
 * const { data, error } = await supabase.from('users').select('*')
 * ```
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string) {
    const client = getSupabaseClient()
    const value: unknown = client[prop as keyof SupabaseClient]
    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
})
