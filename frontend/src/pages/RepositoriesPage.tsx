import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import RepositoryTable from '../components/RepositoryTable'
import ImportRepositoryModal from '../components/ImportRepositoryModal'
import type { Repository } from '../components/RepositoryCard'

/**
 * RepositoriesPage — /repositories (protected)
 * Lists imported repos and allows importing new ones.
 */
export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchRepos()
  }, [])

  function fetchRepos() {
    setLoading(true)
    api
      .get<{ success: boolean; data: { repositories: Repository[] } }>('/repositories')
      .then((res) => setRepos(res.data.data.repositories))
      .catch(() => toast.error('Failed to load repositories'))
      .finally(() => setLoading(false))
  }

  async function handleDelete(id: string) {
    const repo = repos.find((r) => r.id === id)
    if (!repo) return

    if (!window.confirm(`Disconnect "${repo.full_name}"? This only removes the local connection.`)) {
      return
    }

    setDeleting(id)
    try {
      await api.delete(`/repositories/${id}`)
      setRepos((prev) => prev.filter((r) => r.id !== id))
      toast.success(`${repo.full_name} disconnected.`)
    } catch {
      toast.error('Failed to disconnect repository.')
    } finally {
      setDeleting(null)
    }
  }

  function handleImported(repo: Repository) {
    setRepos((prev) => [repo, ...prev])
  }

  const importedIds = repos.map((r) => r.github_repo_id as unknown as number)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-100 mb-2">Repositories</h1>
          <p className="text-slate-400">
            {repos.length} {repos.length === 1 ? 'repository' : 'repositories'} connected
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              fetchRepos()
              toast.success('Repositories refreshed!')
            }}
            className="btn-secondary !py-2.5 !px-4 !text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
            Refresh
          </button>
          <button
            id="open-import-modal"
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Import Repository
          </button>
        </div>
      </div>

      {/* Table / Loading */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <RepositoryTable
          repositories={repos}
          onDelete={(id) => { void handleDelete(id) }}
          isDeleting={deleting}
        />
      )}

      {/* Import modal */}
      <ImportRepositoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onImported={handleImported}
        alreadyImportedIds={importedIds}
      />
    </div>
  )
}
