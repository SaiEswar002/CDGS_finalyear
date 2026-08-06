/**
 * AuthButton — "Sign in with GitHub" button.
 * Navigates directly to GET /api/v1/auth/github which triggers the OAuth redirect.
 */
interface AuthButtonProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
}

export default function AuthButton({ className = '', size = 'md' }: AuthButtonProps) {
  const handleSignIn = () => {
    // Hard navigate — not a React Router link.
    // This triggers the OAuth redirect from the backend.
    window.location.href = '/api/v1/auth/github'
  }

  return (
    <button
      id="auth-signin-github"
      type="button"
      onClick={handleSignIn}
      className={`
        inline-flex items-center gap-2.5 rounded-xl font-semibold
        bg-slate-800 hover:bg-slate-700 active:bg-slate-900
        text-slate-100 border border-white/10 hover:border-white/20
        transition-all duration-200 hover:-translate-y-0.5
        shadow-lg shadow-black/30
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400
        ${sizeMap[size]} ${className}
      `}
      aria-label="Sign in with GitHub"
    >
      {/* GitHub mark */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
      Sign in with GitHub
    </button>
  )
}
