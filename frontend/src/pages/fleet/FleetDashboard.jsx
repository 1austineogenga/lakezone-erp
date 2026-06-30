import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  TruckIcon, BoltIcon, ExclamationTriangleIcon, BeakerIcon,
  ArrowPathIcon, MapPinIcon, ClockIcon, FireIcon,
  CheckCircleIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { getFleetDashboard, getFleetLive, forceSync } from '../../api/fleet'

const STATUS_DOT   = { MOVING: 'bg-green-500', IDLE: 'bg-amber-400', STOP: 'bg-gray-300', INACTIVE: 'bg-red-400' }
const STATUS_LABEL = { MOVING: 'Moving', IDLE: 'Idling', STOP: 'Stopped', INACTIVE: 'Offline' }
const STATUS_PILL  = {
  MOVING:   'bg-green-100 text-green-700',
  IDLE:     'bg-amber-100 text-amber-700',
  STOP:     'bg-gray-100 text-gray-500',
  INACTIVE: 'bg-red-100 text-red-600',
}
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

function StatCard({ icon: Icon, label, value, color, bg, sub }) {
  return (
    <div className={`${bg} rounded-2xl p-4 flex flex-col gap-1`}>
      <div className={`${color} w-8 h-8 rounded-xl flex items-center justify-center bg-white/60 mb-1`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      {sub && <p className="text-[10px] text-gray-600">{sub}</p>}
    </div>
  )
}

export default function FleetDashboard() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: dash } = useQuery({
    queryKey: ['fleet-dashboard'],
    queryFn: getFleetDashboard,
    select: r => r.data,
    refetchInterval: 120_000,
  })

  const { data: live = [] } = useQuery({
    queryKey: ['fleet-live'],
    queryFn: getFleetLive,
    select: r => r.data?.results ?? r.data ?? [],
    refetchInterval: 120_000,
  })

  const alerts = dash?.recent_alerts ?? []

  const syncMut = useMutation({
    mutationFn: forceSync,
    onSuccess: d => {
      const count = d.data.vehicles?.length ?? d.data.synced ?? 0
      toast.success(`Sync complete — ${count} vehicles updated.`)
      qc.invalidateQueries({ queryKey: ['fleet-live'] })
      qc.invalidateQueries({ queryKey: ['fleet-dashboard'] })
    },
    onError: () => toast.error('Sync failed. Check API config in Fleet Settings.'),
  })

  const totalVehicles  = live.length || dash?.total_vehicles || 0
  const onlineCount    = live.filter(v => v.last_seen_minutes_ago != null && v.last_seen_minutes_ago < 10).length
  const movingCount    = live.filter(v => v.last_status === 'MOVING').length
  const lowFuelCount   = live.filter(v => v.last_fuel != null && Number(v.last_fuel) < 30).length
  const unreadAlerts   = dash?.unacknowledged_alerts ?? 0

  const idleHoursToday   = Number(dash?.idle_hours_today ?? 0)
  const fuelFilledToday  = Number(dash?.fuel_filled_today ?? 0)
  const fuelDrainedToday = Number(dash?.fuel_drained_today ?? 0)

  const statusGroups = live.reduce((acc, v) => {
    const s = v.last_status || 'INACTIVE'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  const STATUS_COLOR = { MOVING: '#22c55e', IDLE: '#f59e0b', STOP: '#9ca3af', INACTIVE: '#f87171' }
  const statusChartData = Object.entries(statusGroups).map(([name, value]) => ({
    name: STATUS_LABEL[name] || name, value, color: STATUS_COLOR[name] || '#9ca3af',
  }))

  const fmtTime = mins => {
    if (mins == null) return '—'
    if (mins < 2) return 'Just now'
    if (mins < 60) return `${Math.round(mins)}m ago`
    return `${Math.round(mins / 60)}h ago`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Fleet Overview</h2>
          <p className="text-xs text-gray-600 mt-0.5">Live · refreshes every 2 min</p>
        </div>
        <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 transition-opacity">
          <ArrowPathIcon className={`h-3.5 w-3.5 ${syncMut.isPending ? 'animate-spin' : ''}`} />
          {syncMut.isPending ? 'Syncing…' : 'Force Sync'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard icon={TruckIcon}               label="Total Vehicles"    value={totalVehicles}                    color="text-slate-600"   bg="bg-slate-100" />
        <StatCard icon={BoltIcon}                label="Online"            value={onlineCount}                      color="text-green-600"   bg="bg-green-100" sub="last 10 min" />
        <StatCard icon={MapPinIcon}              label="Moving Now"        value={movingCount}                      color="text-blue-600"    bg="bg-blue-100" />
        <StatCard icon={ExclamationTriangleIcon} label="Unread Alerts"     value={unreadAlerts}                     color="text-red-600"     bg="bg-red-100" />
        <StatCard icon={BeakerIcon}              label="Low Fuel"          value={lowFuelCount}                     color="text-orange-600"  bg="bg-orange-100" sub="<30L" />
        <StatCard icon={ClockIcon}               label="Idle Today"        value={`${idleHoursToday.toFixed(1)}h`}  color="text-amber-600"   bg="bg-amber-100" />
        <StatCard icon={FireIcon}                label="Fuel Filled"       value={`${fuelFilledToday.toFixed(0)}L`} color="text-emerald-600" bg="bg-emerald-100" sub="today" />
        <StatCard icon={BeakerIcon}              label="Fuel Drained"      value={`${fuelDrainedToday.toFixed(0)}L`} color="text-purple-600" bg="bg-purple-100" sub="today" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-brand-slate text-sm">Live Vehicle Status</h3>
            <button onClick={() => navigate('/fleet/vehicles')} className="text-xs text-brand-red hover:underline flex items-center gap-0.5">
              View all <ChevronRightIcon className="h-3 w-3" />
            </button>
          </div>
          {live.length === 0 ? (
            <div className="p-12 text-center">
              <TruckIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-600">No live data.</p>
              <button onClick={() => syncMut.mutate()} className="mt-2 text-xs text-brand-red hover:underline">Force sync</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {live.map(v => (
                <div key={v.id} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                  className="px-5 py-3.5 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[v.last_status] || 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-brand-slate">{v.vehicle_no}</p>
                      {v.vehicle_name && <p className="text-xs text-gray-600 truncate">{v.vehicle_name}</p>}
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-0.5">{v.last_location || '—'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[v.last_status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[v.last_status] || '—'}
                    </span>
                    <div className="text-right text-xs w-20">
                      <p className="text-gray-600 font-medium">{v.last_speed != null ? `${Number(v.last_speed).toFixed(0)} km/h` : '—'}</p>
                      <p className="text-gray-600">{v.last_fuel != null ? `⛽ ${Number(v.last_fuel).toFixed(0)}L` : '—'}</p>
                    </div>
                    <p className="text-[10px] text-gray-600 w-14 text-right">{fmtTime(v.last_seen_minutes_ago)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-brand-slate text-sm">Active Alerts</h3>
            <button onClick={() => navigate('/fleet/alerts')} className="text-xs text-brand-red hover:underline flex items-center gap-0.5">
              View all <ChevronRightIcon className="h-3 w-3" />
            </button>
          </div>
          {alerts.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircleIcon className="h-10 w-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">All clear</p>
              <p className="text-xs text-gray-600 mt-0.5">No active alerts</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {alerts.map(a => (
                <div key={a.id} className={`border-l-4 px-4 py-3 ${SEV_STYLE[a.severity] || 'border-l-gray-300 bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
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

      {statusChartData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Fleet Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={statusChartData} barSize={40}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
