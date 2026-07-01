import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getMDDashboard } from '../../api/auth'
import {
  BanknotesIcon, FolderIcon, TruckIcon, UsersIcon,
  ClipboardDocumentListIcon, CubeIcon,
  ClockIcon, UserGroupIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'

const fmtK = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `KES ${(v / 1_000).toFixed(0)}K`
  return `KES ${v.toLocaleString()}`
}

function SectionTitle({ icon: Icon, label, iconBg, iconColor }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className={`${iconBg} p-1.5 rounded-lg`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</h2>
    </div>
  )
}

function KpiCard({ label, value, sub, subOk, valueColor, bg, border, accent, to }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={to ? () => navigate(to) : undefined}
      className={`relative overflow-hidden ${bg} border ${border} rounded-xl p-4 shadow-sm transition-all ${to ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
    >
      {accent && <div className={`absolute top-0 left-0 w-1 h-full ${accent} rounded-l-xl`} />}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1 pl-1">{label}</p>
      <p className={`text-xl font-bold pl-1 ${valueColor}`}>{value}</p>
      {sub && (
        <p className={`text-xs mt-0.5 pl-1 ${subOk == null ? 'text-gray-400' : subOk ? 'text-green-600' : 'text-red-500'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

function StatusDot({ status }) {
  const colors = {
    active: 'bg-green-500', completed: 'bg-blue-500',
    on_hold: 'bg-amber-500', cancelled: 'bg-red-500', planning: 'bg-purple-500',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-gray-400'}`} />
}

function AlertPill({ count, label, color }) {
  if (!count) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {count} {label}
    </span>
  )
}

export default function MDDashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['md-dashboard'],
    queryFn: getMDDashboard,
    select: r => r.data,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(j => <div key={j} className="h-20 bg-gray-100 rounded-xl" />)}
          </div>
        ))}
      </div>
    )
  }

  if (!data) return null

  const { finance = {}, projects = {}, fleet = {}, hr = {}, procurement = {}, requisitions = {}, inventory = {}, users = {} } = data
  const fleetOnlinePct = fleet.total > 0 ? Math.round((fleet.online / fleet.total) * 100) : 0
  const arCollectionPct = finance.collection_rate || 0

  return (
    <div className="space-y-6">

      {/* ── Finance — full width ── */}
      <div>
        <SectionTitle icon={BanknotesIcon} label="Finance Overview" iconBg="bg-blue-100" iconColor="text-blue-600" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <KpiCard label="Total Invoiced (AR)" value={fmtK(finance.ar_billed)} sub={`${arCollectionPct}% collected`} subOk={arCollectionPct >= 70} valueColor="text-blue-800" bg="bg-blue-50" border="border-blue-100" accent="bg-blue-400" to="/finance/invoices" />
          <KpiCard label="Cash Received" value={fmtK(finance.ar_received)} sub="from clients" valueColor="text-green-800" bg="bg-green-50" border="border-green-100" accent="bg-green-400" to="/finance/payments" />
          <KpiCard label="AR Outstanding" value={fmtK(finance.ar_outstanding)} sub={finance.ar_overdue > 0 ? `${fmtK(finance.ar_overdue)} overdue` : 'No overdue'} subOk={finance.ar_overdue === 0} valueColor="text-amber-800" bg="bg-amber-50" border="border-amber-100" accent="bg-amber-400" to="/finance/aged" />
          <KpiCard label="AP Outstanding" value={fmtK(finance.ap_outstanding)} sub={finance.ap_overdue > 0 ? `${fmtK(finance.ap_overdue)} overdue` : 'All current'} subOk={finance.ap_overdue === 0} valueColor="text-red-800" bg="bg-red-50" border="border-red-100" accent="bg-red-400" to="/finance/bills" />
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">AR Collection Rate</p>
            <span className={`text-xs font-bold ${arCollectionPct >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{arCollectionPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className={`${arCollectionPct >= 70 ? 'bg-green-500' : 'bg-amber-400'} h-2 rounded-full`} style={{ width: `${arCollectionPct}%` }} />
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {finance.pending_expenses_count > 0 && <AlertPill count={finance.pending_expenses_count} label={`expense claims pending (${fmtK(finance.pending_expenses_value)})`} color="bg-amber-100 text-amber-800" />}
            {finance.ar_overdue > 0 && <AlertPill count={1} label={`AR overdue: ${fmtK(finance.ar_overdue)}`} color="bg-red-100 text-red-700" />}
            {finance.ap_overdue > 0 && <AlertPill count={1} label={`AP overdue: ${fmtK(finance.ap_overdue)}`} color="bg-rose-100 text-rose-700" />}
          </div>
        </div>
      </div>

      {/* ── Operations KPI row — uniform 6-card grid ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Operations at a Glance</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Active Projects" value={projects.active || 0} sub={`${projects.on_hold || 0} on hold`} valueColor="text-violet-800" bg="bg-violet-50" border="border-violet-100" accent="bg-violet-400" to="/projects?status=active" />
          <KpiCard label="Pending PRs" value={procurement.pending_prs || 0} sub="awaiting approval" subOk={procurement.pending_prs === 0} valueColor="text-amber-800" bg="bg-amber-50" border="border-amber-100" accent="bg-amber-400" to="/procurement" />
          <KpiCard label="Open POs" value={procurement.open_pos || 0} sub={fmtK(procurement.po_value_open)} valueColor="text-purple-800" bg="bg-purple-50" border="border-purple-100" accent="bg-purple-400" to="/procurement" />
          <KpiCard label="Fleet Online" value={`${fleet.online || 0}/${fleet.total || 0}`} sub={`${fleetOnlinePct}% availability`} subOk={fleetOnlinePct >= 60} valueColor="text-cyan-800" bg="bg-cyan-50" border="border-cyan-100" accent="bg-cyan-400" to="/fleet/vehicles" />
          <KpiCard label="Total Workforce" value={hr.total_employees || 0} sub={`${hr.staff || 0} staff · ${hr.casuals || 0} casuals`} valueColor="text-indigo-800" bg="bg-indigo-50" border="border-indigo-100" accent="bg-indigo-400" to="/hr/employees" />
          <KpiCard label="Stock Items" value={inventory.total_items || 0} sub={inventory.low_stock > 0 ? `${inventory.low_stock} low stock` : 'All stocked'} subOk={inventory.low_stock === 0} valueColor="text-orange-800" bg="bg-orange-50" border="border-orange-100" accent="bg-orange-400" to="/inventory" />
        </div>
      </div>

      {/* ── Detail panels — 3 columns, align to top ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Projects */}
        <div className="space-y-3">
          <SectionTitle icon={FolderIcon} label="Projects" iconBg="bg-violet-100" iconColor="text-violet-600" />
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="Active" value={projects.active || 0} valueColor="text-green-800" bg="bg-green-50" border="border-green-100" accent="bg-green-400" to="/projects?status=active" />
            <KpiCard label="On Hold" value={projects.on_hold || 0} valueColor="text-amber-800" bg="bg-amber-50" border="border-amber-100" accent="bg-amber-400" to="/projects?status=on_hold" />
            <KpiCard label="Completed" value={projects.completed || 0} valueColor="text-violet-800" bg="bg-violet-50" border="border-violet-100" accent="bg-violet-400" to="/projects?status=completed" />
          </div>
          {projects.recent?.length > 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-100 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">Recent Projects</p>
                <span className="cursor-pointer text-xs text-violet-600 hover:underline font-medium" onClick={() => navigate('/projects')}>View all →</span>
              </div>
              {projects.recent.map((p, i) => (
                <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${i < projects.recent.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <StatusDot status={p.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{p.client_name || '—'}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize
                    ${p.status === 'active' ? 'bg-green-100 text-green-700' :
                      p.status === 'completed' ? 'bg-violet-100 text-violet-700' :
                      p.status === 'on_hold' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.status?.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">No recent projects</p>
          )}
        </div>

        {/* Procurement */}
        <div className="space-y-3">
          <SectionTitle icon={ClipboardDocumentListIcon} label="Procurement" iconBg="bg-purple-100" iconColor="text-purple-600" />
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Pending PRs" value={procurement.pending_prs || 0} sub="awaiting approval" subOk={procurement.pending_prs === 0} valueColor="text-amber-800" bg="bg-amber-50" border="border-amber-100" accent="bg-amber-400" to="/procurement" />
            <KpiCard label="Open POs" value={procurement.open_pos || 0} sub={fmtK(procurement.po_value_open)} valueColor="text-purple-800" bg="bg-purple-50" border="border-purple-100" accent="bg-purple-400" to="/procurement" />
            <KpiCard label="Approved PRs" value={procurement.approved_prs || 0} valueColor="text-green-800" bg="bg-green-50" border="border-green-100" accent="bg-green-400" to="/procurement" />
            <KpiCard label="Pending Reqs" value={requisitions.pending || 0} sub="awaiting approval" subOk={requisitions.pending === 0} valueColor="text-amber-800" bg="bg-amber-50" border="border-amber-100" accent="bg-amber-400" to="/requisitions" />
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-3">Requisitions MTD</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-lg py-2.5">
                <p className="text-lg font-bold text-gray-800">{requisitions.total_mtd || 0}</p>
                <p className="text-[10px] text-gray-400">Total</p>
              </div>
              <div className="bg-white rounded-lg py-2.5">
                <p className="text-lg font-bold text-green-600">{requisitions.approved || 0}</p>
                <p className="text-[10px] text-gray-400">Approved</p>
              </div>
              <div className="bg-white rounded-lg py-2.5">
                <p className="text-lg font-bold text-amber-600">{requisitions.pending || 0}</p>
                <p className="text-[10px] text-gray-400">Pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Fleet */}
        <div className="space-y-3">
          <SectionTitle icon={TruckIcon} label="Fleet Status" iconBg="bg-cyan-100" iconColor="text-cyan-600" />
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Online Now" value={`${fleet.online || 0}/${fleet.total || 0}`} sub={`${fleetOnlinePct}% availability`} subOk={fleetOnlinePct >= 60} valueColor="text-cyan-800" bg="bg-cyan-50" border="border-cyan-100" accent="bg-cyan-400" to="/fleet/vehicles" />
            <KpiCard label="Moving" value={fleet.moving || 0} sub="live GPS" valueColor="text-green-800" bg="bg-green-50" border="border-green-100" accent="bg-green-400" to="/fleet/vehicles" />
          </div>
          <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500">Fleet Availability</p>
              <span className={`text-xs font-bold ${fleetOnlinePct >= 60 ? 'text-green-600' : 'text-red-500'}`}>{fleetOnlinePct}%</span>
            </div>
            <div className="w-full bg-white rounded-full h-2 mb-3">
              <div className={`${fleetOnlinePct >= 60 ? 'bg-cyan-500' : 'bg-red-400'} h-2 rounded-full`} style={{ width: `${fleetOnlinePct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-lg py-2">
                <p className="text-sm font-bold text-green-600">{fleet.moving || 0}</p>
                <p className="text-[10px] text-gray-400">Moving</p>
              </div>
              <div className="bg-white rounded-lg py-2">
                <p className="text-sm font-bold text-amber-500">{fleet.idle || 0}</p>
                <p className="text-[10px] text-gray-400">Idle</p>
              </div>
              <div className="bg-white rounded-lg py-2">
                <p className="text-sm font-bold text-gray-500">{fleet.stopped || 0}</p>
                <p className="text-[10px] text-gray-400">Stopped</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {fleet.alerts_unacked > 0 && <span onClick={() => navigate('/fleet/alerts')} className="cursor-pointer"><AlertPill count={fleet.alerts_unacked} label="unacked alerts" color="bg-red-100 text-red-700" /></span>}
              {fleet.low_fuel > 0 && <span onClick={() => navigate('/fleet/fuel')} className="cursor-pointer"><AlertPill count={fleet.low_fuel} label="low fuel" color="bg-amber-100 text-amber-700" /></span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── HR + Inventory + Users — 3 columns, align to top ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* HR */}
        <div className="space-y-3">
          <SectionTitle icon={UsersIcon} label="Human Resources" iconBg="bg-indigo-100" iconColor="text-indigo-600" />
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Total Workforce" value={hr.total_employees || 0} sub={`${hr.staff || 0} staff · ${hr.casuals || 0} casuals`} valueColor="text-indigo-800" bg="bg-indigo-50" border="border-indigo-100" accent="bg-indigo-400" to="/hr/employees" />
            <KpiCard label="Present Today" value={hr.present_today || 0} sub={`${hr.on_leave_today || 0} on leave`} valueColor="text-green-800" bg="bg-green-50" border="border-green-100" accent="bg-green-400" to="/hr/attendance" />
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-3">HR Alerts</p>
            <div className="space-y-2">
              <div onClick={() => navigate('/hr/leave')} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 cursor-pointer hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-gray-700">Pending Leave Applications</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hr.pending_leaves > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>{hr.pending_leaves || 0}</span>
              </div>
              <div onClick={() => navigate('/hr/employees')} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 cursor-pointer hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs text-gray-700">Expiring Contracts (30 days)</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hr.expiring_contracts > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>{hr.expiring_contracts || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory & Assets */}
        <div className="space-y-3">
          <SectionTitle icon={CubeIcon} label="Inventory & Assets" iconBg="bg-orange-100" iconColor="text-orange-600" />
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Stock Items" value={inventory.total_items || 0} sub={inventory.low_stock > 0 ? `${inventory.low_stock} below reorder` : 'All stocked'} subOk={inventory.low_stock === 0} valueColor="text-orange-800" bg="bg-orange-50" border="border-orange-100" accent="bg-orange-400" to="/inventory" />
            <KpiCard label="Registered Assets" value={inventory.total_assets || 0} sub={`${inventory.active_assets || 0} operational`} valueColor="text-orange-800" bg="bg-orange-50" border="border-orange-100" accent="bg-orange-400" to="/assets" />
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-lg py-2.5">
                <p className="text-sm font-bold text-green-600">{inventory.active_assets || 0}</p>
                <p className="text-[10px] text-gray-400">Operational</p>
              </div>
              <div className="bg-white rounded-lg py-2.5">
                <p className="text-sm font-bold text-amber-500">{inventory.under_repair || 0}</p>
                <p className="text-[10px] text-gray-400">Under Repair</p>
              </div>
              <div className="bg-white rounded-lg py-2.5">
                <p className="text-sm font-bold text-red-500">{inventory.low_stock || 0}</p>
                <p className="text-[10px] text-gray-400">Low Stock</p>
              </div>
            </div>
          </div>
        </div>

        {/* System Users */}
        <div className="space-y-3">
          <SectionTitle icon={UserGroupIcon} label="System Users" iconBg="bg-slate-100" iconColor="text-slate-600" />
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Users by Role</p>
              <span className="text-xs font-bold text-slate-600">{users.total || 0} total</span>
            </div>
            <div className="px-4 py-2">
              {(users.by_role || []).map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <p className="text-xs text-gray-700 capitalize">{r.role?.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-brand-slate h-1.5 rounded-full" style={{ width: `${users.total > 0 ? (r.count / users.total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 w-4 text-right">{r.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-right">
        Data refreshes every minute · Last updated {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'}
      </p>
    </div>
  )
}
