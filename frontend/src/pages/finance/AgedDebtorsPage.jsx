import { useQuery } from '@tanstack/react-query'
import { getAgedDebtors, getAgedCreditors } from '../../api/finance'
import { useState } from 'react'

const fmt = (n) => n > 0 ? `KES ${Number(n).toLocaleString()}` : '—'

const BAND_LABELS = {
  current: 'Current',
  '1_30':  '1–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  '90_plus': '90+ days',
}

const BAND_COLORS = {
  current:  'text-green-700  bg-green-50',
  '1_30':   'text-yellow-700 bg-yellow-50',
  '31_60':  'text-orange-600 bg-orange-50',
  '61_90':  'text-red-600    bg-red-50',
  '90_plus':'text-red-800    bg-red-100 font-semibold',
}

const BANDS = ['current', '1_30', '31_60', '61_90', '90_plus']

function AgingTable({ data, nameKey, labelSingular }) {
  if (!data) return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>

  const rows = data.by_client || data.by_supplier || []
  const totals = data.totals || {}

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-brand-slate">{labelSingular}</h3>
          <p className="text-xs text-gray-400 mt-0.5">Grand total outstanding: <span className="font-semibold text-gray-600">KES {Number(data.grand_total || 0).toLocaleString()}</span></p>
        </div>
      </div>

      {/* Band totals bar */}
      {data.grand_total > 0 && (
        <div className="flex h-2">
          {BANDS.map(b => {
            const pct = (totals[b] / data.grand_total) * 100
            if (pct === 0) return null
            const colors = {
              current: 'bg-green-400', '1_30': 'bg-yellow-400',
              '31_60': 'bg-orange-400', '61_90': 'bg-red-400', '90_plus': 'bg-red-700',
            }
            return <div key={b} style={{ width: `${pct}%` }} className={colors[b]} />
          })}
        </div>
      )}

      {rows.length === 0
        ? <p className="text-sm text-gray-400 p-8 text-center">No outstanding {labelSingular.toLowerCase()}.</p>
        : <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{nameKey === 'client_name' ? 'Client' : 'Supplier'}</th>
                  {BANDS.map(b => (
                    <th key={b} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{BAND_LABELS[b]}</th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{row[nameKey]}</td>
                    {BANDS.map(b => (
                      <td key={b} className="px-4 py-3 text-right">
                        {row[b] > 0
                          ? <span className={`text-xs px-2 py-0.5 rounded-full ${BAND_COLORS[b]}`}>{fmt(row[b])}</span>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold text-brand-slate">KES {Number(row.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-600 text-sm">Totals</td>
                  {BANDS.map(b => (
                    <td key={b} className="px-4 py-3 text-right font-semibold text-sm text-gray-700">
                      {totals[b] > 0 ? `KES ${Number(totals[b]).toLocaleString()}` : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold text-brand-slate">
                    KES {Number(data.grand_total || 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
      }
    </div>
  )
}

export default function AgedDebtorsPage() {
  const [view, setView] = useState('debtors')

  const { data: debtors } = useQuery({
    queryKey: ['aged-debtors'],
    queryFn:  getAgedDebtors,
    select:   r => r.data,
  })
  const { data: creditors } = useQuery({
    queryKey: ['aged-creditors'],
    queryFn:  getAgedCreditors,
    select:   r => r.data,
  })

  return (
    <div className="space-y-5">
      {/* Toggle */}
      <div className="flex gap-2">
        {[
          { key: 'debtors',   label: 'Aged Debtors (AR)',   color: 'text-blue-700' },
          { key: 'creditors', label: 'Aged Creditors (AP)', color: 'text-purple-700' },
          { key: 'both',      label: 'View Both' },
        ].map(opt => (
          <button key={opt.key} onClick={() => setView(opt.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${view === opt.key
                ? 'bg-brand-slate text-white border-brand-slate'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {BANDS.map(b => (
          <div key={b} className="flex items-center gap-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${BAND_COLORS[b]}`}>{BAND_LABELS[b]}</span>
          </div>
        ))}
      </div>

      {(view === 'debtors' || view === 'both') && (
        <AgingTable data={debtors} nameKey="client_name" labelSingular="Aged Debtors — Outstanding AR" />
      )}
      {(view === 'creditors' || view === 'both') && (
        <AgingTable data={creditors} nameKey="supplier_name" labelSingular="Aged Creditors — Outstanding AP" />
      )}
    </div>
  )
}
