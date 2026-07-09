import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createPO, getPRs, getSuppliers } from '../../api/procurement'
import { toast } from 'react-toastify'
import { PlusIcon, TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

const emptyItem = { description: '', unit: '', quantity: '', unit_price: '', notes: '' }
const inp = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent'

export default function NewPOPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    supplier: '',
    pr: '',
    delivery_date: '',
    delivery_address: '',
    notes: '',
  })
  const [items, setItems] = useState([{ ...emptyItem }])

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers({ page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: prs = [] } = useQuery({
    queryKey: ['prs-approved'],
    queryFn: () => getPRs({ status: 'approved', page_size: 100 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const mutation = useMutation({
    mutationFn: createPO,
    onSuccess: (res) => {
      toast.success(`Purchase Order ${res.data.po_number} created`)
      navigate(`/procurement/po/${res.data.id}`)
    },
    onError: (err) => {
      const data = err?.response?.data
      const msg = data
        ? (typeof data === 'string' ? data : JSON.stringify(data))
        : 'Failed to create purchase order'
      toast.error(msg)
    },
  })

  const addItem = () => setItems(p => [...p, { ...emptyItem }])
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) =>
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it))

  const total = items.reduce((sum, it) =>
    sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      supplier: form.supplier,
      delivery_date: form.delivery_date,
      delivery_address: form.delivery_address,
      notes: form.notes,
      line_items: items.map(it => ({
        description: it.description,
        unit: it.unit,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        notes: it.notes,
      })),
    }
    if (form.pr) payload.pr = form.pr
    mutation.mutate(payload)
  }

  return (
    <div className="">
      <button onClick={() => navigate('/procurement')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-slate mb-5">
        <ArrowLeftIcon className="h-4 w-4" /> Back to Procurement
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-slate">New Purchase Order</h1>
        <p className="text-sm text-gray-600 mt-0.5">Create a purchase order and send to supplier</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-brand-slate">Order Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Supplier *</label>
              <select required className={inp} value={form.supplier}
                onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}>
                <option value="">— Select supplier —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Linked PR (optional)</label>
              <select className={inp} value={form.pr}
                onChange={e => setForm(f => ({ ...f, pr: e.target.value }))}>
                <option value="">— None —</option>
                {prs.map(pr => (
                  <option key={pr.id} value={pr.id}>{pr.pr_number} — {pr.department}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Date *</label>
              <input required type="date" className={inp} value={form.delivery_date}
                onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Address *</label>
              <input required className={inp} placeholder="e.g. Site A, Kisumu"
                value={form.delivery_address}
                onChange={e => setForm(f => ({ ...f, delivery_address: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea rows={2} className={`${inp} resize-none`} placeholder="Additional instructions…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-brand-slate">Line Items</h3>
            <button type="button" onClick={addItem}
              className="flex items-center gap-1 text-sm text-brand-red hover:opacity-80 font-medium">
              <PlusIcon className="h-4 w-4" /> Add Item
            </button>
          </div>

          <div className="hidden sm:grid grid-cols-12 gap-2 mb-2 px-1">
            <span className="col-span-4 text-xs font-medium text-gray-600">Description</span>
            <span className="col-span-1 text-xs font-medium text-gray-600">Unit</span>
            <span className="col-span-2 text-xs font-medium text-gray-600">Qty</span>
            <span className="col-span-2 text-xs font-medium text-gray-600">Unit Price (KES)</span>
            <span className="col-span-2 text-xs font-medium text-gray-600">Amount</span>
            <span className="col-span-1" />
          </div>

          <div className="space-y-2">
            {items.map((item, i) => {
              const amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input required placeholder="Description *"
                    className={`${inp} col-span-4 text-xs`}
                    value={item.description}
                    onChange={e => updateItem(i, 'description', e.target.value)} />
                  <input required placeholder="pcs"
                    className={`${inp} col-span-1 text-xs`}
                    value={item.unit}
                    onChange={e => updateItem(i, 'unit', e.target.value)} />
                  <input required type="number" min="0.01" step="any" placeholder="0"
                    className={`${inp} col-span-2 text-xs`}
                    value={item.quantity}
                    onChange={e => updateItem(i, 'quantity', e.target.value)} />
                  <input required type="number" min="0" step="any" placeholder="0.00"
                    className={`${inp} col-span-2 text-xs`}
                    value={item.unit_price}
                    onChange={e => updateItem(i, 'unit_price', e.target.value)} />
                  <span className="col-span-2 text-xs text-gray-600 font-medium">
                    {amount > 0 ? amount.toLocaleString() : '—'}
                  </span>
                  <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                    className="col-span-1 text-red-400 hover:text-red-600 flex justify-center disabled:opacity-30">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>

          {total > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
              <div className="text-sm">
                <span className="text-gray-600 mr-3">Total Value:</span>
                <span className="font-bold text-brand-slate">KES {total.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={mutation.isPending}
            className="bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-60 transition-colors">
            {mutation.isPending ? 'Creating…' : 'Create Purchase Order'}
          </button>
          <button type="button" onClick={() => navigate('/procurement')}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
