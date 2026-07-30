import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getMDDashboard } from '../../api/auth'
import { getPortfolioSummary } from '../../api/projects'
import { getPipeline } from '../../api/crm'
import {
  BanknotesIcon, FolderIcon, TruckIcon, UsersIcon,
  ClipboardDocumentListIcon, CubeIcon,
  DocumentTextIcon, UserGroupIcon,
  ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
  CheckCircleIcon, ExclamationTriangleIcon, LockClosedIcon,
  MapPinIcon, WrenchScrewdriverIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'

const fmtK = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `KES ${(v / 1_000).toFixed(0)}K`
  return `KES ${v.toLocaleString()}`
}
const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

// ── Shared StatCard (matches module-level financial overview style) ───────────
function StatCard({ label, value, sub, subColor = 'text-gray-400', icon: Icon, iconBg, iconColor, onClick, alert }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 p-5 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconBg || 'bg-gray-100'}`}>
            <Icon className={`h-4 w-4 ${iconColor || 'text-gray-500'}`} />
          </div>
        )}
      </div>
      <p className="text-xl font-bold text-brand-slate">{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
      {alert && (
        <p className="text-[10px] mt-2 text-red-600 font-medium">{alert}</p>
      )}
    </div>
  )
}

// ── Section heading (matches module overview style) ───────────────────────────
function SectionHeading({ icon: Icon, iconBg, iconColor, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`p-1.5 rounded-lg ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
    </div>
  )
}

// ── Section card (white, border, header bar) ──────────────────────────────────
function SectionCard({ icon: Icon, iconBg, iconColor, title, linkTo, children }) {
  const navigate = useNavigate()
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          </div>
          <h3 className="text-xs font-semibold text-brand-slate uppercase tracking-wide">{title}</h3>
        </div>
        {linkTo && (
          <button onClick={() => navigate(linkTo)} className="text-xs text-brand-red hover:underline font-medium">
            View all →
          </button>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
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

function Ring({ pct = 0, color = '#22c55e', size = 56, stroke = 5 }) {
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
      <div className="h-2 rounded-full bg-gray-100" />
      <p className="text-[10px] text-gray-400">No data yet</p>
    </div>
  )
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
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

function AlertPill({ count, label, color, onClick }) {
  if (!count) return null
  return (
    <span onClick={onClick} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${color} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}>
      {count} {label}
    </span>
  )
}

function IndexBadge({ value }) {
  if (value == null) return <span className="text-gray-400 text-xs">—</span>
  const color = value >= 1.0 ? 'bg-green-100 text-green-700' : value >= 0.9 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${color}`}>{value.toFixed(2)}</span>
}

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700',
  certified: 'bg-indigo-100 text-indigo-700', partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700',
  disputed: 'bg-orange-100 text-orange-700', cancelled: 'bg-gray-100 text-gray-400',
  pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700',
}

export default function MDDashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['md-dashboard'],
    queryFn: getMDDashboard,
    select: r => r.data,
    refetchInterval: 60_000,
  })
  const { data: portfolio } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: getPortfolioSummary,
    select: r => r.data,
    refetchInterval: 60_000,
  })
  const { data: crmPipeline } = useQuery({
    queryKey: ['crm-pipeline'],
    queryFn: getPipeline,
    select: r => r.data,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { finance = {}, projects = {}, fleet = {}, hr = {}, procurement = {}, requisitions = {}, inventory = {}, users = {} } = data
  const fleetPct       = fleet.total > 0 ? Math.round((fleet.online / fleet.total) * 100) : 0
  const attendancePct  = hr.total_employees > 0 ? Math.round(((hr.present_today || 0) / hr.total_employees) * 100) : 0
  const arPct          = finance.collection_rate || 0
  const assetPct       = inventory.total_assets > 0 ? Math.round(((inventory.active_assets || 0) / inventory.total_assets) * 100) : 0
  const reqApprovalPct = requisitions.total_mtd > 0 ? Math.round(((requisitions.approved || 0) / requisitions.total_mtd) * 100) : 0

  return (
    <div className="space-y-8">

      {/* ── Finance Overview ─────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={BanknotesIcon} iconBg="bg-blue-100" iconColor="text-blue-600" title="Finance Overview" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard
            label="Total Revenue (AR)" value={fmtK(finance.ar_billed)}
            icon={ArrowTrendingUpIcon} iconBg="bg-blue-50" iconColor="text-blue-500"
            sub={`${arPct}% collected`} subColor={arPct >= 70 ? 'text-green-600' : 'text-amber-600'}
            onClick={() => navigate('/finance/invoices')}
          />
          <StatCard
            label="Cash Received" value={fmtK(finance.ar_received)}
            icon={CheckCircleIcon} iconBg="bg-green-50" iconColor="text-green-500"
            sub="from clients" subColor="text-green-600"
            onClick={() => navigate('/finance/payments')}
          />
          <StatCard
            label="AR Outstanding" value={fmtK(finance.ar_outstanding)}
            icon={ArrowTrendingUpIcon} iconBg="bg-amber-50" iconColor="text-amber-500"
            sub={finance.ar_overdue > 0 ? `${fmtK(finance.ar_overdue)} overdue` : 'No overdue'}
            subColor={finance.ar_overdue > 0 ? 'text-red-500' : 'text-green-600'}
            onClick={() => navigate('/finance/aged')}
          />
          <StatCard
            label="AP Outstanding" value={fmtK(finance.ap_outstanding)}
            icon={ArrowTrendingDownIcon} iconBg="bg-rose-50" iconColor="text-rose-500"
            sub={finance.ap_overdue > 0 ? `${fmtK(finance.ap_overdue)} overdue` : 'All current'}
            subColor={finance.ap_overdue > 0 ? 'text-red-500' : 'text-green-600'}
            onClick={() => navigate('/finance/bills')}
          />
        </div>

        {/* AR progress bar + alerts */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">AR Collection Rate</p>
            <span className={`text-xs font-bold ${arPct >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{arPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
            <div className={`${arPct >= 70 ? 'bg-green-500' : 'bg-amber-400'} h-2 rounded-full transition-all`} style={{ width: `${arPct}%` }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {finance.pending_expenses_count > 0 && <AlertPill count={finance.pending_expenses_count} label={`expense claims pending (${fmtK(finance.pending_expenses_value)})`} color="bg-amber-100 text-amber-800" onClick={() => navigate('/finance')} />}
            {finance.ar_overdue > 0 && <AlertPill count={1} label={`AR overdue: ${fmtK(finance.ar_overdue)}`}  color="bg-red-100 text-red-700"   onClick={() => navigate('/finance/aged')} />}
            {finance.ap_overdue > 0 && <AlertPill count={1} label={`AP overdue: ${fmtK(finance.ap_overdue)}`}  color="bg-rose-100 text-rose-700" onClick={() => navigate('/finance/bills')} />}
          </div>
        </div>
      </div>

      {/* ── Operational Pulse ────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={ChartBarIcon} iconBg="bg-violet-100" iconColor="text-violet-600" title="Operational Pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Fleet Online',  pct: fleetPct,       color: fleetPct >= 60 ? '#06b6d4' : '#ef4444',      val: `${fleet.online||0}/${fleet.total||0}`,                        sub: 'vehicles',      to: '/fleet/vehicles',    iconBg: 'bg-cyan-50',    iconColor: 'text-cyan-500',    icon: TruckIcon },
            { label: 'Attendance',    pct: attendancePct,  color: attendancePct >= 80 ? '#22c55e' : '#f59e0b',  val: `${hr.present_today||0}/${hr.total_employees||0}`,             sub: 'present today', to: '/hr/attendance',     iconBg: 'bg-green-50',   iconColor: 'text-green-500',   icon: UsersIcon },
            { label: 'Asset Health',  pct: assetPct,       color: assetPct >= 80 ? '#f97316' : '#ef4444',       val: `${inventory.active_assets||0}/${inventory.total_assets||0}`, sub: 'operational',   to: '/assets',            iconBg: 'bg-orange-50',  iconColor: 'text-orange-500',  icon: ShieldCheckIcon },
            { label: 'Req Approval',  pct: reqApprovalPct, color: '#8b5cf6',                                    val: `${requisitions.approved||0}/${requisitions.total_mtd||0}`,   sub: 'approved MTD',  to: '/requisitions',      iconBg: 'bg-purple-50',  iconColor: 'text-purple-500',  icon: DocumentTextIcon },
            { label: 'AR Collection', pct: arPct,          color: arPct >= 70 ? '#3b82f6' : '#ef4444',          val: `${arPct}%`,                                                  sub: 'collected',     to: '/finance/invoices',  iconBg: 'bg-blue-50',    iconColor: 'text-blue-500',    icon: BanknotesIcon },
          ].map(m => (
            <div key={m.label} onClick={() => navigate(m.to)}
              className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all">
              <Ring pct={m.pct} color={m.color} size={56} stroke={5} />
              <div className="text-center">
                <p className="text-sm font-bold text-brand-slate">{m.val}</p>
                <p className="text-[10px] text-gray-400">{m.sub}</p>
                <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{m.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 1: Projects · HR · Fleet ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        <SectionCard icon={FolderIcon} iconBg="bg-violet-100" iconColor="text-violet-600" title="Projects" linkTo="/projects">
          <div className="mb-4">
            <PipelineBar stages={[
              { label: 'Active',    value: projects.active    || 0, color: '#22c55e' },
              { label: 'On Hold',   value: projects.on_hold   || 0, color: '#f59e0b' },
              { label: 'Completed', value: projects.completed || 0, color: '#8b5cf6' },
            ]} />
          </div>
          {projects.recent?.length > 0 ? projects.recent.slice(0, 4).map(p => (
            <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
              className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-5 px-5">
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

        <SectionCard icon={UsersIcon} iconBg="bg-indigo-100" iconColor="text-indigo-600" title="Human Resources" linkTo="/hr/employees">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-indigo-600">{hr.total_employees || 0}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Total Workforce</p>
              <p className="text-[10px] text-gray-400 mt-1">{hr.staff||0} staff · {hr.casuals||0} casual</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{hr.present_today || 0}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Present Today</p>
              <p className="text-[10px] text-amber-500 mt-1">{hr.on_leave_today||0} on leave</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-1">
            <MetricRow label="Pending Leave Applications" value={hr.pending_leaves||0}     color={hr.pending_leaves > 0 ? 'text-amber-600' : 'text-green-600'} onClick={() => navigate('/hr/leave')} />
            <MetricRow label="Expiring Contracts (30d)"   value={hr.expiring_contracts||0} color={hr.expiring_contracts > 0 ? 'text-red-500' : 'text-green-600'} onClick={() => navigate('/hr/employees')} />
          </div>
        </SectionCard>

        <SectionCard icon={TruckIcon} iconBg="bg-cyan-100" iconColor="text-cyan-600" title="Fleet" linkTo="/fleet/vehicles">
          <div className="mb-4">
            <PipelineBar stages={[
              { label: 'Moving',  value: fleet.moving  || 0, color: '#22c55e' },
              { label: 'Idle',    value: fleet.idle    || 0, color: '#f59e0b' },
              { label: 'Stopped', value: fleet.stopped || 0, color: '#94a3b8' },
            ]} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            {[
              { label: 'Online',  value: fleet.online  || 0, color: 'text-cyan-600' },
              { label: 'Moving',  value: fleet.moving  || 0, color: 'text-green-600' },
              { label: 'Stopped', value: fleet.stopped || 0, color: 'text-gray-500' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl py-2.5">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
          {(fleet.alerts_unacked > 0 || fleet.low_fuel > 0) && (
            <div className="flex gap-2 flex-wrap">
              <AlertPill count={fleet.alerts_unacked} label="unacked alerts" color="bg-red-100 text-red-700"    onClick={() => navigate('/fleet/alerts')} />
              <AlertPill count={fleet.low_fuel}       label="low fuel"       color="bg-amber-100 text-amber-700" onClick={() => navigate('/fleet/fuel')} />
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Row 2: Procurement · Inventory & Assets · System Users ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        <SectionCard icon={ClipboardDocumentListIcon} iconBg="bg-purple-100" iconColor="text-purple-600" title="Procurement" linkTo="/procurement">
          <div className="mb-4">
            <PipelineBar stages={[
              { label: 'Pending PRs',  value: procurement.pending_prs  || 0, color: '#f59e0b' },
              { label: 'Approved PRs', value: procurement.approved_prs || 0, color: '#22c55e' },
              { label: 'Open POs',     value: procurement.open_pos     || 0, color: '#8b5cf6' },
            ]} />
          </div>
          <MetricRow label="Open PO Value"      value={fmtK(procurement.po_value_open)} onClick={() => navigate('/procurement')} />
          <MetricRow label="Pending Reqs"        value={requisitions.pending||0} sub="awaiting approval" color={requisitions.pending > 0 ? 'text-amber-600' : 'text-gray-800'} onClick={() => navigate('/requisitions')} />
          <MetricRow label="Requisitions MTD"    value={requisitions.total_mtd||0} sub={`${requisitions.approved||0} approved`} onClick={() => navigate('/requisitions')} />
        </SectionCard>

        <SectionCard icon={CubeIcon} iconBg="bg-orange-100" iconColor="text-orange-600" title="Inventory & Assets" linkTo="/inventory">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{inventory.total_items || 0}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Stock Items</p>
              <p className={`text-[10px] mt-1 ${inventory.low_stock > 0 ? 'text-red-500' : 'text-green-600'}`}>
                {inventory.low_stock > 0 ? `${inventory.low_stock} below reorder` : 'All stocked'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{inventory.total_assets || 0}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Total Assets</p>
              <p className="text-[10px] text-green-600 mt-1">{inventory.active_assets||0} operational</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <PipelineBar stages={[
              { label: 'Operational',  value: inventory.active_assets || 0, color: '#f97316' },
              { label: 'Under Repair', value: inventory.under_repair  || 0, color: '#f59e0b' },
              { label: 'Low Stock',    value: inventory.low_stock     || 0, color: '#ef4444' },
            ]} />
          </div>
        </SectionCard>

        <SectionCard icon={UserGroupIcon} iconBg="bg-slate-100" iconColor="text-slate-600" title="System Users" linkTo="/users">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center shrink-0">
              <p className="text-2xl font-bold text-slate-700">{users.total || 0}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Total Users</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {(users.by_role || []).slice(0, 6).map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-24 truncate capitalize">{r.role?.replace(/_/g,' ')}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className="bg-slate-400 h-1.5 rounded-full" style={{ width: `${users.total > 0 ? (r.count/users.total)*100 : 0}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 w-3 text-right">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Project Health Scorecard ─────────────────────────────────────────── */}
      {portfolio && portfolio.project_cards?.length > 0 && (
        <div>
          <SectionHeading icon={ChartBarIcon} iconBg="bg-violet-100" iconColor="text-violet-600" title="Project Health Scorecard" />
          <div className="flex items-center justify-end gap-4 -mt-2 mb-3 text-[10px] text-gray-400">
            <span>Total Portfolio: <strong className="text-gray-700">{fmtK(portfolio.totals?.total_contract_value)}</strong></span>
            <span className="text-green-600 font-semibold">IPC Certified: {fmtK(portfolio.ipc?.certified)}</span>
            <span className="text-amber-600 font-semibold">IPC Paid: {fmtK(portfolio.ipc?.paid)}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {portfolio.project_cards.map(p => {
              const pct = p.pct_complete ?? (p.bac > 0 ? Math.round((p.ev / p.bac) * 100) : 0)
              const borderColor = p.cpi == null ? 'border-gray-200' : p.cpi >= 1.0 ? 'border-green-200' : p.cpi >= 0.9 ? 'border-amber-200' : 'border-red-200'
              const bgColor     = p.cpi == null ? 'bg-white' : p.cpi >= 1.0 ? 'bg-green-50/50' : p.cpi >= 0.9 ? 'bg-amber-50/50' : 'bg-red-50/50'
              return (
                <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                  className={`border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all ${borderColor} ${bgColor}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold text-brand-slate bg-brand-slate/10 px-1.5 py-0.5 rounded">{p.code}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status?.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs font-semibold text-brand-slate truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{fmtK(p.contract_value)}</p>
                    </div>
                    <div className="shrink-0 ml-2 text-right">
                      <p className="text-[10px] text-gray-400">CPI</p>
                      <IndexBadge value={p.cpi} />
                      <p className="text-[10px] text-gray-400 mt-1">SPI</p>
                      <IndexBadge value={p.spi} />
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-red rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-3 text-[10px] text-gray-500">
                    <span>EV: <strong className="text-gray-700">{fmtK(p.ev)}</strong></span>
                    <span>AC: <strong className="text-gray-700">{fmtK(p.ac)}</strong></span>
                    <span>BAC: <strong className="text-gray-700">{fmtK(p.bac)}</strong></span>
                  </div>
                </div>
              )
            })}
          </div>
          {portfolio.risks?.open > 0 && (
            <div className="mt-2 flex gap-2">
              <AlertPill count={portfolio.risks.open}  label="open risks"         color="bg-amber-100 text-amber-800" onClick={() => navigate('/projects')} />
              {portfolio.risks.high > 0 && <AlertPill count={portfolio.risks.high} label="high-impact risks" color="bg-red-100 text-red-700" onClick={() => navigate('/projects')} />}
            </div>
          )}
        </div>
      )}

      {/* ── CRM Pipeline ─────────────────────────────────────────────────────── */}
      {crmPipeline && (
        <div>
          <SectionHeading icon={UserGroupIcon} iconBg="bg-emerald-100" iconColor="text-emerald-600" title="CRM Pipeline" />
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Weighted Pipeline', value: fmtK(crmPipeline.weighted_pipeline_value), color: 'text-emerald-700' },
                { label: 'Win Rate',           value: crmPipeline.win_rate != null ? `${(crmPipeline.win_rate * 100).toFixed(1)}%` : '—', color: 'text-blue-700' },
                { label: 'Won Value',          value: fmtK(crmPipeline.by_stage?.won?.total_estimated_value), color: 'text-green-700' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {['prospect', 'qualified', 'bid_prep', 'submitted', 'won', 'lost'].map(stage => {
                const s = crmPipeline.by_stage?.[stage] || { count: 0, total_estimated_value: 0 }
                const COLORS = { prospect: 'bg-gray-400', qualified: 'bg-blue-500', bid_prep: 'bg-amber-500', submitted: 'bg-purple-500', won: 'bg-green-500', lost: 'bg-red-400' }
                const LABELS = { prospect: 'Prospect', qualified: 'Qualified', bid_prep: 'Bid Prep', submitted: 'Submitted', won: 'Won', lost: 'Lost' }
                const allVals = ['prospect','qualified','bid_prep','submitted','won','lost'].map(k => Number(crmPipeline.by_stage?.[k]?.total_estimated_value || 0))
                const maxVal = Math.max(...allVals, 1)
                const pct = (Number(s.total_estimated_value || 0) / maxVal) * 100
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500 w-20 shrink-0">{LABELS[stage]}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${COLORS[stage]} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-600 w-20 text-right shrink-0">{fmtK(s.total_estimated_value)}</span>
                    <span className="text-[10px] text-gray-400 w-12 text-right shrink-0">{s.count} deal{s.count !== 1 ? 's' : ''}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-right">
              <button onClick={() => navigate('/crm')} className="text-[10px] text-emerald-600 font-semibold hover:underline">View CRM →</button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400 text-right">
        Data refreshes every minute · Last updated {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'}
      </p>
    </div>
  )
}
