import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getMDDashboard } from '../../api/auth'
import {
  BanknotesIcon, FolderIcon, TruckIcon, UsersIcon,
  ClipboardDocumentListIcon, CubeIcon, ClockIcon,
  DocumentTextIcon, ArrowTrendingUpIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'

const fmtK = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `KES ${(v / 1_000).toFixed(0)}K`
  return `KES ${v.toLocaleString()}`
}

function Ring({ pct = 0, color = '#22c55e', size = 64, stroke = 6, label, sub }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ display: 'block' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray .6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-gray-800 leading-none">{pct}%</span>
        </div>
      </div>
      {label && <p className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{label}</p>}
      {sub   && <p className="text-[10px] text-gray-400 text-center">{sub}</p>}
    </div>
  )
}

function PipelineBar({ stages = [] }) {
  const total = stages.reduce((s, x) => s + (x.value || 0), 0)
  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        {stages.map((s, i) => (
          <div key={i} style={{ width: total > 0 ? `${(s.value / total) * 100}%` : `${100 / stages.length}%`, background: s.color }}
            title={`${s.label}: ${s.value}`} className="min-w-[2px]" />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] text-gray-500">{s.label} <strong className="text-gray-700">{s.value}</strong></span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricRow({ label, value, sub, color = 'text-gray-800', onClick }) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 ${onClick ? 'cursor-pointer hover:bg-gray-50 -mx-4 px-4 rounded' : ''}`}>
      <span className="text-xs text-gray-600">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-bold ${color}`}>{value}</span>
        {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

function SectionCard({ icon: Icon, iconBg, iconColor, title, children, onClick }) {
  const navigate = useNavigate()
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-gray-100 flex items-center justify-between ${iconBg}`}>
        <div className="flex items-center gap-2.5">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <h3 className={`text-xs font-bold uppercase tracking-widest ${iconColor}`}>{title}</h3>
        </div>
        {onClick && (
          <button onClick={() => navigate(onClick)} className={`text-[10px] font-semibold ${iconColor} opacity-70 hover:opacity-100`}>View all →</button>
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
      {sub && (
        <p className={`text-xs mt-0.5 pl-1 ${subOk == null ? 'text-gray-400' : subOk ? 'text-green-600' : 'text-red-500'}`}>{sub}</p>
      )}
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
  const fleetOnlinePct  = fleet.total  > 0 ? Math.round((fleet.online / fleet.total) * 100) : 0
  const attendancePct   = hr.total_employees > 0 ? Math.round((hr.present_today / hr.total_employees) * 100) : 0
  const arCollectionPct = finance.collection_rate || 0
  const assetHealthPct  = inventory.total_assets > 0 ? Math.round((inventory.active_assets / inventory.total_assets) * 100) : 0

  return (
    <div className="space-y-6">

      {/* ── Finance — full width ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="bg-blue-100 p-1.5 rounded-lg"><BanknotesIcon className="h-4 w-4 text-blue-600" /></div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Finance Overview</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <KpiCard label="Total Invoiced (AR)" value={fmtK(finance.ar_billed)} sub={`${arCollectionPct}% collected`} subOk={arCollectionPct >= 70} valueColor="text-blue-800" bg="bg-blue-50" border="border-blue-100" accent="bg-blue-400" to="/finance/invoices" />
          <KpiCard label="Cash Received"        value={fmtK(finance.ar_received)}   sub="from clients"                                                         valueColor="text-green-800"  bg="bg-green-50"  border="border-green-100"  accent="bg-green-400"  to="/finance/payments" />
          <KpiCard label="AR Outstanding"       value={fmtK(finance.ar_outstanding)} sub={finance.ar_overdue > 0 ? `${fmtK(finance.ar_overdue)} overdue` : 'No overdue'} subOk={finance.ar_overdue === 0} valueColor="text-amber-800" bg="bg-amber-50" border="border-amber-100" accent="bg-amber-400" to="/finance/aged" />
          <KpiCard label="AP Outstanding"       value={fmtK(finance.ap_outstanding)} sub={finance.ap_overdue > 0 ? `${fmtK(finance.ap_overdue)} overdue` : 'All current'} subOk={finance.ap_overdue === 0} valueColor="text-red-800"   bg="bg-red-50"    border="border-red-100"   accent="bg-red-400"   to="/finance/bills" />
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">AR Collection Rate</p>
            <span className={`text-xs font-bold ${arCollectionPct >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{arCollectionPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
            <div className={`${arCollectionPct >= 70 ? 'bg-green-500' : 'bg-amber-400'} h-2 rounded-full transition-all`} style={{ width: `${arCollectionPct}%` }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {finance.pending_expenses_count > 0 && <AlertPill count={finance.pending_expenses_count} label={`expense claims pending (${fmtK(finance.pending_expenses_value)})`} color="bg-amber-100 text-amber-800" onClick={() => navigate('/finance')} />}
            {finance.ar_overdue > 0 && <AlertPill count={1} label={`AR overdue: ${fmtK(finance.ar_overdue)}`} color="bg-red-100 text-red-700" onClick={() => navigate('/finance/aged')} />}
            {finance.ap_overdue > 0 && <AlertPill count={1} label={`AP overdue: ${fmtK(finance.ap_overdue)}`} color="bg-rose-100 text-rose-700" onClick={() => navigate('/finance/bills')} />}
          </div>
        </div>
      </div>

      {/* ── Pulse row — 4 visual rings ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/fleet/vehicles')}>
          <Ring pct={fleetOnlinePct} color={fleetOnlinePct >= 60 ? '#06b6d4' : '#ef4444'} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fleet</p>
            <p className="text-lg font-bold text-gray-800">{fleet.online || 0}<span className="text-xs text-gray-400">/{fleet.total || 0}</span></p>
            <p className="text-[10px] text-gray-400">vehicles online</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/hr/attendance')}>
          <Ring pct={attendancePct} color={attendancePct >= 80 ? '#22c55e' : '#f59e0b'} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Attendance</p>
            <p className="text-lg font-bold text-gray-800">{hr.present_today || 0}<span className="text-xs text-gray-400">/{hr.total_employees || 0}</span></p>
            <p className="text-[10px] text-gray-400">present today</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/assets')}>
          <Ring pct={assetHealthPct} color={assetHealthPct >= 80 ? '#f97316' : '#ef4444'} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Assets</p>
            <p className="text-lg font-bold text-gray-800">{inventory.active_assets || 0}<span className="text-xs text-gray-400">/{inventory.total_assets || 0}</span></p>
            <p className="text-[10px] text-gray-400">operational</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/requisitions')}>
          <Ring pct={requisitions.total_mtd > 0 ? Math.round((requisitions.approved / requisitions.total_mtd) * 100) : 0} color="#8b5cf6" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Requisitions</p>
            <p className="text-lg font-bold text-gray-800">{requisitions.approved || 0}<span className="text-xs text-gray-400">/{requisitions.total_mtd || 0}</span></p>
            <p className="text-[10px] text-gray-400">approved MTD</p>
          </div>
        </div>
      </div>

      {/* ── Bottom 3 columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Projects + Procurement */}
        <div className="space-y-4">
          <SectionCard icon={FolderIcon} iconBg="bg-violet-50" iconColor="text-violet-600" title="Projects" onClick="/projects">
            <div className="mb-4">
              <PipelineBar stages={[
                { label: 'Active',    value: projects.active    || 0, color: '#22c55e' },
                { label: 'On Hold',  value: projects.on_hold   || 0, color: '#f59e0b' },
                { label: 'Completed',value: projects.completed || 0, color: '#8b5cf6' },
              ]} />
            </div>
            {projects.recent?.length > 0 ? (
              <div className="space-y-1 -mx-5 px-5">
                {projects.recent.slice(0, 4).map(p => (
                  <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                    className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-5 px-5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'active' ? 'bg-green-500' : p.status === 'completed' ? 'bg-violet-500' : 'bg-amber-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{p.client_name || '—'}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize
                      ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'completed' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.status?.replace('_',' ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">No projects yet</p>
            )}
          </SectionCard>

          <SectionCard icon={ClipboardDocumentListIcon} iconBg="bg-purple-50" iconColor="text-purple-600" title="Procurement" onClick="/procurement">
            <div className="mb-3">
              <PipelineBar stages={[
                { label: 'Pending PRs',  value: procurement.pending_prs  || 0, color: '#f59e0b' },
                { label: 'Approved PRs', value: procurement.approved_prs || 0, color: '#22c55e' },
                { label: 'Open POs',     value: procurement.open_pos     || 0, color: '#8b5cf6' },
              ]} />
            </div>
            <MetricRow label="Open PO Value"    value={fmtK(procurement.po_value_open)} onClick={() => navigate('/procurement')} />
            <MetricRow label="Pending Reqs"     value={requisitions.pending || 0}  sub="awaiting approval" color={requisitions.pending > 0 ? 'text-amber-600' : 'text-gray-800'} onClick={() => navigate('/requisitions')} />
          </SectionCard>
        </div>

        {/* HR */}
        <div className="space-y-4">
          <SectionCard icon={UsersIcon} iconBg="bg-indigo-50" iconColor="text-indigo-600" title="Human Resources" onClick="/hr/employees">
            <div className="flex items-center justify-around mb-4 pt-1">
              <Ring pct={attendancePct} color={attendancePct >= 80 ? '#22c55e' : '#f59e0b'} size={72} label="Attendance" sub={`${hr.present_today || 0} present`} />
              <div className="text-center space-y-3">
                <div>
                  <p className="text-2xl font-bold text-indigo-700">{hr.total_employees || 0}</p>
                  <p className="text-[10px] text-gray-400">Total Workforce</p>
                </div>
                <div className="flex gap-3">
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-700">{hr.staff || 0}</p>
                    <p className="text-[10px] text-gray-400">Staff</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-700">{hr.casuals || 0}</p>
                    <p className="text-[10px] text-gray-400">Casual</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-0 border-t border-gray-50 pt-3">
              <MetricRow label="On Leave Today"       value={hr.on_leave_today || 0}   color={hr.on_leave_today > 0 ? 'text-amber-600' : 'text-gray-800'} onClick={() => navigate('/hr/leave')} />
              <MetricRow label="Pending Leave Apps"   value={hr.pending_leaves || 0}   color={hr.pending_leaves > 0 ? 'text-amber-600' : 'text-green-600'} onClick={() => navigate('/hr/leave')} />
              <MetricRow label="Expiring Contracts"   value={hr.expiring_contracts || 0} color={hr.expiring_contracts > 0 ? 'text-red-500' : 'text-green-600'} sub="within 30 days" onClick={() => navigate('/hr/employees')} />
            </div>
          </SectionCard>
        </div>

        {/* Fleet + Inventory */}
        <div className="space-y-4">
          <SectionCard icon={TruckIcon} iconBg="bg-cyan-50" iconColor="text-cyan-600" title="Fleet" onClick="/fleet/vehicles">
            <div className="flex items-center justify-around mb-4">
              <Ring pct={fleetOnlinePct} color={fleetOnlinePct >= 60 ? '#06b6d4' : '#ef4444'} size={72} label="Available" sub={`${fleet.online || 0}/${fleet.total || 0}`} />
              <div className="grid grid-cols-1 gap-2 text-center">
                {[
                  { label: 'Moving',  value: fleet.moving  || 0, color: 'text-green-600' },
                  { label: 'Idle',    value: fleet.idle    || 0, color: 'text-amber-500' },
                  { label: 'Stopped', value: fleet.stopped || 0, color: 'text-gray-500'  },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-sm font-bold w-6 text-right" style={{ color: s.color.replace('text-','') }}>{s.value}</span>
                    <span className="text-[10px] text-gray-400">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {(fleet.alerts_unacked > 0 || fleet.low_fuel > 0) && (
              <div className="flex gap-2 flex-wrap border-t border-gray-50 pt-3">
                <AlertPill count={fleet.alerts_unacked} label="unacked alerts" color="bg-red-100 text-red-700" onClick={() => navigate('/fleet/alerts')} />
                <AlertPill count={fleet.low_fuel}       label="low fuel"       color="bg-amber-100 text-amber-700" onClick={() => navigate('/fleet/fuel')} />
              </div>
            )}
          </SectionCard>

          <SectionCard icon={CubeIcon} iconBg="bg-orange-50" iconColor="text-orange-600" title="Inventory & Assets" onClick="/inventory">
            <div className="flex items-center justify-around mb-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{inventory.total_items || 0}</p>
                <p className="text-[10px] text-gray-400">Stock Items</p>
                {inventory.low_stock > 0 && <p className="text-[10px] text-red-500 mt-0.5">{inventory.low_stock} low stock</p>}
              </div>
              <div className="w-px h-12 bg-gray-100" />
              <Ring pct={assetHealthPct} color={assetHealthPct >= 80 ? '#f97316' : '#ef4444'} size={56} label="Asset Health" />
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{inventory.total_assets || 0}</p>
                <p className="text-[10px] text-gray-400">Total Assets</p>
                <p className="text-[10px] text-green-600 mt-0.5">{inventory.active_assets || 0} active</p>
              </div>
            </div>
            <div className="border-t border-gray-50 pt-3">
              <PipelineBar stages={[
                { label: 'Operational', value: inventory.active_assets || 0, color: '#f97316' },
                { label: 'Under Repair',value: inventory.under_repair   || 0, color: '#f59e0b' },
                { label: 'Low Stock',   value: inventory.low_stock       || 0, color: '#ef4444' },
              ]} />
            </div>
          </SectionCard>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-right">
        Data refreshes every minute · Last updated {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'}
      </p>
    </div>
  )
}
