import { Link } from 'react-router-dom'

export interface Repository {
  id: string
  user_id: string
  github_repo_id: number
  owner: string
  name: string
  full_name: string
  description: string | null
  language: string | null
  is_private: boolean
  default_branch: string
  selected_branch: string | null
  html_url: string | null
  clone_url: string | null
  is_active: boolean
  last_synced_at: string | null
  updated_at: string
  created_at: string
}

interface RepositoryCardProps {
  repo: Repository
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  JavaScript: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Python: 'bg-green-500/20 text-green-300 border-green-500/30',
  Go: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Rust: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Java: 'bg-red-500/20 text-red-300 border-red-500/30',
  default: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

function getLanguageColor(lang: string | null) {
  if (!lang) return LANGUAGE_COLORS.default
  return LANGUAGE_COLORS[lang] ?? LANGUAGE_COLORS.default
}

/**
 * RepositoryCard — displays a single imported repository.
 */
export default function RepositoryCard({ repo }: RepositoryCardProps) {
  const timeAgo = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((new Date(repo.updated_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day',
  )

  return (
    <div className="glass-card p-6 flex flex-col gap-3 hover:border-brand-500/30
                    hover:bg-brand-600/5 transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/repositories/${repo.id}`}
            id={`repo-card-${repo.id}`}
            className="font-semibold text-slate-100 group-hover:text-brand-300
                       transition-colors duration-150 truncate block"
          >
            {repo.owner}/{repo.name}
          </Link>
          {repo.html_url && (
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              github.com/{repo.full_name}
            </a>
          )}
        </div>

        {/* Private badge */}
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
            repo.is_private
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}
        >
          {repo.is_private ? 'Private' : 'Public'}
        </span>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
          {repo.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2">
        {repo.language && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getLanguageColor(repo.language)}`}
          >
            {repo.language}
          </span>
        )}
        <span className="text-xs text-slate-500 ml-auto">{timeAgo}</span>
      </div>
    </div>
  )
}
