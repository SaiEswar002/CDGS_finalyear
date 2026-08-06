import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const PUBLIC_LINKS = [
  { to: '/', label: 'Home', id: 'nav-home' },
] as const

const PROTECTED_LINKS = [
  { to: '/dashboard', label: 'Dashboard', id: 'nav-dashboard' },
  { to: '/repositories', label: 'Repositories', id: 'nav-repos' },
] as const

/**
 * Primary navigation — shows protected links only when authenticated.
 */
export default function Nav() {
  const { isAuthenticated } = useAuthStore()

  const links = isAuthenticated
    ? [...PUBLIC_LINKS, ...PROTECTED_LINKS]
    : PUBLIC_LINKS

  return (
    <nav aria-label="Primary navigation">
      <ul className="flex items-center gap-1">
        {links.map(({ to, label, id }) => (
          <li key={to}>
            <NavLink
              to={to}
              id={id}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'nav-link px-3 py-1.5 rounded-lg text-sm font-medium',
                  isActive
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/20'
                    : 'hover:bg-white/5',
                ].join(' ')
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
