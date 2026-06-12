import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getExpenses, submitExpense, reviewExpense } from '../../api/finance'
import { PlusIcon, PaperAirplaneIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  paid:      'bg-teal-100 text-teal-700',
}

export default function ExpensesPage() {
  const [status, setStatus] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', status],
    queryFn:  () => getExpenses(status ? { status } : {}),
    select:   r => r.data,
  })

  const submitMutation = useMutation({
    mutationFn: (id) => submitExpense(id),
    onSuccess:  () => { toast.success('Claim submitted for review.'); qc.invalidateQueries(['expenses']) },
    onError:    () => toast.error('Failed to submit.'),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }) => reviewExpense(id, { action }),
    onSuccess:  () => { toast.success('Decision recorded.'); qc.invalidateQueries(['expenses']) },
    onError:    () => toast.error('Action failed.'),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-brand-slate">Expense Claims</h2>
        <Link to="/finance/expenses/new"
          className="flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <PlusIcon className="h-4 w-4" /> New Claim
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'draft', 'submitted', 'approved', 'rejected', 'paid'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${status === s ? 'bg-brand-slate text-white border-brand-slate' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading
          ? <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          : !data?.length
            ? <div className="p-12 text-center text-gray-400 text-sm">No expense claims found.</div>
            : <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Reference', 'Title', 'Submitted By', 'Project', 'Status', 'Amount', 'Date', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map(claim => (
                    <tr key={claim.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand-slate font-medium">{claim.reference}</td>
                      <td className="px-4 py-3 font-medium truncate max-w-[160px]">{claim.title}</td>
                      <td className="px-4 py-3 text-gray-500">{claim.submitted_by_name}</td>
                      <td className="px-4 py-3 text-gray-500 truncate max-w-[100px]">{claim.project_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[claim.status]}`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">KES {Number(claim.total_amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(claim.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {claim.status === 'draft' && (
                            <button onClick={() => submitMutation.mutate(claim.id)}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                              <PaperAirplaneIcon className="h-3.5 w-3.5" /> Submit
                            </button>
                          )}
                          {claim.status === 'submitted' && (
                            <>
                              <button onClick={() => reviewMutation.mutate({ id: claim.id, action: 'approved' })}
                                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                                <CheckIcon className="h-3.5 w-3.5" /> Approve
                              </button>
                              <span className="text-gray-300">|</span>
                              <button onClick={() => reviewMutation.mutate({ id: claim.id, action: 'rejected' })}
                                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium">
                                <XMarkIcon className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        }
      </div>
    </div>
  )
}
