import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  FolderIcon, ClipboardDocumentListIcon, CubeIcon, TruckIcon,
  BanknotesIcon, ExclamationTriangleIcon, UsersIcon, BeakerIcon,
  MapPinIcon, ClockIcon, ChevronRightIcon, CheckCircleIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, ShieldExclamationIcon,
} from '@heroicons/react/24/outline'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid,
} from 'recharts'
import { getProjects } from '../../api/projects'
import { getPRs } from '../../api/procurement'
import { getStockLevels } from '../../api/inventory'
import { getFleetLive, getFleetDashboard } from '../../api/fleet'
import { getFinanceDashboard } from '../../api/finance'
import { getHRDashboard } from '../../api/hr'
import useAuthStore from '../../store/authStore'
import usePermissions from '../../hooks/usePermissions'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const projectIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})
const vehicleIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

const PIE_COLORS   = ['#BF2026', '#6b7280', '#d97706', '#2563eb', '#dc2626']
const STATUS_DOT   = { MOVING: 'bg-green-500', IDLE: 'bg-amber-400', STOP: 'bg-gray-300', INACTIVE: 'bg-red-400' }
const STATUS_PILL  = { MOVING: 'bg-green-100 text-green-700', IDLE: 'bg-amber-100 text-amber-700', STOP: 'bg-gray-100 text-gray-500', INACTIVE: 'bg-red-100 text-red-600' }
const STATUS_LABEL = { MOVING: 'Moving', IDLE: 'Idling', STOP: 'Stopped', INACTIVE: 'Offline' }

const SEV_STYLE = {
  critical: 'border-l-red-500 bg-red-50',
  high:     'border-l-orange-400 bg-orange-50',
  medium:   'border-l-amber-400 bg-amber-50',
  low:      'border-l-blue-400 bg-blue-50',
}
const SEV_BADGE = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-blue-100 text-blue-700',
}

const PROJECT_STATUS_STYLE = {
  active:    'bg-green-100 text-green-700',
  planning:  'bg-gray-100 text-gray-600',
  on_hold:   'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
}

function KpiCard({ icon: Icon, label, value, sub, bg, color, trend, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`${bg} rounded-2xl p-4 flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className={`${color} w-8 h-8 rounded-xl flex items-center justify-center bg-white/60 mb-1`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      {sub && <p className="text-[10px] text-gray-600">{sub}</p>}
      {trend != null && (
        <div className={`flex items-center gap-0.5 text-[10px] font-medium mt-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0
            ? <ArrowTrendingUpIcon className="h-3 w-3" />
            : <ArrowTrendingDownIcon className="h-3 w-3" />}
          {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, sub, action, onAction }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-brand-slate text-sm">{title}</h3>
        {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
      </div>
      {action && (
        <button onClick={onAction} className="text-xs text-brand-red hover:underline flex items-center gap-0.5">
          {action} <ChevronRightIcon className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-gray-50 rounded-2xl p-4 animate-pulse">
      <div className="w-8 h-8 bg-gray-200 rounded-xl mb-3" />
      <div className="h-6 bg-gray-200 rounded w-16 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-24" />
    </div>
  )
}

const fmtK  = n => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : String(n)
const fmtTime = mins => {
  if (mins == null) return '—'
  if (mins < 2)  return 'Just now'
  if (mins < 60) return `${Math.round(mins)}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { can }  = usePermissions()
  const nav = (module, path) => can(module) ? () => navigate(path) : undefined

  const { data: projectsRes, isLoading: projLoading } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => getProjects({ page_size: 100 }),
  })
  const { data: prsRes }    = useQuery({ queryKey: ['prs'],       queryFn: () => getPRs({ page_size: 100 }) })
  const { data: levelsRes } = useQuery({ queryKey: ['levels'],    queryFn: () => getStockLevels({ page_size: 100 }) })
  const { data: fleetRes }  = useQuery({ queryKey: ['fleet-live'], queryFn: getFleetLive, refetchInterval: 60_000 })
  const { data: fleetDash } = useQuery({ queryKey: ['fleet-dashboard'], queryFn: getFleetDashboard, select: r => r.data, refetchInterval: 120_000 })
  const { data: finance }   = useQuery({ queryKey: ['finance-dashboard'], queryFn: getFinanceDashboard, select: r => r.data })
  const { data: hr }        = useQuery({ queryKey: ['hr-dashboard'],      queryFn: getHRDashboard,      select: r => r.data })

  const projectList = projectsRes?.data?.results ?? []
  const prList      = prsRes?.data?.results ?? []
  const levelList   = levelsRes?.data?.results ?? []
  const vehicles    = Array.isArray(fleetRes?.data) ? fleetRes.data : (fleetRes?.data?.results ?? [])

  const activeProjects      = projectList.filter(p => p.status === 'active')
  const pendingPRs          = prList.filter(p => p.status === 'pending').length
  const approvedPRs         = prList.filter(p => p.status === 'approved').length
  const lowStock            = levelList.filter(l => l.is_below_reorder).length
  const onlineVehicles      = vehicles.filter(v => v.last_seen_minutes_ago != null && v.last_seen_minutes_ago < 10).length
  const movingVehicles      = vehicles.filter(v => v.last_status === 'MOVING').length
  const totalContractValue  = activeProjects.reduce((s, p) => s + Number(p.contract_value || 0), 0)
  const openRisks           = projectList.reduce((s, p) => s + (p.open_risks || 0), 0)
  const unreadAlerts        = fleetDash?.unacknowledged_alerts ?? 0

  const statusChartData = [
    { name: 'Active',    count: projectList.filter(p => p.status === 'active').length },
    { name: 'Planning',  count: projectList.filter(p => p.status === 'planning').length },
    { name: 'On Hold',   count: projectList.filter(p => p.status === 'on_hold').length },
    { name: 'Completed', count: projectList.filter(p => p.status === 'completed').length },
  ].filter(d => d.count > 0)

  const projectsWithCoords = projectList.filter(p => p.latitude && p.longitude)
  const vehiclesWithCoords = vehicles.filter(v => v.last_latitude && v.last_longitude)

  const mapCenter = projectsWithCoords.length > 0
    ? [Number(projectsWithCoords[0].latitude), Number(projectsWithCoords[0].longitude)]
    : [-0.73, 36.70]

  const recentAlerts = fleetDash?.recent_alerts ?? []

  const today     = new Date()
  const hour      = today.getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-brand-slate">{greeting}, {user?.first_name ?? 'there'} 👋</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}Lake Zone Enterprises ERP
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {projLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiCard icon={FolderIcon}               label="Active Projects"  value={activeProjects.length}              bg="bg-red-50"     color="text-red-600"     sub={`${projectList.length} total`}         onClick={nav('projects',    '/projects?status=active')} />

          <KpiCard icon={TruckIcon}                 label="Fleet Online"     value={`${onlineVehicles}/${vehicles.length}`} bg="bg-blue-50" color="text-blue-600"  sub="last 10 min"                           onClick={nav('fleet',       '/fleet')} />
          <KpiCard icon={MapPinIcon}                label="Moving Now"       value={movingVehicles}                     bg="bg-green-50"   color="text-green-600"   sub="live GPS"                              onClick={nav('fleet',       '/fleet/vehicles')} />
          <KpiCard icon={ClipboardDocumentListIcon} label="Pending PRs"      value={pendingPRs}                         bg="bg-amber-50"   color="text-amber-600"   sub={`${approvedPRs} approved`}             onClick={nav('procurement', '/procurement')} />
          <KpiCard icon={CubeIcon}                  label="Low Stock"        value={lowStock}                           bg="bg-orange-50"  color="text-orange-600"  sub="below reorder"                         onClick={nav('inventory',   '/inventory')} />
          <KpiCard icon={ExclamationTriangleIcon}   label="Fleet Alerts"     value={unreadAlerts}                       bg="bg-rose-50"    color="text-rose-600"    sub="unacknowledged"                        onClick={nav('fleet',       '/fleet/alerts')} />
          <KpiCard icon={UsersIcon}                 label="Employees"        value={hr?.total_employees ?? '—'}         bg="bg-purple-50"  color="text-purple-600"  sub={hr?.on_leave != null ? `${hr.on_leave} on leave` : undefined} onClick={nav('hr', '/hr')} />
        </div>
      )}

      {/* ── Finance Strip ── */}
      {finance && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1">Revenue (MTD)</p>
            <p className="text-lg font-bold text-emerald-600">KES {fmtK(finance.revenue_mtd ?? finance.total_invoiced ?? 0)}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1">Expenses (MTD)</p>
            <p className="text-lg font-bold text-red-500">KES {fmtK(finance.expenses_mtd ?? finance.total_expenses ?? 0)}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1">Outstanding Invoices</p>
            <p className="text-lg font-bold text-amber-600">KES {fmtK(finance.outstanding_invoices ?? finance.total_outstanding ?? 0)}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1">Overdue Bills</p>
            <p className="text-lg font-bold text-rose-600">KES {fmtK(finance.overdue_bills ?? finance.total_overdue ?? 0)}</p>
          </div>
        </div>
      )}

      {/* ── Live Map ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <SectionHeader
          title="Live Operations Map"
          sub="Fleet vehicles and project sites · updates every minute"
        />
        <div className="flex items-center gap-4 px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Project Site ({projectsWithCoords.length})</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Vehicle ({vehiclesWithCoords.length})</span>
        </div>
        <div style={{ height: 340 }} className="sm:!h-[420px]">
          <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {projectsWithCoords.map(p => (
              <Marker key={p.id} position={[Number(p.latitude), Number(p.longitude)]} icon={projectIcon}>
                <Tooltip permanent direction="top" offset={[0, -38]} className="text-xs font-semibold">{p.code}</Tooltip>
                <Popup>
                  <div className="text-xs space-y-1 min-w-[160px]">
                    <p className="font-bold text-sm">{p.code} — {p.name}</p>
                    <p className="text-gray-600">{p.client}</p>
                    <p>Status: <span className="font-medium capitalize">{p.status?.replace('_', ' ')}</span></p>
                    <p>Contract: <span className="font-medium">KES {Number(p.contract_value || 0).toLocaleString()}</span></p>
                    {p.location && <p className="text-gray-600">{p.location}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
            {vehiclesWithCoords.map(v => (
              <Marker key={v.id} position={[Number(v.last_latitude), Number(v.last_longitude)]} icon={vehicleIcon}>
                <Tooltip permanent direction="top" offset={[0, -38]} className="text-xs font-semibold">{v.vehicle_no}</Tooltip>
                <Popup>
                  <div className="text-xs space-y-1 min-w-[140px]">
                    <p className="font-bold text-sm">{v.vehicle_no}</p>
                    {v.vehicle_name && <p className="text-gray-600">{v.vehicle_name}</p>}
                    <p>Status: <span className={`font-medium ${STATUS_PILL[v.last_status] ? 'capitalize' : 'text-gray-600'}`}>{STATUS_LABEL[v.last_status] || '—'}</span></p>
                    {v.last_location && <p className="text-gray-600">{v.last_location}</p>}
                    <p className="text-gray-600">Last seen: {fmtTime(v.last_seen_minutes_ago)}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* ── Middle Row: Projects pie | Fleet live | Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Projects by Status */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader title="Projects by Status" action="View all" onAction={() => navigate('/projects')} />
          {statusChartData.length === 0 ? (
            <div className="p-10 text-center">
              <FolderIcon className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No projects yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusChartData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {statusChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <ChartTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="px-5 pb-4 space-y-1.5">
                {statusChartData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-600">{d.name}</span>
                    </span>
                    <span className="font-semibold text-brand-slate">{d.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Fleet Live */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader title="Fleet Live" sub="Refreshes every minute" action="View all" onAction={() => navigate('/fleet/vehicles')} />
          {vehicles.length === 0 ? (
            <div className="p-10 text-center">
              <TruckIcon className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No live data</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {vehicles.slice(0, 12).map(v => (
                <div key={v.id} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[v.last_status] || 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-brand-slate">{v.vehicle_no}</p>
                    <p className="text-[10px] text-gray-600 truncate">{v.last_location || v.vehicle_name || '—'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[v.last_status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[v.last_status] || '—'}
                    </span>
                    <p className="text-[10px] text-gray-600 mt-0.5">{fmtTime(v.last_seen_minutes_ago)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fleet Alerts */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader title="Active Alerts" action="View all" onAction={() => navigate('/fleet/alerts')} />
          {recentAlerts.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircleIcon className="h-10 w-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">All clear</p>
              <p className="text-[10px] text-gray-600 mt-0.5">No active fleet alerts</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {recentAlerts.map(a => (
                <div key={a.id} className={`border-l-4 px-4 py-3 ${SEV_STYLE[a.severity] || 'border-l-gray-300 bg-white'}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-brand-slate">{a.vehicle_no || a.vehicle}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEV_BADGE[a.severity] || 'bg-gray-100 text-gray-600'}`}>
                      {a.severity?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{a.message}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{new Date(a.occurred_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row: Active Projects table | Recent PRs ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Active Projects */}
        <div className="xl:col-span-3 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader
            title="Active Projects"
            sub={`${activeProjects.length} running · KES ${fmtK(totalContractValue)} total value`}
            action="All projects"
            onAction={() => navigate('/projects')}
          />
          {activeProjects.length === 0 ? (
            <p className="text-sm text-gray-600 p-8 text-center">No active projects</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    {['Code', 'Name', 'Client', 'Value', 'End Date', 'Status'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeProjects.map(p => (
                    <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <span className="bg-brand-slate text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">{p.code}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-brand-slate max-w-[160px] truncate">{p.name}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[110px] truncate">{p.client || '—'}</td>
                      <td className="px-4 py-3 font-medium text-emerald-700">KES {fmtK(Number(p.contract_value || 0))}</td>
                      <td className="px-4 py-3 text-gray-600">{p.end_date || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${PROJECT_STATUS_STYLE[p.status] || 'bg-gray-100 text-gray-600'}`}>
                          {p.status?.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent PRs */}
        <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader
            title="Recent Purchase Requisitions"
            sub={`${pendingPRs} pending approval`}
            action="View all"
            onAction={() => navigate('/procurement')}
          />
          {prList.length === 0 ? (
            <p className="text-sm text-gray-600 p-8 text-center">No requisitions yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {prList.slice(0, 8).map(pr => (
                <div key={pr.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-brand-slate">{pr.reference_number}</p>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${
                      pr.status === 'approved' ? 'bg-green-100 text-green-700' :
                      pr.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                      pr.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{pr.status}</span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-0.5">{pr.requested_by_name} · {pr.created_at?.slice(0, 10)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
