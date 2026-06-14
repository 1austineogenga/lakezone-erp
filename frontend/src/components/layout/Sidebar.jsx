import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  HomeIcon, FolderIcon, ClipboardDocumentListIcon,
  CubeIcon, UserGroupIcon, ArrowRightOnRectangleIcon,
  DocumentTextIcon, BanknotesIcon, UsersIcon,
  ChevronDownIcon, ChartBarIcon, CreditCardIcon,
  ReceiptPercentIcon, ArrowTrendingUpIcon, LockClosedIcon,
  CalculatorIcon, ScaleIcon, ShieldCheckIcon, DocumentCheckIcon,
  BookOpenIcon, ClockIcon, CalendarDaysIcon,
  ShieldExclamationIcon, CurrencyDollarIcon, ArrowsRightLeftIcon,
  TruckIcon, BeakerIcon, ExclamationTriangleIcon, WrenchScrewdriverIcon,
  Cog6ToothIcon, Squares2X2Icon, ClipboardIcon, PlusCircleIcon,
} from '@heroicons/react/24/outline'
import logoFull from '../../assets/logo-full.png'
import logoIcon from '../../assets/logo-icon.png'
import useAuthStore from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'

const TOP_LINKS = [
  { to: '/',             icon: HomeIcon,                  label: 'Dashboard', end: true },
  { to: '/procurement',  icon: ClipboardDocumentListIcon, label: 'Procurement' },
  { to: '/inventory',    icon: CubeIcon,                  label: 'Inventory' },
  { to: '/crm',          icon: UserGroupIcon,             label: 'CRM' },
  { to: '/requisitions', icon: DocumentTextIcon,          label: 'Requisitions' },
]

const MODULES = [
  {
    key:   'projects',
    label: 'Projects',
    icon:  FolderIcon,
    root:  '/projects',
    sections: [
      {
        heading: null,
        links: [
          { to: '/projects', label: 'All Projects', icon: FolderIcon, end: true },
        ],
      },
      {
        heading: 'Modules',
        links: [
          { to: '/projects', label: 'BOQ & Budget',    icon: CalculatorIcon, end: true },
          { to: '/projects', label: 'IPC Tracking',    icon: DocumentCheckIcon, end: true },
          { to: '/projects', label: 'Risk Register',   icon: ExclamationTriangleIcon, end: true },
          { to: '/projects', label: 'Fleet & Team',    icon: TruckIcon, end: true },
        ],
      },
    ],
  },
  {
    key:  'finance',
    label: 'Finance',
    icon:  BanknotesIcon,
    root:  '/finance',
    sections: [
      {
        heading: null,
        links: [{ to: '/finance', label: 'Dashboard', icon: ChartBarIcon, end: true }],
      },
      {
        heading: 'Transactions',
        links: [
          { to: '/finance/invoices',     label: 'Invoices (AR)',  icon: DocumentTextIcon },
          { to: '/finance/bills',        label: 'Bills (AP)',     icon: CreditCardIcon },
          { to: '/finance/expenses',     label: 'Expenses',       icon: ReceiptPercentIcon },
          { to: '/finance/certificates', label: 'IPC / Certs',   icon: DocumentCheckIcon },
        ],
      },
      {
        heading: 'Reporting',
        links: [
          { to: '/finance/cash-flow',     label: 'Cash Flow',        icon: ArrowTrendingUpIcon },
          { to: '/finance/profitability', label: 'Profitability',    icon: BanknotesIcon },
          { to: '/finance/budget',        label: 'Budget vs Actual', icon: CalculatorIcon },
          { to: '/finance/aged',          label: 'Aged Report',      icon: ClockIcon },
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
        ],
      },
    ],
  },
  {
    key:   'hr',
    label: 'HR',
    icon:  UsersIcon,
    root:  '/hr',
    sections: [
      {
        heading: null,
        links: [{ to: '/hr', label: 'Dashboard', icon: ChartBarIcon, end: true }],
      },
      {
        heading: 'Workforce',
        links: [
          { to: '/hr/employees',    label: 'Employees',    icon: UsersIcon },
          { to: '/hr/transfers',    label: 'Transfers',    icon: ArrowsRightLeftIcon },
          { to: '/hr/disciplinary', label: 'Disciplinary', icon: ShieldExclamationIcon },
        ],
      },
      {
        heading: 'Time & Attendance',
        links: [
          { to: '/hr/attendance', label: 'Attendance',        icon: ClockIcon },
          { to: '/hr/biometric',  label: 'Biometric Devices', icon: ClipboardDocumentListIcon },
        ],
      },
      {
        heading: 'Leave',
        links: [
          { to: '/hr/leave', label: 'Leave Management', icon: CalendarDaysIcon },
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
    key:   'fleet',
    label: 'Fleet',
    icon:  TruckIcon,
    root:  '/fleet',
    sections: [
      {
        heading: null,
        links: [{ to: '/fleet', label: 'Dashboard', icon: ChartBarIcon, end: true }],
      },
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
          { to: '/fleet/alerts', label: 'Alerts', icon: ExclamationTriangleIcon },
        ],
      },
      {
        heading: 'Reports',
        links: [
          { to: '/fleet/fuel',  label: 'Fuel Report',  icon: BeakerIcon },
          { to: '/fleet/trips', label: 'Trip Report',  icon: ArrowTrendingUpIcon },
        ],
      },
      {
        heading: 'Config',
        links: [
          { to: '/fleet/settings', label: 'API Settings', icon: Cog6ToothIcon },
        ],
      },
    ],
  },
]

export default function Sidebar({ collapsed }) {
  const { logout, refreshToken } = useAuthStore()
  const location = useLocation()

  const initialOpen = {}
  MODULES.forEach(m => { initialOpen[m.key] = location.pathname.startsWith(m.root) })
  const [open, setOpen] = useState(initialOpen)

  const toggle = key => setOpen(o => ({ ...o, [key]: !o[key] }))

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
            : <img src={logoFull} alt="Lake Zone Enterprises" className="h-10 w-auto object-contain" />}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">

        {/* Top-level flat links */}
        {TOP_LINKS.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={!!end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive ? 'bg-brand-red text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        <div className="my-2 border-t border-slate-600" />

        {/* Module sections */}
        {MODULES.map(mod => {
          const isActive = location.pathname.startsWith(mod.root)
          const isOpen   = open[mod.key]
          const Icon     = mod.icon

          return (
            <div key={mod.key}>
              {/* Module toggle button */}
              <button onClick={() => toggle(mod.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? 'bg-brand-red text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{mod.label}</span>
                    <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              {/* Expanded sub-links */}
              {isOpen && !collapsed && (
                <div className="mt-1 mb-2 pl-2 border-l-2 border-slate-600 ml-4 space-y-0.5">
                  {mod.sections.map((section, si) => (
                    <div key={si}>
                      {section.heading && (
                        <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                          {section.heading}
                        </p>
                      )}
                      {section.links.map(({ to, label: lbl, icon: LIcon, end }) => (
                        <NavLink key={to} to={to} end={!!end}
                          className={({ isActive }) =>
                            `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors
                             ${isActive ? 'bg-brand-red text-white font-medium' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
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
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 shrink-0">
        <button onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
          <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

    </aside>
  )
}
