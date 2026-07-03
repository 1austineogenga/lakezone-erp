import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getMDDashboard } from '../../api/auth'
import {
  BanknotesIcon, FolderIcon, TruckIcon, UsersIcon,
  ClipboardDocumentListIcon, CubeIcon, ClockIcon,
  DocumentTextIcon, UserGroupIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'

const fmtK = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `KES ${(v / 1_000).toFixed(0)}K`
  return `KES ${v.toLocaleString()}`
}

function Ring({ pct = 0, color = '#22c55e', size = 64, stroke = 6 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ display: 'block' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-gray-700">{pct}%</span>
      </div>
    </div>
  )
}

function PipelineBar({ stages = [] }) {
  const total = stages.reduce((s, x) => s + (x.value || 0), 0)
  if (total === 0) return (
    <div className="space-y-1.5">
      <div className="h-2.5 rounded-full bg-gray-100" />
      <p className="text-[10px] text-gray-400">No data yet</p>
    </div>
  )
  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        {stages.map((s, i) => (
          <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            className="min-w-[2px]" title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-[10px] text-gray-500">{s.label} <strong className="text-gray-700">{s.value}</strong></span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricRow({ label, value, sub, color = 'text-gray-800', onClick }) {
  return (
    <div onClick={onClick}
      className={`flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 ${onClick ? 'cursor-pointer hover:bg-gray-50 -mx-5 px-5 rounded' : ''}`}>
      <span className="text-xs text-gray-600">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-bold ${color}`}>{value}</span>
        {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

function SectionCard({ icon: Icon, iconBg, iconColor, title, linkTo, children }) {
  const navigate = useNavigate()
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className={`px-5 py-3 border-b border-gray-100 flex items-center justify-between ${iconBg}`}>
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <h3 className={`text-xs font-bold uppercase tracking-widest ${iconColor}`}>{title}</h3>
        </div>
        {linkTo && (
          <button onClick={() => navigate(linkTo)} className={`text-[10px] font-semibold ${iconColor} opacity-60 hover:opacity-100`}>View all →</button>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function KpiCard({ label, value, sub, subOk, valueColor, bg, border, accent, to }) {
  const navigate = useNavigate()
  return (
    <div onClick={to ? () => navigate(to) : undefined}
      className={`relative overflow-hidden ${bg} border ${border} rounded-xl p-4 shadow-sm ${to ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all' : ''}`}>
      {accent && <div className={`absolute top-0 left-0 w-1 h-full ${accent} rounded-l-xl`} />}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1 pl-1">{label}</p>
      <p className={`text-xl font-bold pl-1 ${valueColor}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 pl-1 ${subOk == null ? 'text-gray-400' : subOk ? 'text-green-600' : 'text-red-500'}`}>{sub}</p>}
    </div>
  )
}

function AlertPill({ count, label, color, onClick }) {
  if (!count) return null
  return (
    <span onClick={onClick} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${color} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-gray-100 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { finance = {}, projects = {}, fleet = {}, hr = {}, procurement = {}, requisitions = {}, inventory = {}, users = {} } = data
  const fleetPct      = fleet.total > 0 ? Math.round((fleet.online / fleet.total) * 100) : 0
  const attendancePct = hr.total_employees > 0 ? Math.round(((hr.present_today || 0) / hr.total_employees) * 100) : 0
  const arPct         = finance.collection_rate || 0
  const assetPct      = inventory.total_assets > 0 ? Math.round(((inventory.active_assets || 0) / inventory.total_assets) * 100) : 0
  const reqApprovalPct= requisitions.total_mtd > 0 ? Math.round(((requisitions.approved || 0) / requisitions.total_mtd) * 100) : 0

  return (
    <div className="space-y-6">

      {/* ── Finance ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-blue-100 p-1.5 rounded-lg"><BanknotesIcon className="h-4 w-4 text-blue-600" /></div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Finance Overview</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <KpiCard label="Total Invoiced (AR)"  value={fmtK(finance.ar_billed)}      sub={`${arPct}% collected`}                                                subOk={arPct >= 70}                   valueColor="text-blue-800"  bg="bg-blue-50"  border="border-blue-100"  accent="bg-blue-400"  to="/finance/invoices" />
          <KpiCard label="Cash Received"         value={fmtK(finance.ar_received)}    sub="from clients"                                                          subOk={null}                          valueColor="text-green-800" bg="bg-green-50" border="border-green-100" accent="bg-green-400" to="/finance/payments" />
          <KpiCard label="AR Outstanding"        value={fmtK(finance.ar_outstanding)} sub={finance.ar_overdue > 0 ? `${fmtK(finance.ar_overdue)} overdue` : 'No overdue'} subOk={finance.ar_overdue === 0} valueColor="text-amber-800" bg="bg-amber-50" border="border-amber-100" accent="bg-amber-400" to="/finance/aged" />
          <KpiCard label="AP Outstanding"        value={fmtK(finance.ap_outstanding)} sub={finance.ap_overdue > 0 ? `${fmtK(finance.ap_overdue)} overdue` : 'All current'} subOk={finance.ap_overdue === 0} valueColor="text-red-800"   bg="bg-red-50"   border="border-red-100"   accent="bg-red-400"   to="/finance/bills" />
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">AR Collection Rate</p>
            <span className={`text-xs font-bold ${arPct >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{arPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
            <div className={`${arPct >= 70 ? 'bg-green-500' : 'bg-amber-400'} h-2 rounded-full`} style={{ width: `${arPct}%` }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {finance.pending_expenses_count > 0 && <AlertPill count={finance.pending_expenses_count} label={`expense claims pending (${fmtK(finance.pending_expenses_value)})`} color="bg-amber-100 text-amber-800" onClick={() => navigate('/finance')} />}
            {finance.ar_overdue > 0 && <AlertPill count={1} label={`AR overdue: ${fmtK(finance.ar_overdue)}`}  color="bg-red-100 text-red-700"   onClick={() => navigate('/finance/aged')} />}
            {finance.ap_overdue > 0 && <AlertPill count={1} label={`AP overdue: ${fmtK(finance.ap_overdue)}`}  color="bg-rose-100 text-rose-700" onClick={() => navigate('/finance/bills')} />}
          </div>
        </div>
      </div>

      {/* ── Operational Pulse — 5 rings, each unique metric ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Fleet Online',      pct: fleetPct,       color: fleetPct >= 60 ? '#06b6d4' : '#ef4444',      val: `${fleet.online||0}/${fleet.total||0}`,        sub: 'vehicles',      to: '/fleet/vehicles' },
          { label: 'Attendance',        pct: attendancePct,  color: attendancePct >= 80 ? '#22c55e' : '#f59e0b',  val: `${hr.present_today||0}/${hr.total_employees||0}`, sub: 'present today', to: '/hr/attendance' },
          { label: 'Asset Health',      pct: assetPct,       color: assetPct >= 80 ? '#f97316' : '#ef4444',       val: `${inventory.active_assets||0}/${inventory.total_assets||0}`, sub: 'operational', to: '/assets' },
          { label: 'Req Approval',      pct: reqApprovalPct, color: '#8b5cf6',                                    val: `${requisitions.approved||0}/${requisitions.total_mtd||0}`, sub: 'approved MTD', to: '/requisitions' },
          { label: 'AR Collection',     pct: arPct,          color: arPct >= 70 ? '#3b82f6' : '#ef4444',          val: `${arPct}%`,                                   sub: 'collected',     to: '/finance/invoices' },
        ].map(m => (
          <div key={m.label} onClick={() => navigate(m.to)}
            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center gap-2 cursor-pointer hover:shadow-md transition-all">
            <Ring pct={m.pct} color={m.color} size={56} stroke={5} />
            <div className="text-center">
              <p className="text-xs font-bold text-gray-700">{m.val}</p>
              <p className="text-[10px] text-gray-400">{m.sub}</p>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 1: Projects · HR · Fleet ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Projects */}
        <SectionCard icon={FolderIcon} iconBg="bg-violet-50" iconColor="text-violet-600" title="Projects" linkTo="/projects">
          <div className="mb-4">
            <PipelineBar stages={[
              { label: 'Active',    value: projects.active    || 0, color: '#22c55e' },
              { label: 'On Hold',   value: projects.on_hold   || 0, color: '#f59e0b' },
              { label: 'Completed', value: projects.completed || 0, color: '#8b5cf6' },
            ]} />
          </div>
          {projects.recent?.length > 0 ? projects.recent.slice(0, 4).map((p, i) => (
            <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
              className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-5 px-5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status==='active'?'bg-green-500':p.status==='completed'?'bg-violet-500':'bg-amber-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                <p className="text-[10px] text-gray-400">{p.client_name || '—'}</p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${p.status==='active'?'bg-green-100 text-green-700':p.status==='completed'?'bg-violet-100 text-violet-700':'bg-amber-100 text-amber-700'}`}>
                {p.status?.replace('_',' ')}
              </span>
            </div>
          )) : <p className="text-xs text-gray-400 text-center py-4">No projects yet</p>}
        </SectionCard>

        {/* HR */}
        <SectionCard icon={UsersIcon} iconBg="bg-indigo-50" iconColor="text-indigo-600" title="Human Resources" linkTo="/hr/employees">
          <div className="flex justify-around items-center mb-4 py-1">
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600">{hr.total_employees || 0}</p>
              <p className="text-[10px] text-gray-400">Total Workforce</p>
              <div className="flex gap-3 justify-center mt-1">
                <span className="text-[10px] text-gray-500"><strong>{hr.staff||0}</strong> staff</span>
                <span className="text-[10px] text-gray-500"><strong>{hr.casuals||0}</strong> casual</span>
              </div>
            </div>
            <div className="w-px h-14 bg-gray-100" />
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{hr.present_today || 0}</p>
              <p className="text-[10px] text-gray-400">Present Today</p>
              <p className="text-[10px] text-amber-500 mt-1">{hr.on_leave_today||0} on leave</p>
            </div>
          </div>
          <div className="border-t border-gray-50 pt-1">
            <MetricRow label="Pending Leave Applications" value={hr.pending_leaves||0}       color={hr.pending_leaves > 0 ? 'text-amber-600' : 'text-green-600'} onClick={() => navigate('/hr/leave')} />
            <MetricRow label="Expiring Contracts (30d)"   value={hr.expiring_contracts||0}   color={hr.expiring_contracts > 0 ? 'text-red-500' : 'text-green-600'} onClick={() => navigate('/hr/employees')} />
          </div>
        </SectionCard>

        {/* Fleet */}
        <SectionCard icon={TruckIcon} iconBg="bg-cyan-50" iconColor="text-cyan-600" title="Fleet" linkTo="/fleet/vehicles">
          <div className="mb-3">
            <PipelineBar stages={[
              { label: 'Moving',       value: fleet.moving  || 0, color: '#22c55e' },
              { label: 'Idle',         value: fleet.idle    || 0, color: '#f59e0b' },
              { label: 'Stopped',      value: fleet.stopped || 0, color: '#94a3b8' },
            ]} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            {[
              { label: 'Online',   value: fleet.online  || 0, color: 'text-cyan-600' },
              { label: 'Moving',   value: fleet.moving  || 0, color: 'text-green-600' },
              { label: 'Stopped',  value: fleet.stopped || 0, color: 'text-gray-500' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl py-2.5">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
          {(fleet.alerts_unacked > 0 || fleet.low_fuel > 0) && (
            <div className="flex gap-2 flex-wrap">
              <AlertPill count={fleet.alerts_unacked} label="unacked alerts" color="bg-red-100 text-red-700"   onClick={() => navigate('/fleet/alerts')} />
              <AlertPill count={fleet.low_fuel}       label="low fuel"       color="bg-amber-100 text-amber-700" onClick={() => navigate('/fleet/fuel')} />
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Row 2: Procurement · Inventory & Assets · System Users ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Procurement */}
        <SectionCard icon={ClipboardDocumentListIcon} iconBg="bg-purple-50" iconColor="text-purple-600" title="Procurement" linkTo="/procurement">
          <div className="mb-4">
            <PipelineBar stages={[
              { label: 'Pending PRs',  value: procurement.pending_prs  || 0, color: '#f59e0b' },
              { label: 'Approved PRs', value: procurement.approved_prs || 0, color: '#22c55e' },
              { label: 'Open POs',     value: procurement.open_pos     || 0, color: '#8b5cf6' },
            ]} />
          </div>
          <MetricRow label="Open PO Value"     value={fmtK(procurement.po_value_open)} onClick={() => navigate('/procurement')} />
          <MetricRow label="Pending Reqs"       value={requisitions.pending||0} sub="awaiting approval" color={requisitions.pending > 0 ? 'text-amber-600' : 'text-gray-800'} onClick={() => navigate('/requisitions')} />
          <MetricRow label="Requisitions MTD"   value={requisitions.total_mtd||0} sub={`${requisitions.approved||0} approved`} onClick={() => navigate('/requisitions')} />
        </SectionCard>

        {/* Inventory & Assets */}
        <SectionCard icon={CubeIcon} iconBg="bg-orange-50" iconColor="text-orange-600" title="Inventory & Assets" linkTo="/inventory">
          <div className="flex justify-around items-center mb-4 py-1">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">{inventory.total_items || 0}</p>
              <p className="text-[10px] text-gray-400">Stock Items</p>
              {inventory.low_stock > 0
                ? <p className="text-[10px] text-red-500 mt-1">{inventory.low_stock} below reorder</p>
                : <p className="text-[10px] text-green-600 mt-1">All stocked</p>}
            </div>
            <div className="w-px h-14 bg-gray-100" />
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">{inventory.total_assets || 0}</p>
              <p className="text-[10px] text-gray-400">Total Assets</p>
              <p className="text-[10px] text-green-600 mt-1">{inventory.active_assets||0} operational</p>
            </div>
          </div>
          <div className="border-t border-gray-50 pt-3">
            <PipelineBar stages={[
              { label: 'Operational', value: inventory.active_assets || 0, color: '#f97316' },
              { label: 'Under Repair',value: inventory.under_repair  || 0, color: '#f59e0b' },
              { label: 'Low Stock',   value: inventory.low_stock     || 0, color: '#ef4444' },
            ]} />
          </div>
        </SectionCard>

        {/* System Users */}
        <SectionCard icon={UserGroupIcon} iconBg="bg-slate-50" iconColor="text-slate-600" title="System Users" linkTo="/users">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-700">{users.total || 0}</p>
              <p className="text-[10px] text-gray-400">Total Users</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {(users.by_role || []).slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-24 truncate capitalize">{r.role?.replace(/_/g,' ')}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className="bg-slate-500 h-1.5 rounded-full" style={{ width: `${users.total > 0 ? (r.count/users.total)*100 : 0}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 w-3 text-right">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
          {(users.by_role || []).length > 5 && (
            <div className="border-t border-gray-50 pt-3 space-y-1.5">
              {(users.by_role || []).slice(5).map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-24 truncate capitalize">{r.role?.replace(/_/g,' ')}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className="bg-slate-400 h-1.5 rounded-full" style={{ width: `${users.total > 0 ? (r.count/users.total)*100 : 0}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 w-3 text-right">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <p className="text-[10px] text-gray-400 text-right">
        Data refreshes every minute · Last updated {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'}
      </p>
    </div>
  )
}
