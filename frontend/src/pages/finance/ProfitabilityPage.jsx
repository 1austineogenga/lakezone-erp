import { useQuery } from '@tanstack/react-query'
import { getProfitability } from '../../api/finance'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

const STATUS_COLORS = {
  planning:    'bg-gray-100 text-gray-600',
  active:      'bg-green-100 text-green-700',
  on_hold:     'bg-yellow-100 text-yellow-700',
  completed:   'bg-blue-100 text-blue-700',
  cancelled:   'bg-red-100 text-red-700',
}

export default function ProfitabilityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['profitability'],
    queryFn:  getProfitability,
    select:   r => r.data,
  })

  if (isLoading) return <div className="p-8 text-center text-gray-600 text-sm">Loading…</div>
  if (!data?.length) return (
    <div className="p-12 text-center text-gray-600 text-sm">
      No projects found. Contract profitability will appear here once projects have invoices and bills.
    </div>
  )

  const totalContract = data.reduce((s, p) => s + p.contract_value, 0)
  const totalInvoiced = data.reduce((s, p) => s + p.invoiced, 0)
  const totalCosts    = data.reduce((s, p) => s + p.costs, 0)
  const totalMargin   = data.reduce((s, p) => s + p.gross_margin, 0)
  const overallPct    = totalInvoiced > 0 ? (totalMargin / totalInvoiced * 100).toFixed(1) : 0

  const chartData = data.map(p => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
    margin_pct: p.margin_pct,
  }))

  return (
    <div className="space-y-6">
      {/* Portfolio summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Contract Value', value: fmt(totalContract), color: 'text-brand-slate' },
          { label: 'Total Invoiced',       value: fmt(totalInvoiced), color: 'text-blue-600' },
          { label: 'Total Costs',          value: fmt(totalCosts),    color: 'text-orange-600' },
          { label: `Portfolio Margin (${overallPct}%)`, value: fmt(totalMargin),
            color: totalMargin >= 0 ? 'text-green-600' : 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">{card.label}</p>
            <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Margin chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-brand-slate mb-4">Gross Margin % by Project</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [`${v}%`, 'Margin']} />
            <Bar dataKey="margin_pct" name="Margin %" radius={[3,3,0,0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.margin_pct >= 15 ? '#22c55e' : entry.margin_pct >= 0 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-600 mt-1">Green ≥15% · Amber 0–14% · Red &lt;0%</p>
      </div>

      {/* Detailed table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate">Contract Profitability Detail</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Project', 'Status', 'Contract Value', 'Invoiced', 'Received', 'Costs', 'Gross Margin', 'Margin %'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                      {p.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fmt(p.contract_value)}</td>
                  <td className="px-4 py-3 text-blue-600 font-medium">{fmt(p.invoiced)}</td>
                  <td className="px-4 py-3 text-green-600">{fmt(p.received)}</td>
                  <td className="px-4 py-3 text-orange-600">{fmt(p.costs)}</td>
                  <td className={`px-4 py-3 font-medium ${p.gross_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(p.gross_margin)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold text-sm ${
                      p.margin_pct >= 15 ? 'text-green-600'
                      : p.margin_pct >= 0 ? 'text-yellow-600'
                      : 'text-red-600'}`}>
                      {p.margin_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
