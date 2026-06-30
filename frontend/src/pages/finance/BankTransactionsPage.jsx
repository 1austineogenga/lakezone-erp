import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBankTransactions } from '../../api/finance'

const TXN_COLORS = {
  deposit:    'bg-green-100 text-green-700',
  withdrawal: 'bg-red-100 text-red-700',
  transfer:   'bg-blue-100 text-blue-700',
  other:      'bg-gray-100 text-gray-600',
}

export default function BankTransactionsPage() {
  const [txnType, setTxnType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['bank-transactions', txnType],
    queryFn:  () => getBankTransactions(txnType ? { txn_type: txnType } : {}),
    select:   r => r.data?.results ?? r.data,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-brand-slate">Bank Transactions</h2>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'deposit', 'withdrawal', 'transfer', 'other'].map(t => (
          <button key={t} onClick={() => setTxnType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${txnType === t
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
                    {['Reference', 'Date', 'Type', 'Account', 'Payee', 'Description', 'Amount (KES)'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map(txn => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand-slate font-medium">{txn.reference || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{txn.txn_date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TXN_COLORS[txn.txn_type] || 'bg-gray-100 text-gray-600'}`}>
                          {txn.txn_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{txn.account || '—'}</td>
                      <td className="px-4 py-3 text-gray-700 truncate max-w-[120px]">{txn.payee || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[160px]">{txn.description || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">KES {Number(txn.amount).toLocaleString()}</td>
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
