import { useEffect } from 'react'
import { api } from '../lib/api'
import { useAuthStore, type AuthUser } from '../store/authStore'

interface MeResponse {
  success: boolean
  data: { user: AuthUser }
}

/**
 * Hook that fetches the current user from GET /api/v1/auth/me on mount.
 * Populates the auth store. Call this once near the app root.
 *
 * @returns `{ user, isLoading, isAuthenticated }` from the auth store
 */
export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, clearUser, setLoading } =
    useAuthStore()

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    api
      .get<MeResponse>('/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res.data.data.user)
      })
      .catch(() => {
        if (!cancelled) clearUser()
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { user, isLoading, isAuthenticated }
}
