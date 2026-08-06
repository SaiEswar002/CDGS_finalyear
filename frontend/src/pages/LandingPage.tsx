import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import AuthButton from '../components/AuthButton'

interface Feature {
  icon: string
  title: string
  description: string
  tag?: string
}

const FEATURES: Feature[] = [
  {
    icon: '⚡',
    title: 'Instant GitHub Import',
    description:
      'Seamlessly connect your public and private GitHub repositories with a single click.',
    tag: 'Live',
  },
  {
    icon: '🔐',
    title: 'Bank-Grade Security',
    description:
      'AES-256-GCM encrypted GitHub tokens, CSRF protection, and HttpOnly JWT authentication.',
    tag: 'Secured',
  },
  {
    icon: '🧠',
    title: 'AI Documentation Engine',
    description:
      'Generates rich, comprehensive API guides, inline code comments, and architecture overviews.',
    tag: 'AI Powered',
  },
  {
    icon: '📊',
    title: 'Real-Time Dashboard',
    description:
      'Track total repositories, documentation runs, and workspace metrics in real time.',
    tag: 'Interactive',
  },
  {
    icon: '🔄',
    title: 'Automated Sync & Webhooks',
    description:
      'Monitors push events and repository commits to keep documentation continuously updated.',
    tag: 'Automated',
  },
  {
    icon: '📖',
    title: 'OpenAPI & Swagger Specs',
    description:
      'Interactive OpenAPI documentation built-in for seamless backend API exploration.',
    tag: 'Developer Ready',
  },
]

const STEPS = [
  {
    step: '01',
    title: 'Connect GitHub',
    description: 'Sign in securely with GitHub OAuth in seconds.',
  },
  {
    step: '02',
    title: 'Select Repositories',
    description: 'Choose which public or private repos you want to document.',
  },
  {
    step: '03',
    title: 'Generate & Publish',
    description: 'Sit back while AI generates and versions your documentation.',
  },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()

  return (
    <div className="animate-fade-in space-y-24 pb-16">
      {/* ── Hero Section ─────────────────────────────────────────── */}
      <section className="relative pt-20 pb-12 overflow-hidden">
        {/* Ambient Glows */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-brand-600/20 blur-[120px]" />
          <div className="absolute top-40 right-1/4 w-[350px] h-[250px] rounded-full bg-violet-600/15 blur-[100px]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-300">
              CDGS Platform Live • GitHub OAuth & Supabase Integrated
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 text-slate-100">
            Transform Repositories into{' '}
            <span className="text-gradient">Live AI Documentation</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Automate your codebase documentation workflows. CDGS connects directly to your GitHub account, monitors repository updates, and generates structured, production-ready documentation using AI.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                id="hero-cta-dashboard"
                className="btn-primary text-base px-8 py-4 shadow-xl shadow-brand-500/20"
              >
                Go to Workspace Dashboard
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ) : (
              <AuthButton size="lg" className="shadow-xl shadow-brand-500/20" />
            )}

            <Link
              to="/repositories"
              id="hero-cta-explore"
              className="btn-secondary text-base px-8 py-4"
            >
              Explore Repositories
            </Link>
          </div>
        </div>
      </section>

      {/* ── Interactive Code / Platform Showcase ──────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card p-6 sm:p-8 rounded-2xl border-white/10 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
              <span className="text-xs font-mono text-slate-400 ml-2">cdgs-documentation-pipeline.ts</span>
            </div>
            <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-md">
              AI Generation Engine Active
            </span>
          </div>

          <div className="font-mono text-sm space-y-2 text-slate-300 overflow-x-auto scrollbar-hide">
            <p className="text-slate-500">// 1. GitHub Webhook event received on commit push</p>
            <p className="text-emerald-400">const repository = await cdgs.importRepo(&quot;owner/repo&quot;);</p>
            <p className="text-slate-500">// 2. Abstract Syntax Tree & AI Context Extraction</p>
            <p className="text-violet-400">const docs = await cdgs.generateDocs(repository.codebase, &#123; model: &quot;gpt-4o&quot; &#125;);</p>
            <p className="text-slate-500">// 3. Store versioned documentation artifact</p>
            <p className="text-brand-300">await cdgs.publishVersion(&#123; version: &quot;v1.2.0&quot;, docs &#125;);</p>
          </div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────── */}
      <section id="features" aria-label="Features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
            Engineered for Modern Software Teams
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-base">
            From automated GitHub authentication to background queue processing, CDGS handles your end-to-end documentation ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="glass-card p-6 flex flex-col justify-between hover:border-brand-500/40 hover:bg-white/[0.04] transition-all duration-300 group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl" role="img" aria-label={feature.title}>
                    {feature.icon}
                  </span>
                  {feature.tag && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold font-mono text-brand-300 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
                      {feature.tag}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-brand-300 transition-colors mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-slate-100 mb-3">How CDGS Works</h2>
          <p className="text-slate-400">Get your automated documentation setup in 3 simple steps</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div key={step.step} className="glass-card p-6 relative overflow-hidden">
              <span className="text-5xl font-extrabold text-white/5 absolute top-2 right-4 select-none">
                {step.step}
              </span>
              <div className="relative z-10">
                <span className="inline-block text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-md mb-4">
                  Step {step.step}
                </span>
                <h3 className="text-lg font-bold text-slate-100 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA Banner ─────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="glass-card p-10 sm:p-12 text-center rounded-3xl border-brand-500/30 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-brand-600/10 via-violet-600/10 to-brand-600/10" />
          <h2 className="text-3xl font-extrabold text-slate-100 mb-4">
            Ready to Automate Your Repository Docs?
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-8 text-sm sm:text-base">
            Connect your GitHub account today and manage your repositories in one central dashboard.
          </p>
          <div className="flex justify-center">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary text-base px-8 py-3.5">
                Go to Dashboard
              </Link>
            ) : (
              <AuthButton size="md" />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
