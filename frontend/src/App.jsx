import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ProjectsPage from './pages/projects/ProjectsPage'
import ProjectDetailPage from './pages/projects/ProjectDetailPage'
import ProcurementPage from './pages/procurement/ProcurementPage'
import NewPRPage from './pages/procurement/NewPRPage'
import InventoryPage from './pages/inventory/InventoryPage'
import CRMPage from './pages/crm/CRMPage'
import RequisitionsPage from './pages/requisitions/RequisitionsPage'
import NewRequisitionPage from './pages/requisitions/NewRequisitionPage'
import RequisitionDetailPage from './pages/requisitions/RequisitionDetailPage'
import FinancePage from './pages/finance/FinancePage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/"                   element={<DashboardPage />} />
            <Route path="/projects"           element={<ProjectsPage />} />
            <Route path="/projects/:id"       element={<ProjectDetailPage />} />
            <Route path="/procurement"        element={<ProcurementPage />} />
            <Route path="/procurement/new-pr" element={<NewPRPage />} />
            <Route path="/inventory"          element={<InventoryPage />} />
            <Route path="/crm"                element={<CRMPage />} />
            <Route path="/requisitions"       element={<RequisitionsPage />} />
            <Route path="/requisitions/new"   element={<NewRequisitionPage />} />
            <Route path="/requisitions/:id"   element={<RequisitionDetailPage />} />
            <Route path="/finance/*"          element={<FinancePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
    </QueryClientProvider>
  )
}
