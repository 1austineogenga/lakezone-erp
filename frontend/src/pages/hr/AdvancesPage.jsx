import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getSalaryAdvances, createSalaryAdvance, reviewAdvance } from '../../api/hr'
import { PlusIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import api from '../../api/client'

const STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  deducted: 'bg-gray-100 text-gray-500',
}

const fmt = n => `KES ${Number(n || 0).toLocaleString()}`
const EMPTY = { employee: '', amount: '', reason: '', requested_date: '', deduction_period: '' }

export default function AdvancesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatus] = useState('')
  const [form, setForm] = useState(EMPTY)

  const { data: advances, isLoading } = useQuery({
    queryKey: ['advances', statusFilter],
    queryFn: () => getSalaryAdvances(statusFilter ? { status: statusFilter } : undefined),
    select: r => r.data,
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-simple'],
    queryFn: () => api.get('/hr/employees/', { params: { is_active: true } }),
    select: r => r.data,
  })

  const createMut = useMutation({
    mutationFn: createSalaryAdvance,
    onSuccess: () => {
      toast.success('Advance request submitted.')
      qc.invalidateQueries(['advances'])
      setShowForm(false)
      setForm(EMPTY)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed.'),
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, action }) => reviewAdvance(id, { action }),
    onSuccess: () => { toast.success('Decision saved.'); qc.invalidateQueries(['advances']) },
  })

  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap items-center">
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowForm(s => !s)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
          <PlusIcon className="h-4 w-4" /> New Advance Request
        </button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate(form) }}
          className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Salary Advance Request</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Employee *</label>
              <select required {...f('employee')} className={cls}>
                <option value="">Select employee…</option>
                {employees?.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_number})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount (KES) *</label>
              <input required type="number" {...f('amount')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Requested Date *</label>
              <input required type="date" {...f('requested_date')} className={cls} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Reason *</label>
              <textarea required {...f('reason')} rows={2}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg disabled:opacity-60">
              Submit
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-gray-300 text-xs rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Salary Advances</h3>
        </div>
        {isLoading
          ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
          : !advances || advances.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No advance requests.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Employee', 'Amount', 'Reason', 'Requested', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {advances.map(adv => (
                      <tr key={adv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-brand-slate text-xs">{adv.employee_number}</p>
                          <p className="text-xs text-gray-500">{adv.employee_name}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-sm">{fmt(adv.amount)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{adv.reason}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{adv.requested_date}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[adv.status]}`}>
                            {adv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {adv.status === 'pending' && (
                            <div className="flex gap-2">
                              <button onClick={() => reviewMut.mutate({ id: adv.id, action: 'approved' })}
                                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                                <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button onClick={() => reviewMut.mutate({ id: adv.id, action: 'rejected' })}
                                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium">
                                <XCircleIcon className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </div>
    </div>
  )
}
