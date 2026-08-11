import { Outlet } from 'react-router-dom'
import Header from './Header'

/**
 * BaseLayout wraps all pages with the shared Header + Nav shell.
 * Child routes are rendered via <Outlet />.
 */
export default function BaseLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-white/5 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} CDGS — Continuous Documentation Generation System
      </footer>
    </div>
  )
}
