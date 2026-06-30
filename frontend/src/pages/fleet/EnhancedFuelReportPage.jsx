import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LineChart, Line } from 'recharts'
import { BeakerIcon, FireIcon, ArrowTrendingDownIcon, ArrowTrendingUpIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import { getFuelReport, getFuelEvents, getVehicles, getCurrentFuelPrices } from '../../api/fleet'

const fmt   = n => Number(n || 0).toFixed(1)
const fmtCost = n => `KSh ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDt = s => new Date(s).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })

function SummaryCard({ icon: Icon, label, value, sub, bg, color }) {
  return (
    <div className={`${bg} rounded-2xl p-4`}>
      <div className={`${color} w-8 h-8 rounded-xl flex items-center justify-center bg-white/60 mb-2`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-600">{sub}</p>}
    </div>
  )
}

export default function EnhancedFuelReportPage() {
  const today = new Date()
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(today.getDate() - 90)

  const [dateFrom, setDateFrom]   = useState(ninetyDaysAgo.toISOString().split('T')[0])
  const [dateTo, setDateTo]       = useState(today.toISOString().split('T')[0])
  const [vehicleId, setVehicleId] = useState('')
  const [tab, setTab]             = useState('fills')
  const [location, setLocation]   = useState('Nairobi')

  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: getVehicles,
    select: r => r.data?.results ?? r.data ?? [],
  })

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

  const { data: currentPrices = {} } = useQuery({
    queryKey: ['current-fuel-prices', location],
    queryFn: () => getCurrentFuelPrices(location),
    select: r => r.data ?? {},
  })

  const fills  = events.filter(e => e.event_type === 'fill')
  const drains = events.filter(e => e.event_type === 'drain' || e.event_type === 'theft')

  const totalFills    = byVehicle.reduce((s, v) => s + (v.total_fills ?? 0), 0)
  const totalDrains   = byVehicle.reduce((s, v) => s + (v.total_drains ?? 0), 0)
  const totalAdded    = byVehicle.reduce((s, v) => s + (v.total_fuel_filled ?? 0), 0)
  const totalDrained  = byVehicle.reduce((s, v) => s + (v.total_fuel_drained ?? 0), 0)
  const totalAddedCost = byVehicle.reduce((s, v) => s + (v.total_fuel_filled_cost ?? 0), 0)
  const totalDrainedCost = byVehicle.reduce((s, v) => s + (v.total_fuel_drained_cost ?? 0), 0)
  const netConsumption = totalAdded - totalDrained
  const netCost = totalAddedCost - totalDrainedCost

  // Chart data
  const chartData = byVehicle.map(v => ({
    vehicle: v.vehicle_no,
    filled: v.total_fuel_filled,
    drained: v.total_fuel_drained,
    filledCost: v.total_fuel_filled_cost,
    drainedCost: v.total_fuel_drained_cost,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-brand-slate">Enhanced Fuel Report</h2>
        <p className="text-xs text-gray-600 mt-0.5">Fills, drains, consumption &amp; costs by vehicle</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-wrap gap-3 items-end">
        {[['From', dateFrom, setDateFrom], ['To', dateTo, setDateTo]].map(([label, val, set]) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input type="date" value={val} onChange={e => set(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Location (for prices)</label>
          <select value={location} onChange={e => setLocation(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="Nairobi">Nairobi</option>
            <option value="Mombasa">Mombasa</option>
            <option value="Kisumu">Kisumu</option>
            <option value="Nakuru">Nakuru</option>
            <option value="Eldoret">Eldoret</option>
          </select>
        </div>
      </div>

      {/* Current Prices Widget */}
      {Object.keys(currentPrices).length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-brand-slate text-sm mb-3">Current Fuel Prices in {location}</h3>
          <div className="grid grid-cols-3 gap-3">
            {currentPrices.petrol && (
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-gray-600">Super Petrol</p>
                <p className="text-lg font-bold text-blue-600">KSh {currentPrices.petrol.price_per_litre}/L</p>
              </div>
            )}
            {currentPrices.diesel && (
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <p className="text-xs text-gray-600">Diesel</p>
                <p className="text-lg font-bold text-green-600">KSh {currentPrices.diesel.price_per_litre}/L</p>
              </div>
            )}
            {currentPrices.kerosene && (
              <div className="bg-white rounded-lg p-3 border border-amber-100">
                <p className="text-xs text-gray-600">Kerosene</p>
                <p className="text-lg font-bold text-amber-600">KSh {currentPrices.kerosene.price_per_litre}/L</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {byVehicle.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={FireIcon}              label="Total Fills"   value={totalFills}              color="text-green-600"  bg="bg-green-50"   sub={`${fmt(totalAdded)}L added`} />
          <SummaryCard icon={ArrowTrendingDownIcon} label="Total Drains"  value={totalDrains}             color="text-red-600"    bg="bg-red-50"     sub={`${fmt(totalDrained)}L lost`} />
          <SummaryCard icon={BeakerIcon}            label="Fuel Added"    value={`${fmt(totalAdded)}L`}   color="text-blue-600"   bg="bg-blue-50" />
          <SummaryCard icon={ArrowTrendingUpIcon}   label="Net Balance"   value={`${fmt(netConsumption)}L`} color="text-purple-600" bg="bg-purple-50" sub="filled minus drained" />
        </div>
      )}

      {/* Cost Summary */}
      {byVehicle.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={CurrencyDollarIcon}    label="Fill Cost"     value={fmtCost(totalAddedCost)}   color="text-green-600"  bg="bg-green-50" />
          <SummaryCard icon={CurrencyDollarIcon}    label="Drain Cost"    value={fmtCost(totalDrainedCost)} color="text-red-600"    bg="bg-red-50" />
          <SummaryCard icon={CurrencyDollarIcon}    label="Net Cost"      value={fmtCost(netCost)}          color="text-purple-600" bg="bg-purple-50" />
          <SummaryCard icon={CurrencyDollarIcon}    label="Avg Cost/L"    value={`KSh ${(netCost / (netConsumption || 1)).toFixed(2)}`} color="text-indigo-600" bg="bg-indigo-50" />
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Activity by Vehicle (Volume)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="vehicle" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="L" />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="filled"  name="Filled (L)"  fill="#22c55e" radius={[4,4,0,0]} />
              <Bar dataKey="drained" name="Drained (L)" fill="#f87171" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cost Chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Activity by Vehicle (Cost)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="vehicle" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="KSh" />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11 }} formatter={(v) => `KSh ${v.toLocaleString()}`} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="filledCost"  name="Fill Cost (KSh)"  fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="drainedCost" name="Drain Cost (KSh)" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Events Tabs */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[['fills', `Fills (${fills.length})`, 'text-green-600'], ['drains', `Drains / Theft (${drains.length})`, 'text-red-600']].map(([key, label, color]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 px-4 py-3 text-xs font-semibold border-b-2 transition-colors
                ${tab === key ? `border-brand-red ${color}` : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'fills' && (
          fills.length === 0 ? (
            <p className="text-sm text-gray-600 p-8 text-center">No fill events in this period.</p>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    {['Vehicle', 'Date / Time', 'Before', 'After', 'Added', 'Price/L', 'Total Cost'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fills.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-semibold text-brand-slate">{e.vehicle_no || e.vehicle}</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmtDt(e.occurred_at)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmt(e.fuel_before)}L</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmt(e.fuel_after)}L</td>
                      <td className="px-4 py-2.5 font-bold text-green-600">+{fmt(e.fuel_change)}L</td>
                      <td className="px-4 py-2.5 text-gray-600">{e.price_per_litre ? `KSh ${e.price_per_litre}` : '—'}</td>
                      <td className="px-4 py-2.5 font-bold text-green-600">{e.total_cost ? fmtCost(e.total_cost) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'drains' && (
          drains.length === 0 ? (
            <p className="text-sm text-gray-600 p-8 text-center">No drain events in this period.</p>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    {['Vehicle', 'Type', 'Date / Time', 'Before', 'After', 'Lost', 'Price/L', 'Total Cost'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {drains.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-semibold text-brand-slate">{e.vehicle_no || e.vehicle}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                          ${e.event_type === 'theft' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>
                          {e.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{fmtDt(e.occurred_at)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmt(e.fuel_before)}L</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmt(e.fuel_after)}L</td>
                      <td className="px-4 py-2.5 font-bold text-red-600">{fmt(e.fuel_change)}L</td>
                      <td className="px-4 py-2.5 text-gray-600">{e.price_per_litre ? `KSh ${e.price_per_litre}` : '—'}</td>
                      <td className="px-4 py-2.5 font-bold text-red-600">{e.total_cost ? fmtCost(e.total_cost) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
