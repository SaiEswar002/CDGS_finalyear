import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export interface PipelineRunItem {
  id: string
  commit_sha: string
  branch: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'retrying'
  current_stage: 'webhook' | 'clone' | 'diff'
  duration_ms: number | null
  created_at: string
  repository?: {
    full_name: string
    name: string
  }
}

function getStatusBadge(status: PipelineRunItem['status']) {
  switch (status) {
    case 'success':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    case 'running':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'queued':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    case 'retrying':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    case 'failed':
      return 'bg-red-500/10 text-red-400 border-red-500/20'
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }
}

export default function PipelineRunsTable() {
  const [runs, setRuns] = useState<PipelineRunItem[]>([])
  const [loading, setLoading] = useState(true)

  function fetchRuns() {
    setLoading(true)
    api
      .get<{ success: boolean; data: { runs: PipelineRunItem[]; total: number } }>(
        '/pipeline-runs?limit=10',
      )
      .then((res) => setRuns(res.data.data.runs ?? []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRuns()
  }, [])

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 mb-1">Recent Pipeline Runs</h2>
          <p className="text-xs text-slate-400">
            Real-time change detection & processing history across your repositories.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRuns}
          disabled={loading}
          className="btn-secondary !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">
          No pipeline runs recorded yet. Pushing code to connected repositories will trigger runs automatically.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left" aria-label="Recent pipeline runs">
            <thead>
              <tr className="border-b border-white/8 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="pb-3">Repository</th>
                <th className="pb-3">Commit</th>
                <th className="pb-3">Branch</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Current Stage</th>
                <th className="pb-3">Duration</th>
                <th className="pb-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-white/3 transition-colors">
                  <td className="py-3 font-sans font-medium text-slate-200">
                    {run.repository?.full_name ?? '—'}
                  </td>
                  <td className="py-3 text-brand-400 font-bold">
                    {run.commit_sha.slice(0, 7)}
                  </td>
                  <td className="py-3 text-slate-300">
                    {run.branch}
                  </td>
                  <td className="py-3 font-sans">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border uppercase ${getStatusBadge(
                        run.status,
                      )}`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="py-3 font-sans text-slate-300 capitalize">
                    {run.current_stage}
                  </td>
                  <td className="py-3 text-slate-400">
                    {run.duration_ms !== null ? `${run.duration_ms} ms` : '—'}
                  </td>
                  <td className="py-3 text-slate-500 text-right font-sans text-[11px]">
                    {new Date(run.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
