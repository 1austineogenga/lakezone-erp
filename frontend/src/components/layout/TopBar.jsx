import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bars3Icon, BellIcon, CheckIcon } from '@heroicons/react/24/outline'
import useAuthStore from '../../store/authStore'
import { getNotifications, markRead, markAllRead } from '../../api/notifications'

const TYPE_COLORS = {
  pr_approved:  'bg-green-100 text-green-700',
  pr_rejected:  'bg-red-100 text-red-700',
  pr_submitted: 'bg-amber-100 text-amber-700',
  po_approved:  'bg-blue-100 text-blue-700',
  low_stock:    'bg-orange-100 text-orange-700',
  tender_due:   'bg-purple-100 text-purple-700',
  ipc_issued:   'bg-teal-100 text-teal-700',
  general:      'bg-gray-100 text-gray-600',
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)  return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function TopBar({ onToggleSidebar }) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const dropRef = useRef(null)

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications().then(r => r.data?.results ?? r.data ?? []),
    refetchInterval: 30_000,
  })

  const unread = notifications.filter(n => !n.is_read).length

  const readMut = useMutation({
    mutationFn: (id) => markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const readAllMut = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleNotifClick = (n) => {
    if (!n.is_read) readMut.mutate(n.id)
    if (n.link) {
      navigate(n.link)
      setOpen(false)
    }
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 relative"
          >
            <BellIcon className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 bg-brand-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-brand-slate text-sm">
                  Notifications {unread > 0 && <span className="text-xs text-brand-red">({unread} new)</span>}
                </span>
                {unread > 0 && (
                  <button
                    onClick={() => readAllMut.mutate()}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-slate"
                  >
                    <CheckIcon className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
                ) : notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${TYPE_COLORS[n.type] || TYPE_COLORS.general}`}>
                        {n.type?.replace(/_/g, ' ')}
                      </span>
                      {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-red shrink-0" />}
                    </div>
                    <p className="text-xs font-semibold text-brand-slate mt-1 leading-tight">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-brand-red flex items-center justify-center text-white text-sm font-semibold">
            {user?.first_name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="hidden sm:block text-sm">
            <p className="font-medium text-gray-800">
              {user ? `${user.first_name} ${user.last_name}` : 'User'}
            </p>
            <p className="text-xs text-gray-500 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
