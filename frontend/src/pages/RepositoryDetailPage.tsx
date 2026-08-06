import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import type { Repository } from '../components/RepositoryCard'

/**
 * RepositoryDetailPage — /repositories/:id (protected)
 */
export default function RepositoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [repo, setRepo] = useState<Repository | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    api
      .get<{ success: boolean; data: { repository: Repository } }>(`/repositories/${id}`)
      .then((res) => setRepo(res.data.data.repository))
      .catch(() => {
        toast.error('Repository not found')
        navigate('/repositories')
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  async function handleDelete() {
    if (!repo) return
    if (!window.confirm(`Disconnect "${repo.full_name}"? This only removes the local connection.`)) return

    setDeleting(true)
    try {
      await api.delete(`/repositories/${repo.id}`)
      toast.success(`${repo.full_name} disconnected.`)
      navigate('/repositories')
    } catch {
      toast.error('Failed to disconnect repository.')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!repo) return null

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-slide-up">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500 mb-8">
        <Link to="/repositories" className="hover:text-slate-300 transition-colors">
          Repositories
        </Link>
        <span>/</span>
        <span className="text-slate-300">{repo.full_name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 mb-2">{repo.full_name}</h1>
          {repo.description && (
            <p className="text-slate-400 max-w-xl">{repo.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {repo.html_url && (
            <a
              href={repo.html_url}
              id="repo-github-link"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !py-2 !px-4 !text-sm"
            >
              View on GitHub ↗
            </a>
          )}
          <button
            id="repo-disconnect"
            type="button"
            disabled={deleting}
            onClick={() => { void handleDelete() }}
            className="px-4 py-2 rounded-xl text-sm font-semibold
                       border border-red-500/20 text-red-400
                       hover:bg-red-500/10 hover:border-red-500/40
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            {deleting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      </div>

      {/* Details grid */}
      <div className="glass-card p-6 grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
        {[
          { label: 'Owner', value: repo.owner },
          { label: 'Default Branch', value: repo.default_branch },
          { label: 'Selected Branch', value: repo.selected_branch ?? repo.default_branch },
          { label: 'Language', value: repo.language ?? '—' },
          {
            label: 'Visibility',
            value: repo.is_private ? 'Private' : 'Public',
          },
          {
            label: 'Connected',
            value: new Date(repo.created_at).toLocaleDateString(),
          },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm font-medium text-slate-200">{value}</p>
          </div>
        ))}
      </div>

      {/* Coming soon callout */}
      <div className="glass-card p-6 border-dashed text-center">
        <p className="text-sm text-slate-500">
          Documentation runs, generated docs, and version history will appear here in Phase 3.
        </p>
      </div>
    </div>
  )
}
