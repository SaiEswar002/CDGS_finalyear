import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'

/**
 * ProfilePage — /profile (protected)
 * Shows user info and logout action.
 */
export default function ProfilePage() {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await api.post('/auth/logout')
      clearUser()
      toast.success('Signed out successfully')
      navigate('/login')
    } catch {
      toast.error('Logout failed. Please try again.')
    }
  }

  if (!user) return null

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-slide-up">
      <h1 className="text-4xl font-extrabold text-slate-100 mb-8">Profile</h1>

      {/* User card */}
      <div className="glass-card p-8 mb-6">
        <div className="flex items-center gap-5 mb-8">
          {user.githubAvatarUrl ? (
            <img
              src={user.githubAvatarUrl}
              alt="Your avatar"
              className="w-20 h-20 rounded-2xl ring-4 ring-brand-500/20"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-brand-600 flex items-center justify-center
                            text-2xl font-bold text-white ring-4 ring-brand-500/20">
              {(user.githubName ?? user.githubLogin)[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-100">
              {user.githubName ?? user.githubLogin}
            </h2>
            <p className="text-slate-400">@{user.githubLogin}</p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            { dt: 'GitHub Login', dd: user.githubLogin, id: 'profile-login' },
            { dt: 'Display Name', dd: user.githubName ?? '—', id: 'profile-name' },
            { dt: 'Email', dd: user.email ?? 'Not shared', id: 'profile-email' },
            { dt: 'Account ID', dd: user.id.slice(0, 8) + '…', id: 'profile-id' },
          ].map(({ dt, dd, id }) => (
            <div key={dt} id={id}>
              <dt className="text-xs text-slate-500 uppercase tracking-wider mb-1">{dt}</dt>
              <dd className="text-sm font-medium text-slate-200">{dd}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Danger zone */}
      <div className="glass-card p-6 border-red-500/10">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Account Actions</h3>
        <button
          id="profile-logout"
          type="button"
          onClick={() => { void handleLogout() }}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm
                     border border-red-500/30 text-red-400
                     hover:bg-red-500/10 hover:border-red-500/50
                     transition-all duration-200"
        >
          Sign out of DocOps
        </button>
      </div>
    </div>
  )
}
