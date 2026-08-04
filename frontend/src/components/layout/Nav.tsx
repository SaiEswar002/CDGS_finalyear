import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Home', id: 'nav-home' },
  { to: '/dashboard', label: 'Dashboard', id: 'nav-dashboard' },
] as const

/**
 * Primary navigation links.
 * Uses React Router's <NavLink> for active state styling.
 */
export default function Nav() {
  return (
    <nav aria-label="Primary navigation">
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map(({ to, label, id }) => (
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

        {/* CTA — will route to /auth/login in Phase 2 */}
        <li className="ml-3">
          <a
            href="#"
            id="nav-signin"
            className="btn-primary !py-2 !px-4 !text-xs"
            aria-label="Sign in with GitHub (coming soon)"
            onClick={(e) => e.preventDefault()}
          >
            Sign in with GitHub
          </a>
        </li>
      </ul>
    </nav>
  )
}
