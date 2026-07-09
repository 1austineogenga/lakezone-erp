import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { createInvoice } from '../../api/finance'
import api from '../../api/client'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const emptyLine = { description: '', quantity: '1', unit_price: '', account: '' }

export default function NewInvoicePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    invoice_type: 'progress_claim', client: '', project: '',
    due_date: '', period_from: '', period_to: '',
    vat_rate: '16', retention_rate: '0', notes: '',
  })
  const [lines, setLines] = useState([{ ...emptyLine }])

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn:  () => api.get('/crm/clients/'),
    select:   r => r.data?.results ?? r.data,
  })
  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn:  () => api.get('/projects/'),
    select:   r => r.data?.results ?? r.data,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: createInvoice,
    onSuccess:  (res) => { toast.success(`Invoice ${res.data.invoice_number} created.`); navigate('/finance/invoices') },
    onError:    () => toast.error('Failed to create invoice.'),
  })

  const setLine = (i, field, value) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0)
  const vat      = subtotal * (parseFloat(form.vat_rate) || 0) / 100
  const retention = subtotal * (parseFloat(form.retention_rate) || 0) / 100
  const total    = subtotal + vat - retention

  const handleSubmit = (e) => {
    e.preventDefault()
    mutate({
      ...form,
      lines: lines.map(l => ({ ...l, quantity: parseFloat(l.quantity), unit_price: parseFloat(l.unit_price) })),
    })
  }

  return (
    <div className="">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-brand-slate">New Invoice / Progress Claim</h2>
        <p className="text-sm text-gray-600">Issue an invoice to a client linked to a project</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-brand-slate mb-4">Invoice Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select value={form.invoice_type} onChange={e => setForm({...form, invoice_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
                <option value="progress_claim">Progress Claim (IPC)</option>
                <option value="variation">Variation Order</option>
                <option value="advance">Advance Payment</option>
                <option value="final">Final Account</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
              <select required value={form.client} onChange={e => setForm({...form, client: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
                <option value="">Select client…</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select value={form.project} onChange={e => setForm({...form, project: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
                <option value="">No project</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input required type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period From</label>
              <input type="date" value={form.period_from} onChange={e => setForm({...form, period_from: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period To</label>
              <input type="date" value={form.period_to} onChange={e => setForm({...form, period_to: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
              <input type="number" value={form.vat_rate} onChange={e => setForm({...form, vat_rate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retention Rate (%)</label>
              <input type="number" value={form.retention_rate} onChange={e => setForm({...form, retention_rate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red resize-none" />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-brand-slate">Line Items</h3>
            <button type="button" onClick={() => setLines(p => [...p, { ...emptyLine }])}
              className="flex items-center gap-1.5 text-xs text-brand-red font-medium">
              <PlusIcon className="h-4 w-4" /> Add Line
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  {i === 0 && <label className="block text-xs text-gray-600 mb-1">Description *</label>}
                  <input required value={line.description} onChange={e => setLine(i, 'description', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder="Work description" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-600 mb-1">Qty</label>}
                  <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => setLine(i, 'quantity', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
                </div>
                <div className="col-span-4">
                  {i === 0 && <label className="block text-xs text-gray-600 mb-1">Unit Price (KES)</label>}
                  <input type="number" min="0" step="0.01" value={line.unit_price} onChange={e => setLine(i, 'unit_price', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder="0.00" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button type="button" disabled={lines.length === 1} onClick={() => setLines(p => p.filter((_, idx) => idx !== i))}
                    className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-1.5 text-sm max-w-xs ml-auto">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>KES {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>VAT ({form.vat_rate}%)</span><span>KES {vat.toLocaleString()}</span>
            </div>
            {parseFloat(form.retention_rate) > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Retention ({form.retention_rate}%)</span><span>- KES {retention.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-brand-slate border-t pt-1.5">
              <span>Total</span><span>KES {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/finance/invoices')}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={isPending}
            className="px-5 py-2.5 text-sm font-medium text-white bg-brand-red hover:bg-brand-red-dark rounded-lg disabled:opacity-60">
            {isPending ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}
