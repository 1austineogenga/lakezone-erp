import { useLocation, useNavigate, Routes, Route } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import {
  ChartBarIcon, DocumentTextIcon, DocumentCheckIcon,
  PresentationChartLineIcon, BookOpenIcon,
} from '@heroicons/react/24/outline'

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
import QuickBooksPage from './QuickBooksPage'
import BalanceSheetPage from './BalanceSheetPage'
import IncomeStatementPage from './IncomeStatementPage'
import PaymentsPage from './PaymentsPage'
import BankTransactionsPage from './BankTransactionsPage'
import CreditNotesPage from './CreditNotesPage'

const QB_ROLES = new Set(['system_admin', 'finance_officer', 'finance_manager'])

const GROUPS = (role) => [
  {
    id: 'overview',
    label: 'Overview',
    icon: ChartBarIcon,
    paths: ['/finance'],
    defaultPath: '/finance',
    exact: true,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: DocumentTextIcon,
    defaultPath: '/finance/invoices',
    paths: ['/finance/invoices', '/finance/bills', '/finance/expenses', '/finance/payments', '/finance/bank-transactions', '/finance/credit-notes'],
    tabs: [
      { label: 'Invoices (AR)',     path: '/finance/invoices' },
      { label: 'Bills (AP)',        path: '/finance/bills' },
      { label: 'Expenses',          path: '/finance/expenses' },
      { label: 'Payments',          path: '/finance/payments' },
      { label: 'Bank Transactions', path: '/finance/bank-transactions' },
      { label: 'Credit Notes',      path: '/finance/credit-notes' },
    ],
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: DocumentCheckIcon,
    defaultPath: '/finance/certificates',
    paths: ['/finance/certificates', '/finance/retention', '/finance/bonds'],
    tabs: [
      { label: 'IPC / Certificates', path: '/finance/certificates' },
      { label: 'Retention',          path: '/finance/retention' },
      { label: 'Performance Bonds',  path: '/finance/bonds' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: PresentationChartLineIcon,
    defaultPath: '/finance/income-statement',
    paths: ['/finance/income-statement', '/finance/balance-sheet', '/finance/cash-flow', '/finance/profitability', '/finance/budget', '/finance/aged'],
    tabs: [
      { label: 'Income Statement', path: '/finance/income-statement' },
      { label: 'Balance Sheet',    path: '/finance/balance-sheet' },
      { label: 'Cash Flow',        path: '/finance/cash-flow' },
      { label: 'Profitability',    path: '/finance/profitability' },
      { label: 'Budget vs Actual', path: '/finance/budget' },
      { label: 'Aged Report',      path: '/finance/aged' },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: BookOpenIcon,
    defaultPath: '/finance/gl',
    paths: ['/finance/gl', '/finance/timesheets', '/finance/tax', '/finance/quickbooks'],
    tabs: [
      { label: 'GL Journal',     path: '/finance/gl' },
      { label: 'Payroll / Time', path: '/finance/timesheets' },
      { label: 'Tax & VAT',      path: '/finance/tax' },
      ...(QB_ROLES.has(role) ? [{ label: 'QuickBooks', path: '/finance/quickbooks' }] : []),
    ],
  },
]

export default function FinancePage() {
  const { user } = useAuthStore()
  const location  = useLocation()
  const navigate  = useNavigate()
  const role      = user?.role || ''

  const groups = GROUPS(role)

  // Find active group
  const activeGroup = groups.find(g =>
    g.exact
      ? location.pathname === g.defaultPath || location.pathname === '/finance'
      : g.paths.some(p => location.pathname.startsWith(p))
  ) || groups[0]

  // For sub-pages like /new that are children of a tab path, find the parent tab
  const activeTab = activeGroup?.tabs?.find(t => location.pathname.startsWith(t.path)) || activeGroup?.tabs?.[0]

  return (
    <div className="flex flex-col -m-4 lg:-m-6 h-full min-h-screen">

      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 pt-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-lg font-bold text-brand-slate">Finance</h1>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">{activeGroup?.label}{activeTab ? ` — ${activeTab.label}` : ''}</span>
        </div>

        {/* Main group tab bar */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {groups.map(({ id, label, icon: Icon, defaultPath, paths, exact }) => {
            const isActive = exact
              ? location.pathname === '/finance' || location.pathname === defaultPath
              : paths.some(p => location.pathname.startsWith(p))
            return (
              <button key={id}
                onClick={() => navigate(defaultPath)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px whitespace-nowrap transition-colors
                  ${isActive
                    ? 'border-brand-red text-brand-red bg-red-50/40'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            )
          })}
        </div>

        {/* Sub-tab bar — only when active group has tabs */}
        {activeGroup?.tabs && activeGroup.tabs.length > 0 && (
          <div className="flex gap-1 pt-1 overflow-x-auto scrollbar-none border-t border-gray-100 mt-1">
            {activeGroup.tabs.map(({ label, path }) => {
              const isActive = location.pathname.startsWith(path)
              return (
                <button key={path}
                  onClick={() => navigate(path)}
                  className={`px-3 py-2 text-xs font-medium rounded-t whitespace-nowrap transition-colors -mb-px border-b-2
                    ${isActive
                      ? 'border-brand-red text-brand-red'
                      : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Page Content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route index                    element={<FinanceDashboard />} />
          <Route path="invoices"          element={<InvoicesPage />} />
          <Route path="invoices/new"      element={<NewInvoicePage />} />
          <Route path="bills"             element={<BillsPage />} />
          <Route path="bills/new"         element={<NewBillPage />} />
          <Route path="expenses"          element={<ExpensesPage />} />
          <Route path="expenses/new"      element={<NewExpensePage />} />
          <Route path="payments"          element={<PaymentsPage />} />
          <Route path="bank-transactions" element={<BankTransactionsPage />} />
          <Route path="credit-notes"      element={<CreditNotesPage />} />
          <Route path="certificates"      element={<PaymentCertificatesPage />} />
          <Route path="retention"         element={<RetentionPage />} />
          <Route path="bonds"             element={<PerformanceBondsPage />} />
          <Route path="income-statement"  element={<IncomeStatementPage />} />
          <Route path="balance-sheet"     element={<BalanceSheetPage />} />
          <Route path="cash-flow"         element={<CashFlowPage />} />
          <Route path="profitability"     element={<ProfitabilityPage />} />
          <Route path="budget"            element={<BudgetVsActualPage />} />
          <Route path="aged"              element={<AgedDebtorsPage />} />
          <Route path="gl"                element={<GLJournalPage />} />
          <Route path="timesheets"        element={<TimesheetsPage />} />
          <Route path="tax"               element={<TaxCompliancePage />} />
          <Route path="quickbooks"        element={<QuickBooksPage />} />
        </Routes>
      </div>
    </div>
  )
}
