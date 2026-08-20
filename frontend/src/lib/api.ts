import axios from 'axios'
import { useAuthStore } from '../store/authStore'

/**
 * Shared Axios instance for all CDGS API calls.
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

/**
 * Helper to safely extract error message from API response or Error object.
 * Checks res.data.message (standard backend API error shape), res.data.error, err.message, or returns fallback.
 */
export function getErrorMessage(err: unknown, fallback: string = 'An unexpected error occurred'): string {
  if (err && typeof err === 'object') {
    const axiosErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string }
    if (axiosErr.response?.data?.message && typeof axiosErr.response.data.message === 'string') {
      return axiosErr.response.data.message
    }
    if (axiosErr.response?.data?.error && typeof axiosErr.response.data.error === 'string') {
      return axiosErr.response.data.error
    }
    if (axiosErr.message && typeof axiosErr.message === 'string') {
      return axiosErr.message
    }
  }
  return fallback
}

