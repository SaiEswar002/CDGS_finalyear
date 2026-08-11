import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

interface FileContentData {
  file: {
    path: string
    name: string
    size: number
    sha: string
    content: string
    html_url: string
  }
  editUrl: string
}

interface FileViewerModalProps {
  repoId: string
  filePath: string | null
  onClose: () => void
}

function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileViewerModal({ repoId, filePath, onClose }: FileViewerModalProps) {
  const [data, setData] = useState<FileContentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!filePath) return
    setLoading(true)
    api
      .get<{ success: boolean; data: FileContentData }>(
        `/repositories/${repoId}/file?path=${encodeURIComponent(filePath)}`,
      )
      .then((res) => setData(res.data.data))
      .catch(() => {
        toast.error('Failed to load file content.')
        onClose()
      })
      .finally(() => setLoading(false))
  }, [repoId, filePath, onClose])

  if (!filePath) return null

  const lines = data?.file.content ? data.file.content.split('\n') : []

  function handleCopy() {
    if (!data?.file.content) return
    navigator.clipboard.writeText(data.file.content)
    setCopied(true)
    toast.success('File content copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${filePath}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[85vh] glass-card flex flex-col overflow-hidden animate-slide-up shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl">📄</span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-100 font-mono truncate">
                {filePath}
              </h2>
              {data && (
                <p className="text-xs text-slate-400">
                  {formatBytes(data.file.size)} • {lines.length} lines
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {data?.editUrl && (
              <a
                href={data.editUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold
                           bg-brand-600 hover:bg-brand-500 text-white
                           transition-all duration-150 flex items-center gap-1.5 shadow-md shadow-brand-900/40"
              >
                <span>✏️</span> Edit on GitHub ↗
              </a>
            )}

            <button
              type="button"
              onClick={handleCopy}
              disabled={!data?.file.content}
              className="px-3 py-1.5 rounded-lg text-xs font-medium
                         bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white
                         transition-colors border border-white/10 disabled:opacity-40"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-y-auto bg-[#0d1117] p-4 text-xs font-mono text-slate-200">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
          ) : !data?.file.content ? (
            <div className="py-12 text-center text-slate-500">
              Binary or empty file cannot be previewed directly.
            </div>
          ) : (
            <div className="table w-full select-text border-collapse">
              {lines.map((line, idx) => (
                <div key={idx} className="table-row hover:bg-white/5">
                  <div className="table-cell text-right pr-4 text-slate-600 select-none w-10 text-[11px]">
                    {idx + 1}
                  </div>
                  <div className="table-cell whitespace-pre-wrap break-all leading-relaxed pl-2 text-slate-300">
                    {line || ' '}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
