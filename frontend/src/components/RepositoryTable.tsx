import { Link } from 'react-router-dom'
import type { Repository } from './RepositoryCard'

interface RepositoryTableProps {
  repositories: Repository[]
  onDelete?: (id: string) => void
  isDeleting?: string | null
}

/**
 * RepositoryTable — table view of imported repositories.
 */
export default function RepositoryTable({
  repositories,
  onDelete,
  isDeleting,
}: RepositoryTableProps) {
  if (repositories.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-600/15 border border-brand-500/20
                        flex items-center justify-center text-3xl">
          📁
        </div>
        <p className="text-slate-300 font-medium mb-1">No repositories yet</p>
        <p className="text-slate-500 text-sm">Import a GitHub repository to get started.</p>
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      <table className="w-full text-sm" aria-label="Imported repositories">
        <thead>
          <tr className="border-b border-white/8 text-left">
            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Repository
            </th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">
              Language
            </th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">
              Visibility
            </th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {repositories.map((repo) => (
            <tr
              key={repo.id}
              id={`repo-row-${repo.id}`}
              className="hover:bg-white/3 transition-colors duration-100"
            >
              <td className="px-6 py-4">
                <Link
                  to={`/repositories/${repo.id}`}
                  className="font-medium text-slate-100 hover:text-brand-300 transition-colors"
                >
                  {repo.full_name}
                </Link>
                {repo.description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {repo.description}
                  </p>
                )}
              </td>

              <td className="px-6 py-4 hidden md:table-cell">
                {repo.language ? (
                  <span className="text-xs text-slate-400">{repo.language}</span>
                ) : (
                  <span className="text-xs text-slate-600">—</span>
                )}
              </td>

              <td className="px-6 py-4 hidden lg:table-cell">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    repo.is_private
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {repo.is_private ? 'Private' : 'Public'}
                </span>
              </td>

              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Link
                    to={`/repositories/${repo.id}`}
                    id={`view-repo-${repo.id}`}
                    className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium"
                  >
                    View
                  </Link>
                  {onDelete && (
                    <button
                      id={`delete-repo-${repo.id}`}
                      type="button"
                      disabled={isDeleting === repo.id}
                      onClick={() => onDelete(repo.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors
                                 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isDeleting === repo.id ? 'Removing…' : 'Disconnect'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
