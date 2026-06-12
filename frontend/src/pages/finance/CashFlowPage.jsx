import { useQuery } from '@tanstack/react-query'
import { getCashFlow } from '../../api/finance'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

const fmt = (v) => `KES ${Number(v).toLocaleString()}`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-brand-slate mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function CashFlowPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['cash-flow'],
    queryFn:  getCashFlow,
    select:   r => r.data,
  })

  if (isLoading) return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  if (!data) return null

  const totalInflows  = data.reduce((s, m) => s + m.inflows, 0)
  const totalOutflows = data.reduce((s, m) => s + m.outflows, 0)
  const netPosition   = totalInflows - totalOutflows

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Receipts (12m)</p>
          <p className="text-xl font-bold text-green-600">KES {totalInflows.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Payments (12m)</p>
          <p className="text-xl font-bold text-red-600">KES {totalOutflows.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Net Cash Position</p>
          <p className={`text-xl font-bold ${netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            KES {netPosition.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Actual receipts vs payments chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-brand-slate mb-4">Monthly Cash Flow — Actual (12 months)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#999" />
            <Bar dataKey="inflows"  name="Receipts"  fill="#22c55e" radius={[3,3,0,0]} />
            <Bar dataKey="outflows" name="Payments"  fill="#ef4444" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Net cash per month chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-brand-slate mb-4">Net Cash by Month</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#999" />
            <Bar dataKey="net" name="Net Cash"
              fill="#3C4F5C"
              radius={[3,3,0,0]}
              label={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Upcoming forecast */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-brand-slate mb-4">Upcoming — Expected Inflows vs Outflows (by due date)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="expected_inflows"  name="Expected Receipts"  fill="#86efac" radius={[3,3,0,0]} />
            <Bar dataKey="expected_outflows" name="Expected Payments"  fill="#fca5a5" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-2">Based on outstanding invoice / bill due dates</p>
      </div>
    </div>
  )
}
