import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getPayrollPeriods, createPayrollPeriod, generatePayroll, approvePayroll } from '../../api/hr'
import { PlusIcon, BoltIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import api from '../../api/client'

const STATUS_COLORS = {
  draft:      'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  approved:   'bg-green-100 text-green-700',
  paid:       'bg-emerald-100 text-emerald-700',
  closed:     'bg-gray-100 text-gray-400',
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const currentYear  = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export default function PayrollPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', month: currentMonth, year: currentYear, payment_date: '', notes: '',
  })

  const { data: periods, isLoading } = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: getPayrollPeriods,
    select: r => r.data?.results ?? r.data,
  })

  const createMut = useMutation({
    mutationFn: createPayrollPeriod,
    onSuccess: () => {
      toast.success('Payroll period created.')
      qc.invalidateQueries(['payroll-periods'])
      setShowForm(false)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to create.'),
  })

  const generateMut = useMutation({
    mutationFn: generatePayroll,
    onSuccess: d => {
      toast.success(`Generated ${d.data.created} payroll entries.`)
      qc.invalidateQueries(['payroll-periods'])
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to generate.'),
  })

  const approveMut = useMutation({
    mutationFn: approvePayroll,
    onSuccess: () => { toast.success('Payroll approved.'); qc.invalidateQueries(['payroll-periods']) },
  })

  const payMut = useMutation({
    mutationFn: (id) => api.post(`/hr/payroll/periods/${id}/pay/`),
    onSuccess: () => { toast.success('Payroll marked as paid.'); qc.invalidateQueries(['payroll-periods']) },
  })

  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form, month: Number(form.month), year: Number(form.year) }
    if (!payload.name) payload.name = `${MONTHS[payload.month - 1]} ${payload.year}`
    createMut.mutate(payload)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-brand-slate">Payroll Periods</h2>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
          <PlusIcon className="h-4 w-4" /> New Period
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Payroll Period</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Name (optional)</label>
              <input {...f('name')} placeholder="Auto-filled from month/year" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Month *</label>
              <select required {...f('month')} className={cls}>
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Year *</label>
              <input required type="number" {...f('year')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Payment Date</label>
              <input type="date" {...f('payment_date')} className={cls} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg disabled:opacity-60">
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-gray-300 text-xs rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {isLoading
          ? <p className="text-sm text-gray-600 p-8 text-center">Loading…</p>
          : !periods || periods.length === 0
            ? <p className="text-sm text-gray-600 p-8 text-center">No payroll periods yet.</p>
            : <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Period', 'Entries', 'Payment Date', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {periods.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/hr/payroll/${p.id}`} className="font-medium text-brand-slate hover:text-brand-red text-sm">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{p.entry_count}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{p.payment_date || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {p.status === 'draft' && (
                            <button onClick={() => generateMut.mutate(p.id)} disabled={generateMut.isPending}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                              <BoltIcon className="h-3.5 w-3.5" /> Generate
                            </button>
                          )}
                          {p.status === 'processing' && (
                            <button onClick={() => approveMut.mutate(p.id)}
                              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                              <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
                            </button>
                          )}
                          {p.status === 'approved' && (
                            <button onClick={() => payMut.mutate(p.id)}
                              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                              Mark Paid
                            </button>
                          )}
                          <Link to={`/hr/payroll/${p.id}`}
                            className="text-xs text-gray-500 hover:text-brand-slate font-medium">
                            View
                          </Link>
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
