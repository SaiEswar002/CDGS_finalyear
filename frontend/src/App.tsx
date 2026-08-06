import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import BaseLayout from './components/layout/BaseLayout'
import ProtectedRoute from './components/ProtectedRoute'

// Pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RepositoriesPage from './pages/RepositoriesPage'
import RepositoryDetailPage from './pages/RepositoryDetailPage'
import ProfilePage from './pages/ProfilePage'

/**
 * AuthInitialiser — calls useAuth once at the app root to populate the store.
 * Rendered as a child so it's inside BrowserRouter context.
 */
function AuthInitialiser() {
  useAuth()
  return null
}

/**
 * Root application component.
 * Route tree:
 *   /           → LandingPage (public)
 *   /login      → LoginPage (redirects if authed)
 *   /dashboard  → DashboardPage (protected)
 *   /repositories        → RepositoriesPage (protected)
 *   /repositories/:id    → RepositoryDetailPage (protected)
 *   /profile    → ProfilePage (protected)
 */
export default function App() {
  return (
    <BrowserRouter>
      {/* Initialise auth state from cookie on every page load */}
      <AuthInitialiser />

      {/* Global toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a3e',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1a1a3e' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#1a1a3e' },
          },
        }}
      />

      <Routes>
        {/* Public layout */}
        <Route element={<BaseLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected layout — redirects to /login if unauthenticated */}
        <Route element={<BaseLayout />}>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/repositories" element={<RepositoriesPage />} />
            <Route path="/repositories/:id" element={<RepositoryDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
