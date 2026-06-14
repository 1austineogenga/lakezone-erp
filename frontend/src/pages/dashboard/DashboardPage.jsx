import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  FolderIcon, ClipboardDocumentListIcon, CubeIcon,
  TruckIcon, BanknotesIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { getProjects } from '../../api/projects'
import { getPRs } from '../../api/procurement'
import { getStockLevels } from '../../api/inventory'
import { getFleetLive } from '../../api/fleet'
import useAuthStore from '../../store/authStore'

// Fix default leaflet icon paths (broken in bundlers)
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

const STATUS_COLORS = {
  active: '#16a34a', planning: '#6b7280', on_hold: '#d97706',
  completed: '#2563eb', suspended: '#dc2626',
}

const PIE_COLORS = ['#BF2026', '#6b7280', '#d97706', '#2563eb']

function StatCard({ label, value, sub, icon: Icon, color, onClick }) {
  const colors = {
    red:   { bg: 'bg-red-50',   border: 'border-l-red-500',   text: 'text-red-700',   icon: 'bg-red-100 text-red-600' },
    slate: { bg: 'bg-slate-50', border: 'border-l-slate-500', text: 'text-slate-700', icon: 'bg-slate-100 text-slate-600' },
    green: { bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-700', icon: 'bg-green-100 text-green-600' },
    blue:  { bg: 'bg-blue-50',  border: 'border-l-blue-500',  text: 'text-blue-700',  icon: 'bg-blue-100 text-blue-600' },
    amber: { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700', icon: 'bg-amber-100 text-amber-600' },
    teal:  { bg: 'bg-teal-50',  border: 'border-l-teal-500',  text: 'text-teal-700',  icon: 'bg-teal-100 text-teal-600' },
  }
  const c = colors[color] || colors.slate
  return (
    <div
      onClick={onClick}
      className={`${c.bg} border border-gray-200 border-l-4 ${c.border} rounded-xl p-4 flex items-start gap-3 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className={`${c.icon} p-2 rounded-lg shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
        <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const { data: projectsRes } = useQuery({ queryKey: ['projects'], queryFn: () => getProjects({ page_size: 100 }) })
  const { data: prsRes }      = useQuery({ queryKey: ['prs'],      queryFn: () => getPRs({ page_size: 100 }) })
  const { data: levelsRes }   = useQuery({ queryKey: ['levels'],   queryFn: () => getStockLevels({ page_size: 100 }) })
  const { data: fleetRes }    = useQuery({ queryKey: ['fleet-live'], queryFn: getFleetLive, refetchInterval: 60000 })

  const projectList = projectsRes?.data?.results ?? []
  const prList      = prsRes?.data?.results ?? []
  const levelList   = levelsRes?.data?.results ?? []
  const vehicles    = fleetRes?.data ?? []

  const activeProjects  = projectList.filter(p => p.status === 'active')
  const pendingPRs      = prList.filter(p => p.status === 'pending').length
  const lowStock        = levelList.filter(l => l.is_below_reorder).length
  const onlineVehicles  = vehicles.filter(v => v.is_online).length
  const totalContractValue = activeProjects.reduce((s, p) => s + Number(p.contract_value || 0), 0)

  const statusChartData = [
    { name: 'Active',    count: projectList.filter(p => p.status === 'active').length },
    { name: 'Planning',  count: projectList.filter(p => p.status === 'planning').length },
    { name: 'Completed', count: projectList.filter(p => p.status === 'completed').length },
    { name: 'On Hold',   count: projectList.filter(p => p.status === 'on_hold').length },
  ].filter(d => d.count > 0)

  const projectsWithCoords = projectList.filter(p => p.latitude && p.longitude)
  const vehiclesWithCoords = vehicles.filter(v => v.last_latitude && v.last_longitude)

  const mapCenter = projectsWithCoords.length > 0
    ? [Number(projectsWithCoords[0].latitude), Number(projectsWithCoords[0].longitude)]
    : [-0.73, 36.70]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-brand-slate">Welcome, {user?.first_name ?? 'User'}</h1>
        <p className="text-xs text-gray-400 mt-0.5">Here's what's happening at Lake Zone Enterprises today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard label="Active Projects"    value={activeProjects.length}  icon={FolderIcon}                sub={`${projectList.length} total`}                color="red"   onClick={() => navigate('/projects?status=active')} />
        <StatCard label="Contract Value"     value={`KES ${(totalContractValue / 1e6).toFixed(1)}M`}        icon={BanknotesIcon}                               sub="Active projects"      color="teal"  onClick={() => navigate('/projects')} />
        <StatCard label="Fleet Online"       value={`${onlineVehicles} / ${vehicles.length}`}              icon={TruckIcon}                                   sub="Live GPS vehicles"    color="blue"  onClick={() => navigate('/fleet')} />
        <StatCard label="Pending PRs"        value={pendingPRs}             icon={ClipboardDocumentListIcon} sub="Awaiting approval"                            color="slate" onClick={() => navigate('/procurement')} />
        <StatCard label="Low Stock Alerts"   value={lowStock}               icon={CubeIcon}                 sub="Below reorder level"                          color="amber" onClick={() => navigate('/inventory')} />
        <StatCard label="Open Risks"         value={0}                      icon={ExclamationTriangleIcon}  sub="Across all projects"                          color="red"   onClick={() => navigate('/projects')} />
      </div>

      {/* Live Map */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-brand-slate text-sm">Live Operations Map</h3>
            <p className="text-xs text-gray-400 mt-0.5">Fleet vehicles and project sites</p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Vehicle
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> Project Site
            </span>
          </div>
        </div>
        <div style={{ height: 420 }}>
          <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Project markers */}
            {projectsWithCoords.map(p => (
              <Marker key={p.id} position={[Number(p.latitude), Number(p.longitude)]} icon={projectIcon}>
                <Tooltip permanent direction="top" offset={[0, -38]} className="text-xs font-semibold">
                  {p.code}
                </Tooltip>
                <Popup>
                  <div className="text-xs space-y-1 min-w-[160px]">
                    <p className="font-bold text-sm">{p.code} — {p.name}</p>
                    <p className="text-gray-500">{p.client}</p>
                    <p>Status: <span className="font-medium capitalize">{p.status.replace('_', ' ')}</span></p>
                    <p>Contract: <span className="font-medium">KES {Number(p.contract_value).toLocaleString()}</span></p>
                    <p className="text-gray-400">{p.location}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Vehicle markers */}
            {vehiclesWithCoords.map(v => (
              <Marker key={v.id} position={[Number(v.last_latitude), Number(v.last_longitude)]} icon={vehicleIcon}>
                <Tooltip permanent direction="top" offset={[0, -38]} className="text-xs font-semibold">
                  {v.vehicle_no}
                </Tooltip>
                <Popup>
                  <div className="text-xs space-y-1 min-w-[140px]">
                    <p className="font-bold text-sm">{v.vehicle_no}</p>
                    <p className="text-gray-500">{v.vehicle_name}</p>
                    <p>Status: <span className={`font-medium ${v.is_online ? 'text-green-600' : 'text-gray-400'}`}>{v.is_online ? 'Online' : 'Offline'}</span></p>
                    {v.last_location && <p className="text-gray-400">{v.last_location}</p>}
                    {v.last_seen_minutes_ago != null && (
                      <p className="text-gray-400">Last seen {v.last_seen_minutes_ago}m ago</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Charts + Active Projects */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Status Pie */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Projects by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusChartData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, count }) => `${name} (${count})`} labelLine={false}>
                {statusChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <ChartTooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Active Projects Table */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Active Projects</h3>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-gray-400 p-8 text-center">No active projects</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Code', 'Name', 'Client', 'Contract Value', 'End Date', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeProjects.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="bg-brand-slate text-white text-xs font-bold px-2 py-0.5 rounded">{p.code}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-brand-slate max-w-[200px] truncate">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{p.client}</td>
                    <td className="px-4 py-3 font-medium">KES {Number(p.contract_value).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{p.end_date || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent PRs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate text-sm">Recent Purchase Requisitions</h3>
          <span className="text-xs text-gray-400">{prList.length} total</span>
        </div>
        {prList.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">No requisitions yet</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Reference', 'Requested By', 'Date', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {prList.slice(0, 5).map(pr => (
                <tr key={pr.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate">{pr.reference_number}</td>
                  <td className="px-4 py-3 text-gray-600">{pr.requested_by_name}</td>
                  <td className="px-4 py-3 text-gray-500">{pr.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      pr.status === 'approved' ? 'bg-green-100 text-green-700' :
                      pr.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                      pr.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{pr.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
