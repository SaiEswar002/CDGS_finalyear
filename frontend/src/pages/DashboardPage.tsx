import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import type { Repository } from '../components/RepositoryCard'

interface StatsData {
  connectedRepos: number
  githubRepos: number | null
}

/**
 * DashboardPage — /dashboard (protected)
 * Shows summary stats and quick links.
 */
export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<StatsData>({ connectedRepos: 0, githubRepos: null })
  const [loadingConnected, setLoadingConnected] = useState(true)
  const [loadingGitHub, setLoadingGitHub] = useState(true)

  useEffect(() => {
    // Fetch CDGS connected repos count
    api
      .get<{ success: boolean; data: { repositories: Repository[]; count: number } }>(
        '/repositories',
      )
      .then((res) => setStats((prev) => ({ ...prev, connectedRepos: res.data.data.count })))
      .catch(() => setStats((prev) => ({ ...prev, connectedRepos: 0 })))
      .finally(() => setLoadingConnected(false))

    // Fetch total GitHub repos count from user's account
    api
      .get<{ success: boolean; data: { repos: { id: number }[] } }>('/github/repos')
      .then((res) => setStats((prev) => ({ ...prev, githubRepos: res.data.data.repos.length })))
      .catch(() => setStats((prev) => ({ ...prev, githubRepos: 0 })))
      .finally(() => setLoadingGitHub(false))
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-slide-up">
      {/* Welcome */}
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-slate-100 mb-2">
          Welcome back,{' '}
          <span className="text-gradient">
            {user?.githubName ?? user?.githubLogin ?? 'there'}
          </span>
        </h1>
        <p className="text-slate-400">
          Here&apos;s an overview of your CDGS workspace.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {[
          {
            label: 'Connected Repos',
            value: loadingConnected ? '…' : String(stats.connectedRepos),
            icon: '📁',
            link: '/repositories',
            linkLabel: 'Manage',
          },
          {
            label: 'Total GitHub Repos',
            value: loadingGitHub ? '…' : String(stats.githubRepos ?? 0),
            icon: '🐙',
            link: '/repositories',
            linkLabel: 'Import',
          },
          { label: 'Doc Runs', value: '—', icon: '⚙️', note: 'Phase 3' },
          { label: 'AI Tokens Used', value: '—', icon: '🧠', note: 'Phase 4' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-6">
            <div className="flex items-start justify-between mb-4">
              <span className="text-2xl" role="img" aria-label={stat.label}>
                {stat.icon}
              </span>
              {'note' in stat && stat.note && (
                <span className="text-xs font-mono text-slate-500 bg-white/5 px-2 py-1 rounded-md">
                  {stat.note}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-slate-300 mb-1">{stat.value}</p>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{stat.label}</p>
              {'link' in stat && stat.link && (
                <Link
                  to={stat.link}
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium"
                >
                  {stat.linkLabel} →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="glass-card p-8">
        <h2 className="text-lg font-semibold text-slate-200 mb-5">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/repositories"
            id="dashboard-manage-repos"
            className="flex items-center gap-4 p-5 rounded-xl border border-white/8
                       hover:bg-brand-600/8 hover:border-brand-500/30 transition-all duration-200 group"
          >
            <span className="text-2xl">📁</span>
            <div>
              <p className="font-semibold text-slate-200 group-hover:text-brand-300 transition-colors">
                Manage Repositories
              </p>
              <p className="text-sm text-slate-500">Import and connect GitHub repos</p>
            </div>
          </Link>
          <Link
            to="/profile"
            id="dashboard-profile"
            className="flex items-center gap-4 p-5 rounded-xl border border-white/8
                       hover:bg-white/5 hover:border-white/15 transition-all duration-200 group"
          >
            <span className="text-2xl">👤</span>
            <div>
              <p className="font-semibold text-slate-200 group-hover:text-slate-100 transition-colors">
                Your Profile
              </p>
              <p className="text-sm text-slate-500">View account details</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
