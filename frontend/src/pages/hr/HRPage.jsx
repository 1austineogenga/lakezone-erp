import { useLocation, useNavigate, Routes, Route } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import {
  ChartBarIcon, UsersIcon, CalendarDaysIcon, BanknotesIcon,
} from '@heroicons/react/24/outline'

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
import OrganisationPage from './OrganisationPage'

const GROUPS = (role) => [
  {
    id: 'overview',
    label: 'Overview',
    icon: ChartBarIcon,
    paths: ['/hr'],
    defaultPath: '/hr',
    exact: true,
  },
  {
    id: 'workforce',
    label: 'Workforce',
    icon: UsersIcon,
    defaultPath: '/hr/employees',
    paths: ['/hr/employees', '/hr/casuals-registry', '/hr/disciplinary', '/hr/transfers', '/hr/organisation'],
    tabs: [
      { label: 'Employees',    path: '/hr/employees' },
      { label: 'Casuals',      path: '/hr/casuals-registry' },
      { label: 'Disciplinary', path: '/hr/disciplinary' },
      ...(role === 'system_admin' ? [{ label: 'Transfers',    path: '/hr/transfers' }] : []),
      ...(role === 'system_admin' ? [{ label: 'Organisation', path: '/hr/organisation' }] : []),
    ],
  },
  {
    id: 'time-leave',
    label: 'Attendance & Leave',
    icon: CalendarDaysIcon,
    defaultPath: '/hr/attendance',
    paths: ['/hr/attendance', '/hr/biometric', '/hr/leave'],
    tabs: [
      { label: 'Attendance', path: '/hr/attendance' },
      { label: 'Leave',      path: '/hr/leave' },
      ...(role === 'system_admin' ? [{ label: 'Biometric', path: '/hr/biometric' }] : []),
    ],
  },
  {
    id: 'payroll',
    label: 'Payroll',
    icon: BanknotesIcon,
    defaultPath: '/hr/payroll',
    paths: ['/hr/payroll', '/hr/advances'],
    tabs: [
      { label: 'Payroll Periods',  path: '/hr/payroll' },
      { label: 'Salary Advances',  path: '/hr/advances' },
    ],
  },
]

export default function HRPage() {
  const { user } = useAuthStore()
  const location  = useLocation()
  const navigate  = useNavigate()
  const role      = user?.role || ''

  const groups = GROUPS(role)

  const activeGroup = groups.find(g =>
    g.exact
      ? location.pathname === g.defaultPath || location.pathname === '/hr'
      : g.paths.some(p => location.pathname.startsWith(p))
  ) || groups[0]

  const activeTab = activeGroup?.tabs?.find(t => location.pathname.startsWith(t.path)) || activeGroup?.tabs?.[0]

  return (
    <div className="flex flex-col -m-4 lg:-m-6 h-full min-h-screen">

      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 pt-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-lg font-bold text-brand-slate">Human Resources</h1>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">{activeGroup?.label}{activeTab ? ` — ${activeTab.label}` : ''}</span>
        </div>

        {/* Main group tab bar */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {groups.map(({ id, label, icon: Icon, defaultPath, paths, exact }) => {
            const isActive = exact
              ? location.pathname === '/hr' || location.pathname === defaultPath
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
          <Route path="organisation"      element={<OrganisationPage />} />
        </Routes>
      </div>
    </div>
  )
}
