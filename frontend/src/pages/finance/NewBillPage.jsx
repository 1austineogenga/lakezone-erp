import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { createBill } from '../../api/finance'
import api from '../../api/client'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const emptyLine = { description: '', quantity: '1', unit_price: '', cost_code: '' }

export default function NewBillPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    bill_type: 'supplier', supplier: '', project: '',
    purchase_order: '', issue_date: '', due_date: '',
    supplier_ref: '', vat_amount: '0', withholding_tax: '0', notes: '',
  })
  const [lines, setLines] = useState([{ ...emptyLine }])

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn:  () => api.get('/procurement/suppliers/'),
    select:   r => r.data?.results ?? r.data,
  })
  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn:  () => api.get('/projects/'),
    select:   r => r.data?.results ?? r.data,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: createBill,
    onSuccess:  (res) => { toast.success(`Bill ${res.data.bill_number} recorded.`); navigate('/finance/bills') },
    onError:    () => toast.error('Failed to record bill.'),
  })

  const setLine = (i, field, value) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0)
  const total    = subtotal + (parseFloat(form.vat_amount) || 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    mutate({
      ...form,
      vat_amount: parseFloat(form.vat_amount) || 0,
      withholding_tax: parseFloat(form.withholding_tax) || 0,
      purchase_order: form.purchase_order || null,
      project: form.project || null,
      lines: lines.map(l => ({ ...l, quantity: parseFloat(l.quantity), unit_price: parseFloat(l.unit_price) })),
    })
  }

  return (
    <div className="">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-brand-slate">Record Vendor Bill</h2>
        <p className="text-sm text-gray-600">Record a supplier invoice or subcontractor certificate</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-brand-slate mb-4">Bill Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select value={form.bill_type} onChange={e => setForm({...form, bill_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
                <option value="supplier">Supplier Invoice</option>
                <option value="subcontractor">Subcontractor Certificate</option>
                <option value="utility">Utility / Overhead</option>
                <option value="professional">Professional Fee</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
              <select required value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
                <option value="">Select supplier…</option>
                {suppliers?.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Ref / Invoice No.</label>
              <input value={form.supplier_ref} onChange={e => setForm({...form, supplier_ref: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                placeholder="Supplier's invoice number" />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date *</label>
              <input required type="date" value={form.issue_date} onChange={e => setForm({...form, issue_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input required type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VAT Amount (KES)</label>
              <input type="number" min="0" step="0.01" value={form.vat_amount} onChange={e => setForm({...form, vat_amount: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Withholding Tax / WHT (KES)</label>
              <input type="number" min="0" step="0.01" value={form.withholding_tax} onChange={e => setForm({...form, withholding_tax: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red resize-none" />
            </div>
          </div>
        </div>

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
                    placeholder="Item / service" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-600 mb-1">Qty</label>}
                  <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => setLine(i, 'quantity', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
                </div>
                <div className="col-span-3">
                  {i === 0 && <label className="block text-xs text-gray-600 mb-1">Unit Price (KES)</label>}
                  <input type="number" min="0" step="0.01" value={line.unit_price} onChange={e => setLine(i, 'unit_price', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder="0.00" />
                </div>
                <div className="col-span-1">
                  {i === 0 && <label className="block text-xs text-gray-600 mb-1">Cost Code</label>}
                  <select value={line.cost_code} onChange={e => setLine(i, 'cost_code', e.target.value)}
                    className="w-full px-1.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-red">
                    <option value="">—</option>
                    {['materials','labour','plant','subcontractor','preliminaries','overhead'].map(c =>
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
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
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-1.5 text-sm max-w-xs ml-auto">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>KES {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>VAT</span><span>KES {Number(form.vat_amount || 0).toLocaleString()}</span>
            </div>
            {parseFloat(form.withholding_tax) > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>WHT</span><span>- KES {Number(form.withholding_tax).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-brand-slate border-t pt-1.5">
              <span>Total</span><span>KES {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/finance/bills')}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={isPending}
            className="px-5 py-2.5 text-sm font-medium text-white bg-brand-red hover:bg-brand-red-dark rounded-lg disabled:opacity-60">
            {isPending ? 'Recording…' : 'Record Bill'}
          </button>
        </div>
      </form>
    </div>
  )
}
