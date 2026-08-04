import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BaseLayout from './components/layout/BaseLayout'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'

/**
 * Root application component.
 * Defines the React Router route tree.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Routes inside BaseLayout share the header/nav shell */}
        <Route element={<BaseLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
