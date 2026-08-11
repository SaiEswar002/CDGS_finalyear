import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import type { Repository } from '../components/RepositoryCard'
import FileViewerModal from '../components/FileViewerModal'

interface LanguageItem {
  name: string
  bytes: number
  percentage: number
}

interface CommitItem {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      date: string
    }
  }
  author: {
    login: string
    avatar_url: string
  } | null
  html_url: string
}

interface TreeItem {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  PHP: '#4F5D95',
  Ruby: '#701516',
}

function getLangColor(lang: string): string {
  return LANG_COLORS[lang] ?? '#6e7681'
}

function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * RepositoryDetailPage — /repositories/:id (protected)
 * Displays repository details, interactive directory tree, commits, and language breakdown.
 */
export default function RepositoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [repo, setRepo] = useState<Repository | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Tabs: 'tree' | 'commits' | 'languages'
  const [activeTab, setActiveTab] = useState<'tree' | 'commits' | 'languages'>('tree')

  // Tab Data States
  const [languages, setLanguages] = useState<LanguageItem[]>([])
  const [totalLangBytes, setTotalLangBytes] = useState(0)
  const [commits, setCommits] = useState<CommitItem[]>([])
  const [tree, setTree] = useState<TreeItem[]>([])
  const [loadingTab, setLoadingTab] = useState(false)
  const [treeSearch, setTreeSearch] = useState('')

  // Directory navigation state
  const [currentDir, setCurrentDir] = useState<string>('')

  // Selected file for reading modal
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

  // 1. Fetch Repository Metadata
  useEffect(() => {
    if (!id) return
    let isMounted = true
    setLoading(true)

    api
      .get<{ success: boolean; data: { repository: Repository } }>(`/repositories/${id}`)
      .then((res) => {
        if (isMounted) {
          setRepo(res.data.data.repository)
        }
      })
      .catch(() => {
        if (isMounted) {
          toast.error('Repository not found')
          navigate('/repositories')
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [id, navigate])

  // 2. Fetch Tab Data helper
  const loadTabData = useCallback(
    (tab: 'tree' | 'commits' | 'languages', force = false) => {
      if (!id) return

      if (!force) {
        if (tab === 'tree' && tree.length > 0) return
        if (tab === 'commits' && commits.length > 0) return
        if (tab === 'languages' && languages.length > 0) return
      }

      setLoadingTab(true)
      api
        .get<{ success: boolean; data: any }>(`/repositories/${id}/${tab}`)
        .then((res) => {
          if (tab === 'tree') setTree(res.data.data.tree ?? [])
          if (tab === 'commits') setCommits(res.data.data.commits ?? [])
          if (tab === 'languages') {
            setLanguages(res.data.data.languages ?? [])
            setTotalLangBytes(res.data.data.totalBytes ?? 0)
          }
        })
        .catch(() => {
          // Soft error handling
        })
        .finally(() => setLoadingTab(false))
    },
    [id, tree.length, commits.length, languages.length],
  )

  // Load tree and languages once repo is available
  useEffect(() => {
    if (repo && id) {
      loadTabData('tree')
      loadTabData('languages')
    }
  }, [repo, id, loadTabData])

  function handleTabChange(tab: 'tree' | 'commits' | 'languages') {
    setActiveTab(tab)
    loadTabData(tab)
  }

  async function handleRefresh() {
    if (!id) return
    setRefreshing(true)
    try {
      setTree([])
      setCommits([])
      setLanguages([])
      await Promise.all([
        api.get(`/repositories/${id}/tree`).then((res) => setTree(res.data.data.tree ?? [])),
        api.get(`/repositories/${id}/commits`).then((res) => setCommits(res.data.data.commits ?? [])),
        api.get(`/repositories/${id}/languages`).then((res) => {
          setLanguages(res.data.data.languages ?? [])
          setTotalLangBytes(res.data.data.totalBytes ?? 0)
        }),
      ])
      toast.success('Repository data refreshed from GitHub!')
    } catch {
      toast.error('Failed to refresh repository data.')
    } finally {
      setRefreshing(false)
    }
  }

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

  if (!repo) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="glass-card p-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center text-xl">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Repository Not Found</h2>
          <p className="text-slate-400 text-sm mb-6">
            The requested repository could not be found or you do not have permission to view it.
          </p>
          <Link to="/repositories" className="btn-primary">
            ← Back to Repositories
          </Link>
        </div>
      </div>
    )
  }

  // Directory Filtering Logic
  const isSearching = treeSearch.trim().length > 0

  const currentDirectoryItems = isSearching
    ? tree.filter((item) => item.path.toLowerCase().includes(treeSearch.toLowerCase()))
    : tree.filter((item) => {
        if (!currentDir) {
          return !item.path.includes('/')
        }
        if (!item.path.startsWith(`${currentDir}/`)) return false
        const relativePath = item.path.slice(currentDir.length + 1)
        return !relativePath.includes('/')
      })

  const dirParts = currentDir ? currentDir.split('/') : []

  function navigateUp() {
    if (!currentDir) return
    const parts = currentDir.split('/')
    parts.pop()
    setCurrentDir(parts.join('/'))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-slide-up">
      {/* Breadcrumb Header */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500 mb-8">
        <Link to="/repositories" className="hover:text-slate-300 transition-colors">
          Repositories
        </Link>
        <span>/</span>
        <span className="text-slate-300">{repo.full_name}</span>
      </nav>

      {/* Main Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-extrabold text-slate-100">{repo.full_name}</h1>
            <span
              className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                repo.is_private
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {repo.is_private ? 'Private' : 'Public'}
            </span>
          </div>
          {repo.description && (
            <p className="text-slate-400 max-w-xl text-sm leading-relaxed">{repo.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => { void handleRefresh() }}
            className="btn-secondary !py-2 !px-4 !text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>

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

      {/* Metadata Overview Grid */}
      <div className="glass-card p-6 grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Owner</p>
          <p className="text-sm font-medium text-slate-200">{repo.owner}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Default Branch</p>
          <p className="text-sm font-medium text-slate-200 font-mono">{repo.default_branch}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Primary Language</p>
          <p className="text-sm font-medium text-slate-200">{repo.language ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Connected On</p>
          <p className="text-sm font-medium text-slate-200">
            {new Date(repo.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Language Breakdown Bar */}
      {languages.length > 0 && (
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300">Languages Breakdown</h2>
            <span className="text-xs text-slate-500">{(totalLangBytes / 1024).toFixed(0)} KB total</span>
          </div>

          <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-800 mb-4">
            {languages.map((lang) => (
              <div
                key={lang.name}
                style={{ width: `${lang.percentage}%`, backgroundColor: getLangColor(lang.name) }}
                title={`${lang.name}: ${lang.percentage}%`}
                className="h-full transition-all duration-300"
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            {languages.map((lang) => (
              <div key={lang.name} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: getLangColor(lang.name) }}
                />
                <span className="font-medium text-slate-200">{lang.name}</span>
                <span className="text-slate-500">{lang.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 mb-6">
        <button
          type="button"
          onClick={() => handleTabChange('tree')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${
            activeTab === 'tree'
              ? 'border-brand-500 text-brand-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📁</span> Files & Folders ({tree.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('commits')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${
            activeTab === 'commits'
              ? 'border-brand-500 text-brand-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📜</span> Recent Commits ({commits.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('languages')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${
            activeTab === 'languages'
              ? 'border-brand-500 text-brand-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📊</span> Detailed Languages ({languages.length})
        </button>
      </div>

      {/* Tab Contents */}
      {loadingTab ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      ) : activeTab === 'tree' ? (
        /* 📁 Interactive Directory Explorer */
        <div className="glass-card p-6">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Filter files by path (e.g. src/App.tsx)…"
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-white/10
                         text-sm text-slate-200 placeholder-slate-500
                         focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          {!isSearching && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/40 px-4 py-2.5 rounded-xl mb-4 border border-white/5 font-mono">
              <button
                type="button"
                onClick={() => setCurrentDir('')}
                className="hover:text-brand-300 transition-colors font-bold text-slate-300"
              >
                root
              </button>
              {dirParts.map((part, index) => {
                const fullPrefix = dirParts.slice(0, index + 1).join('/')
                return (
                  <span key={fullPrefix} className="flex items-center gap-1.5">
                    <span className="text-slate-600">/</span>
                    <button
                      type="button"
                      onClick={() => setCurrentDir(fullPrefix)}
                      className={`hover:text-brand-300 transition-colors ${
                        index === dirParts.length - 1 ? 'font-bold text-brand-400' : 'text-slate-300'
                      }`}
                    >
                      {part}
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {currentDirectoryItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              {tree.length === 0 ? 'No files found in repository.' : 'Directory is empty.'}
            </div>
          ) : (
            <div className="divide-y divide-white/5 font-mono text-xs max-h-[550px] overflow-y-auto scrollbar-hide">
              {!isSearching && currentDir && (
                <button
                  type="button"
                  onClick={navigateUp}
                  className="w-full py-2.5 px-3 hover:bg-white/5 rounded-lg flex items-center gap-2.5 text-slate-400 hover:text-brand-300 transition-colors text-left font-bold"
                >
                  <span className="text-base">📁</span>
                  <span>.. (Parent Directory)</span>
                </button>
              )}

              {currentDirectoryItems.map((item) => {
                const displayName = isSearching
                  ? item.path
                  : currentDir
                  ? item.path.slice(currentDir.length + 1)
                  : item.path

                return (
                  <div
                    key={item.path}
                    onClick={() => {
                      if (item.type === 'tree') {
                        setCurrentDir(item.path)
                      } else {
                        setSelectedFilePath(item.path)
                      }
                    }}
                    className="py-2.5 px-3 hover:bg-white/5 rounded-lg flex items-center justify-between group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-base">
                        {item.type === 'tree' ? '📁' : '📄'}
                      </span>
                      <span
                        className={`truncate ${
                          item.type === 'tree'
                            ? 'font-bold text-brand-300 group-hover:text-brand-200'
                            : 'text-slate-300 group-hover:text-white'
                        }`}
                      >
                        {displayName}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-slate-500 text-[11px]">
                      {item.type === 'blob' && item.size !== undefined && (
                        <span>{formatBytes(item.size)}</span>
                      )}
                      <span className="font-mono text-slate-600">{item.sha.slice(0, 7)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'commits' ? (
        /* 📜 Commit History View */
        <div className="glass-card p-6">
          {commits.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No commit history available.
            </div>
          ) : (
            <div className="space-y-4">
              {commits.map((c) => (
                <div
                  key={c.sha}
                  className="p-4 rounded-xl border border-white/8 hover:bg-white/5 transition-colors flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {c.author?.avatar_url ? (
                      <img
                        src={c.author.avatar_url}
                        alt={c.commit.author.name}
                        className="w-8 h-8 rounded-full shrink-0 ring-1 ring-brand-500/30"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {c.commit.author.name[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 line-clamp-1">
                        {c.commit.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        <span className="font-medium text-slate-300">{c.commit.author.name}</span>
                        {' committed '}
                        <span>
                          {new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
                            Math.round((new Date(c.commit.author.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                            'day',
                          )}
                        </span>
                      </p>
                    </div>
                  </div>

                  <a
                    href={c.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10
                               font-mono text-xs text-brand-400 border border-brand-500/20
                               transition-colors"
                  >
                    {c.sha.slice(0, 7)} ↗
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 📊 Languages Table View */
        <div className="glass-card p-6">
          <div className="divide-y divide-white/5">
            {languages.map((lang) => (
              <div key={lang.name} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getLangColor(lang.name) }}
                  />
                  <span className="font-medium text-sm text-slate-200">{lang.name}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-slate-400">{formatBytes(lang.bytes)}</span>
                  <span className="font-bold text-brand-300 w-16 text-right">
                    {lang.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected File Viewer Modal */}
      {selectedFilePath && (
        <FileViewerModal
          repoId={repo.id}
          filePath={selectedFilePath}
          onClose={() => setSelectedFilePath(null)}
        />
      )}
    </div>
  )
}
