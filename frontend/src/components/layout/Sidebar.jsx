import { NavLink } from 'react-router-dom'
import {
  HomeIcon, FolderIcon, ClipboardDocumentListIcon,
  CubeIcon, UserGroupIcon, ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import logoFull from '../../assets/logo-full.svg'
import logoIcon from '../../assets/logo-icon.svg'
import useAuthStore from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'

const links = [
  { to: '/',             icon: HomeIcon,                    label: 'Dashboard' },
  { to: '/projects',     icon: FolderIcon,                  label: 'Projects' },
  { to: '/procurement',  icon: ClipboardDocumentListIcon,   label: 'Procurement' },
  { to: '/inventory',    icon: CubeIcon,                    label: 'Inventory' },
  { to: '/crm',          icon: UserGroupIcon,               label: 'CRM' },
]

export default function Sidebar({ collapsed }) {
  const { logout, refreshToken } = useAuthStore()

  const handleLogout = async () => {
    try { await apiLogout(refreshToken) } catch {}
    logout()
  }

  return (
    <aside className={`flex flex-col bg-brand-slate-dark text-white transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-brand-slate px-3">
        {collapsed
          ? <img src={logoIcon} alt="LZ" className="h-9 w-9" />
          : <img src={logoFull} alt="Lake Zone Enterprises" className="h-10" />
        }
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-brand-red text-white'
                 : 'text-brand-gray hover:bg-brand-slate hover:text-white'}`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-gray hover:bg-brand-slate hover:text-white transition-colors"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
