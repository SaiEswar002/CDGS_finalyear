import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'

interface NotificationItem {
  id: string
  type: 'push_received' | 'pipeline_queued' | 'pipeline_success' | 'pipeline_failed' | 'docs_generated'
  title: string
  body: string
  commit_sha: string | null
  branch: string | null
  is_read: boolean
  created_at: string
}

const TYPE_ICON: Record<NotificationItem['type'], string> = {
  push_received: '📥',
  pipeline_queued: '⚙️',
  pipeline_success: '✅',
  pipeline_failed: '❌',
  docs_generated: '🧠',
}

const TYPE_COLOR: Record<NotificationItem['type'], string> = {
  push_received: 'text-blue-400',
  pipeline_queued: 'text-amber-400',
  pipeline_success: 'text-emerald-400',
  pipeline_failed: 'text-red-400',
  docs_generated: 'text-violet-400',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
  const { isAuthenticated } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback((silent = false) => {
    if (!isAuthenticated) return
    if (!silent) setLoading(true)
    api
      .get<{ success: boolean; data: { notifications: NotificationItem[]; unreadCount: number } }>(
        '/notifications?limit=20',
      )
      .then((res) => {
        setNotifications(res.data.data.notifications ?? [])
        setUnreadCount(res.data.data.unreadCount ?? 0)
      })
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false) })
  }, [isAuthenticated])

  // Initial load + poll every 15 seconds for new notifications
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(() => fetchNotifications(true), 15000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleMarkAllRead() {
    try {
      await api.post('/notifications/read', {})
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {}
  }

  async function handleMarkRead(id: string) {
    try {
      await api.post('/notifications/read', { id })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {}
  }

  if (!isAuthenticated) return null

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        id="notification-bell"
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        onClick={() => {
          setOpen((o) => !o)
          if (!open) fetchNotifications()
        }}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl
                   border border-white/10 bg-white/5 text-slate-400
                   hover:bg-white/10 hover:text-slate-200 hover:border-white/20
                   transition-all duration-200 focus:outline-none"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center
                           w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold
                           ring-2 ring-surface animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {open && (
        <div
          className="absolute right-0 top-11 w-80 max-h-[480px] overflow-y-auto
                     glass-card border border-white/10 shadow-2xl shadow-black/40 z-50
                     animate-slide-up rounded-2xl"
          role="dialog"
          aria-label="Notifications panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/8">
            <h3 className="text-sm font-bold text-slate-200">
              Notifications {unreadCount > 0 && (
                <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300">
                  {unreadCount} new
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-brand-400 hover:text-brand-300 transition-colors font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => fetchNotifications()}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                title="Refresh"
              >
                ↻
              </button>
            </div>
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-2xl mb-2">🔔</p>
              <p className="text-xs text-slate-500">No notifications yet.</p>
              <p className="text-[10px] text-slate-600 mt-1">Push code to trigger your first pipeline run.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-3 transition-colors cursor-pointer group
                    ${n.is_read ? 'opacity-60 hover:opacity-80' : 'bg-brand-500/3 hover:bg-white/5'}`}
                  onClick={() => { if (!n.is_read) void handleMarkRead(n.id) }}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[n.type]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={`text-[11px] font-semibold truncate ${TYPE_COLOR[n.type]}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0 mt-0.5" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{n.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {n.commit_sha && (
                          <span className="font-mono text-[10px] text-slate-600">
                            {n.commit_sha.slice(0, 7)}
                          </span>
                        )}
                        {n.branch && (
                          <span className="text-[10px] text-slate-600 font-mono">
                            {n.branch}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-600 ml-auto">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
