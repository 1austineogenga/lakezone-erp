import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../api/client'

const fmt = (n) => new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

function Section({ title, rows, total, color = 'text-gray-800' }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-4 py-2 rounded-t-lg">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">{title}</h3>
        <span className={`text-sm font-bold ${color}`}>KES {fmt(total)}</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={3} className="px-4 py-3 text-gray-600 italic text-xs">No entries</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-600 w-20 font-mono text-xs">{r.code}</td>
              <td className="px-2 py-2 text-gray-700">{r.name}</td>
              <td className="px-4 py-2 text-right font-medium text-gray-800">KES {fmt(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function BalanceSheetPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [asOf, setAsOf] = useState(today)
  const [applied, setApplied] = useState(today)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['balance-sheet', applied],
    queryFn: () => api.get(`/finance/balance-sheet/?as_of=${applied}`).then(r => r.data),
  })

  const assets      = data?.assets      ?? []
  const liabilities = data?.liabilities ?? []
  const equity      = data?.equity      ?? []
  const totalA      = data?.total_assets      ?? 0
  const totalL      = data?.total_liabilities ?? 0
  const totalE      = data?.total_equity      ?? 0
  const balanced    = Math.abs(totalA - (totalL + totalE)) < 0.05

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Balance Sheet</h1>
          <p className="text-sm text-gray-600 mt-0.5">Financial position as of a specific date</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={asOf}
            onChange={e => setAsOf(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
          <button
            onClick={() => setApplied(asOf)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-red text-white hover:bg-red-700 transition"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Company + date banner */}
      <div className="text-center mb-6">
        <p className="text-xs text-gray-600 uppercase tracking-widest">Lake Zone Enterprises Ltd</p>
        <p className="text-base font-semibold text-gray-700 mt-0.5">As at {fmtDate(applied)}</p>
      </div>

      {isLoading && <p className="text-center text-gray-600 py-10">Loading…</p>}
      {isError   && <p className="text-center text-red-500 py-10">Failed to load balance sheet.</p>}

      {data && (
        <>
          <Section title="Assets"      rows={assets}      total={totalA} color="text-green-700" />
          <Section title="Liabilities" rows={liabilities} total={totalL} color="text-red-600" />
          <Section title="Equity & Retained Earnings" rows={equity} total={totalE} color="text-blue-700" />

          {/* Totals */}
          <div className="mt-4 border-t-2 border-gray-800 pt-3 space-y-1">
            <div className="flex justify-between text-sm font-bold text-gray-800">
              <span>Total Assets</span>
              <span>KES {fmt(totalA)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-800">
              <span>Total Liabilities + Equity</span>
              <span>KES {fmt(totalL + totalE)}</span>
            </div>
            <div className={`flex justify-between text-xs font-medium mt-2 px-3 py-1.5 rounded-lg ${balanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              <span>{balanced ? '✓ Balanced' : '⚠ Out of balance'}</span>
              <span>Difference: KES {fmt(Math.abs(totalA - totalL - totalE))}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
