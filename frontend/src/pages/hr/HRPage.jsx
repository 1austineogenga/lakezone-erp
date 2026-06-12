import { useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
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
import {
  UsersIcon, ChartBarIcon, ClockIcon, CalendarDaysIcon,
  BanknotesIcon, FingerPrintIcon, ShieldExclamationIcon,
  CurrencyDollarIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline'

const NAV_GROUPS = [
  {
    key: 'workforce',
    label: 'Workforce',
    items: [
      { to: '/hr/employees', label: 'All Employees',    icon: UsersIcon },
      { to: '/hr/disciplinary', label: 'Disciplinary', icon: ShieldExclamationIcon },
    ],
  },
  {
    key: 'attendance',
    label: 'Time & Attendance',
    items: [
      { to: '/hr/attendance',  label: 'Attendance',         icon: ClockIcon },
      { to: '/hr/biometric',   label: 'Biometric Devices',  icon: FingerPrintIcon },
    ],
  },
  {
    key: 'leave',
    label: 'Leave',
    items: [
      { to: '/hr/leave', label: 'Leave Management', icon: CalendarDaysIcon },
    ],
  },
  {
    key: 'payroll',
    label: 'Payroll',
    items: [
      { to: '/hr/payroll',   label: 'Payroll Periods', icon: BanknotesIcon },
      { to: '/hr/advances',  label: 'Salary Advances', icon: CurrencyDollarIcon },
    ],
  },
]

function HRNav() {
  const location = useLocation()
  const activeGroup = NAV_GROUPS.find(g =>
    g.items.some(item => location.pathname.startsWith(item.to))
  )?.key
  const [open, setOpen] = useState(() => {
    const init = {}
    NAV_GROUPS.forEach(g => { init[g.key] = g.key === activeGroup })
    return init
  })
  const toggle = (key) => setOpen(o => ({ ...o, [key]: !o[key] }))

  return (
    <nav className="w-52 shrink-0 space-y-1">
      <NavLink to="/hr" end
        className={({ isActive }) =>
          `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
           ${isActive ? 'bg-brand-red text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-brand-slate'}`}>
        <ChartBarIcon className="h-4 w-4 shrink-0" />
        Dashboard
      </NavLink>
      {NAV_GROUPS.map(group => {
        const isOpen = open[group.key]
        const hasActive = group.items.some(item => location.pathname.startsWith(item.to))
        return (
          <div key={group.key}>
            <button onClick={() => toggle(group.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors
                ${hasActive ? 'text-brand-red bg-red-50' : 'text-gray-400 hover:text-brand-slate hover:bg-gray-100'}`}>
              <span>{group.label}</span>
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="mt-0.5 ml-2 space-y-0.5 border-l-2 border-gray-100 pl-2">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors
                       ${isActive ? 'bg-brand-red text-white font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-brand-slate'}`}>
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

export default function HRPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-brand-red bg-opacity-10 rounded-lg">
          <UsersIcon className="h-6 w-6 text-brand-red" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-brand-slate">Human Resources</h1>
          <p className="text-sm text-gray-500">Employees, attendance, leave, payroll &amp; biometric integration</p>
        </div>
      </div>
      <div className="flex gap-6 items-start">
        <HRNav />
        <div className="flex-1 min-w-0">
          <Routes>
            <Route index              element={<HRDashboard />} />
            <Route path="employees"   element={<EmployeesPage />} />
            <Route path="employees/new" element={<NewEmployeePage />} />
            <Route path="employees/:id" element={<EmployeeDetailPage />} />
            <Route path="attendance"  element={<AttendancePage />} />
            <Route path="biometric"   element={<BiometricDevicesPage />} />
            <Route path="leave"       element={<LeavePage />} />
            <Route path="payroll"     element={<PayrollPage />} />
            <Route path="payroll/:id" element={<PayrollPeriodPage />} />
            <Route path="advances"    element={<AdvancesPage />} />
            <Route path="disciplinary" element={<DisciplinaryPage />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
