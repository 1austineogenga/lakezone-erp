import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPayments } from '../../api/finance'

const TYPE_COLORS = {
  receipt: 'bg-green-100 text-green-700',
  payment: 'bg-orange-100 text-orange-700',
}

export default function PaymentsPage() {
  const [paymentType, setPaymentType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['payments', paymentType],
    queryFn:  () => getPayments(paymentType ? { payment_type: paymentType } : {}),
    select:   r => r.data?.results ?? r.data,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-brand-slate">Payments</h2>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'receipt', 'payment'].map(t => (
          <button key={t} onClick={() => setPaymentType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${paymentType === t
                ? 'bg-brand-slate text-white border-brand-slate'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {t === '' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
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
                    {['Reference', 'Type', 'Method', 'Invoice', 'Bill', 'Amount (KES)', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand-slate font-medium">{p.reference || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[p.payment_type] || 'bg-gray-100 text-gray-600'}`}>
                          {p.payment_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs capitalize">{p.payment_method?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs font-mono">{p.invoice || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs font-mono">{p.bill || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">KES {Number(p.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-600">{p.payment_date}</td>
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
