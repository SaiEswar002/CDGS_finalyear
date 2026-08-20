import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
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

interface DocVersionItem {
  id: string
  version_number: number
  commit_sha: string
  published_at: string
  created_at: string
}

interface DocArtifactItem {
  id: string
  file_path: string
  doc_type: string
  title: string
  content: string
  token_count: number
  model_used: string
}

interface PipelineRunItem {
  id: string
  commit_sha: string
  before_sha: string | null
  branch: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'retrying'
  current_stage: string
  duration_ms: number | null
  error_message: string | null
  trigger_type: string
  created_at: string
  retry_count: number
}

function getStageBadge(status: PipelineRunItem['status']) {
  switch (status) {
    case 'success': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    case 'running': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'queued': return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    case 'retrying': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20'
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }
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
  const [activeTriggerSha, setActiveTriggerSha] = useState<string | 'header' | null>(null)
  const isRunningAny = activeTriggerSha !== null

  // Tabs: 'tree' | 'commits' | 'languages' | 'docs' | 'pipeline'
  const [activeTab, setActiveTab] = useState<'tree' | 'commits' | 'languages' | 'docs' | 'pipeline'>('tree')

  // Tab Data States
  const [languages, setLanguages] = useState<LanguageItem[]>([])
  const [totalLangBytes, setTotalLangBytes] = useState(0)
  const [commits, setCommits] = useState<CommitItem[]>([])
  const [tree, setTree] = useState<TreeItem[]>([])
  const [loadingTab, setLoadingTab] = useState(false)
  const [treeSearch, setTreeSearch] = useState('')

  // Documentation States
  const [docVersions, setDocVersions] = useState<DocVersionItem[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [docArtifacts, setDocArtifacts] = useState<DocArtifactItem[]>([])
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [docsSearchQuery, setDocsSearchQuery] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)

  // Pipeline Runs States
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRunItem[]>([])
  const [loadingPipeline, setLoadingPipeline] = useState(false)
  const [backfillingAll, setBackfillingAll] = useState(false)

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
    (tab: 'tree' | 'commits' | 'languages' | 'docs' | 'pipeline', force = false) => {
      if (!id) return

      if (!force) {
        if (tab === 'tree' && tree.length > 0) return
        if (tab === 'commits' && commits.length > 0) return
        if (tab === 'languages' && languages.length > 0) return
        if (tab === 'docs' && docArtifacts.length > 0) return
      }

      setLoadingTab(true)
      if (tab === 'docs') {
        setLoadingDocs(true)
        api
          .get<{ success: boolean; data: { version: DocVersionItem | null; documents: DocArtifactItem[] } }>(
            `/repositories/${id}/docs/latest`,
          )
          .then((res) => {
            const version = res.data.data.version
            const docs = res.data.data.documents ?? []
            setDocArtifacts(docs)
            if (version) {
              setSelectedVersionId(version.id)
              setDocVersions([version])
            }
            if (docs.length > 0) {
              setSelectedArtifactId(docs[0].id)
            }
          })
          .catch(() => {
            toast.error('Failed to load generated documentation')
          })
          .finally(() => {
            setLoadingTab(false)
            setLoadingDocs(false)
          })
        return
      }

      if (tab === 'pipeline') {
        setLoadingPipeline(true)
        api
          .get<{ success: boolean; data: { runs: PipelineRunItem[]; total: number } }>(
            `/pipeline-runs?repositoryId=${id}&limit=20`,
          )
          .then((res) => setPipelineRuns(res.data.data.runs ?? []))
          .catch(() => toast.error('Failed to load pipeline runs'))
          .finally(() => {
            setLoadingTab(false)
            setLoadingPipeline(false)
          })
        return
      }

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
    [id, tree.length, commits.length, languages.length, docArtifacts.length],
  )

  function handleTabChange(tab: 'tree' | 'commits' | 'languages' | 'docs' | 'pipeline') {
    setActiveTab(tab)
    loadTabData(tab)
  }

  // Load tree and languages once repo is available
  useEffect(() => {
    if (repo && id) {
      loadTabData('tree')
      loadTabData('languages')
    }
  }, [repo, id, loadTabData])

  // 3. Pipeline polling — auto-refresh every 4 seconds when active runs exist on pipeline tab
  useEffect(() => {
    if (activeTab !== 'pipeline') return
    const hasActive = pipelineRuns.some((r) => r.status === 'queued' || r.status === 'running')
    if (!hasActive) return

    const interval = setInterval(() => {
      if (!id) return
      api
        .get<{ success: boolean; data: { runs: PipelineRunItem[] } }>(
          `/pipeline-runs?repositoryId=${id}&limit=20`,
        )
        .then((res) => setPipelineRuns(res.data.data.runs ?? []))
        .catch(() => {})
    }, 4000)

    return () => clearInterval(interval)
  }, [activeTab, pipelineRuns, id])

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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to refresh repository data.'))
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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to disconnect repository.'))
      setDeleting(false)
    }
  }

  async function handleTriggerPipeline(commitSha?: string) {
    if (!id) return
    setActiveTriggerSha(commitSha || 'header')
    try {
      const res = await api.post<{ success: boolean; message: string }>(`/repositories/${id}/trigger-pipeline`, {
        commitSha,
      })
      toast.success(res.data.message || 'Pipeline run triggered successfully!')
      setActiveTab('docs')
      setTimeout(() => {
        loadTabData('docs', true)
      }, 2500)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to trigger pipeline run.'))
    } finally {
      setActiveTriggerSha(null)
    }
  }

  async function handleExportPdf() {
    if (!id) return
    if (docArtifacts.length === 0) {
      toast.error('No generated documentation available yet. Please click "Run Pipeline & Build Docs" first.')
      return
    }

    setExportingPdf(true)
    const toastId = toast.loading('Generating professional PDF documentation report...')
    try {
      const endpoint = selectedVersionId
        ? `/repositories/${id}/docs/versions/${selectedVersionId}/pdf`
        : `/repositories/${id}/docs/latest/pdf`

      const response = await api.get(endpoint, {
        responseType: 'blob',
        timeout: 120_000, // 2-minute timeout for PDF generation
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const safeRepoName = (repo?.name || 'repository').replace(/[^a-zA-Z0-9_-]/g, '_')
      link.setAttribute('download', `${safeRepoName}-documentation.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success('PDF report exported and downloaded successfully!', { id: toastId })
    } catch (err: any) {
      let errMsg = 'Failed to export PDF documentation report'
      if (err?.response?.data instanceof Blob) {
        try {
          const blobText = await err.response.data.text()
          const json = JSON.parse(blobText)
          if (json.error) errMsg = json.error
          else if (json.message) errMsg = json.message
        } catch {
          // ignore parsing error
        }
      } else {
        errMsg = getErrorMessage(err, errMsg)
      }
      toast.error(errMsg, { id: toastId })
    } finally {
      setExportingPdf(false)
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
            disabled={isRunningAny}
            onClick={() => { void handleTriggerPipeline() }}
            className="btn-primary !py-2 !px-4 !text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={activeTriggerSha === 'header' ? 'animate-spin inline-block' : ''}>⚡</span>
            {activeTriggerSha === 'header' ? 'Running Pipeline…' : 'Run Pipeline & Build Docs'}
          </button>

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
        <button
          type="button"
          onClick={() => handleTabChange('docs')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${
            activeTab === 'docs'
              ? 'border-brand-500 text-brand-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🧠</span> Generated Docs ({docArtifacts.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('pipeline')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${
            activeTab === 'pipeline'
              ? 'border-brand-500 text-brand-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>⚙️</span> Pipeline
          {pipelineRuns.filter((r) => r.status === 'queued' || r.status === 'running').length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          )}
          ({pipelineRuns.length})
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

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isRunningAny}
                      onClick={() => { void handleTriggerPipeline(c.sha) }}
                      className="px-2.5 py-1 rounded-md bg-brand-500/10 hover:bg-brand-500/20
                                 font-sans text-xs text-brand-300 border border-brand-500/30
                                 transition-colors flex items-center gap-1 disabled:opacity-50 font-medium"
                      title="Run pipeline and generate docs for this committed push"
                    >
                      <span className={activeTriggerSha === c.sha ? 'animate-spin inline-block' : ''}>⚡</span>
                      {activeTriggerSha === c.sha ? 'Building…' : 'Build Docs'}
                    </button>
                    <a
                      href={c.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10
                                 font-mono text-xs text-brand-400 border border-brand-500/20
                                 transition-colors"
                    >
                      {c.sha.slice(0, 7)} ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'docs' ? (
        /* 🧠 Generated Documentation View */
        <div className="space-y-6">
          {docVersions.length > 0 && (
            <div className="flex items-center justify-between glass-card p-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium">Documentation Version:</span>
                <select
                  value={selectedVersionId ?? ''}
                  onChange={(e) => {
                    const verId = e.target.value
                    setSelectedVersionId(verId)
                    if (id && verId) {
                      setLoadingDocs(true)
                      api
                        .get<{ success: boolean; data: { version: DocVersionItem; documents: DocArtifactItem[] } }>(
                          `/repositories/${id}/docs/versions/${verId}`,
                        )
                        .then((res) => {
                          setDocArtifacts(res.data.data.documents ?? [])
                          if (res.data.data.documents?.length > 0) {
                            setSelectedArtifactId(res.data.data.documents[0].id)
                          }
                        })
                        .finally(() => setLoadingDocs(false))
                    }
                  }}
                  className="bg-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 border border-white/10 focus:outline-none focus:border-brand-500 font-mono"
                >
                  {docVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      Version {v.version_number} (sha: {v.commit_sha.slice(0, 7)}) — {new Date(v.created_at || v.published_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={() => { void handleExportPdf() }}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                  title="Export complete documentation snapshot as professional PDF"
                >
                  <span className={exportingPdf ? 'animate-spin inline-block' : ''}>📄</span>
                  {exportingPdf ? 'Exporting PDF…' : 'Export PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => loadTabData('docs', true)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          )}

          {loadingDocs ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
          ) : docArtifacts.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center text-xl">
                🧠
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-1">No Generated Documentation Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                Push code to this repository to automatically trigger Phase 3 change detection & Phase 4 documentation generation.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isRunningAny}
                  onClick={() => { void handleTriggerPipeline() }}
                  className="btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  <span className={activeTriggerSha === 'header' ? 'animate-spin inline-block' : ''}>⚡</span>
                  {activeTriggerSha === 'header' ? 'Running Pipeline…' : 'Run Pipeline & Generate Docs'}
                </button>
                <button
                  type="button"
                  onClick={() => loadTabData('docs', true)}
                  className="btn-secondary text-xs inline-flex items-center gap-1.5"
                >
                  🔄 Refresh Docs
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Artifacts Sidebar */}
              <div className="lg:col-span-1 space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
                  <span>Generated Artifacts</span>
                  <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-mono text-[10px]">
                    {docArtifacts.length}
                  </span>
                </h3>

                {/* Instant Search Bar */}
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="🔍 Filter artifacts..."
                    value={docsSearchQuery}
                    onChange={(e) => setDocsSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-700/60 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                {docArtifacts
                  .filter((art) => {
                    if (!docsSearchQuery.trim()) return true
                    const q = docsSearchQuery.toLowerCase()
                    return (
                      art.title.toLowerCase().includes(q) ||
                      art.file_path.toLowerCase().includes(q) ||
                      art.doc_type.toLowerCase().includes(q)
                    )
                  })
                  .map((art) => {
                    const badgeColor =
                      art.file_path === 'docs/quality.md'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                        : art.doc_type === 'readme'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : art.doc_type === 'architecture'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        : art.doc_type === 'api'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : art.doc_type === 'database'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'

                    return (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => setSelectedArtifactId(art.id)}
                        className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                          selectedArtifactId === art.id
                            ? 'bg-brand-500/10 border-brand-500/50 text-slate-100 font-medium shadow-sm ring-1 ring-brand-500/30'
                            : 'glass-card border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${badgeColor}`}>
                            {art.doc_type}
                          </span>
                          {art.model_used && (
                            <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{art.model_used}</span>
                          )}
                        </div>
                        <p className="font-medium truncate text-slate-200">{art.title || art.file_path}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">{art.file_path}</p>
                      </button>
                    )
                  })}
              </div>

              {/* Artifact Viewer */}
              <div className="lg:col-span-3">
                {(() => {
                  const selectedDoc = docArtifacts.find((d) => d.id === selectedArtifactId) ?? docArtifacts[0]
                  if (!selectedDoc) return null

                  const badgeColor =
                    selectedDoc.doc_type === 'readme'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      : selectedDoc.doc_type === 'architecture'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : selectedDoc.doc_type === 'api'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : selectedDoc.doc_type === 'database'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'

                  return (
                    <div className="glass-card p-6 border border-white/10">
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-white/10">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border uppercase font-mono ${badgeColor}`}>
                              {selectedDoc.doc_type}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">{selectedDoc.file_path}</span>
                          </div>
                          <h2 className="text-lg font-bold text-slate-100">{selectedDoc.title}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={exportingPdf}
                            onClick={() => { void handleExportPdf() }}
                            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <span className={exportingPdf ? 'animate-spin inline-block' : ''}>📄</span>
                            {exportingPdf ? 'Exporting PDF…' : 'Export PDF'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedDoc.content)
                              toast.success('Document copied to clipboard!')
                            }}
                            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                          >
                            <span>📋</span> Copy Content
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[650px] overflow-y-auto">
                        {selectedDoc.content}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'languages' ? (
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
      ) : activeTab === 'pipeline' ? (
        /* ⚙️ Pipeline Runs Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Pipeline Run History</h2>
              <p className="text-xs text-slate-500 mt-0.5">Auto-triggers on every push. Live-polls active runs every 4 seconds.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isRunningAny || backfillingAll}
                onClick={async () => {
                  if (!id || commits.length === 0) { toast.error('Load commits first'); return }
                  setBackfillingAll(true)
                  let count = 0
                  for (const c of commits) {
                    try {
                      await api.post(`/repositories/${id}/trigger-pipeline`, { commitSha: c.sha })
                      count++
                    } catch { /* skip already-queued */ }
                  }
                  toast.success(`Queued ${count} pipeline run${count !== 1 ? 's' : ''} for existing commits`)
                  setBackfillingAll(false)
                  loadTabData('pipeline', true)
                }}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                title="Generate docs for all recent commits in history"
              >
                <span className={backfillingAll ? 'animate-spin inline-block' : ''}>📂</span>
                {backfillingAll ? 'Queuing…' : 'Backfill All Commits'}
              </button>
              <button
                type="button"
                disabled={isRunningAny}
                onClick={() => { void handleTriggerPipeline() }}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className={activeTriggerSha === 'header' ? 'animate-spin inline-block' : ''}>⚡</span>
                {activeTriggerSha === 'header' ? 'Running…' : 'Run Pipeline Now'}
              </button>
              <button
                type="button"
                onClick={() => loadTabData('pipeline', true)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {loadingPipeline ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
          ) : pipelineRuns.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center text-xl">
                ⚙️
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-1">No Pipeline Runs Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                Pipeline runs are created automatically on every GitHub push. You can also trigger one manually.
              </p>
              <button
                type="button"
                disabled={isRunningAny}
                onClick={() => { void handleTriggerPipeline() }}
                className="btn-primary text-xs inline-flex items-center gap-1.5"
              >
                <span>⚡</span> Trigger Pipeline Now
              </button>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-xs text-left" aria-label="Pipeline run history">
                <thead>
                  <tr className="border-b border-white/8 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Commit</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Trigger</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3 text-right">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pipelineRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-brand-400">
                        {run.commit_sha.slice(0, 7)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono">{run.branch}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase ${getStageBadge(run.status)}`}>
                          {run.status === 'running' ? (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                              {run.status}
                            </span>
                          ) : run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 capitalize">{run.current_stage}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500 font-mono">
                          {run.trigger_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {run.duration_ms !== null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-right font-sans">
                        {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}


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
