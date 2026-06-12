import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import logoIcon from '../../assets/logo-icon.png'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  if (!localStorage.getItem('access_token')) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar collapsed={collapsed} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="shrink-0 border-t border-gray-200">
          <div className="flex items-center h-9">
            {/* Slate stripe matching sidebar */}
            <div className="bg-brand-slate-dark h-full flex items-center px-4 gap-2">
              <img src={logoIcon} alt="LZ" className="h-4 w-4 object-contain opacity-90" />
            </div>
            {/* Red accent line */}
            <div className="bg-brand-red h-full w-1" />
            {/* Copyright text */}
            <div className="flex-1 bg-white h-full flex items-center px-4">
              <p className="text-xs text-gray-400">
                © {new Date().getFullYear()} <span className="text-brand-slate font-medium">Lake Zone Enterprises Ltd</span>
                <span className="mx-2 text-gray-200">|</span>
                <span className="text-gray-400">Enterprise Resource Planning System</span>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
