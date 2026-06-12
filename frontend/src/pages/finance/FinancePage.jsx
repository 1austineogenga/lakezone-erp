import { Routes, Route, NavLink } from 'react-router-dom'
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
import {
  BanknotesIcon, DocumentTextIcon, CreditCardIcon,
  ChartBarIcon, ReceiptPercentIcon, ArrowTrendingUpIcon,
  LockClosedIcon, ClockIcon,
} from '@heroicons/react/24/outline'

const tabs = [
  { to: '/finance',               label: 'Dashboard',      icon: ChartBarIcon,        end: true },
  { to: '/finance/invoices',      label: 'Invoices (AR)',  icon: DocumentTextIcon },
  { to: '/finance/bills',         label: 'Bills (AP)',     icon: CreditCardIcon },
  { to: '/finance/expenses',      label: 'Expenses',       icon: ReceiptPercentIcon },
  { to: '/finance/retention',     label: 'Retention',      icon: LockClosedIcon },
  { to: '/finance/aged',          label: 'Aged Report',    icon: ClockIcon },
  { to: '/finance/cash-flow',     label: 'Cash Flow',      icon: ArrowTrendingUpIcon },
  { to: '/finance/profitability', label: 'Profitability',  icon: BanknotesIcon },
]

export default function FinancePage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-brand-red bg-opacity-10 rounded-lg">
          <BanknotesIcon className="h-6 w-6 text-brand-red" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-brand-slate">Finance</h1>
          <p className="text-sm text-gray-500">Invoices, bills, retention, aged debtors, cash flow & profitability</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
               ${isActive
                 ? 'border-brand-red text-brand-red'
                 : 'border-transparent text-gray-500 hover:text-brand-slate'}`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </div>

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
      </Routes>
    </div>
  )
}
