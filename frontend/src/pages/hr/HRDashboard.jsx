import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getHRDashboard } from '../../api/hr'
import {
  UsersIcon, ClockIcon, CalendarDaysIcon,
  ExclamationTriangleIcon, CheckCircleIcon, BanknotesIcon,
  UserMinusIcon, UserPlusIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'

const AVATAR_COLORS = [
  'from-indigo-500 to-violet-500', 'from-blue-500 to-cyan-500',
  'from-teal-500 to-emerald-500', 'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',   'from-sky-500 to-blue-500',
]
function avatarGradient(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function MetricCard({ label, value, sub, subColor = 'text-gray-400', icon: Icon, accent, to }) {
  const inner = (
    <div className={`relative bg-white rounded-2xl border-l-4 ${accent} shadow-sm p-5 hover:shadow-md transition-all group overflow-hidden`}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-5 bg-current -translate-y-4 translate-x-4 pointer-events-none" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
          <p className="text-3xl font-extrabold text-brand-slate leading-none">{value ?? '—'}</p>
          {sub && <p className={`text-xs mt-1.5 font-medium ${subColor}`}>{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform`}>
          <Icon className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </div>
  )
  return to ? <Link to={to} className="block">{inner}</Link> : inner
}

function SectionHeader({ title, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`p-1.5 rounded-lg ${color}`}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</h2>
    </div>
  )
}

export default function HRDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: getHRDashboard,
    select: r => r.data?.results ?? r.data,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-gray-400 animate-pulse">Loading dashboard…</div>
    </div>
  )
  if (!data) return null

  const attendancePct = data.total_employees > 0
    ? Math.round(data.present_today / data.total_employees * 100)
    : 0

  return (
    <div className="space-y-6">

      {/* Hero banner */}
      <div className="bg-brand-slate rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white opacity-[0.03] -translate-y-20 translate-x-20 pointer-events-none" />
        <div className="absolute bottom-0 left-32 w-40 h-40 rounded-full bg-white opacity-[0.03] translate-y-12 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-0.5">Human Resources</p>
          <h1 className="text-white text-xl font-extrabold">HR Dashboard</h1>
          <p className="text-white/50 text-xs mt-1">Workforce overview and today's snapshot</p>
        </div>
        <div className="relative z-10 flex gap-3 flex-wrap">
          <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center min-w-[70px]">
            <p className="text-white text-xl font-extrabold leading-none">{data.total_employees}</p>
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wide mt-0.5">Total</p>
          </div>
          <div className="bg-indigo-500/30 rounded-xl px-4 py-2.5 text-center min-w-[70px]">
            <p className="text-white text-xl font-extrabold leading-none">{data.total_staff}</p>
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wide mt-0.5">Staff</p>
          </div>
          <div className="bg-purple-500/30 rounded-xl px-4 py-2.5 text-center min-w-[70px]">
            <p className="text-white text-xl font-extrabold leading-none">{data.total_casuals}</p>
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wide mt-0.5">Casuals</p>
          </div>
        </div>
      </div>

      {/* Workforce metrics */}
      <div>
        <SectionHeader title="Workforce" icon={UsersIcon} color="bg-indigo-500" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Employees" value={data.total_employees}
            icon={UsersIcon} accent="border-blue-400"
            sub="All active headcount" subColor="text-blue-500" to="/hr/employees" />
          <MetricCard label="Permanent Staff" value={data.total_staff}
            icon={UserPlusIcon} accent="border-indigo-400"
            sub="Full-time employees" subColor="text-indigo-500" to="/hr/employees?type=staff" />
          <MetricCard label="Casuals" value={data.total_casuals}
            icon={UsersIcon} accent="border-purple-400"
            sub="Daily / contract workers" subColor="text-purple-500" to="/hr/employees?type=casual" />
          <MetricCard label="Expiring Contracts" value={data.expiring_contracts_30_days}
            icon={ExclamationTriangleIcon}
            accent={data.expiring_contracts_30_days > 0 ? 'border-amber-400' : 'border-gray-200'}
            sub="Next 30 days"
            subColor={data.expiring_contracts_30_days > 0 ? 'text-amber-500' : 'text-gray-400'} />
        </div>
      </div>

      {/* Attendance */}
      <div>
        <SectionHeader title="Today's Attendance" icon={ClockIcon} color="bg-green-500" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Present Today" value={data.present_today}
            icon={CheckCircleIcon} accent="border-green-400"
            sub={`${attendancePct}% attendance rate`} subColor="text-green-600" to="/hr/attendance" />
          <MetricCard label="Absent Today" value={data.absent_today}
            icon={UserMinusIcon} accent="border-red-400"
            sub={data.absent_today > 0 ? 'Follow up required' : 'All accounted for'}
            subColor={data.absent_today > 0 ? 'text-red-500' : 'text-green-500'} />
          <MetricCard label="On Leave Today" value={data.on_leave_today}
            icon={CalendarDaysIcon} accent="border-cyan-400"
            sub="Approved leave" subColor="text-cyan-500" to="/hr/leave" />
        </div>
      </div>

      {/* Pending actions */}
      {(data.pending_leave_applications > 0 || data.pending_advances > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.pending_leave_applications > 0 && (
            <div className="flex items-center gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl px-5 py-4">
              <div className="p-2.5 bg-blue-100 rounded-xl shrink-0">
                <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-900">Leave Applications</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  <span className="font-semibold">{data.pending_leave_applications}</span> application{data.pending_leave_applications !== 1 ? 's' : ''} awaiting review
                </p>
              </div>
              <Link to="/hr/leave" className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                Review
              </Link>
            </div>
          )}
          {data.pending_advances > 0 && (
            <div className="flex items-center gap-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl px-5 py-4">
              <div className="p-2.5 bg-amber-100 rounded-xl shrink-0">
                <BanknotesIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-900">Salary Advances</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  <span className="font-semibold">{data.pending_advances}</span> advance{data.pending_advances !== 1 ? 's' : ''} pending approval
                </p>
              </div>
              <Link to="/hr/advances" className="shrink-0 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors">
                Review
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Recently added employees */}
      {data.recent_employees?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-brand-slate">
                <UserPlusIcon className="h-3.5 w-3.5 text-white" />
              </div>
              <h3 className="font-bold text-brand-slate text-sm">Recently Added Employees</h3>
            </div>
            <Link to="/hr/employees" className="text-xs font-semibold text-brand-red hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data.recent_employees.map((emp, idx) => {
              const initials = (emp.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              const grad = avatarGradient(emp.full_name || '')
              const isStaff = emp.employment_type === 'staff'
              return (
                <Link key={emp.id} to={`/hr/employees/${emp.id}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/80 transition-colors group">
                  <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-slate group-hover:text-brand-red transition-colors truncate">{emp.full_name}</p>
                    <p className="text-[11px] text-gray-400 font-mono">{emp.employee_number}</p>
                  </div>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold shrink-0
                    ${isStaff ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                    {isStaff ? 'Staff' : 'Casual'}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 hidden sm:block">
                    {emp.department_name || <span className="text-gray-300">—</span>}
                  </span>
                  <span className="text-[11px] text-gray-400 shrink-0 hidden md:block">{emp.date_hired}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
