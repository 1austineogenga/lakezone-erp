import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getMDDashboard } from '../../api/auth'
import {
  BanknotesIcon, FolderIcon, TruckIcon, UsersIcon,
  ClipboardDocumentListIcon, CubeIcon, ExclamationTriangleIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, CheckCircleIcon,
  ClockIcon, ShieldExclamationIcon, BeakerIcon, UserGroupIcon,
  DocumentTextIcon, WrenchScrewdriverIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`
const fmtK = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `KES ${(v / 1_000).toFixed(0)}K`
  return `KES ${v.toLocaleString()}`
}

function SectionTitle({ icon: Icon, label, color = 'text-brand-red' }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`h-4 w-4 ${color}`} />
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</h2>
    </div>
  )
}

function KpiTile({ label, value, sub, subColor = 'text-gray-400', color = 'text-gray-800', bg = 'bg-white', border = 'border-gray-100', to }) {
  const navigate = useNavigate()
  const cls = `${bg} border ${border} rounded-xl p-4 shadow-sm transition-all ${to ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`
  return (
    <div className={cls} onClick={to ? () => navigate(to) : undefined}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  )
}

function AlertPill({ count, label, color }) {
  if (!count) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {count} {label}
    </span>
  )
}

function ProgressBar({ value, max, color = 'bg-brand-red' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
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

      {/* ── Finance Overview ── */}
      <div>
        <SectionTitle icon={BanknotesIcon} label="Finance Overview" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile label="Total Invoiced (AR)" value={fmtK(finance.ar_billed)} sub={`${arCollectionPct}% collected`} subColor={arCollectionPct >= 70 ? 'text-green-600' : 'text-amber-600'} color="text-blue-700" to="/finance/invoices" />
          <KpiTile label="Cash Received" value={fmtK(finance.ar_received)} sub="from clients" color="text-green-700" to="/finance/payments" />
          <KpiTile label="AR Outstanding" value={fmtK(finance.ar_outstanding)} sub={finance.ar_overdue > 0 ? `${fmtK(finance.ar_overdue)} overdue` : 'No overdue'} subColor={finance.ar_overdue > 0 ? 'text-red-500' : 'text-green-500'} color="text-amber-700" to="/finance/aged" />
          <KpiTile label="AP Outstanding" value={fmtK(finance.ap_outstanding)} sub={finance.ap_overdue > 0 ? `${fmtK(finance.ap_overdue)} overdue` : 'All current'} subColor={finance.ap_overdue > 0 ? 'text-red-500' : 'text-green-500'} color="text-red-700" to="/finance/bills" />
        </div>

        {/* Collection rate bar */}
        <div className="mt-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-600">AR Collection Rate</p>
            <span className={`text-xs font-bold ${arCollectionPct >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{arCollectionPct}%</span>
          </div>
          <ProgressBar value={arCollectionPct} max={100} color={arCollectionPct >= 70 ? 'bg-green-500' : 'bg-amber-400'} />
          <div className="flex gap-3 mt-3 flex-wrap">
            {finance.pending_expenses_count > 0 && (
              <AlertPill count={finance.pending_expenses_count} label={`expense claims pending (${fmtK(finance.pending_expenses_value)})`} color="bg-amber-100 text-amber-800" />
            )}
            {finance.ar_overdue > 0 && (
              <AlertPill count={1} label={`AR overdue: ${fmtK(finance.ar_overdue)}`} color="bg-red-100 text-red-700" />
            )}
            {finance.ap_overdue > 0 && (
              <AlertPill count={1} label={`AP overdue: ${fmtK(finance.ap_overdue)}`} color="bg-rose-100 text-rose-700" />
            )}
          </div>
        </div>
      </div>

      {/* ── Projects + Procurement ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects */}
        <div>
          <SectionTitle icon={FolderIcon} label="Projects" color="text-blue-600" />
          <div className="grid grid-cols-3 gap-3 mb-3">
            <KpiTile label="Active" value={projects.active || 0} color="text-green-700" to="/projects?status=active" />
            <KpiTile label="On Hold" value={projects.on_hold || 0} color="text-amber-700" to="/projects?status=on_hold" />
            <KpiTile label="Completed" value={projects.completed || 0} color="text-blue-700" to="/projects?status=completed" />
          </div>
          {projects.recent?.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <p className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-50 flex items-center justify-between">Recent Projects <span className="cursor-pointer text-brand-red hover:underline" onClick={() => navigate('/projects')}>View all →</span></p>
              {projects.recent.map((p, i) => (
                <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${i < projects.recent.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <StatusDot status={p.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{p.client_name || '—'}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize
                    ${p.status === 'active' ? 'bg-green-100 text-green-700' :
                      p.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      p.status === 'on_hold' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.status?.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Procurement */}
        <div>
          <SectionTitle icon={ClipboardDocumentListIcon} label="Procurement" color="text-purple-600" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <KpiTile label="Pending PRs" value={procurement.pending_prs || 0} sub="awaiting approval" subColor={procurement.pending_prs > 0 ? 'text-amber-500' : 'text-gray-400'} color="text-amber-700" to="/procurement" />
            <KpiTile label="Open POs" value={procurement.open_pos || 0} sub={fmtK(procurement.po_value_open)} color="text-purple-700" to="/procurement" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <KpiTile label="Approved PRs" value={procurement.approved_prs || 0} color="text-green-700" to="/procurement" />
            <KpiTile label="Pending Requisitions" value={requisitions.pending || 0} sub="awaiting approval" subColor={requisitions.pending > 0 ? 'text-amber-500' : 'text-gray-400'} color="text-amber-700" to="/requisitions" />
          </div>
          {/* Requisitions strip */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Requisitions MTD</p>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-800">{requisitions.total_mtd || 0}</p>
                <p className="text-[10px] text-gray-400">Total raised</p>
              </div>
              <div className="h-8 w-px bg-gray-100" />
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">{requisitions.approved || 0}</p>
                <p className="text-[10px] text-gray-400">Approved</p>
              </div>
              <div className="h-8 w-px bg-gray-100" />
              <div className="text-center">
                <p className="text-lg font-bold text-amber-600">{requisitions.pending || 0}</p>
                <p className="text-[10px] text-gray-400">Pending</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fleet + HR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet */}
        <div>
          <SectionTitle icon={TruckIcon} label="Fleet Status" color="text-cyan-600" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <KpiTile label="Online Now" value={`${fleet.online || 0}/${fleet.total || 0}`} sub={`${fleetOnlinePct}% availability`} subColor={fleetOnlinePct >= 60 ? 'text-green-600' : 'text-red-500'} color="text-cyan-700" to="/fleet/vehicles" />
            <KpiTile label="Moving" value={fleet.moving || 0} sub="live GPS" color="text-green-700" to="/fleet/vehicles" />
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fleet Availability</p>
              <span className={`text-xs font-bold ${fleetOnlinePct >= 60 ? 'text-green-600' : 'text-red-500'}`}>{fleetOnlinePct}%</span>
            </div>
            <ProgressBar value={fleetOnlinePct} max={100} color={fleetOnlinePct >= 60 ? 'bg-cyan-500' : 'bg-red-400'} />
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div>
                <p className="text-sm font-bold text-green-600">{fleet.moving || 0}</p>
                <p className="text-[10px] text-gray-400">Moving</p>
              </div>
              <div>
                <p className="text-sm font-bold text-amber-500">{fleet.idle || 0}</p>
                <p className="text-[10px] text-gray-400">Idle</p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">{fleet.stopped || 0}</p>
                <p className="text-[10px] text-gray-400">Stopped</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {fleet.alerts_unacked > 0 && (
                <span onClick={() => navigate('/fleet/alerts')} className="cursor-pointer">
                  <AlertPill count={fleet.alerts_unacked} label="unacknowledged alerts" color="bg-red-100 text-red-700" />
                </span>
              )}
              {fleet.low_fuel > 0 && (
                <span onClick={() => navigate('/fleet/fuel')} className="cursor-pointer">
                  <AlertPill count={fleet.low_fuel} label="low fuel" color="bg-amber-100 text-amber-700" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* HR */}
        <div>
          <SectionTitle icon={UsersIcon} label="Human Resources" color="text-indigo-600" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <KpiTile label="Total Workforce" value={hr.total_employees || 0} sub={`${hr.staff || 0} staff · ${hr.casuals || 0} casuals`} color="text-indigo-700" to="/hr/employees" />
            <KpiTile label="Present Today" value={hr.present_today || 0} sub={`${hr.on_leave_today || 0} on leave`} color="text-green-700" to="/hr/attendance" />
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">HR Alerts</p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => navigate('/hr/leave')}>
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-gray-700">Pending Leave Applications</span>
                </div>
                <span className={`text-xs font-bold ${hr.pending_leaves > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{hr.pending_leaves || 0}</span>
              </div>
              <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => navigate('/hr/employees')}>
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs text-gray-700">Expiring Contracts (30 days)</span>
                </div>
                <span className={`text-xs font-bold ${hr.expiring_contracts > 0 ? 'text-red-600' : 'text-gray-400'}`}>{hr.expiring_contracts || 0}</span>
              </div>
            </div>
            {hr.expiring_contracts > 0 && (
              <div className="mt-3 flex gap-2">
                <AlertPill count={hr.expiring_contracts} label="contracts expiring soon" color="bg-red-100 text-red-700" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Inventory & Assets + Users ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory & Assets */}
        <div>
          <SectionTitle icon={CubeIcon} label="Inventory & Assets" color="text-orange-600" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <KpiTile label="Stock Items" value={inventory.total_items || 0} sub={inventory.low_stock > 0 ? `${inventory.low_stock} below reorder` : 'All stocked'} subColor={inventory.low_stock > 0 ? 'text-red-500' : 'text-green-500'} color="text-orange-700" to="/inventory" />
            <KpiTile label="Registered Assets" value={inventory.total_assets || 0} sub={`${inventory.active_assets || 0} operational`} color="text-orange-700" to="/assets" />
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-bold text-green-600">{inventory.active_assets || 0}</p>
                <p className="text-[10px] text-gray-400">Operational</p>
              </div>
              <div>
                <p className="text-sm font-bold text-amber-500">{inventory.under_repair || 0}</p>
                <p className="text-[10px] text-gray-400">Under Repair</p>
              </div>
              <div>
                <p className="text-sm font-bold text-red-500">{inventory.low_stock || 0}</p>
                <p className="text-[10px] text-gray-400">Low Stock</p>
              </div>
            </div>
          </div>
        </div>

        {/* Users / System */}
        <div>
          <SectionTitle icon={UserGroupIcon} label="System Users" color="text-slate-600" />
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Active Users by Role</p>
              <span className="text-xs font-bold text-gray-700">{users.total || 0} total</span>
            </div>
            <div className="px-4 py-2 max-h-44 overflow-y-auto">
              {(users.by_role || []).map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <p className="text-xs text-gray-700 capitalize">{r.role?.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-100 rounded-full h-1">
                      <div className="bg-brand-red h-1 rounded-full" style={{ width: `${users.total > 0 ? (r.count / users.total) * 100 : 0}%` }} />
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
