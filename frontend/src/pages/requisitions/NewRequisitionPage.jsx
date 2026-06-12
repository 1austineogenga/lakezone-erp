import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { createRequisition } from '../../api/requisitions'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const emptyItem = { description: '', quantity: '', unit: '', unit_price: '', notes: '' }

export default function NewRequisitionPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', req_type: 'store_item', priority: 'medium',
    description: '', date_required: '',
  })
  const [items, setItems] = useState([{ ...emptyItem }])

  const { mutate, isPending } = useMutation({
    mutationFn: createRequisition,
    onSuccess: (res) => {
      toast.success(`Requisition ${res.data.reference_number} submitted.`)
      navigate('/requisitions')
    },
    onError: () => toast.error('Failed to submit requisition.'),
  })

  const setItem = (i, field, value) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    mutate({ ...form, items })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-slate">New Requisition</h1>
        <p className="text-sm text-gray-500">Submit a request for items, purchases or services</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-brand-slate mb-4">Requisition Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                required value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                placeholder="e.g. Office stationery for Q3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={form.req_type}
                onChange={e => setForm({ ...form, req_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
              >
                <option value="store_item">Store Item</option>
                <option value="external_purchase">External Purchase</option>
                <option value="service">Service Request</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Required *</label>
              <input
                required type="date" value={form.date_required}
                onChange={e => setForm({ ...form, date_required: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red resize-none"
                placeholder="Additional context or justification…"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-slate">Line Items</h2>
            <button
              type="button"
              onClick={() => setItems(p => [...p, { ...emptyItem }])}
              className="flex items-center gap-1.5 text-xs text-brand-red hover:text-brand-red-dark font-medium"
            >
              <PlusIcon className="h-4 w-4" /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Description *</label>}
                  <input
                    required value={item.description}
                    onChange={e => setItem(i, 'description', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder="Item / service name"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Qty *</label>}
                  <input
                    required type="number" min="0.01" step="0.01" value={item.quantity}
                    onChange={e => setItem(i, 'quantity', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder="1"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Unit</label>}
                  <input
                    value={item.unit}
                    onChange={e => setItem(i, 'unit', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder="pcs"
                  />
                </div>
                <div className="col-span-3">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Unit Price (TZS)</label>}
                  <input
                    type="number" min="0" step="0.01" value={item.unit_price}
                    onChange={e => setItem(i, 'unit_price', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  {i === 0 && <div className="h-4 mb-1" />}
                  <button
                    type="button"
                    disabled={items.length === 1}
                    onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                    className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total preview */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
            <div className="text-sm">
              <span className="text-gray-500 mr-3">Estimated Total:</span>
              <span className="font-bold text-brand-slate">
                TZS {items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/requisitions')}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 text-sm font-medium text-white bg-brand-red hover:bg-brand-red-dark rounded-lg transition-colors disabled:opacity-60"
          >
            {isPending ? 'Submitting…' : 'Submit Requisition'}
          </button>
        </div>
      </form>
    </div>
  )
}
