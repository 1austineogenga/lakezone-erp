import { useNavigate } from 'react-router-dom'
import {
  HomeIcon, BriefcaseIcon, DocumentTextIcon, FolderIcon,
  ClipboardDocumentListIcon, CubeIcon, BuildingOfficeIcon,
  UserGroupIcon, BanknotesIcon, UsersIcon, TruckIcon,
  BellAlertIcon, DocumentChartBarIcon, ChartBarIcon,
  WrenchScrewdriverIcon, BeakerIcon, ArrowTrendingUpIcon,
  CalendarDaysIcon, ClockIcon, UserCircleIcon, MapPinIcon,
  ShieldExclamationIcon, CurrencyDollarIcon, ArrowsRightLeftIcon,
  MapIcon, Cog6ToothIcon, ExclamationTriangleIcon, ChartPieIcon,
  ScaleIcon, LockClosedIcon, BookOpenIcon, CalculatorIcon,
  ReceiptPercentIcon, CreditCardIcon, DocumentCheckIcon,
  TableCellsIcon, PresentationChartLineIcon,
} from '@heroicons/react/24/outline'
import useAuthStore from '../store/authStore'
import usePermissions from '../hooks/usePermissions'

// All navigation items grouped by category
const SECTIONS = (role, can) => [
  {
    heading: 'Core',
    color: 'bg-slate-700',
    items: [
      { to: '/',             label: 'Dashboard',    icon: HomeIcon,                  always: true },
      { to: '/workspace',    label: 'My Work',      icon: BriefcaseIcon,             always: true },
      { to: '/requisitions', label: 'Requisitions', icon: DocumentTextIcon,          always: true },
      { to: '/projects',     label: 'Projects',     icon: FolderIcon,                show: can('projects') },
      { to: '/procurement',  label: 'Procurement',  icon: ClipboardDocumentListIcon, show: can('procurement') },
      { to: '/inventory',    label: 'Inventory',    icon: CubeIcon,                  show: can('inventory') },
      { to: '/assets',       label: 'Assets',       icon: BuildingOfficeIcon,        show: can('assets') },
      { to: '/crm',          label: 'CRM',          icon: UserGroupIcon,             show: can('crm') },
      { to: '/reports',      label: 'Site Reports', icon: DocumentChartBarIcon,      show: can('reports') },
      { to: '/alerts',       label: 'Alerts',       icon: BellAlertIcon,             always: true },
      { to: '/users',        label: 'Users',        icon: UsersIcon,                 show: can('users') },
    ].filter(i => i.always || i.show),
  },
  {
    heading: 'Finance',
    color: 'bg-emerald-700',
    show: can('finance'),
    items: [
      { to: '/finance',                  label: 'Dashboard',     icon: ChartBarIcon },
      { to: '/finance/invoices',         label: 'Invoices (AR)', icon: DocumentTextIcon },
      { to: '/finance/bills',            label: 'Bills (AP)',    icon: CreditCardIcon },
      { to: '/finance/expenses',         label: 'Expenses',      icon: ReceiptPercentIcon },
      { to: '/finance/payments',         label: 'Payments',      icon: BanknotesIcon },
      { to: '/finance/bank-transactions',label: 'Bank Txns',     icon: ArrowsRightLeftIcon },
      { to: '/finance/balance-sheet',    label: 'Balance Sheet', icon: TableCellsIcon },
      { to: '/finance/income-statement', label: 'Income Stmt',   icon: PresentationChartLineIcon },
      { to: '/finance/budget',           label: 'Budget',        icon: CalculatorIcon },
      { to: '/finance/tax',              label: 'Tax & VAT',     icon: ScaleIcon },
      { to: '/finance/payroll',          label: 'Payroll',       icon: BanknotesIcon },
      { to: '/finance/gl',               label: 'GL Journal',    icon: BookOpenIcon },
    ],
  },
  {
    heading: 'Fleet',
    color: 'bg-blue-700',
    show: can('fleet'),
    items: [
      { to: '/fleet',              label: 'Dashboard',    icon: ChartBarIcon },
      { to: '/fleet/vehicles',     label: 'Vehicles',     icon: TruckIcon },
      { to: '/fleet/maintenance',  label: 'Maintenance',  icon: WrenchScrewdriverIcon },
      { to: '/fleet/fuel',         label: 'Fuel Report',  icon: BeakerIcon },
      { to: '/fleet/enhanced-fuel',label: 'Adv. Fuel',    icon: ChartPieIcon },
      { to: '/fleet/trips',        label: 'Trip Report',  icon: ArrowTrendingUpIcon },
      { to: '/fleet/alerts',       label: 'Fleet Alerts', icon: ExclamationTriangleIcon },
      { to: '/fleet/geofences',    label: 'Geofences',    icon: MapIcon },
    ],
  },
  {
    heading: 'HR',
    color: 'bg-purple-700',
    show: can('hr'),
    items: [
      { to: '/hr',               label: 'Dashboard',   icon: ChartBarIcon },
      { to: '/hr/employees',     label: 'Employees',   icon: UsersIcon },
      { to: '/hr/attendance',    label: 'Attendance',  icon: ClockIcon },
      { to: '/hr/leave',         label: 'Leave',       icon: CalendarDaysIcon },
      { to: '/hr/payroll',       label: 'Payroll',     icon: BanknotesIcon },
      { to: '/hr/advances',      label: 'Advances',    icon: CurrencyDollarIcon },
      { to: '/hr/disciplinary',  label: 'Disciplinary',icon: ShieldExclamationIcon },
      { to: '/hr/transfers',     label: 'Transfers',   icon: ArrowsRightLeftIcon },
    ],
  },
]

const ICON_BG = {
  'bg-slate-700':   'bg-slate-100 text-slate-700',
  'bg-emerald-700': 'bg-emerald-100 text-emerald-700',
  'bg-blue-700':    'bg-blue-100 text-blue-700',
  'bg-purple-700':  'bg-purple-100 text-purple-700',
}

const HEADING_COLOR = {
  'bg-slate-700':   'text-slate-700 border-slate-200',
  'bg-emerald-700': 'text-emerald-700 border-emerald-200',
  'bg-blue-700':    'text-blue-700 border-blue-200',
  'bg-purple-700':  'text-purple-700 border-purple-200',
}

export default function MobileMenuPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { can } = usePermissions()
  const role = user?.role ?? ''

  const sections = SECTIONS(role, can).filter(s => s.always !== false && (s.show !== false))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">All Modules</h1>
        <p className="text-sm text-gray-500">Navigate to any section</p>
      </div>

      <div className="px-4 py-4 space-y-6 pb-8">
        {sections.map(section => (
          <div key={section.heading}>
            {/* Section heading */}
            <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${HEADING_COLOR[section.color]}`}>
              <span className={`h-2 w-2 rounded-full ${section.color}`} />
              <h2 className={`text-sm font-bold uppercase tracking-wider ${HEADING_COLOR[section.color].split(' ')[0]}`}>
                {section.heading}
              </h2>
            </div>

            {/* 3-column grid */}
            <div className="grid grid-cols-3 gap-3">
              {section.items.map(item => {
                const Icon = item.icon
                const iconClass = ICON_BG[section.color]
                return (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    className="flex flex-col items-center gap-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-95 transition-transform"
                  >
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${iconClass}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
