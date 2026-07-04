import { useState, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import ErrorBoundary from '../ErrorBoundary'
import logoIcon from '../../assets/logo-icon.png'
import useAuthStore from '../../store/authStore'

export default function AppLayout() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const user = useAuthStore(s => s.user)

  // Close mobile sidebar on route change
  useEffect(() => setMobileOpen(false), [location.pathname])

  if (!localStorage.getItem('access_token')) return <Navigate to="/login" replace />
  if (user?.must_change_password) return <Navigate to="/change-password" replace />

  return (
    <div
      className="flex h-screen overflow-hidden bg-gray-50"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — off-canvas on mobile, always visible on lg+ */}
      <div className={`
        fixed inset-y-0 left-0 z-40 lg:static lg:z-auto
        transform transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
        style={{ top: 0 }}
      >
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(o => !o)} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar onToggleSidebar={() => setMobileOpen(o => !o)} sidebarCollapsed={sidebarCollapsed} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Footer */}
        <footer className="shrink-0 border-t border-gray-200">
          <div className="flex items-center h-9">
            <div className="bg-[#1a2332] h-full flex items-center px-4">
              <img src={logoIcon} alt="LZ" className="h-4 w-4 object-contain opacity-90" />
            </div>
            <div className="bg-brand-red h-full w-1" />
            <div className="flex-1 bg-white h-full flex items-center px-4 overflow-hidden">
              <p className="text-xs text-gray-600 truncate">
                &copy; {new Date().getFullYear()} <span className="text-brand-slate font-medium">Lake Zone Enterprises Ltd</span>
                <span className="mx-2 text-gray-600 hidden sm:inline">|</span>
                <span className="text-gray-600 hidden sm:inline">Enterprise Resource Planning System</span>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
