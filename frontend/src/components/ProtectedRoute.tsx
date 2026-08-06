/**
 * ProtectedRoute — wraps React Router's <Outlet>.
 * Redirects unauthenticated users to /login.
 * Shows a loading spinner while auth state is initialising.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"
            role="status"
            aria-label="Loading"
          />
          <p className="text-slate-400 text-sm">Checking authentication…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
