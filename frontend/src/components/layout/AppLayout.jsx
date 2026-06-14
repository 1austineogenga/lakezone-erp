import { useState, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import ErrorBoundary from '../ErrorBoundary'
import logoIcon from '../../assets/logo-icon.png'

export default function AppLayout() {
  const location = useLocation()
  // On desktop: sidebar collapses to icon strip. On mobile: sidebar is off-canvas overlay.
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile sidebar on route change
  useEffect(() => setMobileOpen(false), [location.pathname])

  if (!localStorage.getItem('access_token')) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — off-canvas on mobile, always visible on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-40 lg:static lg:z-auto
        transform transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <Sidebar collapsed={collapsed} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar
          onToggleSidebar={() => {
            // On mobile toggle the overlay; on desktop toggle collapse
            if (window.innerWidth < 1024) setMobileOpen(o => !o)
            else setCollapsed(c => !c)
          }}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Footer */}
        <footer className="shrink-0 border-t border-gray-200">
          <div className="flex items-center h-9">
            <div className="bg-brand-slate-dark h-full flex items-center px-4 gap-2">
              <img src={logoIcon} alt="LZ" className="h-4 w-4 object-contain opacity-90" />
            </div>
            <div className="bg-brand-red h-full w-1" />
            <div className="flex-1 bg-white h-full flex items-center px-4 overflow-hidden">
              <p className="text-xs text-gray-400 truncate">
                © {new Date().getFullYear()} <span className="text-brand-slate font-medium">Lake Zone Enterprises Ltd</span>
                <span className="mx-2 text-gray-200 hidden sm:inline">|</span>
                <span className="text-gray-400 hidden sm:inline">Enterprise Resource Planning System</span>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
