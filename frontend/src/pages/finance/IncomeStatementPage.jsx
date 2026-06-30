import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../api/client'

const fmt = (n) => new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

const thisYear = new Date().getFullYear()
const PRESETS = [
  { label: 'This Year',    from: `${thisYear}-01-01`,     to: new Date().toISOString().slice(0, 10) },
  { label: 'Last Year',    from: `${thisYear - 1}-01-01`, to: `${thisYear - 1}-12-31` },
  { label: 'Q1',           from: `${thisYear}-01-01`,     to: `${thisYear}-03-31` },
  { label: 'Q2',           from: `${thisYear}-04-01`,     to: `${thisYear}-06-30` },
  { label: 'Q3',           from: `${thisYear}-07-01`,     to: `${thisYear}-09-30` },
  { label: 'Q4',           from: `${thisYear}-10-01`,     to: `${thisYear}-12-31` },
]

function AccountTable({ rows }) {
  if (!rows.length) return <p className="px-4 py-3 text-gray-600 italic text-xs">No entries</p>
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-4 py-2 text-gray-600 w-20 font-mono text-xs">{r.code}</td>
            <td className="px-2 py-2 text-gray-700">{r.name}</td>
            <td className="px-4 py-2 text-right font-medium text-gray-800">KES {fmt(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function IncomeStatementPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom]       = useState(`${thisYear}-01-01`)
  const [to,   setTo]         = useState(today)
  const [applied, setApplied] = useState({ from: `${thisYear}-01-01`, to: today })

  const apply = (f = from, t = to) => setApplied({ from: f, to: t })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['income-statement', applied.from, applied.to],
    queryFn:  () => api.get(`/finance/income-statement/?period_from=${applied.from}&period_to=${applied.to}`).then(r => r.data),
  })

  const revenue       = data?.revenue        ?? []
  const expenses      = data?.expenses       ?? []
  const totalRevenue  = data?.total_revenue  ?? 0
  const totalExpenses = data?.total_expenses ?? 0
  const netIncome     = data?.net_income     ?? 0
  const isProfit      = (data?.is_profit ?? true)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Income Statement</h1>
          <p className="text-sm text-gray-600 mt-0.5">Profit & Loss for a selected period</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(p => (
            <button key={p.label}
              onClick={() => { setFrom(p.from); setTo(p.to); apply(p.from, p.to) }}
              className="px-2.5 py-1 text-xs rounded-full border border-gray-200 hover:border-brand-red hover:text-brand-red transition"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date range picker */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
        <span className="text-gray-600 text-sm">to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
        <button onClick={() => apply()}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-red text-white hover:bg-red-700 transition">
          Apply
        </button>
      </div>

      {/* Company banner */}
      <div className="text-center mb-6">
        <p className="text-xs text-gray-600 uppercase tracking-widest">Lake Zone Enterprises Ltd</p>
        <p className="text-base font-semibold text-gray-700 mt-0.5">
          {fmtDate(applied.from)} — {fmtDate(applied.to)}
        </p>
      </div>

      {isLoading && <p className="text-center text-gray-600 py-10">Loading…</p>}
      {isError   && <p className="text-center text-red-500 py-10">Failed to load income statement.</p>}

      {data && (
        <>
          {/* Revenue */}
          <div className="mb-6">
            <div className="flex items-center justify-between bg-green-50 border-b border-green-200 px-4 py-2 rounded-t-lg">
              <h3 className="text-sm font-bold uppercase tracking-wide text-green-700">Revenue / Income</h3>
              <span className="text-sm font-bold text-green-700">KES {fmt(totalRevenue)}</span>
            </div>
            <AccountTable rows={revenue} />
          </div>

          {/* Gross Profit line */}
          <div className="flex justify-between items-center bg-gray-50 px-4 py-2 border border-gray-200 rounded-lg mb-6 text-sm font-bold text-gray-700">
            <span>Gross Revenue</span>
            <span>KES {fmt(totalRevenue)}</span>
          </div>

          {/* Expenses */}
          <div className="mb-6">
            <div className="flex items-center justify-between bg-red-50 border-b border-red-200 px-4 py-2 rounded-t-lg">
              <h3 className="text-sm font-bold uppercase tracking-wide text-red-600">Expenses</h3>
              <span className="text-sm font-bold text-red-600">KES {fmt(totalExpenses)}</span>
            </div>
            <AccountTable rows={expenses} />
          </div>

          {/* Net Income */}
          <div className={`flex justify-between items-center px-4 py-3 rounded-lg border-2 text-base font-bold
            ${isProfit ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-700'}`}>
            <span>{isProfit ? 'Net Profit' : 'Net Loss'}</span>
            <span>KES {fmt(Math.abs(netIncome))}</span>
          </div>

          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-600 uppercase tracking-wide">Total Revenue</p>
              <p className="text-lg font-bold text-green-600 mt-1">KES {fmt(totalRevenue)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-600 uppercase tracking-wide">Total Expenses</p>
              <p className="text-lg font-bold text-red-600 mt-1">KES {fmt(totalExpenses)}</p>
            </div>
            <div className={`border rounded-lg p-4 text-center ${isProfit ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-gray-600 uppercase tracking-wide">{isProfit ? 'Net Profit' : 'Net Loss'}</p>
              <p className={`text-lg font-bold mt-1 ${isProfit ? 'text-green-700' : 'text-red-700'}`}>
                KES {fmt(Math.abs(netIncome))}
              </p>
              {totalRevenue > 0 && (
                <p className="text-xs text-gray-600 mt-0.5">
                  {((Math.abs(netIncome) / totalRevenue) * 100).toFixed(1)}% margin
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
