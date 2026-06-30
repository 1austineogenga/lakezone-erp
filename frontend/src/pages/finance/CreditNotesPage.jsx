import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCreditNotes } from '../../api/finance'

const STATUS_COLORS = {
  open:    'bg-blue-100 text-blue-700',
  applied: 'bg-green-100 text-green-700',
  voided:  'bg-gray-100 text-gray-500',
}

const TYPE_COLORS = {
  ar: 'bg-purple-100 text-purple-700',
  ap: 'bg-orange-100 text-orange-700',
}

export default function CreditNotesPage() {
  const [creditType, setCreditType] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['credit-notes', creditType, status],
    queryFn:  () => {
      const params = {}
      if (creditType) params.credit_type = creditType
      if (status)     params.status      = status
      return getCreditNotes(params)
    },
    select: r => r.data?.results ?? r.data,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-brand-slate">Credit Notes</h2>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <span className="text-xs text-gray-600 self-center mr-1">Type:</span>
        {['', 'ar', 'ap'].map(t => (
          <button key={t} onClick={() => setCreditType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${creditType === t
                ? 'bg-brand-slate text-white border-brand-slate'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {t === '' ? 'All' : t.toUpperCase()}
          </button>
        ))}
        <span className="text-xs text-gray-600 self-center ml-3 mr-1">Status:</span>
        {['', 'open', 'applied', 'voided'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${status === s
                ? 'bg-brand-slate text-white border-brand-slate'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading
          ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          )
          : !data?.length
            ? <div className="p-12 text-center text-gray-600 text-sm">No records found.</div>
            : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Reference', 'Type', 'Date', 'Client / Supplier', 'Amount (KES)', 'Balance (KES)', 'Status', 'Memo'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map(cn => (
                    <tr key={cn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand-slate font-medium">{cn.reference || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[cn.credit_type] || 'bg-gray-100 text-gray-600'}`}>
                          {cn.credit_type?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{cn.txn_date}</td>
                      <td className="px-4 py-3 text-gray-700 truncate max-w-[140px]">
                        {cn.client || cn.supplier || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700">KES {Number(cn.amount).toLocaleString()}</td>
                      <td className={`px-4 py-3 font-medium ${Number(cn.balance) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        KES {Number(cn.balance).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cn.status] || 'bg-gray-100 text-gray-600'}`}>
                          {cn.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[160px]">{cn.memo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
      </div>
    </div>
  )
}
