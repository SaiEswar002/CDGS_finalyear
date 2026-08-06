import { create } from 'zustand'

/** Public user shape returned by GET /api/v1/auth/me */
export interface AuthUser {
  id: string
  githubId: number
  githubLogin: string
  githubName: string | null
  githubAvatarUrl: string | null
  email: string | null
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean

  setUser: (user: AuthUser) => void
  clearUser: () => void
  setLoading: (loading: boolean) => void
}

/**
 * Zustand auth store.
 * Populated by `useAuth` hook on mount via GET /api/v1/auth/me.
 * Cleared on logout or 401.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),
  clearUser: () => set({ user: null, isAuthenticated: false, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
}))
