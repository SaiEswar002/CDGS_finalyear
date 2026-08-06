import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { useAuthStore, type AuthUser } from '../store/authStore'

interface UserMenuProps {
  user: AuthUser
}

/**
 * UserMenu — avatar dropdown for authenticated users.
 * Shows profile links and logout button.
 */
export default function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const clearUser = useAuthStore((s) => s.clearUser)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    try {
      await api.post('/auth/logout')
      clearUser()
      toast.success('Signed out successfully')
      navigate('/login')
    } catch {
      toast.error('Logout failed. Please try again.')
    }
  }

  const initials = (user.githubName ?? user.githubLogin)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div ref={menuRef} className="relative">
      {/* Avatar trigger */}
      <button
        id="user-menu-trigger"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5
                   hover:bg-white/5 transition-colors duration-150
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        {user.githubAvatarUrl ? (
          <img
            src={user.githubAvatarUrl}
            alt={`${user.githubLogin}'s avatar`}
            className="w-8 h-8 rounded-full ring-2 ring-brand-500/30"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center
                          text-xs font-bold text-white ring-2 ring-brand-500/30">
            {initials}
          </div>
        )}
        <span className="text-sm text-slate-300 font-medium hidden sm:block">
          {user.githubLogin}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          className={`text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 4.5L7 9.5L12 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-52 rounded-2xl
                     border border-white/10 bg-surface-50 shadow-2xl shadow-black/40
                     backdrop-blur-md py-1 z-50 animate-fade-in"
        >
          {/* User info header */}
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-sm font-semibold text-slate-100 truncate">
              {user.githubName ?? user.githubLogin}
            </p>
            <p className="text-xs text-slate-400 truncate">
              @{user.githubLogin}
            </p>
          </div>

          {/* Links */}
          <div className="py-1">
            {[
              { to: '/dashboard', label: 'Dashboard', id: 'menu-dashboard' },
              { to: '/repositories', label: 'Repositories', id: 'menu-repos' },
              { to: '/profile', label: 'Profile', id: 'menu-profile' },
            ].map(({ to, label, id }) => (
              <Link
                key={to}
                id={id}
                to={to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center px-4 py-2 text-sm text-slate-300
                           hover:bg-white/5 hover:text-slate-100
                           transition-colors duration-100"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t border-white/8 py-1">
            <button
              id="menu-logout"
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); void handleLogout() }}
              className="flex items-center w-full px-4 py-2 text-sm text-red-400
                         hover:bg-red-500/10 hover:text-red-300
                         transition-colors duration-100"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
