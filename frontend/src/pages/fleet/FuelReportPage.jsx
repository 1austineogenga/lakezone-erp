import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { getFuelReport, getFuelEvents, getVehicles } from '../../api/fleet'

const fmt = n => Number(n || 0).toFixed(1)
const fmtDt = s => new Date(s).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })

export default function FuelReportPage() {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const [dateFrom, setDateFrom]   = useState(firstDay)
  const [dateTo, setDateTo]       = useState(today.toISOString().split('T')[0])
  const [vehicleId, setVehicleId] = useState('')

  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: getVehicles,
    select: r => r.data?.results ?? r.data ?? [],
  })

  // API returns array of per-vehicle objects
  const { data: byVehicle = [] } = useQuery({
    queryKey: ['fuel-report', dateFrom, dateTo, vehicleId],
    queryFn: () => getFuelReport({ date_from: dateFrom, date_to: dateTo, ...(vehicleId && { vehicle: vehicleId }) }),
    select: r => Array.isArray(r.data) ? r.data : (r.data?.results ?? []),
  })

  const { data: events = [] } = useQuery({
    queryKey: ['fuel-events-detail', dateFrom, dateTo, vehicleId],
    queryFn: () => getFuelEvents({ date_from: dateFrom, date_to: dateTo, ...(vehicleId && { vehicle: vehicleId }), limit: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const summary = byVehicle.length > 0 ? {
    total_fills:        byVehicle.reduce((s, v) => s + (v.total_fills ?? 0), 0),
    total_drains:       byVehicle.reduce((s, v) => s + (v.total_drains ?? 0), 0),
    total_fuel_added:   byVehicle.reduce((s, v) => s + (v.total_fuel_filled ?? 0), 0),
    total_fuel_drained: byVehicle.reduce((s, v) => s + (v.total_fuel_drained ?? 0), 0),
  } : null

  const fills  = events.filter(e => e.event_type === 'fill')
  const drains = events.filter(e => e.event_type === 'drain' || e.event_type === 'theft')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-bold text-brand-slate text-lg">Fuel Report</h2>
        <p className="text-xs text-gray-400 mt-0.5">Fuel consumption, fills, and drain/theft events</p>
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

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Fills',      val: summary.total_fills,                    color: 'text-green-600' },
            { label: 'Total Drains',     val: summary.total_drains,                   color: 'text-red-600' },
            { label: 'Fuel Added',       val: `${fmt(summary.total_fuel_added)}L`,    color: 'text-blue-600' },
            { label: 'Fuel Drained',     val: `${fmt(summary.total_fuel_drained)}L`,  color: 'text-orange-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* By Vehicle Chart */}
      {byVehicle.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Fuel Activity by Vehicle</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byVehicle} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="vehicle_no" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="total_fuel_filled"  name="Fills (L)"  fill="#22c55e" radius={[4,4,0,0]} />
              <Bar dataKey="total_fuel_drained" name="Drains (L)" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Events Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Fills */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Fill Events ({fills.length})</h3>
          </div>
          {fills.length === 0 ? (
            <p className="text-sm text-gray-400 p-6 text-center">No fill events.</p>
          ) : (
            <div className="overflow-x-auto max-h-72">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    {['Vehicle', 'Date', 'Before', 'After', '+Change'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fills.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{e.vehicle_no || e.vehicle}</td>
                      <td className="px-3 py-2 text-gray-500">{fmtDt(e.occurred_at)}</td>
                      <td className="px-3 py-2">{fmt(e.fuel_before)}L</td>
                      <td className="px-3 py-2">{fmt(e.fuel_after)}L</td>
                      <td className="px-3 py-2 font-bold text-green-600">+{fmt(e.fuel_change)}L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Drains / Theft */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Drain / Theft Events ({drains.length})</h3>
          </div>
          {drains.length === 0 ? (
            <p className="text-sm text-gray-400 p-6 text-center">No drain events.</p>
          ) : (
            <div className="overflow-x-auto max-h-72">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    {['Vehicle', 'Type', 'Date', 'Before', 'After', 'Change'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {drains.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{e.vehicle_no || e.vehicle}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium
                          ${e.event_type === 'theft' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>
                          {e.event_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{fmtDt(e.occurred_at)}</td>
                      <td className="px-3 py-2">{fmt(e.fuel_before)}L</td>
                      <td className="px-3 py-2">{fmt(e.fuel_after)}L</td>
                      <td className="px-3 py-2 font-bold text-red-600">{fmt(e.fuel_change)}L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
