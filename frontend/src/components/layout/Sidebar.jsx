import { useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  HomeIcon, FolderIcon, ClipboardDocumentListIcon,
  CubeIcon, UserGroupIcon, ArrowRightOnRectangleIcon, BuildingOfficeIcon,
  DocumentTextIcon, BanknotesIcon, UsersIcon,
  ChevronDownIcon, ChartBarIcon, CreditCardIcon,
  ReceiptPercentIcon, ArrowTrendingUpIcon, LockClosedIcon,
  CalculatorIcon, ScaleIcon, ShieldCheckIcon, DocumentCheckIcon,
  BookOpenIcon, ClockIcon, CalendarDaysIcon,
  ShieldExclamationIcon, CurrencyDollarIcon, ArrowsRightLeftIcon,
  TruckIcon, BeakerIcon, ExclamationTriangleIcon, WrenchScrewdriverIcon,
  Cog6ToothIcon, KeyIcon, BriefcaseIcon, TableCellsIcon, PresentationChartLineIcon,
  BellAlertIcon, MapIcon, ChartPieIcon, DocumentChartBarIcon, MapPinIcon,
  ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentCheckIcon, DocumentDuplicateIcon,
  PlusIcon, FingerPrintIcon, ArchiveBoxArrowDownIcon,
  ExclamationCircleIcon, QuestionMarkCircleIcon, ListBulletIcon,
} from '@heroicons/react/24/outline'
import logoFull from '../../assets/logo-full.png'

const PROJECT_NAV = [
  { tab: 'dashboard',      label: 'Dashboard',          icon: ChartBarIcon },
  { tab: 'boq',            label: 'Bill of Quantities', icon: ClipboardDocumentListIcon },
  { tab: 'budget',         label: 'Budget / Workbook',  icon: BanknotesIcon },
  { tab: 'wbs',            label: 'WBS / Activities',   icon: ListBulletIcon },
  { tab: 'chainage',       label: 'Chainage Segments',  icon: MapPinIcon },
  { tab: 'ipcs',           label: 'IPCs',               icon: DocumentCheckIcon },
  { tab: 'evm',            label: 'EVM & Finance',      icon: PresentationChartLineIcon },
  { tab: 'site-diary',     label: 'Site Diary',         icon: BookOpenIcon },
  { tab: 'progress',       label: 'Weekly Progress',    icon: CalendarDaysIcon },
  { tab: 'qa',             label: 'QA / Testing',       icon: BeakerIcon },
  { tab: 'ncr',            label: 'NCR',                icon: ExclamationCircleIcon },
  { tab: 'rfi-list',       label: 'RFIs',               icon: QuestionMarkCircleIcon },
  { tab: 'safety',         label: 'Safety',             icon: ShieldExclamationIcon },
  { tab: 'subcontractors', label: 'Subcontractors',     icon: BuildingOfficeIcon },
  { tab: 'fleet',          label: 'Fleet',              icon: TruckIcon },
  { tab: 'team',           label: 'Team',               icon: UsersIcon },
  { tab: 'risks',          label: 'Risk Register',      icon: ExclamationTriangleIcon },
  { tab: 'photos',         label: 'Photos',             icon: DocumentChartBarIcon },
  { tab: 'reports',        label: 'Reports',            icon: DocumentTextIcon },
]
import useAuthStore from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'
import usePermissions from '../../hooks/usePermissions'

// Unified nav — each item is either a simple link or a dropdown module.
// module: permission key (null = always visible), roles: allowlist Set
const NAV = (role, isAdmin) => [
  { type: 'link', to: '/',           icon: HomeIcon,                   label: 'Dashboard',        end: true,  module: null },
  {
    type: 'dropdown', key: 'workspace', label: 'My Workspace', icon: BriefcaseIcon,
    root: '/workspace', module: null,
    paramLinks: [
      { tab: 'overview',      label: 'Overview',       icon: ChartBarIcon },
      { tab: 'profile',       label: 'My Profile',     icon: UsersIcon },
      { tab: 'attendance',    label: 'Attendance',     icon: FingerPrintIcon },
      { tab: 'leave',         label: 'Leave',          icon: CalendarDaysIcon },
      { tab: 'advance',       label: 'Salary Advance', icon: CurrencyDollarIcon },
      { tab: 'payslips',      label: 'Payslips',       icon: DocumentTextIcon },
      { tab: 'storerequests', label: 'Store Requests', icon: ArchiveBoxArrowDownIcon },
      { tab: 'requisitions',  label: 'Requisitions',   icon: ClipboardDocumentListIcon },
    ],
  },
  { type: 'projects', key: 'projects', label: 'Projects', icon: FolderIcon, root: '/projects', module: 'projects' },

  {
    type: 'dropdown', key: 'procurement', label: 'Procurement', icon: ClipboardDocumentListIcon,
    root: '/procurement', module: 'procurement',
    isActive: (p) => p.startsWith('/procurement') || p.startsWith('/requisitions'),
    links: [
      { to: '/procurement',      label: 'Purchase Orders', icon: ClipboardDocumentListIcon, end: true },
      { to: '/requisitions',     label: 'Requisitions',    icon: DocumentTextIcon },
      { to: '/procurement/rfqs', label: 'RFQ / Bids',      icon: DocumentCheckIcon },
    ],
  },

  {
    type: 'dropdown', key: 'finance', label: 'Finance', icon: BanknotesIcon,
    root: '/finance', module: 'finance',
    links: [
      { to: '/finance',                  label: 'Dashboard',    icon: ChartBarIcon,              end: true },
      { to: '/finance/invoices',         label: 'Transactions', icon: DocumentTextIcon },
      { to: '/finance/certificates',     label: 'Contracts',    icon: DocumentCheckIcon },
      { to: '/finance/income-statement', label: 'Reports',      icon: PresentationChartLineIcon },
      { to: '/finance/gl',               label: 'Accounting',   icon: BookOpenIcon },
    ],
  },

  {
    type: 'dropdown', key: 'hr', label: 'HR', icon: UsersIcon,
    root: '/hr', module: 'hr',
    links: [
      { to: '/hr',                       label: 'Dashboard',         icon: ChartBarIcon,          end: true },
      { to: '/hr/employees',             label: 'Employees',         icon: UsersIcon },
      { to: '/hr/attendance',            label: 'Attendance',        icon: ClockIcon },
      { to: '/hr/leave',                 label: 'Leave',             icon: CalendarDaysIcon },
      { to: '/hr/payroll',               label: 'Payroll',           icon: BanknotesIcon },
      { to: '/hr/disciplinary',          label: 'Disciplinary',      icon: ShieldExclamationIcon },
      { to: '/hr/organisation',          label: 'Organisation',      icon: BuildingOfficeIcon },
    ],
  },

  {
    type: 'dropdown', key: 'fleet', label: 'Fleet', icon: TruckIcon,
    root: '/fleet', module: 'fleet',
    links: [
      { to: '/fleet',           label: 'Dashboard',  icon: ChartBarIcon,   end: true },
      { to: '/fleet/vehicles',  label: 'Vehicles',   icon: TruckIcon },
      { to: '/fleet/fuel',      label: 'Monitoring', icon: ArrowTrendingUpIcon },
      { to: '/fleet/geofences', label: 'Control',    icon: MapIcon },
    ],
  },

  { type: 'link', to: '/inventory',  icon: CubeIcon,                   label: 'Inventory',        module: 'inventory' },
  { type: 'link', to: '/assets',     icon: BuildingOfficeIcon,         label: 'Assets',           module: 'assets' },
  { type: 'link', to: '/crm',        icon: UserGroupIcon,              label: 'CRM',              module: 'crm' },
  { type: 'link', to: '/hse',        icon: ShieldExclamationIcon,      label: 'HSE',              module: null },
  { type: 'link', to: '/quality',    icon: ClipboardDocumentCheckIcon, label: 'Quality Control',  module: null },
  { type: 'link', to: '/documents',  icon: DocumentDuplicateIcon,      label: 'Documents',        module: null },
  { type: 'link', to: '/alerts',     icon: BellAlertIcon,              label: 'Alerts',           module: null,
    roles: new Set(['system_admin', 'managing_director', 'admin_officer', 'head_of_security']) },
  { type: 'link', to: '/users',      icon: KeyIcon,                    label: 'Users',            module: 'users' },
]

export default function Sidebar({ collapsed = false, onToggleCollapse }) {
  const { logout, refreshToken, user } = useAuthStore()
  const location = useLocation()
  const { can } = usePermissions()
  const isAdmin = user?.role === 'system_admin'
  const role = user?.role || ''

  const nav = NAV(role, isAdmin)

  const initialOpen = {}
  nav.filter(i => i.type === 'dropdown' || i.type === 'projects').forEach(i => {
    initialOpen[i.key] = i.isActive ? i.isActive(location.pathname) : location.pathname.startsWith(i.root ?? '')
  })
  const [open, setOpen] = useState(initialOpen)
  const toggle = key => setOpen(o => ({ ...o, [key]: !o[key] }))

  const handleLogout = async () => {
    try { await apiLogout(refreshToken) } catch {}
    logout()
  }

  const linkCls = (isActive) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
     ${collapsed ? 'justify-center' : ''}
     ${isActive ? 'bg-brand-red text-white' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`

  return (
    <aside className={`flex flex-col bg-[#1a2332] text-white h-full shrink-0 transition-all duration-200 relative ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className="absolute top-0 right-0 bottom-0 w-[3px] bg-brand-red" />

      {/* Logo + collapse toggle */}
      <div className="px-3 py-4 border-b border-white/10 shrink-0 flex items-center justify-between gap-2">
        {!collapsed && (
          <div className="bg-white rounded-lg px-3 py-2 flex items-center justify-center flex-1">
            <img src={logoFull} alt="Lake Zone Enterprises" className="h-9 w-auto object-contain" />
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {nav.map((item, idx) => {
          // permission check
          if (item.module !== null && item.module !== undefined && !can(item.module)) return null
          if (item.roles && !item.roles.has(role)) return null

          if (item.type === 'link') {
            return (
              <NavLink key={item.to} to={item.to} end={!!item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) => linkCls(isActive)}>
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )
          }

          // projects dropdown — list link + per-project nav when inside a project
          if (item.type === 'projects') {
            const onProjects = location.pathname.startsWith('/projects')
            const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/)
            const projectId = projectMatch?.[1]
            const currentTab = new URLSearchParams(location.search).get('tab') || 'dashboard'
            const isOpen = open[item.key]
            return (
              <div key={item.key}>
                <button onClick={() => !collapsed && toggle(item.key)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${collapsed ? 'justify-center' : ''}
                    ${onProjects ? 'text-white' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>
                {!collapsed && isOpen && (
                  <div className="mt-0.5 mb-1 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                    <NavLink to="/projects" end
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors
                         ${isActive ? 'bg-brand-red text-white font-medium' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
                      <FolderIcon className="h-3.5 w-3.5 shrink-0" />
                      All Projects
                    </NavLink>
                    {projectId && PROJECT_NAV.map(({ tab, label, icon: LIcon }) => {
                      const active = currentTab === tab
                      return (
                        <Link key={tab} to={`/projects/${projectId}?tab=${tab}`}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors
                            ${active ? 'bg-brand-red text-white font-medium' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
                          <LIcon className="h-3.5 w-3.5 shrink-0" />
                          {label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          // dropdown
          const isActive = item.isActive ? item.isActive(location.pathname) : location.pathname.startsWith(item.root)
          const isOpen = open[item.key]

          // workspace-style param-based sub-links
          if (item.paramLinks) {
            const currentTab = new URLSearchParams(location.search).get('tab') || 'overview'
            return (
              <div key={item.key}>
                <button onClick={() => !collapsed && toggle(item.key)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive ? 'text-white' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>
                {!collapsed && isOpen && (
                  <div className="mt-0.5 mb-1 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                    {item.paramLinks.map(({ tab, label, icon: LIcon }) => {
                      const active = location.pathname === item.root && currentTab === tab
                      return (
                        <Link key={tab} to={`${item.root}?tab=${tab}`}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors
                            ${active ? 'bg-brand-red text-white font-medium' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
                          <LIcon className="h-3.5 w-3.5 shrink-0" />
                          {label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const visibleLinks = item.links.filter(l => !l.hideRoles || !l.hideRoles.has(role))

          return (
            <div key={item.key}>
              <button onClick={() => !collapsed && toggle(item.key)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${collapsed ? 'justify-center' : ''}
                  ${isActive ? 'bg-brand-red text-white' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              {!collapsed && isOpen && (
                <div className="mt-0.5 mb-1 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                  {visibleLinks.map(({ to, label, icon: LIcon, end }) => (
                    <NavLink key={to} to={to} end={!!end}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors
                         ${isActive ? 'bg-brand-red text-white font-medium' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
                      <LIcon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 border-t border-white/10 shrink-0" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <button onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/8 hover:text-white transition-colors ${collapsed ? 'justify-center' : ''}`}>
          <ArrowRightOnRectangleIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
