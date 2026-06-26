import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getRetentionSchedule, createRetentionRelease, actionRetentionRelease } from '../../api/finance'
import api from '../../api/client'
import { PlusIcon, CheckIcon, LockOpenIcon } from '@heroicons/react/24/outline'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

const STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-700',
  released: 'bg-blue-100 text-blue-700',
  paid:     'bg-green-100 text-green-700',
}

export default function RetentionPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    retention_type: 'receivable', invoice: '', bill: '', project: '',
    amount: '', release_date: '', notes: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['retention'],
    queryFn:  getRetentionSchedule,
    select:   r => r.data?.results ?? r.data,
  })
  const { data: invoices } = useQuery({
    queryKey: ['invoices-simple'],
    queryFn:  () => api.get('/finance/invoices/'),
    select:   r => r.data?.filter(i => i.retention_amount > 0),
  })
  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn:  () => api.get('/projects/'),
    select:   r => r.data?.results ?? r.data,
  })

  const createMutation = useMutation({
    mutationFn: createRetentionRelease,
    onSuccess:  () => { toast.success('Retention release recorded.'); qc.invalidateQueries(['retention']); setShowForm(false) },
    onError:    () => toast.error('Failed to record.'),
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, status }) => actionRetentionRelease(id, { status }),
    onSuccess:  () => { toast.success('Status updated.'); qc.invalidateQueries(['retention']) },
    onError:    () => toast.error('Action failed.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createMutation.mutate({
      ...form,
      amount: parseFloat(form.amount),
      invoice: form.invoice || null,
      bill: form.bill || null,
      project: form.project || null,
    })
  }

  if (isLoading) return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>

  const { summary, ar_invoices = [], releases = [] } = data || {}

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total AR Retention Held</p>
          <p className="text-xl font-bold text-brand-slate">{fmt(summary?.ar_retention_held)}</p>
          <p className="text-xs text-gray-400 mt-1">Clients holding on our invoices</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Released to Date</p>
          <p className="text-xl font-bold text-green-600">{fmt(summary?.ar_retention_released)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Net Retention Due</p>
          <p className="text-xl font-bold text-orange-600">{fmt(summary?.ar_retention_net)}</p>
          <p className="text-xs text-gray-400 mt-1">Still to be released by clients</p>
        </div>
      </div>

      {/* AR invoices with retention */}
      {ar_invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Invoices with Retention Held</h3>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Invoice', 'Client', 'Project', 'Issue Date', 'Retention Held'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ar_invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-brand-slate font-medium">{inv.invoice_number}</td>
                  <td className="px-4 py-2.5 text-gray-700">{inv['client__company_name']}</td>
                  <td className="px-4 py-2.5 text-gray-500">{inv['project__name'] || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{inv.issue_date}</td>
                  <td className="px-4 py-2.5 font-semibold text-orange-600">{fmt(inv.retention_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Releases schedule */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Release Schedule</h3>
          <button onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 text-xs text-brand-red font-medium">
            <PlusIcon className="h-4 w-4" /> Record Release
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="p-5 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type *</label>
                <select required value={form.retention_type} onChange={e => setForm({...form, retention_type: e.target.value})}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
                  <option value="receivable">Receivable (client owes us)</option>
                  <option value="payable">Payable (we owe subcontractor)</option>
                </select>
              </div>
              {form.retention_type === 'receivable' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Invoice</label>
                  <select value={form.invoice} onChange={e => setForm({...form, invoice: e.target.value})}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
                    <option value="">Select invoice…</option>
                    {invoices?.map(i => <option key={i.id} value={i.id}>{i.invoice_number} — {i.client_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Project</label>
                <select value={form.project} onChange={e => setForm({...form, project: e.target.value})}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
                  <option value="">No project</option>
                  {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount (KES) *</label>
                <input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Release Date *</label>
                <input required type="date" value={form.release_date} onChange={e => setForm({...form, release_date: e.target.value})}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="submit" disabled={createMutation.isPending}
                className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-brand-red-dark disabled:opacity-60">
                Save Release
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        )}

        {releases.length === 0
          ? <p className="text-sm text-gray-400 p-5">No retention releases recorded yet.</p>
          : <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Type', 'Project', 'Invoice / Bill', 'Amount', 'Release Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {releases.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 capitalize text-xs font-medium text-gray-700">
                      {r.retention_type}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 truncate max-w-[120px]">{r.project_name || '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-brand-slate">
                      {r.invoice_number || r.bill_number || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-orange-600">{fmt(r.amount)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.release_date}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        {r.status === 'pending' && (
                          <button onClick={() => actionMutation.mutate({ id: r.id, status: 'released' })}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                            <LockOpenIcon className="h-3.5 w-3.5" /> Release
                          </button>
                        )}
                        {r.status === 'released' && (
                          <button onClick={() => actionMutation.mutate({ id: r.id, status: 'paid' })}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                            <CheckIcon className="h-3.5 w-3.5" /> Mark Paid
                          </button>
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
