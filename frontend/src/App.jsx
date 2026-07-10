import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import AppLayout from './components/layout/AppLayout'
import PrivateRoute from './components/PrivateRoute'
import LoginPage from './pages/auth/LoginPage'
import ChangePasswordPage from './pages/auth/ChangePasswordPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ProjectsPage from './pages/projects/ProjectsPage'
import ProjectPage from './pages/projects/ProjectPage'
import ProcurementPage from './pages/procurement/ProcurementPage'
import NewPRPage from './pages/procurement/NewPRPage'
import PRDetailPage from './pages/procurement/PRDetailPage'
import PODetailPage from './pages/procurement/PODetailPage'
import NewPOPage from './pages/procurement/NewPOPage'
import InventoryPage from './pages/inventory/InventoryPage'
import StockItemDetailPage from './pages/inventory/StockItemDetailPage'
import AssetsPage from './pages/inventory/AssetsPage'
import AssetDetailPage from './pages/inventory/AssetDetailPage'
import InspectionAcceptanceFormPage from './pages/inventory/InspectionAcceptanceFormPage'
import CounterIssueVoucherPage from './pages/inventory/CounterIssueVoucherPage'
import CRMPage from './pages/crm/CRMPage'
import RequisitionsPage from './pages/requisitions/RequisitionsPage'
import NewRequisitionPage from './pages/requisitions/NewRequisitionPage'
import RequisitionDetailPage from './pages/requisitions/RequisitionDetailPage'
import FinancePage from './pages/finance/FinancePage'
import HRPage from './pages/hr/HRPage'
import FleetPage from './pages/fleet/FleetPage'
import UsersPage from './pages/users/UsersPage'
import ProfilePage from './pages/profile/ProfilePage'
import WorkspacePage from './pages/workspace/WorkspacePage'
import AlertsPage from './pages/AlertsPage'
import RFQPage from './pages/procurement/RFQPage'
import SiteReportingPage from './pages/reports/SiteReportingPage'
import MobileMenuPage from './pages/MobileMenuPage'
import DeploymentPage from './pages/deployment/DeploymentPage'
import OfflineBanner from './components/pwa/OfflineBanner'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<AppLayout />}>
            <Route path="/"                   element={<DashboardPage />} />
            <Route path="/projects"              element={<PrivateRoute module="projects"><ProjectsPage /></PrivateRoute>} />
            <Route path="/projects/:projectId/*" element={<PrivateRoute module="projects"><ProjectPage /></PrivateRoute>} />
            <Route path="/procurement"           element={<PrivateRoute module="procurement"><ProcurementPage /></PrivateRoute>} />
            <Route path="/procurement/new-pr"    element={<PrivateRoute module="procurement"><NewPRPage /></PrivateRoute>} />
            <Route path="/procurement/pr/:id"    element={<PrivateRoute module="procurement"><PRDetailPage /></PrivateRoute>} />
            <Route path="/procurement/new-po"    element={<PrivateRoute module="procurement"><NewPOPage /></PrivateRoute>} />
            <Route path="/procurement/po/:id"    element={<PrivateRoute module="procurement"><PODetailPage /></PrivateRoute>} />
            <Route path="/inventory"             element={<PrivateRoute module="inventory"><InventoryPage /></PrivateRoute>} />
            <Route path="/inventory/:id"         element={<PrivateRoute module="inventory"><StockItemDetailPage /></PrivateRoute>} />
            <Route path="/inventory/inspection"  element={<PrivateRoute module="inventory"><InspectionAcceptanceFormPage /></PrivateRoute>} />
            <Route path="/inventory/counter-issue" element={<PrivateRoute module="inventory"><CounterIssueVoucherPage /></PrivateRoute>} />
            <Route path="/assets"                element={<PrivateRoute module="assets"><AssetsPage /></PrivateRoute>} />
            <Route path="/assets/:id"            element={<PrivateRoute module="assets"><AssetDetailPage /></PrivateRoute>} />
            <Route path="/crm"                   element={<PrivateRoute module="crm"><CRMPage /></PrivateRoute>} />
            <Route path="/requisitions"          element={<RequisitionsPage />} />
            <Route path="/requisitions/new"      element={<NewRequisitionPage />} />
            <Route path="/requisitions/:id"      element={<RequisitionDetailPage />} />
            <Route path="/finance/*"             element={<PrivateRoute module="finance"><FinancePage /></PrivateRoute>} />
            <Route path="/hr/*"                  element={<PrivateRoute module="hr"><HRPage /></PrivateRoute>} />
            <Route path="/fleet/*"               element={<PrivateRoute module="fleet"><FleetPage /></PrivateRoute>} />
            <Route path="/users"                 element={<PrivateRoute module="users"><UsersPage /></PrivateRoute>} />
            <Route path="/profile"            element={<ProfilePage />} />
            <Route path="/workspace"          element={<WorkspacePage />} />
            <Route path="/reports/*"             element={<PrivateRoute module="reports"><SiteReportingPage /></PrivateRoute>} />
            <Route path="/alerts"             element={<AlertsPage />} />

            <Route path="/procurement/rfqs"      element={<PrivateRoute module="procurement"><RFQPage /></PrivateRoute>} />
            <Route path="/menu"              element={<MobileMenuPage />} />
            <Route path="/deployment"        element={<DeploymentPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />

    </QueryClientProvider>
  )
}
