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

const TYPE_TITLE_COLOR: Record<NotificationItem['type'], string> = {
  push_received: 'text-blue-300 font-semibold',
  pipeline_queued: 'text-amber-300 font-semibold',
  pipeline_success: 'text-emerald-400 font-semibold',
  pipeline_failed: 'text-red-400 font-semibold',
  docs_generated: 'text-violet-300 font-semibold',
}

const TYPE_BORDER_ACCENT: Record<NotificationItem['type'], string> = {
  push_received: 'border-l-blue-500',
  pipeline_queued: 'border-l-amber-500',
  pipeline_success: 'border-l-emerald-500',
  pipeline_failed: 'border-l-red-500',
  docs_generated: 'border-l-violet-500',
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
      .finally(() => {
        if (!silent) setLoading(false)
      })
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
                   border border-slate-700/60 bg-slate-800/80 text-slate-300
                   hover:bg-slate-800 hover:text-white hover:border-slate-600
                   transition-all duration-200 focus:outline-none shadow-sm"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center
                           w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold
                           ring-2 ring-slate-900 animate-pulse shadow-md">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel - Solid Opaque Dark UI */}
      {open && (
        <div
          className="absolute right-0 top-12 w-96 max-h-[520px] flex flex-col
                     bg-slate-900 border border-slate-700/80 shadow-[0_25px_60px_rgba(0,0,0,0.9)] z-50
                     rounded-2xl overflow-hidden animate-slide-up"
          role="dialog"
          aria-label="Notifications panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors font-medium hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => fetchNotifications()}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-800"
                title="Refresh notifications"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Notifications Scrollable List with sleek custom scrollbar */}
          <div className="flex-1 overflow-y-auto max-h-[420px] bg-slate-900 divide-y divide-slate-800/60
                          [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-950
                          [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full
                          hover:[&::-webkit-scrollbar-thumb]:bg-slate-600">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-900/50">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-lg">
                  🔔
                </div>
                <p className="text-xs font-medium text-slate-300">No notifications yet</p>
                <p className="text-[11px] text-slate-500 mt-1">Push code to your repository to trigger automatic pipeline runs.</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => {
                      if (!n.is_read) void handleMarkRead(n.id)
                    }}
                    className={`p-3.5 transition-all cursor-pointer border-l-4 ${TYPE_BORDER_ACCENT[n.type]} ${
                      n.is_read
                        ? 'bg-slate-900/80 hover:bg-slate-800/60 opacity-75'
                        : 'bg-slate-850 hover:bg-slate-800/90'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-base shrink-0 mt-0.5 p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                        {TYPE_ICON[n.type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={`text-xs ${TYPE_TITLE_COLOR[n.type]} truncate`}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-brand-400 shrink-0 ring-2 ring-brand-500/30 animate-pulse" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed break-words font-sans">
                          {n.body}
                        </p>

                        <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-800/40">
                          {n.commit_sha && (
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                              sha: {n.commit_sha.slice(0, 7)}
                            </span>
                          )}
                          {n.branch && (
                            <span className="font-mono text-[10px] text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">
                              {n.branch}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 ml-auto font-medium">
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

          {/* Footer Bar */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <span>{notifications.length} recent notifications</span>
              <span className="font-mono text-slate-500">CDGS Alert System</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
