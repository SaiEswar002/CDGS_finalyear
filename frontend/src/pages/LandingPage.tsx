import { Link } from 'react-router-dom'

/** Feature item data shape */
interface Feature {
  icon: string
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: '🤖',
    title: 'AI-Powered Generation',
    description:
      'Automatically generate comprehensive docs from your codebase using state-of-the-art language models.',
  },
  {
    icon: '🔗',
    title: 'GitHub Native',
    description:
      'Connect any repository. We listen to push events and regenerate docs on every commit.',
  },
  {
    icon: '📦',
    title: 'Version Control',
    description:
      'Every doc generation is versioned. Roll back, compare, and publish with full history.',
  },
  {
    icon: '⚡',
    title: 'Queue-Driven',
    description:
      'Heavy generation jobs run in the background via BullMQ — your UI stays responsive.',
  },
]

/**
 * Static landing page — Phase 1.
 * No live data; showcases product value proposition.
 */
export default function LandingPage() {
  return (
    <div className="animate-fade-in">
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background glow orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px]
                          rounded-full bg-brand-600/20 blur-3xl" />
          <div className="absolute top-48 right-1/4 w-[300px] h-[200px]
                          rounded-full bg-violet-700/15 blur-2xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-8">
            <span className="badge-green">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
              Phase 1 — Foundation
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-6">
            Documentation that{' '}
            <span className="text-gradient">writes itself</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            CDGS connects to your GitHub repositories, listens for changes, and
            automatically generates, versions, and publishes beautiful
            documentation — powered by AI.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/dashboard"
              id="hero-cta-dashboard"
              className="btn-primary text-base px-8 py-4"
            >
              Open Dashboard
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <a
              href="https://github.com/SaiEswar002/CDGS_finalyear"
              id="hero-cta-github"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-base px-8 py-4"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ── Feature grid ───────────────────────────────────── */}
      <section
        id="features"
        aria-label="Features"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
      >
        <h2 className="text-3xl font-bold text-center mb-4 text-slate-100">
          Everything you need
        </h2>
        <p className="text-center text-slate-400 mb-12 max-w-xl mx-auto">
          Built on a solid async foundation — queued jobs, webhooks, and AI
          providers — so your docs are always up to date.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="glass-card p-6 flex flex-col gap-3
                         hover:border-brand-500/30 hover:bg-brand-600/5
                         transition-all duration-200 group"
            >
              <span className="text-3xl" role="img" aria-label={feature.title}>
                {feature.icon}
              </span>
              <h3 className="font-semibold text-slate-100 group-hover:text-brand-300
                             transition-colors duration-150">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Status callout ─────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-4 pb-24 text-center">
        <div className="glass-card p-8 border-brand-500/20">
          <p className="text-sm font-mono text-brand-400 mb-2">// Phase 1 complete</p>
          <p className="text-slate-400 text-sm">
            Foundation scaffolded. GitHub OAuth, webhook processing, AI generation,
            and versioning are coming in later phases.
          </p>
        </div>
      </section>
    </div>
  )
}
