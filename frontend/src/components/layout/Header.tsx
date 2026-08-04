import { Link } from 'react-router-dom'
import Nav from './Nav'

/**
 * Site-wide header component containing the logo and navigation.
 */
export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/8 backdrop-blur-md bg-surface/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            id="header-logo"
            className="flex items-center gap-2.5 group focus-visible:outline-none"
          >
            {/* Logomark */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600
                            flex items-center justify-center shadow-lg shadow-brand-900/50
                            group-hover:shadow-brand-800/60 transition-shadow duration-200">
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 5L9 2L15 5V9C15 12.866 12.3137 16.3137 9 17C5.68629 16.3137 3 12.866 3 9V5Z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.5 9L8 10.5L11.5 7"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-bold text-sm tracking-wide text-slate-100">
              CDGS
            </span>
          </Link>

          {/* Navigation */}
          <Nav />
        </div>
      </div>
    </header>
  )
}
