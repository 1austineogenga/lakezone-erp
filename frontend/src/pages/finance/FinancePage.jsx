import { useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import FinanceDashboard from './FinanceDashboard'
import InvoicesPage from './InvoicesPage'
import BillsPage from './BillsPage'
import NewInvoicePage from './NewInvoicePage'
import NewBillPage from './NewBillPage'
import ExpensesPage from './ExpensesPage'
import NewExpensePage from './NewExpensePage'
import CashFlowPage from './CashFlowPage'
import ProfitabilityPage from './ProfitabilityPage'
import RetentionPage from './RetentionPage'
import AgedDebtorsPage from './AgedDebtorsPage'
import BudgetVsActualPage from './BudgetVsActualPage'
import TaxCompliancePage from './TaxCompliancePage'
import PaymentCertificatesPage from './PaymentCertificatesPage'
import PerformanceBondsPage from './PerformanceBondsPage'
import TimesheetsPage from './TimesheetsPage'
import GLJournalPage from './GLJournalPage'
import {
  BanknotesIcon, DocumentTextIcon, CreditCardIcon,
  ChartBarIcon, ReceiptPercentIcon, ArrowTrendingUpIcon,
  LockClosedIcon, ClockIcon, CalculatorIcon,
  ScaleIcon, ShieldCheckIcon, DocumentCheckIcon,
  ClipboardDocumentListIcon, BookOpenIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline'

const NAV_GROUPS = [
  {
    key: 'transactions',
    label: 'Transactions',
    items: [
      { to: '/finance/invoices',     label: 'Invoices (AR)',  icon: DocumentTextIcon },
      { to: '/finance/bills',        label: 'Bills (AP)',     icon: CreditCardIcon },
      { to: '/finance/expenses',     label: 'Expenses',       icon: ReceiptPercentIcon },
      { to: '/finance/certificates', label: 'IPC / Certs',   icon: DocumentCheckIcon },
    ],
  },
  {
    key: 'reporting',
    label: 'Reporting',
    items: [
      { to: '/finance/cash-flow',     label: 'Cash Flow',        icon: ArrowTrendingUpIcon },
      { to: '/finance/profitability', label: 'Profitability',    icon: BanknotesIcon },
      { to: '/finance/budget',        label: 'Budget vs Actual', icon: CalculatorIcon },
      { to: '/finance/aged',          label: 'Aged Report',      icon: ClockIcon },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance',
    items: [
      { to: '/finance/tax',       label: 'Tax & VAT',  icon: ScaleIcon },
      { to: '/finance/retention', label: 'Retention',  icon: LockClosedIcon },
      { to: '/finance/bonds',     label: 'Bonds',      icon: ShieldCheckIcon },
    ],
  },
  {
    key: 'accounting',
    label: 'Payroll & Accounting',
    items: [
      { to: '/finance/timesheets', label: 'Payroll / Time', icon: ClipboardDocumentListIcon },
      { to: '/finance/gl',         label: 'GL Journal',     icon: BookOpenIcon },
    ],
  },
]

function FinanceNav() {
  const location = useLocation()

  // Determine which group contains the active route (auto-expand it)
  const activeGroup = NAV_GROUPS.find(g =>
    g.items.some(item => location.pathname.startsWith(item.to))
  )?.key

  const [open, setOpen] = useState(() => {
    const initial = {}
    NAV_GROUPS.forEach(g => { initial[g.key] = g.key === activeGroup })
    return initial
  })

  const toggle = (key) => setOpen(o => ({ ...o, [key]: !o[key] }))

  return (
    <nav className="w-52 shrink-0 space-y-1">
      {/* Dashboard — always visible */}
      <NavLink
        to="/finance" end
        className={({ isActive }) =>
          `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
           ${isActive
             ? 'bg-brand-red text-white'
             : 'text-gray-600 hover:bg-gray-100 hover:text-brand-slate'}`
        }
      >
        <ChartBarIcon className="h-4 w-4 shrink-0" />
        Dashboard
      </NavLink>

      {/* Grouped sections */}
      {NAV_GROUPS.map(group => {
        const isOpen = open[group.key]
        const hasActive = group.items.some(item => location.pathname.startsWith(item.to))

        return (
          <div key={group.key}>
            <button
              onClick={() => toggle(group.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors
                ${hasActive
                  ? 'text-brand-red bg-red-50'
                  : 'text-gray-400 hover:text-brand-slate hover:bg-gray-100'}`}
            >
              <span>{group.label}</span>
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="mt-0.5 ml-2 space-y-0.5 border-l-2 border-gray-100 pl-2">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to} to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors
                       ${isActive
                         ? 'bg-brand-red text-white font-medium'
                         : 'text-gray-600 hover:bg-gray-100 hover:text-brand-slate'}`
                    }
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export default function FinancePage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-brand-red bg-opacity-10 rounded-lg">
          <BanknotesIcon className="h-6 w-6 text-brand-red" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-brand-slate">Finance</h1>
          <p className="text-sm text-gray-500">Invoices, bills, retention, cash flow &amp; accounting</p>
        </div>
      </div>

      {/* Layout: left nav + content */}
      <div className="flex gap-6 items-start">
        <FinanceNav />

        <div className="flex-1 min-w-0">
          <Routes>
            <Route index                  element={<FinanceDashboard />} />
            <Route path="invoices"        element={<InvoicesPage />} />
            <Route path="invoices/new"    element={<NewInvoicePage />} />
            <Route path="bills"           element={<BillsPage />} />
            <Route path="bills/new"       element={<NewBillPage />} />
            <Route path="expenses"        element={<ExpensesPage />} />
            <Route path="expenses/new"    element={<NewExpensePage />} />
            <Route path="retention"       element={<RetentionPage />} />
            <Route path="aged"            element={<AgedDebtorsPage />} />
            <Route path="cash-flow"       element={<CashFlowPage />} />
            <Route path="profitability"   element={<ProfitabilityPage />} />
            <Route path="budget"          element={<BudgetVsActualPage />} />
            <Route path="tax"             element={<TaxCompliancePage />} />
            <Route path="certificates"    element={<PaymentCertificatesPage />} />
            <Route path="bonds"           element={<PerformanceBondsPage />} />
            <Route path="timesheets"      element={<TimesheetsPage />} />
            <Route path="gl"              element={<GLJournalPage />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
