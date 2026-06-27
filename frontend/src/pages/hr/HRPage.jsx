import { Routes, Route } from 'react-router-dom'
import HRDashboard from './HRDashboard'
import EmployeesPage from './EmployeesPage'
import EmployeeDetailPage from './EmployeeDetailPage'
import NewEmployeePage from './NewEmployeePage'
import AttendancePage from './AttendancePage'
import BiometricDevicesPage from './BiometricDevicesPage'
import LeavePage from './LeavePage'
import PayrollPage from './PayrollPage'
import PayrollPeriodPage from './PayrollPeriodPage'
import AdvancesPage from './AdvancesPage'
import DisciplinaryPage from './DisciplinaryPage'
import TransfersPage from './TransfersPage'
import CasualsRegistryPage from './CasualsRegistryPage'
import LeaveApplicationPage from './LeaveApplicationPage'

export default function HRPage() {
  return (
    <Routes>
      <Route index                 element={<HRDashboard />} />
      <Route path="employees"      element={<EmployeesPage />} />
      <Route path="employees/new"  element={<NewEmployeePage />} />
      <Route path="employees/:id"  element={<EmployeeDetailPage />} />
      <Route path="attendance"     element={<AttendancePage />} />
      <Route path="biometric"      element={<BiometricDevicesPage />} />
      <Route path="leave"          element={<LeavePage />} />
      <Route path="leave/:id/application" element={<LeaveApplicationPage />} />
      <Route path="payroll"        element={<PayrollPage />} />
      <Route path="payroll/:id"    element={<PayrollPeriodPage />} />
      <Route path="advances"       element={<AdvancesPage />} />
      <Route path="disciplinary"   element={<DisciplinaryPage />} />
      <Route path="transfers"      element={<TransfersPage />} />
      <Route path="casuals-registry" element={<CasualsRegistryPage />} />
    </Routes>
  )
}
