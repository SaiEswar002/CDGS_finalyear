/**
 * DashboardPage — Phase 1 placeholder.
 *
 * This route exists to prove routing works end-to-end.
 * Real dashboard content (repos, jobs, doc versions) is a later phase.
 */
export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-slide-up">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="badge-green">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
            Route active
          </span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-100 mb-3">
          Dashboard
        </h1>
        <p className="text-slate-400 max-w-xl">
          Routing is working correctly. This placeholder will become the
          main dashboard once GitHub OAuth and repository management are
          implemented in later phases.
        </p>
      </div>

      {/* Placeholder cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        {[
          { label: 'Repositories', value: '—', icon: '📁', note: 'Phase 2' },
          { label: 'Doc Runs', value: '—', icon: '⚙️', note: 'Phase 3' },
          { label: 'AI Tokens Used', value: '—', icon: '🧠', note: 'Phase 4' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-6">
            <div className="flex items-start justify-between mb-4">
              <span className="text-2xl" role="img" aria-label={stat.label}>
                {stat.icon}
              </span>
              <span className="text-xs font-mono text-slate-500 bg-white/5 px-2 py-1 rounded-md">
                {stat.note}
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-300 mb-1">{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Coming soon callout */}
      <div className="glass-card p-8 border-dashed border-white/10 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-600/15 border border-brand-500/20
                        flex items-center justify-center text-3xl">
          🚧
        </div>
        <h2 className="text-xl font-semibold text-slate-200 mb-2">
          Dashboard under construction
        </h2>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Connect your GitHub account, add repositories, and trigger doc generation
          — all coming in Phases 2–4.
        </p>
      </div>
    </div>
  )
}
