import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import type { Repository } from './RepositoryCard'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  private: boolean
  description: string | null
  language: string | null
}

interface ImportRepositoryModalProps {
  open: boolean
  onClose: () => void
  onImported: (repo: Repository) => void
  alreadyImportedIds: number[]
}

/**
 * ImportRepositoryModal — fetches the user's GitHub repos via the backend
 * and allows importing one at a time.
 */
export default function ImportRepositoryModal({
  open,
  onClose,
  onImported,
  alreadyImportedIds,
}: ImportRepositoryModalProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSearch('')

    // We expose the user's GitHub repos through the backend
    // by having the backend call github/service.ts for us.
    // For now, this hits a not-yet-implemented route; it will work in Phase 3.
    // The modal gracefully handles the empty/error state.
    api
      .get<{ success: boolean; data: { repos: GitHubRepo[] } }>('/github/repos')
      .then((res) => setRepos(res.data.data.repos))
      .catch(() => {
        // Fallback: empty list until GitHub repos endpoint is wired
        setRepos([])
      })
      .finally(() => setLoading(false))
  }, [open])

  const filtered = repos.filter(
    (r) =>
      !alreadyImportedIds.includes(r.id) &&
      r.full_name.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleImport(repo: GitHubRepo) {
    setImporting(repo.id)
    try {
      const res = await api.post<{ success: boolean; data: { repository: Repository } }>(
        '/repositories',
        {
          github_repo_id: repo.id,
          owner: repo.owner.login,
          name: repo.name,
        },
      )
      onImported(res.data.data.repository)
      toast.success(`${repo.full_name} imported!`)
      onClose()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to import repository'
      toast.error(message)
    } finally {
      setImporting(null)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import a repository"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass-card p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Import Repository</h2>
            <p className="text-sm text-slate-400">Select a GitHub repository to connect.</p>
          </div>
          <button
            id="import-modal-close"
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200
                       transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <input
          id="import-repo-search"
          type="search"
          placeholder="Search repositories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 mb-4 rounded-xl bg-white/5 border border-white/10
                     text-sm text-slate-100 placeholder-slate-500
                     focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          aria-label="Search repositories"
        />

        {/* Repo list */}
        <div className="max-h-80 overflow-y-auto scrollbar-hide space-y-1.5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-500 py-8 text-sm">
              {repos.length === 0
                ? 'No repositories found. Connect more repos on GitHub.'
                : 'All matching repositories are already imported.'}
            </p>
          ) : (
            filtered.map((repo) => (
              <div
                key={repo.id}
                id={`import-repo-item-${repo.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3
                           rounded-xl hover:bg-white/5 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {repo.full_name}
                  </p>
                  {repo.description && (
                    <p className="text-xs text-slate-500 truncate">{repo.description}</p>
                  )}
                </div>
                <button
                  id={`import-btn-${repo.id}`}
                  type="button"
                  disabled={importing === repo.id}
                  onClick={() => { void handleImport(repo) }}
                  className="shrink-0 btn-primary !py-1.5 !px-3 !text-xs
                             disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                >
                  {importing === repo.id ? 'Importing…' : 'Import'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
