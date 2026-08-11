import axios from 'axios'
import { useAuthStore } from '../store/authStore'

/**
 * Shared Axios instance for all DocOps API calls.
 *
 * - Base URL: /api/v1 (proxied to backend via Vite in dev)
 * - Credentials: true — sends the httpOnly JWT cookie automatically
 * - 401 interceptor: clears auth state and redirects to /login
 */
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
})

// Response interceptor — handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Clear client-side auth state
      useAuthStore.getState().clearUser()

      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  },
)
