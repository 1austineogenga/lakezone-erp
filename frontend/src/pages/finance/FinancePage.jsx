import { Routes, Route } from 'react-router-dom'
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

export default function FinancePage() {
  return (
    <Routes>
      <Route index                element={<FinanceDashboard />} />
      <Route path="invoices"      element={<InvoicesPage />} />
      <Route path="invoices/new"  element={<NewInvoicePage />} />
      <Route path="bills"         element={<BillsPage />} />
      <Route path="bills/new"     element={<NewBillPage />} />
      <Route path="expenses"      element={<ExpensesPage />} />
      <Route path="expenses/new"  element={<NewExpensePage />} />
      <Route path="retention"     element={<RetentionPage />} />
      <Route path="aged"          element={<AgedDebtorsPage />} />
      <Route path="cash-flow"     element={<CashFlowPage />} />
      <Route path="profitability" element={<ProfitabilityPage />} />
      <Route path="budget"        element={<BudgetVsActualPage />} />
      <Route path="tax"           element={<TaxCompliancePage />} />
      <Route path="certificates"  element={<PaymentCertificatesPage />} />
      <Route path="bonds"         element={<PerformanceBondsPage />} />
      <Route path="timesheets"    element={<TimesheetsPage />} />
      <Route path="gl"                element={<GLJournalPage />} />
      <Route path="balance-sheet"     element={<BalanceSheetPage />} />
      <Route path="income-statement"  element={<IncomeStatementPage />} />
      <Route path="quickbooks"        element={<QuickBooksPage />} />
    </Routes>
  )
}
