import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  TruckIcon, BoltIcon, ExclamationTriangleIcon, BeakerIcon,
  ArrowPathIcon, MapPinIcon, CheckCircleIcon, ClockIcon, FireIcon,
} from '@heroicons/react/24/outline'
import { getFleetDashboard, getFleetLive, forceSync } from '../../api/fleet'

const STATUS_DOT = {
  MOVING:   'bg-green-500',
  IDLE:     'bg-yellow-400',
  STOP:     'bg-gray-400',
  INACTIVE: 'bg-red-500',
}
const STATUS_LABEL = { MOVING: 'Moving', IDLE: 'Idling', STOP: 'Stopped', INACTIVE: 'Offline' }
const ALERT_SEV = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-blue-100 text-blue-700 border-blue-200',
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

  // recent_alerts is embedded in the dashboard response
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

  // Derive counts from live data so they're always in sync with the vehicle list
  const totalVehicles = live.length || dash?.total_vehicles || 0
  const onlineCount   = live.filter(v => v.last_seen_minutes_ago != null && v.last_seen_minutes_ago < 10).length
  const movingCount   = live.filter(v => v.last_status === 'MOVING').length
  const lowFuelCount  = live.filter(v => v.last_fuel != null && Number(v.last_fuel) < 10).length

  const idleHoursToday  = dash?.idle_hours_today ?? 0
  const fuelFilledToday = dash?.fuel_filled_today ?? 0
  const fuelDrainedToday = dash?.fuel_drained_today ?? 0

  const stats = [
    { label: 'Total Vehicles',   val: totalVehicles,                       icon: TruckIcon,               color: 'text-brand-slate', bg: 'bg-slate-50',   border: 'border-l-4 border-l-slate-400' },
    { label: 'Online (10 min)',   val: onlineCount,                         icon: BoltIcon,                color: 'text-green-600',   bg: 'bg-green-50',   border: 'border-l-4 border-l-green-500' },
    { label: 'Moving Now',        val: movingCount,                         icon: MapPinIcon,              color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-l-4 border-l-blue-500' },
    { label: 'Unread Alerts',     val: dash?.unacknowledged_alerts ?? 0,   icon: ExclamationTriangleIcon, color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-l-4 border-l-red-500' },
    { label: 'Low Fuel (<10%)',   val: lowFuelCount,                        icon: BeakerIcon,              color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-l-4 border-l-orange-500' },
    { label: 'Idle Hours Today',  val: `${Number(idleHoursToday).toFixed(1)}h`,  icon: ClockIcon,         color: 'text-yellow-600',  bg: 'bg-yellow-50',  border: 'border-l-4 border-l-yellow-400' },
    { label: 'Fuel Filled Today', val: `${Number(fuelFilledToday).toFixed(0)}L`,  icon: FireIcon,         color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-l-4 border-l-emerald-500' },
    { label: 'Fuel Drained Today',val: `${Number(fuelDrainedToday).toFixed(0)}L`, icon: BeakerIcon,       color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-l-4 border-l-purple-500' },
  ]

  const statusGroups = live.reduce((acc, v) => {
    const s = v.last_status || 'INACTIVE'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  const STATUS_COLOR = { MOVING: '#22c55e', IDLE: '#facc15', STOP: '#9ca3af', INACTIVE: '#ef4444' }
  const statusChartData = Object.entries(statusGroups).map(([name, value]) => ({
    name: STATUS_LABEL[name] || name, value, color: STATUS_COLOR[name] || '#9ca3af',
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Fleet Dashboard</h2>
          <p className="text-xs text-gray-400 mt-0.5">Live data · auto-refreshes every 2 min</p>
        </div>
        <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
          <ArrowPathIcon className={`h-3.5 w-3.5 ${syncMut.isPending ? 'animate-spin' : ''}`} />
          {syncMut.isPending ? 'Syncing…' : 'Force Sync'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-200 ${s.border} rounded-xl p-4`}>
            <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Live Vehicle Grid */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-brand-slate text-sm">Live Vehicle Status</h3>
            <span className="text-xs text-gray-400">{live.length} vehicles</span>
          </div>
          {live.length === 0 ? (
            <p className="text-sm text-gray-400 p-8 text-center">
              No live data.{' '}
              <button onClick={() => syncMut.mutate()} className="text-brand-red hover:underline">Force sync</button>
              {' '}or check{' '}
              <button onClick={() => navigate('/fleet/settings')} className="text-brand-red hover:underline">Fleet Settings</button>.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
              {live.map(v => (
                <div key={v.id} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                  className="px-5 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-4">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[v.last_status] || 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-slate">{v.vehicle_no}</p>
                    <p className="text-xs text-gray-400 truncate">{v.last_location || '—'}</p>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <p className="font-medium text-gray-700">{STATUS_LABEL[v.last_status] || '—'}</p>
                    <p className="text-gray-400">{v.last_speed != null ? `${Number(v.last_speed).toFixed(1)} km/h` : '—'}</p>
                  </div>
                  <div className="text-right text-xs shrink-0 w-20">
                    <p className="text-gray-600">{v.last_fuel != null ? `⛽ ${Number(v.last_fuel).toFixed(1)}%` : '—'}</p>
                    <p className="text-gray-400">{v.last_odometer ? `${(v.last_odometer / 1000).toFixed(0)} km` : '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alerts Panel */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-brand-slate text-sm">Active Alerts</h3>
            <button onClick={() => navigate('/fleet/alerts')} className="text-xs text-brand-red hover:underline">View all</button>
          </div>
          {alerts.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircleIcon className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">All clear!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
              {alerts.map(a => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border shrink-0 ${ALERT_SEV[a.severity] || ALERT_SEV.low}`}>
                      {a.severity?.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-brand-slate">{a.vehicle_no || a.vehicle}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(a.occurred_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status distribution */}
      {statusChartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Fleet Status Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={statusChartData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {statusChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
