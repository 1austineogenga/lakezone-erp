import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  HomeIcon, FolderIcon, ClipboardDocumentListIcon,
  CubeIcon, UserGroupIcon, ArrowRightOnRectangleIcon,
  DocumentTextIcon, BanknotesIcon, UsersIcon,
  ChevronDownIcon, ChartBarIcon, CreditCardIcon,
  ReceiptPercentIcon, ArrowTrendingUpIcon, LockClosedIcon,
  CalculatorIcon, ScaleIcon, ShieldCheckIcon, DocumentCheckIcon,
  ClipboardDocumentListIcon as TimesheetIcon, BookOpenIcon,
  ClockIcon, CalendarDaysIcon, FingerPrintIcon,
  ShieldExclamationIcon, CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import logoFull from '../../assets/logo-full.png'
import logoIcon from '../../assets/logo-icon.png'
import useAuthStore from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'

// ── Top-level flat links ────────────────────────────────────────────────────
const TOP_LINKS = [
  { to: '/',             icon: HomeIcon,                  label: 'Dashboard',    exact: true },
  { to: '/projects',     icon: FolderIcon,                label: 'Projects' },
  { to: '/procurement',  icon: ClipboardDocumentListIcon, label: 'Procurement' },
  { to: '/inventory',    icon: CubeIcon,                  label: 'Inventory' },
  { to: '/crm',          icon: UserGroupIcon,             label: 'CRM' },
  { to: '/requisitions', icon: DocumentTextIcon,          label: 'Requisitions' },
]

// ── Collapsible module groups ───────────────────────────────────────────────
const MODULE_GROUPS = [
  {
    key:   'finance',
    label: 'Finance',
    icon:  BanknotesIcon,
    root:  '/finance',
    groups: [
      {
        label: 'Overview',
        items: [
          { to: '/finance', label: 'Dashboard', icon: ChartBarIcon, exact: true },
        ],
      },
      {
        label: 'Transactions',
        items: [
          { to: '/finance/invoices',     label: 'Invoices (AR)',  icon: DocumentTextIcon },
          { to: '/finance/bills',        label: 'Bills (AP)',     icon: CreditCardIcon },
          { to: '/finance/expenses',     label: 'Expenses',       icon: ReceiptPercentIcon },
          { to: '/finance/certificates', label: 'IPC / Certs',   icon: DocumentCheckIcon },
        ],
      },
      {
        label: 'Reporting',
        items: [
          { to: '/finance/cash-flow',     label: 'Cash Flow',        icon: ArrowTrendingUpIcon },
          { to: '/finance/profitability', label: 'Profitability',    icon: BanknotesIcon },
          { to: '/finance/budget',        label: 'Budget vs Actual', icon: CalculatorIcon },
          { to: '/finance/aged',          label: 'Aged Report',      icon: ClockIcon },
        ],
      },
      {
        label: 'Compliance',
        items: [
          { to: '/finance/tax',       label: 'Tax & VAT', icon: ScaleIcon },
          { to: '/finance/retention', label: 'Retention', icon: LockClosedIcon },
          { to: '/finance/bonds',     label: 'Bonds',     icon: ShieldCheckIcon },
        ],
      },
      {
        label: 'Accounting',
        items: [
          { to: '/finance/timesheets', label: 'Payroll / Time', icon: TimesheetIcon },
          { to: '/finance/gl',         label: 'GL Journal',     icon: BookOpenIcon },
        ],
      },
    ],
  },
  {
    key:   'hr',
    label: 'HR',
    icon:  UsersIcon,
    root:  '/hr',
    groups: [
      {
        label: 'Overview',
        items: [
          { to: '/hr', label: 'Dashboard', icon: ChartBarIcon, exact: true },
        ],
      },
      {
        label: 'Workforce',
        items: [
          { to: '/hr/employees',   label: 'Employees',   icon: UsersIcon },
          { to: '/hr/disciplinary',label: 'Disciplinary',icon: ShieldExclamationIcon },
        ],
      },
      {
        label: 'Time & Attendance',
        items: [
          { to: '/hr/attendance', label: 'Attendance',        icon: ClockIcon },
          { to: '/hr/biometric',  label: 'Biometric Devices', icon: FingerPrintIcon },
        ],
      },
      {
        label: 'Leave',
        items: [
          { to: '/hr/leave', label: 'Leave Management', icon: CalendarDaysIcon },
        ],
      },
      {
        label: 'Payroll',
        items: [
          { to: '/hr/payroll',   label: 'Payroll Periods', icon: BanknotesIcon },
          { to: '/hr/advances',  label: 'Salary Advances', icon: CurrencyDollarIcon },
        ],
      },
    ],
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────
function isGroupActive(group, pathname) {
  return group.groups.some(g =>
    g.items.some(item =>
      item.exact ? pathname === item.to : pathname.startsWith(item.to)
    )
  )
}

// ── Sub-group items (indented list under a section header) ──────────────────
function SubGroup({ group, collapsed }) {
  const location = useLocation()
  const hasActive = group.items.some(item =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)
  )

  if (group.label === 'Overview') {
    return (
      <div className="mt-0.5">
        {group.items.map(({ to, label, icon: Icon, exact }) => (
          <NavLink key={to} to={to} end={!!exact}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors
               ${isActive
                 ? 'bg-white bg-opacity-20 text-white font-medium'
                 : 'text-slate-300 hover:bg-white hover:bg-opacity-10 hover:text-white'}`
            }>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-1">
      {!collapsed && (
        <p className={`px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest
          ${hasActive ? 'text-red-300' : 'text-slate-500'}`}>
          {group.label}
        </p>
      )}
      <div className={collapsed ? '' : 'ml-1 border-l border-slate-600 pl-2 space-y-0.5'}>
        {group.items.map(({ to, label, icon: Icon, exact }) => (
          <NavLink key={to} to={to} end={!!exact}
            className={({ isActive }) =>
              `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors
               ${isActive
                 ? 'bg-brand-red text-white font-medium'
                 : 'text-slate-300 hover:bg-white hover:bg-opacity-10 hover:text-white'}`
            }>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

// ── Module expandable section ────────────────────────────────────────────────
function ModuleSection({ mod, collapsed }) {
  const location  = useLocation()
  const active    = isGroupActive(mod, location.pathname) || location.pathname.startsWith(mod.root)
  const [open, setOpen] = useState(active)
  const Icon = mod.icon

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
          ${active
            ? 'bg-brand-red text-white'
            : 'text-brand-gray hover:bg-brand-slate hover:text-white'}`}>
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{mod.label}</span>
            <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {open && !collapsed && (
        <div className="mt-0.5 mb-1 bg-brand-slate-dark rounded-lg py-1 px-1 border border-slate-600">
          {mod.groups.map(g => (
            <SubGroup key={g.label} group={g} collapsed={collapsed} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar({ collapsed }) {
  const { logout, refreshToken } = useAuthStore()

  const handleLogout = async () => {
    try { await apiLogout(refreshToken) } catch {}
    logout()
  }

  return (
    <aside className={`flex flex-col bg-brand-slate-dark text-white transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className="flex items-center justify-center border-b border-brand-slate px-3 py-3 shrink-0">
        <div className="bg-white rounded-xl flex items-center justify-center px-3 py-2 w-full">
          {collapsed
            ? <img src={logoIcon} alt="LZ" className="h-8 w-8 object-contain" />
            : <img src={logoFull} alt="Lake Zone Enterprises" className="h-10 w-auto object-contain" />
          }
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {/* Flat top-level links */}
        {TOP_LINKS.map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={!!exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-brand-red text-white'
                 : 'text-brand-gray hover:bg-brand-slate hover:text-white'}`
            }>
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* Divider */}
        <div className="my-2 border-t border-slate-600" />

        {/* Module groups */}
        {MODULE_GROUPS.map(mod => (
          <ModuleSection key={mod.key} mod={mod} collapsed={collapsed} />
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 shrink-0">
        <button onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-gray hover:bg-brand-slate hover:text-white transition-colors">
          <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
