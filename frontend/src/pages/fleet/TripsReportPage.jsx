import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getUtilizationReport, getTrips, getVehicles } from '../../api/fleet'

const fmt = (n, d = 1) => Number(n || 0).toFixed(d)
const fmtDt = s => new Date(s).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })

export default function TripsReportPage() {
  const today = new Date()
  const ninetyDaysAgo = new Date(today); ninetyDaysAgo.setDate(today.getDate() - 90)
  const [dateFrom, setDateFrom]   = useState(ninetyDaysAgo.toISOString().split('T')[0])
  const [dateTo, setDateTo]       = useState(today.toISOString().split('T')[0])
  const [vehicleId, setVehicleId] = useState('')

  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: getVehicles,
    select: r => r.data?.results ?? r.data ?? [],
  })

  // API returns array of per-vehicle objects
  const { data: byVehicle = [] } = useQuery({
    queryKey: ['utilization-report', dateFrom, dateTo, vehicleId],
    queryFn: () => getUtilizationReport({ date_from: dateFrom, date_to: dateTo, ...(vehicleId && { vehicle: vehicleId }) }),
    select: r => Array.isArray(r.data) ? r.data : (r.data?.results ?? []),
  })

  const { data: trips = [] } = useQuery({
    queryKey: ['trips-detail', dateFrom, dateTo, vehicleId],
    queryFn: () => getTrips({ date_from: dateFrom, date_to: dateTo, ...(vehicleId && { vehicle: vehicleId }), limit: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const summary = byVehicle.length > 0 ? {
    total_trips:      byVehicle.reduce((s, v) => s + (v.total_trips ?? 0), 0),
    total_distance_km: byVehicle.reduce((s, v) => s + (v.total_distance_km ?? 0), 0),
    avg_distance_km:   byVehicle.length ? (byVehicle.reduce((s, v) => s + (v.total_distance_km ?? 0), 0) / byVehicle.reduce((s, v) => s + (v.total_trips || 1), 0)) : 0,
    max_speed:         Math.max(...byVehicle.map(v => v.max_speed ?? 0)),
  } : null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-bold text-brand-slate text-lg">Trip & Mileage Report</h2>
        <p className="text-xs text-gray-600 mt-0.5">Fleet utilization, distance, and speed analytics</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-end">
        {[['From', dateFrom, setDateFrom], ['To', dateTo, setDateTo]].map(([label, val, set]) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input type="date" value={val} onChange={e => set(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Trips',    val: summary.total_trips,                       color: 'text-brand-slate' },
            { label: 'Total Distance', val: `${fmt(summary.total_distance_km)} km`,    color: 'text-blue-600' },
            { label: 'Avg Trip',       val: `${fmt(summary.avg_distance_km)} km`,      color: 'text-green-600' },
            { label: 'Max Speed',      val: `${fmt(summary.max_speed)} km/h`,          color: 'text-orange-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* By Vehicle Chart */}
      {byVehicle.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Distance by Vehicle (km)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byVehicle}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="vehicle_no" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" km" />
              <Tooltip formatter={v => `${v} km`} />
              <Bar dataKey="total_distance_km" name="Distance" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By Vehicle Table */}
      {byVehicle.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Utilization by Vehicle</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Vehicle', 'Trips', 'Distance', 'Avg Trip', 'Max Speed', 'Fuel Used'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byVehicle.map(v => (
                  <tr key={v.vehicle_no} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-brand-slate">{v.vehicle_no}</td>
                    <td className="px-4 py-3 text-xs">{v.trip_count ?? 0}</td>
                    <td className="px-4 py-3 text-xs font-medium">{fmt(v.total_distance_km ?? 0)} km</td>
                    <td className="px-4 py-3 text-xs">{fmt(v.avg_distance_km ?? 0)} km</td>
                    <td className="px-4 py-3 text-xs">{fmt(v.max_speed ?? 0)} km/h</td>
                    <td className="px-4 py-3 text-xs">{v.total_fuel_consumed != null ? `${fmt(v.total_fuel_consumed)}L` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trip Log */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Trip Log ({trips.length})</h3>
        </div>
        {trips.length === 0 ? (
          <p className="text-sm text-gray-600 p-8 text-center">No trips in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Vehicle', 'Start', 'End', 'From → To', 'Distance', 'Duration', 'Max Speed', 'Driver'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trips.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-medium text-brand-slate">{t.vehicle_no || t.vehicle}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{fmtDt(t.started_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {t.ended_at ? fmtDt(t.ended_at) : <span className="text-green-600 font-medium">In Progress</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px] truncate">
                      {t.start_location || '—'}{t.end_location ? ` → ${t.end_location}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">{t.distance_km ? `${fmt(t.distance_km)} km` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{t.duration_minutes ? `${t.duration_minutes} min` : '—'}</td>
                    <td className="px-4 py-3 text-xs">{t.max_speed ? `${fmt(t.max_speed)} km/h` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{t.driver_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
