import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  ArrowLeftIcon, ArrowPathIcon, MapPinIcon, BoltIcon,
  BeakerIcon, ExclamationTriangleIcon, PrinterIcon,
} from '@heroicons/react/24/outline'
import { getVehicle, getVehicleLive, getFuelEvents, getTrips, getAlerts, acknowledgeAlert } from '../../api/fleet'
import { printMachineWeekly } from '../../utils/print'

const STATUS_DOT   = { MOVING: 'bg-green-500', IDLE: 'bg-yellow-400', STOP: 'bg-gray-400', INACTIVE: 'bg-red-400' }
const STATUS_LABEL = { MOVING: 'Moving', IDLE: 'Idling', STOP: 'Stopped', INACTIVE: 'Offline' }
const FUEL_COLORS  = { fill: 'bg-green-100 text-green-700', drain: 'bg-red-100 text-red-700', theft: 'bg-purple-100 text-purple-700' }

const fmt = (n, d = 1) => Number(n || 0).toFixed(d)
const fmtDt = s => new Date(s).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })

export default function VehicleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('fuel')

  const { data: vehicle } = useQuery({
    queryKey: ['fleet-vehicle', id],
    queryFn: () => getVehicle(id),
    select: r => r.data,
  })

  const { data: liveHistory = [] } = useQuery({
    queryKey: ['fleet-vehicle-live', id],
    queryFn: () => getVehicleLive(id),
    select: r => {
      const d = r.data?.results ?? r.data ?? []
      return (Array.isArray(d) ? d : []).slice(-48)
    },
    refetchInterval: 120_000,
  })

  const { data: fuelEvents = [] } = useQuery({
    queryKey: ['fleet-fuel-events-v', id],
    queryFn: () => getFuelEvents({ vehicle: id, limit: 50 }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: tab === 'fuel',
  })

  const { data: trips = [] } = useQuery({
    queryKey: ['fleet-trips-v', id],
    queryFn: () => getTrips({ vehicle: id, limit: 50 }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: tab === 'trips',
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['fleet-alerts-v', id],
    queryFn: () => getAlerts({ vehicle: id, limit: 30 }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: tab === 'alerts',
  })

  const ackMut = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      toast.success('Alert acknowledged.')
      qc.invalidateQueries({ queryKey: ['fleet-alerts-v', id] })
      qc.invalidateQueries({ queryKey: ['fleet-dashboard'] })
    },
  })

  if (!vehicle) return <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>

  const fuelChartData = liveHistory
    .filter(d => d.fuel_level != null)
    .map(d => ({
      time: new Date(d.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fuel: Number(d.fuel_level).toFixed(1),
      speed: Number(d.speed || 0).toFixed(1),
    }))

  const odomKm = vehicle.last_odometer ? (vehicle.last_odometer / 1000).toFixed(0) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/fleet/vehicles')} className="text-gray-400 hover:text-brand-slate mt-1">
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-bold text-brand-slate text-lg">{vehicle.vehicle_no}</h2>
            <button
              onClick={() => printMachineWeekly({ vehicle_no: vehicle.vehicle_no, vehicle_name: vehicle.vehicle_name, make: vehicle.make, model: vehicle.model_name })}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
              <PrinterIcon className="h-3.5 w-3.5" /> Machine Weekly Report
            </button>
            {vehicle.last_status && (
              <>
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[vehicle.last_status] || 'bg-gray-300'}`} />
                <span className="text-sm text-gray-500">{STATUS_LABEL[vehicle.last_status] || vehicle.last_status}</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {[vehicle.vehicle_name, vehicle.make, vehicle.model_name, vehicle.year].filter(Boolean).join(' · ')}
            {vehicle.project_name ? ` · ${vehicle.project_name}` : ''}
          </p>
          {vehicle.last_location && (
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <MapPinIcon className="h-3 w-3" /> {vehicle.last_location}
            </p>
          )}
        </div>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Speed',      val: vehicle.last_speed != null ? `${fmt(vehicle.last_speed)} km/h` : '—', icon: BoltIcon,     color: 'text-blue-600' },
          { label: 'Fuel Level', val: vehicle.last_fuel  != null ? `${fmt(vehicle.last_fuel)}%`      : '—', icon: BeakerIcon,   color: 'text-green-600' },
          { label: 'Odometer',   val: odomKm != null ? `${odomKm} km` : '—',                              icon: MapPinIcon,   color: 'text-brand-slate' },
          {
            label: 'Last Seen',
            val: vehicle.last_seen_minutes_ago != null
              ? vehicle.last_seen_minutes_ago < 2 ? 'Just now'
              : vehicle.last_seen_minutes_ago < 60 ? `${Math.round(vehicle.last_seen_minutes_ago)}m ago`
              : `${Math.round(vehicle.last_seen_minutes_ago / 60)}h ago`
              : '—',
            icon: ArrowPathIcon, color: 'text-gray-500',
          },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <s.icon className={`h-5 w-5 ${s.color} mb-1`} />
            <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Fuel trend chart */}
      {fuelChartData.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Fuel Level Trend (last 48 readings)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={fuelChartData}>
              <defs>
                <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <Tooltip formatter={(v, n) => [v, n === 'fuel' ? 'Fuel %' : 'Speed km/h']} />
              <Area type="monotone" dataKey="fuel" stroke="#22c55e" fill="url(#fuelGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="flex border-b border-gray-100">
          {[['fuel', 'Fuel Events'], ['trips', 'Trip History'], ['alerts', 'Alerts']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-5 py-3 text-xs font-medium border-b-2 transition-colors
                ${tab === k ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-brand-slate'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Fuel Events */}
        {tab === 'fuel' && (
          fuelEvents.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No fuel events recorded.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Type', 'Time', 'Before', 'After', 'Change', 'Location'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fuelEvents.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FUEL_COLORS[e.event_type] || 'bg-gray-100 text-gray-600'}`}>
                            {e.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtDt(e.occurred_at)}</td>
                        <td className="px-4 py-3 text-xs">{fmt(e.fuel_before)}%</td>
                        <td className="px-4 py-3 text-xs">{fmt(e.fuel_after)}%</td>
                        <td className={`px-4 py-3 text-xs font-medium ${e.event_type === 'fill' ? 'text-green-600' : 'text-red-600'}`}>
                          {e.event_type === 'fill' ? '+' : ''}{fmt(e.fuel_change)}%
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate">{e.location_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}

        {/* Trips */}
        {tab === 'trips' && (
          trips.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No trips recorded.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Start', 'End', 'From', 'To', 'Distance', 'Duration', 'Max Speed'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trips.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtDt(t.started_at)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {t.ended_at ? fmtDt(t.ended_at) : <span className="text-green-600 font-medium">In Progress</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[120px] truncate">{t.start_location || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[120px] truncate">{t.end_location || '—'}</td>
                        <td className="px-4 py-3 text-xs font-medium">{t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{t.duration_minutes ? `${t.duration_minutes} min` : '—'}</td>
                        <td className="px-4 py-3 text-xs">{t.max_speed ? `${fmt(t.max_speed)} km/h` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}

        {/* Alerts */}
        {tab === 'alerts' && (
          alerts.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No alerts for this vehicle.</p>
            : <div className="divide-y divide-gray-100">
                {alerts.map(a => (
                  <div key={a.id} className={`px-5 py-4 flex items-start gap-3 ${a.acknowledged ? 'opacity-50' : ''}`}>
                    <ExclamationTriangleIcon className={`h-4 w-4 mt-0.5 shrink-0 ${a.severity === 'critical' ? 'text-red-500' : a.severity === 'high' ? 'text-orange-500' : a.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-brand-slate">{a.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDt(a.occurred_at)}</p>
                    </div>
                    {!a.acknowledged && (
                      <button onClick={() => ackMut.mutate(a.id)} className="text-xs text-blue-600 hover:underline shrink-0">
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </div>
        )}
      </div>
    </div>
  )
}
