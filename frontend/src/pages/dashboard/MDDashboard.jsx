import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getMDDashboard } from '../../api/auth'
import { getPortfolioSummary } from '../../api/projects'
import {
  BanknotesIcon, FolderIcon, TruckIcon, UsersIcon,
  ClipboardDocumentListIcon, CubeIcon, ChartBarIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon,
  CheckCircleIcon, ExclamationTriangleIcon,
  MapPinIcon, ShieldCheckIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'

const fmtK = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `KES ${(v / 1_000).toFixed(0)}K`
  return `KES ${v.toLocaleString()}`
}

// ── Solid-color KPI card (same style as original Finance Overview) ────────────
function KpiCard({ label, value, sub, subOk, bg, to, icon: Icon }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={to ? () => navigate(to) : undefined}
      className={`relative overflow-hidden ${bg} rounded-xl p-4 shadow-md ${to ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all' : ''}`}
    >
      {Icon && <Icon className="absolute top-3 right-3 h-5 w-5 text-white/20" />}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && (
        <p className={`text-xs mt-0.5 font-medium ${
          subOk == null ? 'text-white/60' : subOk ? 'text-white/80' : 'text-yellow-200'
        }`}>{sub}</p>
      )}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ icon: Icon, iconBg, iconColor, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`p-1.5 rounded-lg ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</h2>
    </div>
  )
}

// ── Detail card (white, for tables / lists / pipeline charts) ─────────────────
function DetailCard({ title, linkTo, children }) {
  const navigate = useNavigate()
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <h3 className="font-semibold text-brand-slate text-sm">{title}</h3>
        {linkTo && (
          <button onClick={() => navigate(linkTo)} className="text-xs text-brand-red hover:underline">View all →</button>
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

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[0,1,2,3].map(i => (
          <div key={i}>
            <div className="h-4 bg-gray-100 rounded w-40 mb-3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0,1,2,3].map(j => <div key={j} className="h-24 bg-gray-100 rounded-xl" />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!data) return null

  const { finance = {}, projects = {}, fleet = {}, hr = {}, procurement = {}, requisitions = {}, inventory = {}, users = {} } = data
  const arPct          = finance.collection_rate || 0
  const fleetPct       = fleet.total > 0 ? Math.round((fleet.online / fleet.total) * 100) : 0
  const attendancePct  = hr.total_employees > 0 ? Math.round(((hr.present_today || 0) / hr.total_employees) * 100) : 0
  const assetPct       = inventory.total_assets > 0 ? Math.round(((inventory.active_assets || 0) / inventory.total_assets) * 100) : 0
  const reqApprovalPct = requisitions.total_mtd > 0 ? Math.round(((requisitions.approved || 0) / requisitions.total_mtd) * 100) : 0

  return (
    <div className="space-y-8">

      {/* ── Operational Pulse ────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={ChartBarIcon} iconBg="bg-slate-100" iconColor="text-slate-600" title="Operational Pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard label="Fleet Online"   value={`${fleet.online||0}/${fleet.total||0}`}                        sub={`${fleetPct}% availability`}       subOk={fleetPct >= 60}       bg={fleetPct >= 60 ? 'bg-cyan-600' : 'bg-red-600'}      to="/fleet/vehicles"     icon={TruckIcon} />
          <KpiCard label="Attendance"     value={`${hr.present_today||0}/${hr.total_employees||0}`}             sub={`${attendancePct}% present`}       subOk={attendancePct >= 80}  bg={attendancePct >= 80 ? 'bg-green-600' : 'bg-amber-500'} to="/hr/attendance"    icon={UsersIcon} />
          <KpiCard label="Asset Health"   value={`${inventory.active_assets||0}/${inventory.total_assets||0}`} sub={`${assetPct}% operational`}        subOk={assetPct >= 80}       bg={assetPct >= 80 ? 'bg-orange-500' : 'bg-red-600'}    to="/assets"             icon={ShieldCheckIcon} />
          <KpiCard label="Req Approval"   value={`${requisitions.approved||0}/${requisitions.total_mtd||0}`}   sub={`${reqApprovalPct}% approved MTD`} subOk={reqApprovalPct >= 50} bg="bg-violet-600"                                       to="/requisitions"       icon={DocumentTextIcon} />
          <KpiCard label="AR Collection"  value={`${arPct}%`}                                                  sub="collected"                         subOk={arPct >= 70}          bg={arPct >= 70 ? 'bg-blue-600' : 'bg-red-600'}         to="/finance/invoices"   icon={BanknotesIcon} />
        </div>
      </div>

      {/* ── Finance ──────────────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={BanknotesIcon} iconBg="bg-blue-100" iconColor="text-blue-600" title="Finance Overview" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Total Revenue (AR)"  value={fmtK(finance.ar_billed)}      sub={`${arPct}% collected`}                                                          subOk={arPct >= 70}              bg="bg-blue-600"    to="/finance/invoices" icon={ArrowTrendingUpIcon} />
          <KpiCard label="Cash Received"        value={fmtK(finance.ar_received)}    sub="from clients"                                                                    subOk={null}                     bg="bg-emerald-600" to="/finance/payments" icon={CheckCircleIcon} />
          <KpiCard label="AR Outstanding"       value={fmtK(finance.ar_outstanding)} sub={finance.ar_overdue > 0 ? `${fmtK(finance.ar_overdue)} overdue` : 'No overdue'}  subOk={finance.ar_overdue === 0} bg="bg-amber-500"   to="/finance/aged"    icon={ExclamationTriangleIcon} />
          <KpiCard label="AP Outstanding"       value={fmtK(finance.ap_outstanding)} sub={finance.ap_overdue > 0 ? `${fmtK(finance.ap_overdue)} overdue` : 'All current'} subOk={finance.ap_overdue === 0} bg="bg-rose-600"    to="/finance/bills"   icon={ArrowTrendingDownIcon} />
        </div>
      </div>

      {/* ── Projects ─────────────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={FolderIcon} iconBg="bg-violet-100" iconColor="text-violet-600" title="Projects" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <KpiCard label="Active Projects"   value={projects.active    || 0} sub={`${(projects.active||0) + (projects.on_hold||0) + (projects.completed||0)} total`} subOk={null} bg="bg-violet-600" to="/projects?status=active" icon={FolderIcon} />
          <KpiCard label="On Hold"           value={projects.on_hold   || 0} sub="paused"                                                                             subOk={null} bg="bg-amber-500"  to="/projects?status=on_hold" icon={ExclamationTriangleIcon} />
          <KpiCard label="Completed"         value={projects.completed || 0} sub="finished"                                                                           subOk={null} bg="bg-green-600"  to="/projects?status=completed" icon={CheckCircleIcon} />
          <KpiCard label="Portfolio Value"   value={fmtK(portfolio?.totals?.total_contract_value)} sub="total contract"                                               subOk={null} bg="bg-indigo-600" to="/projects" icon={ChartBarIcon} />
        </div>
        {projects.recent?.length > 0 && (
          <DetailCard title="Recent Projects" linkTo="/projects">
            {projects.recent.slice(0, 4).map(p => (
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
            ))}
          </DetailCard>
        )}
      </div>

      {/* ── Fleet ────────────────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={TruckIcon} iconBg="bg-cyan-100" iconColor="text-cyan-600" title="Fleet" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Fleet Online"   value={`${fleet.online||0}/${fleet.total||0}`} sub={`${fleetPct}% availability`}      subOk={fleetPct >= 60}  bg="bg-cyan-600"   to="/fleet/vehicles" icon={TruckIcon} />
          <KpiCard label="Moving Now"     value={fleet.moving  || 0}                      sub="live GPS"                         subOk={null}            bg="bg-green-600"  to="/fleet/vehicles" icon={MapPinIcon} />
          <KpiCard label="Idle / Stopped" value={(fleet.idle||0) + (fleet.stopped||0)}   sub={`${fleet.idle||0} idle · ${fleet.stopped||0} stopped`} subOk={null} bg="bg-slate-500" to="/fleet/vehicles" icon={ExclamationTriangleIcon} />
          <KpiCard label="Fleet Alerts"   value={fleet.alerts_unacked || 0}               sub={fleet.low_fuel > 0 ? `${fleet.low_fuel} low fuel` : 'Fuel OK'} subOk={fleet.alerts_unacked === 0} bg="bg-rose-600" to="/fleet/alerts" icon={ExclamationTriangleIcon} />
        </div>
      </div>

      {/* ── HR ───────────────────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={UsersIcon} iconBg="bg-indigo-100" iconColor="text-indigo-600" title="Human Resources" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Total Workforce"   value={hr.total_employees || 0}       sub={`${hr.staff||0} staff · ${hr.casuals||0} casual`}         subOk={null}                             bg="bg-indigo-600" to="/hr/employees"  icon={UsersIcon} />
          <KpiCard label="Present Today"     value={hr.present_today   || 0}       sub={`${attendancePct}% attendance`}                            subOk={attendancePct >= 80}              bg="bg-green-600"  to="/hr/attendance" icon={CheckCircleIcon} />
          <KpiCard label="On Leave"          value={hr.on_leave_today  || 0}       sub="today"                                                     subOk={null}                             bg="bg-amber-500"  to="/hr/leave"      icon={ExclamationTriangleIcon} />
          <KpiCard label="Pending Leaves"    value={hr.pending_leaves  || 0}       sub={hr.expiring_contracts > 0 ? `${hr.expiring_contracts} expiring contracts` : 'Contracts OK'} subOk={hr.pending_leaves === 0} bg="bg-purple-600" to="/hr/leave" icon={DocumentTextIcon} />
        </div>
      </div>

      {/* ── Procurement & Requisitions ───────────────────────────────────────── */}
      <div>
        <SectionHeading icon={ClipboardDocumentListIcon} iconBg="bg-purple-100" iconColor="text-purple-600" title="Procurement & Requisitions" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Pending PRs"       value={procurement.pending_prs  || 0} sub="awaiting approval"                                        subOk={procurement.pending_prs === 0}   bg="bg-amber-500"  to="/procurement"   icon={ClipboardDocumentListIcon} />
          <KpiCard label="Approved PRs"      value={procurement.approved_prs || 0} sub="this period"                                              subOk={null}                             bg="bg-green-600"  to="/procurement"   icon={CheckCircleIcon} />
          <KpiCard label="Open PO Value"     value={fmtK(procurement.po_value_open)} sub={`${procurement.open_pos||0} open POs`}                  subOk={null}                             bg="bg-blue-600"   to="/procurement"   icon={ArrowTrendingUpIcon} />
          <KpiCard label="Requisitions MTD"  value={requisitions.total_mtd   || 0} sub={`${requisitions.pending||0} pending · ${reqApprovalPct}% approved`} subOk={requisitions.pending === 0} bg="bg-violet-600" to="/requisitions" icon={DocumentTextIcon} />
        </div>
      </div>

      {/* ── Inventory & Assets ───────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={CubeIcon} iconBg="bg-orange-100" iconColor="text-orange-600" title="Inventory & Assets" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Stock Items"       value={inventory.total_items   || 0} sub="total SKUs"                                                subOk={null}                             bg="bg-orange-500" to="/inventory"  icon={CubeIcon} />
          <KpiCard label="Low Stock"         value={inventory.low_stock     || 0} sub="below reorder level"                                       subOk={inventory.low_stock === 0}        bg="bg-red-600"    to="/inventory"  icon={ExclamationTriangleIcon} />
          <KpiCard label="Total Assets"      value={inventory.total_assets  || 0} sub={`${inventory.active_assets||0} operational`}              subOk={null}                             bg="bg-teal-600"   to="/assets"     icon={ShieldCheckIcon} />
          <KpiCard label="Asset Health"      value={`${assetPct}%`}              sub={inventory.under_repair > 0 ? `${inventory.under_repair} under repair` : 'All operational'} subOk={assetPct >= 80} bg="bg-emerald-600" to="/assets" icon={CheckCircleIcon} />
        </div>
      </div>


      {/* ── Project Health Scorecard ──────────────────────────────────────────── */}
      {portfolio && portfolio.project_cards?.length > 0 && (
        <div>
          <SectionHeading icon={ChartBarIcon} iconBg="bg-violet-100" iconColor="text-violet-600" title="Project Health Scorecard" />
          <div className="flex items-center justify-end gap-4 -mt-2 mb-3 text-[10px] text-gray-400">
            <span>Portfolio: <strong className="text-gray-700">{fmtK(portfolio.totals?.total_contract_value)}</strong></span>
            <span className="text-green-600 font-semibold">IPC Certified: {fmtK(portfolio.ipc?.certified)}</span>
            <span className="text-amber-600 font-semibold">IPC Paid: {fmtK(portfolio.ipc?.paid)}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {portfolio.project_cards.map(p => {
              const pct = p.pct_complete ?? (p.bac > 0 ? Math.round((p.ev / p.bac) * 100) : 0)
              const cpiColor = p.cpi == null ? 'border-gray-200 bg-white' : p.cpi >= 1.0 ? 'border-green-200 bg-green-50' : p.cpi >= 0.9 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'
              return (
                <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                  className={`border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all ${cpiColor}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold text-brand-slate bg-brand-slate/10 px-1.5 py-0.5 rounded">{p.code}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status?.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs font-semibold text-brand-slate truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{fmtK(p.contract_value)}</p>
                    </div>
                    <div className="shrink-0 ml-2 text-right">
                      <p className="text-[10px] text-gray-400">CPI</p>
                      {(() => { const color = p.cpi == null ? 'bg-gray-100 text-gray-400' : p.cpi >= 1.0 ? 'bg-green-100 text-green-700' : p.cpi >= 0.9 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'; return p.cpi != null ? <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${color}`}>{p.cpi.toFixed(2)}</span> : <span className="text-gray-400 text-xs">—</span> })()}
                      <p className="text-[10px] text-gray-400 mt-1">SPI</p>
                      {(() => { const color = p.spi == null ? 'bg-gray-100 text-gray-400' : p.spi >= 1.0 ? 'bg-green-100 text-green-700' : p.spi >= 0.9 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'; return p.spi != null ? <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${color}`}>{p.spi.toFixed(2)}</span> : <span className="text-gray-400 text-xs">—</span> })()}
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>Progress</span><span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
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

      <p className="text-[10px] text-gray-400 text-right">
        Data refreshes every minute · Last updated {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'}
      </p>
    </div>
  )
}
