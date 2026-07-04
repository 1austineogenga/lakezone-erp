import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bars3Icon, BellIcon, CheckIcon, UserCircleIcon, ArrowRightOnRectangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import useAuthStore from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'
import { getNotifications, markRead, markAllRead } from '../../api/notifications'
import logoFull from '../../assets/logo-full.png'

const PAGE_LABELS = {
  '/':                    'Dashboard',
  '/workspace':           'My Workspace',
  '/projects':            'Projects',
  '/procurement':         'Procurement',
  '/requisitions':        'Requisitions',
  '/inventory':           'Inventory',
  '/assets':              'Assets',
  '/crm':                 'CRM',
  '/alerts':              'Alerts',
  '/users':               'Users',
  '/profile':             'My Profile',
  '/reports':             'Site Reporting',
  '/finance':             'Finance',
  '/hr':                  'Human Resources',
  '/fleet':               'Fleet Management',
  '/menu':                'All Modules',
}

function usePageLabel() {
  const { pathname } = useLocation()
  const key = Object.keys(PAGE_LABELS)
    .filter(k => pathname === k || (k !== '/' && pathname.startsWith(k)))
    .sort((a, b) => b.length - a.length)[0]
  return PAGE_LABELS[key] ?? ''
}

const TYPE_COLORS = {
  pr_approved:        'bg-green-100 text-green-700',
  pr_rejected:        'bg-red-100 text-red-700',
  pr_submitted:       'bg-amber-100 text-amber-700',
  po_approved:        'bg-blue-100 text-blue-700',
  low_stock:          'bg-orange-100 text-orange-700',
  tender_due:         'bg-purple-100 text-purple-700',
  ipc_issued:         'bg-teal-100 text-teal-700',
  compliance_expiry:  'bg-red-100 text-red-700',
  compliance_warning: 'bg-amber-100 text-amber-700',
  expense_submitted:  'bg-blue-100 text-blue-700',
  expense_approved:   'bg-green-100 text-green-700',
  expense_rejected:   'bg-red-100 text-red-700',
  general:            'bg-gray-100 text-gray-600',
}

// Beep sound for new critical notifications
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch {}
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)  return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'

export default function TopBar({ onToggleSidebar, sidebarCollapsed }) {
  const { user, logout, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const dropRef = useRef(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  const handleLogout = async () => {
    try { await apiLogout(refreshToken) } catch {}
    logout()
  }

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const prevUnreadRef = useRef(0)

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications().then(r => r.data?.results ?? r.data ?? []),
    refetchInterval: 30_000,
  })

  const unread = notifications.filter(n => !n.is_read).length

  // Play sound when new notifications arrive
  useEffect(() => {
    if (unread > prevUnreadRef.current) playBeep()
    prevUnreadRef.current = unread
  }, [unread])

  const readMut = useMutation({
    mutationFn: (id) => markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const readAllMut = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleNotifClick = (n) => {
    if (!n.is_read) readMut.mutate(n.id)
    if (n.link) {
      navigate(n.link)
      setOpen(false)
    }
  }

  const pageLabel = usePageLabel()

  return (
    <header className="shrink-0 relative bg-[#1a2332]">
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-black/30" />

      <div className="h-16 flex items-center">

        {/* Logo block — desktop: fixed width matching sidebar; mobile: hidden */}
        <div className={`hidden lg:flex items-center shrink-0 px-3 h-full border-r border-white/10 transition-all duration-200 ${sidebarCollapsed ? 'w-16 justify-center' : 'w-60'}`}>
          {!sidebarCollapsed && (
            <div className="bg-white rounded-lg px-3 py-2 flex items-center justify-center w-full">
              <img src={logoFull} alt="LakeZone" className="h-9 w-auto object-contain" />
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-white/70 hover:bg-white/10 lg:hidden ml-2"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>

        {/* Page name — desktop */}
        {pageLabel && (
          <span className="hidden lg:block text-base font-semibold text-white tracking-wide px-5">
            {pageLabel}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        <div className="flex items-center gap-3 pr-4">
          {/* Global refresh */}
          <button
            onClick={() => window.location.reload()}
            title="Refresh"
            className="p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>

          {/* Notification bell */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setOpen(o => !o)}
              className="p-2 rounded-lg text-white/70 hover:bg-white/10 relative"
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
                    <p className="text-sm text-gray-600 text-center py-8">No notifications</p>
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
                      <p className="text-xs text-gray-600 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{timeAgo(n.created_at)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User avatar + dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1 transition-colors"
            >
              {user?.profile_photo ? (
                <img
                  src={user.profile_photo.startsWith('http') ? user.profile_photo : `${API_BASE}${user.profile_photo}`}
                  alt="Avatar"
                  className="h-8 w-8 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-brand-red flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {user?.first_name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-white leading-tight">
                  {user ? `${user.first_name} ${user.last_name}` : 'User'}
                </p>
                <p className="text-xs text-white/60 capitalize leading-tight">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-12 w-44 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                <button
                  onClick={() => { navigate('/profile'); setUserMenuOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <UserCircleIcon className="h-4 w-4 text-gray-400" /> My Profile
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  )
}
