import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getCertificates, createCertificate, updateCertificate } from '../../api/finance'
import api from '../../api/client'
import { PlusIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

const STATUS_COLORS = {
  draft:    'bg-gray-100 text-gray-600',
  issued:   'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  paid:     'bg-emerald-100 text-emerald-700',
}

const EMPTY_FORM = {
  invoice: '', project: '', certified_by: '', certificate_date: '',
  period_from: '', period_to: '', contract_value: '', work_done_to_date: '',
  previous_certified: '', retention_held: '', notes: '',
}

export default function PaymentCertificatesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [projectFilter, setProjectFilter] = useState('')

  const { data: certs, isLoading } = useQuery({
    queryKey: ['certificates', projectFilter],
    queryFn: () => getCertificates(projectFilter ? { project: projectFilter } : undefined),
    select: r => r.data?.results ?? r.data,
  })

  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/projects/'),
    select: r => r.data?.results ?? r.data,
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices-simple'],
    queryFn: () => api.get('/finance/invoices/'),
    select: r => r.data?.results ?? r.data,
  })

  const createMut = useMutation({
    mutationFn: createCertificate,
    onSuccess: () => {
      toast.success('Payment Certificate created.')
      qc.invalidateQueries(['certificates'])
      setShowForm(false)
      setForm(EMPTY_FORM)
    },
    onError: () => toast.error('Failed to create certificate.'),
  })

  const approveMut = useMutation({
    mutationFn: ({ id, status }) => updateCertificate(id, { status }),
    onSuccess: () => { toast.success('Status updated.'); qc.invalidateQueries(['certificates']) },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    ;['contract_value', 'work_done_to_date', 'previous_certified', 'retention_held'].forEach(f => {
      payload[f] = parseFloat(payload[f] || 0)
    })
    if (!payload.invoice) delete payload.invoice
    if (!payload.project) delete payload.project
    if (!payload.period_from) delete payload.period_from
    if (!payload.period_to)   delete payload.period_to
    createMut.mutate(payload)
  }

  const f = (k) => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) })
  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
          <option value="">All Projects</option>
          {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setShowForm(s => !s)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
          <PlusIcon className="h-4 w-4" /> New Certificate (IPC)
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Payment Certificate / IPC</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Project</label>
              <select {...f('project')} className={cls}>
                <option value="">No specific project</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Related Invoice (AR)</label>
              <select {...f('invoice')} className={cls}>
                <option value="">Not linked</option>
                {invoices?.map(i => <option key={i.id} value={i.id}>{i.invoice_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Certified By *</label>
              <input required {...f('certified_by')} placeholder="Architect / QS name" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Certificate Date *</label>
              <input required type="date" {...f('certificate_date')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Period From</label>
              <input type="date" {...f('period_from')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Period To</label>
              <input type="date" {...f('period_to')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contract Value (KES)</label>
              <input type="number" min="0" step="0.01" {...f('contract_value')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Work Done to Date (KES) *</label>
              <input required type="number" min="0" step="0.01" {...f('work_done_to_date')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Previously Certified (KES)</label>
              <input type="number" min="0" step="0.01" {...f('previous_certified')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Retention Held (KES)</label>
              <input type="number" min="0" step="0.01" {...f('retention_held')} className={cls} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <input {...f('notes')} className={cls} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-brand-red-dark disabled:opacity-60">
              Create Certificate
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Payment Certificates / Interim Payment Certificates (IPC)</h3>
        </div>
        {isLoading
          ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
          : !certs || certs.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No payment certificates yet.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Certificate #', 'Project', 'Certified By', 'Date', 'Certified Amount', 'Retention', 'Net Payment', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {certs.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-slate">{c.certificate_number}</td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{c.project_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{c.certified_by}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{c.certificate_date}</td>
                        <td className="px-4 py-3 font-medium">{fmt(c.certified_amount)}</td>
                        <td className="px-4 py-3 text-orange-600">{c.retention_held > 0 ? fmt(c.retention_held) : '—'}</td>
                        <td className="px-4 py-3 font-bold text-brand-slate">{fmt(c.net_payment_due)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {c.status === 'draft' && (
                              <button onClick={() => approveMut.mutate({ id: c.id, status: 'issued' })}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium">Issue</button>
                            )}
                            {c.status === 'issued' && (
                              <button onClick={() => approveMut.mutate({ id: c.id, status: 'approved' })}
                                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                                <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
                              </button>
                            )}
                            {c.status === 'approved' && (
                              <button onClick={() => approveMut.mutate({ id: c.id, status: 'paid' })}
                                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Mark Paid</button>
                            )}
                          </div>
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
