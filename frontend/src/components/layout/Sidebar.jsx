import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  BellAlertIcon, MapIcon, ChartPieIcon, DocumentChartBarIcon,
} from '@heroicons/react/24/outline'
import logoFull from '../../assets/logo-full.png'
import useAuthStore from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'
import usePermissions from '../../hooks/usePermissions'

const TOP_LINKS = [
  { to: '/',             icon: HomeIcon,                  label: 'Dashboard',    end: true,  module: 'dashboard' },
  { to: '/workspace',    icon: BriefcaseIcon,             label: 'My Workspace', end: true,  module: null },
  { to: '/projects',     icon: FolderIcon,                label: 'Projects',                 module: 'projects' },
  { to: '/procurement',  icon: ClipboardDocumentListIcon, label: 'Procurement',              module: 'procurement' },
  { to: '/requisitions', icon: DocumentTextIcon,          label: 'Requisitions',             module: 'requisitions' },
  { to: '/reports',      icon: DocumentChartBarIcon,      label: 'Site Reporting',           module: 'reports' },
  { to: '/inventory',    icon: CubeIcon,                  label: 'Inventory',                module: 'inventory' },
  { to: '/assets',       icon: BuildingOfficeIcon,        label: 'Assets',                   module: 'assets' },
  { to: '/crm',          icon: UserGroupIcon,             label: 'CRM',                      module: 'crm' },
  { to: '/alerts',       icon: BellAlertIcon,             label: 'Alerts',                   module: null, roles: new Set(['system_admin', 'managing_director', 'admin_officer', 'site_manager', 'head_of_security']) },
  { to: '/users',        icon: KeyIcon,                   label: 'Users',                    module: 'users' },
]

// Roles that may access QuickBooks
const QB_ROLES = new Set(['system_admin', 'finance_officer', 'finance_manager'])

// Primary module per role — shown first in the Management section
const MODULE_PRIMARY = {
  finance_officer: 'finance', finance_manager: 'finance',
  hr_manager: 'hr',
  fleet_manager: 'fleet',
}

const MODULES = [
  {
    key: 'finance', label: 'Finance', icon: BanknotesIcon, root: '/finance',
    sections: (role) => [
      { heading: null, links: [{ to: '/finance', label: 'Dashboard', icon: ChartBarIcon, end: true }] },
      {
        heading: 'Transactions',
        links: [
          { to: '/finance/invoices',          label: 'Invoices (AR)',      icon: DocumentTextIcon },
          { to: '/finance/bills',             label: 'Bills (AP)',         icon: CreditCardIcon },
          { to: '/finance/expenses',          label: 'Expenses',           icon: ReceiptPercentIcon },
          { to: '/finance/certificates',      label: 'IPC / Certs',        icon: DocumentCheckIcon },
          { to: '/finance/payments',          label: 'Payments',           icon: BanknotesIcon },
          { to: '/finance/bank-transactions', label: 'Bank Transactions',  icon: ArrowsRightLeftIcon },
          { to: '/finance/credit-notes',      label: 'Credit Notes',       icon: DocumentCheckIcon },
        ],
      },
      {
        heading: 'Reporting',
        links: [
          { to: '/finance/balance-sheet',    label: 'Balance Sheet',    icon: TableCellsIcon },
          { to: '/finance/income-statement', label: 'Income Statement', icon: PresentationChartLineIcon },
          { to: '/finance/cash-flow',        label: 'Cash Flow',        icon: ArrowTrendingUpIcon },
          { to: '/finance/profitability',    label: 'Profitability',    icon: BanknotesIcon },
          { to: '/finance/budget',           label: 'Budget vs Actual', icon: CalculatorIcon },
          { to: '/finance/aged',             label: 'Aged Report',      icon: ClockIcon },
        ],
      },
      {
        heading: 'Compliance',
        links: [
          { to: '/finance/tax',       label: 'Tax & VAT', icon: ScaleIcon },
          { to: '/finance/retention', label: 'Retention', icon: LockClosedIcon },
          { to: '/finance/bonds',     label: 'Bonds',     icon: ShieldCheckIcon },
        ],
      },
      {
        heading: 'Accounting',
        links: [
          { to: '/finance/timesheets', label: 'Payroll / Time', icon: ClipboardDocumentListIcon },
          { to: '/finance/gl',         label: 'GL Journal',     icon: BookOpenIcon },
          ...(QB_ROLES.has(role) ? [{ to: '/finance/quickbooks', label: 'QuickBooks', icon: ArrowsRightLeftIcon }] : []),
        ],
      },
    ],
  },
  {
    key: 'hr', label: 'HR', icon: UsersIcon, root: '/hr',
    sections: (role) => [
      { heading: null, links: [{ to: '/hr', label: 'Dashboard', icon: ChartBarIcon, end: true }] },
      {
        heading: 'Workforce',
        links: [
          { to: '/hr/employees',    label: 'Employees',    icon: UsersIcon },
          { to: '/hr/transfers',    label: 'Transfers',    icon: ArrowsRightLeftIcon },
          { to: '/hr/disciplinary', label: 'Disciplinary', icon: ShieldExclamationIcon },
        ],
      },
      {
        heading: 'Time & Leave',
        links: [
          { to: '/hr/attendance',       label: 'Attendance',       icon: ClockIcon },
          ...(role === 'system_admin' ? [{ to: '/hr/biometric', label: 'Biometric', icon: ClipboardDocumentListIcon }] : []),
          { to: '/hr/leave',            label: 'Leave',            icon: CalendarDaysIcon },
          { to: '/hr/casuals-registry', label: 'Casuals Registry', icon: ClipboardDocumentListIcon },
        ],
      },
      {
        heading: 'Payroll',
        links: [
          { to: '/hr/payroll',  label: 'Payroll Periods', icon: BanknotesIcon },
          { to: '/hr/advances', label: 'Salary Advances', icon: CurrencyDollarIcon },
        ],
      },
    ],
  },
  {
    key: 'fleet', label: 'Fleet', icon: TruckIcon, root: '/fleet',
    sections: [
      { heading: null, links: [{ to: '/fleet', label: 'Dashboard', icon: ChartBarIcon, end: true }] },
      {
        heading: 'Vehicles',
        links: [
          { to: '/fleet/vehicles',    label: 'Vehicles',    icon: TruckIcon },
          { to: '/fleet/maintenance', label: 'Maintenance', icon: WrenchScrewdriverIcon },
        ],
      },
      {
        heading: 'Monitoring',
        links: [
          { to: '/fleet/alerts', label: 'Alerts',      icon: ExclamationTriangleIcon },
          { to: '/fleet/fuel',   label: 'Fuel Report', icon: BeakerIcon },
          { to: '/fleet/enhanced-fuel', label: 'Advanced Fuel', icon: ChartPieIcon },
          { to: '/fleet/trips',  label: 'Trip Report', icon: ArrowTrendingUpIcon },
        ],
      },
      {
        heading: 'Control',
        links: [
          { to: '/fleet/geofences', label: 'Geofences', icon: MapIcon },
        ],
      },
      {
        heading: 'Config',
        links: [
          { to: '/fleet/fuel-prices', label: 'Fuel Prices', icon: CurrencyDollarIcon },
          { to: '/fleet/settings', label: 'API Settings', icon: Cog6ToothIcon },
        ],
      },
    ],
  },
]

export default function Sidebar() {
  const { logout, refreshToken, user } = useAuthStore()
  const location = useLocation()
  const { can } = usePermissions()
  const isAdmin = user?.role === 'system_admin'
  const role = user?.role || ''

  // Sort modules: user's primary module first, then others
  const primaryKey = MODULE_PRIMARY[role]
  const sortedModules = [...MODULES].sort((a, b) => {
    if (a.key === primaryKey) return -1
    if (b.key === primaryKey) return 1
    return 0
  })

  const initialOpen = {}
  sortedModules.forEach(m => {
    // Auto-open primary module or the one matching current path
    initialOpen[m.key] = m.key === primaryKey || location.pathname.startsWith(m.root)
  })
  const [open, setOpen] = useState(initialOpen)

  const toggle = key => setOpen(o => ({ ...o, [key]: !o[key] }))

  // Resolve sections — may be a plain array or a function(role)
  const getSections = (mod) => typeof mod.sections === 'function' ? mod.sections(role) : mod.sections

  const handleLogout = async () => {
    try { await apiLogout(refreshToken) } catch {}
    logout()
  }

  return (
    <aside className="flex flex-col w-60 bg-[#1a2332] text-white h-full shrink-0">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/10 shrink-0">
        <div className="bg-white rounded-lg px-3 py-2 flex items-center justify-center">
          <img src={logoFull} alt="Lake Zone Enterprises" className="h-9 w-auto object-contain" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">

        {/* Operations */}
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Operations
        </p>

        {TOP_LINKS.filter(({ module, roles }) => (module === null || can(module)) && (!roles || roles.has(role))).map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={!!end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-brand-red text-white'
                 : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* Management modules */}
        {sortedModules.filter(mod => can(mod.key)).length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Management
              </p>
            </div>

            {sortedModules.filter(mod => can(mod.key)).map(mod => {
              const isActive = location.pathname.startsWith(mod.root)
              const isOpen   = open[mod.key]
              const Icon     = mod.icon
              const sections = getSections(mod)

              return (
                <div key={mod.key}>
                  <button onClick={() => toggle(mod.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${isActive ? 'bg-brand-red text-white' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{mod.label}</span>
                    <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="mt-0.5 mb-1 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                      {sections.filter(section =>
                        section.heading !== 'Config' || isAdmin
                      ).map((section, si) => (
                        <div key={si}>
                          {section.heading && (
                            <p className="px-2 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                              {section.heading}
                            </p>
                          )}
                          {section.links.map(({ to, label: lbl, icon: LIcon, end }) => (
                            <NavLink key={to} to={to} end={!!end}
                              className={({ isActive }) =>
                                `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors
                                 ${isActive ? 'bg-brand-red text-white font-medium' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
                              <LIcon className="h-3.5 w-3.5 shrink-0" />
                              {lbl}
                            </NavLink>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-white/10 shrink-0">
        <button onClick={handleLogout}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/8 hover:text-white transition-colors">
          <ArrowRightOnRectangleIcon className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
