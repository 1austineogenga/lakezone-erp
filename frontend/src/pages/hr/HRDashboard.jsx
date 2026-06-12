import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getHRDashboard } from '../../api/hr'
import {
  UsersIcon, ClockIcon, CalendarDaysIcon,
  ExclamationTriangleIcon, CheckCircleIcon, BanknotesIcon,
  UserMinusIcon, UserPlusIcon,
} from '@heroicons/react/24/outline'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

const StatCard = ({ label, value, sub, subColor = 'text-gray-400', icon: Icon, iconBg, to }) => {
  const inner = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`p-2 rounded-lg ${iconBg}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="text-2xl font-bold text-brand-slate">{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

export default function HRDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: getHRDashboard,
    select: r => r.data,
  })

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Workforce summary */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Workforce</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Employees" value={data.total_employees}
            icon={UsersIcon} iconBg="bg-blue-50 text-blue-500" to="/hr/employees" />
          <StatCard label="Permanent Staff" value={data.total_staff}
            icon={UserPlusIcon} iconBg="bg-indigo-50 text-indigo-500"
            sub="Full-time employees" to="/hr/employees?type=staff" />
          <StatCard label="Casuals" value={data.total_casuals}
            icon={UsersIcon} iconBg="bg-purple-50 text-purple-500"
            sub="Daily / contract workers" to="/hr/employees?type=casual" />
          <StatCard label="Expiring Contracts" value={data.expiring_contracts_30_days}
            icon={ExclamationTriangleIcon}
            iconBg={data.expiring_contracts_30_days > 0 ? 'bg-yellow-50 text-yellow-500' : 'bg-gray-50 text-gray-400'}
            sub="Next 30 days"
            subColor={data.expiring_contracts_30_days > 0 ? 'text-yellow-600' : 'text-gray-400'} />
        </div>
      </div>

      {/* Today's attendance */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Today's Attendance</h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Present Today" value={data.present_today}
            icon={CheckCircleIcon} iconBg="bg-green-50 text-green-500" subColor="text-green-600"
            sub={`${data.total_employees > 0 ? Math.round(data.present_today / data.total_employees * 100) : 0}% attendance`}
            to="/hr/attendance" />
          <StatCard label="Absent Today" value={data.absent_today}
            icon={UserMinusIcon} iconBg="bg-red-50 text-red-500"
            subColor="text-red-500" sub={data.absent_today > 0 ? 'Follow up required' : 'All accounted for'} />
          <StatCard label="On Leave Today" value={data.on_leave_today}
            icon={CalendarDaysIcon} iconBg="bg-blue-50 text-blue-500" to="/hr/leave" />
        </div>
      </div>

      {/* Pending actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Leave applications */}
        {data.pending_leave_applications > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
            <CalendarDaysIcon className="h-5 w-5 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800">
              <span className="font-semibold">{data.pending_leave_applications}</span> leave application{data.pending_leave_applications !== 1 ? 's' : ''} awaiting review.
            </p>
            <Link to="/hr/leave" className="ml-auto text-xs text-blue-700 font-medium hover:underline">Review →</Link>
          </div>
        )}
        {/* Salary advances */}
        {data.pending_advances > 0 && (
          <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3">
            <BanknotesIcon className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">{data.pending_advances}</span> salary advance{data.pending_advances !== 1 ? 's' : ''} pending approval.
            </p>
            <Link to="/hr/advances" className="ml-auto text-xs text-yellow-700 font-medium hover:underline">Review →</Link>
          </div>
        )}
      </div>

      {/* Recent employees */}
      {data.recent_employees?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Recently Added Employees</h3>
            <Link to="/hr/employees" className="text-xs text-brand-red hover:underline">View all</Link>
          </div>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-50">
              {data.recent_employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-brand-slate text-xs">{emp.employee_number}</p>
                    <p className="text-xs text-gray-500">{emp.full_name}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${emp.employment_type === 'staff' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                      {emp.employment_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{emp.department_name || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{emp.date_hired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
