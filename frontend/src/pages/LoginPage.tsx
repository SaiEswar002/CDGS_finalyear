import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import AuthButton from '../components/AuthButton'

/**
 * LoginPage — /login
 * Shows the GitHub sign-in CTA.
 * Redirects authenticated users straight to /dashboard.
 */
export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-md text-center px-4">
        {/* Logo mark */}
        <div className="w-20 h-20 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-brand-500 to-violet-600
                        flex items-center justify-center shadow-2xl shadow-brand-900/50">
          <svg width="36" height="36" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M3 5L9 2L15 5V9C15 12.866 12.3137 16.3137 9 17C5.68629 16.3137 3 12.866 3 9V5Z"
              stroke="white" strokeWidth="1.5" strokeLinejoin="round"
            />
            <path
              d="M6.5 9L8 10.5L11.5 7"
              stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-4xl font-extrabold text-slate-100 mb-3">
          Welcome to DocOps
        </h1>
        <p className="text-slate-400 mb-10 leading-relaxed">
          Sign in with your GitHub account to start automatically generating
          documentation for your repositories.
        </p>

        <div className="flex flex-col items-center gap-4">
          <AuthButton size="lg" />

          <p className="text-xs text-slate-600 max-w-xs">
            We request <code className="text-brand-400">read:user</code>,{' '}
            <code className="text-brand-400">user:email</code>, and{' '}
            <code className="text-brand-400">repo</code> scopes — the minimum
            needed to read your repositories.
          </p>
        </div>
      </div>
    </div>
  )
}
