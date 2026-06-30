import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createPR } from '../../api/procurement'
import { getProjects } from '../../api/projects'
import { toast } from 'react-toastify'
import { PlusIcon, TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

const emptyItem = { description: '', unit: '', quantity: '', estimated_unit_rate: '', notes: '' }

export default function NewPRPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    department: '',
    project: '',
    required_by_date: '',
  })
  const [items, setItems] = useState([{ ...emptyItem }])

  const { data: projData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects({ page_size: 100 }),
  })
  const projects = projData?.data?.results ?? []

  const mutation = useMutation({
    mutationFn: (data) => createPR(data),
    onSuccess: (res) => {
      toast.success('Purchase Requisition created')
      navigate(`/procurement/pr/${res.data.id}`)
    },
    onError: (err) => {
      const msg = err?.response?.data
        ? JSON.stringify(err.response.data)
        : 'Failed to create requisition'
      toast.error(msg)
    },
  })

  const addItem = () => setItems([...items, { ...emptyItem }])
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)))

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      department: form.department,
      required_by_date: form.required_by_date,
      line_items: items.map(it => ({
        description: it.description,
        unit: it.unit,
        quantity: Number(it.quantity),
        estimated_unit_rate: Number(it.estimated_unit_rate),
        notes: it.notes,
      })),
    }
    if (form.project) payload.project = form.project
    mutation.mutate(payload)
  }

  const inp = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent'

  // Calculate live total
  const total = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity) || 0
    const rate = parseFloat(it.estimated_unit_rate) || 0
    return sum + qty * rate
  }, 0)

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => navigate('/procurement')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-slate mb-5"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Back to Procurement
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-brand-slate">New Purchase Requisition</h1>
          <p className="text-sm text-gray-600 mt-0.5">Fill in the details and line items below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Details card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-brand-slate">Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department *</label>
              <input
                required
                className={inp}
                placeholder="e.g. Engineering"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Project (optional)</label>
              <select
                className={inp}
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
              >
                <option value="">— Select project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Required By Date *</label>
              <input
                required
                type="date"
                className={inp}
                value={form.required_by_date}
                onChange={(e) => setForm({ ...form, required_by_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-brand-slate">Line Items</h3>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-sm text-brand-red hover:opacity-80 font-medium"
            >
              <PlusIcon className="h-4 w-4" /> Add Item
            </button>
          </div>

          {/* Header row */}
          <div className="hidden sm:grid grid-cols-12 gap-2 mb-2 px-1">
            <span className="col-span-4 text-xs font-medium text-gray-600">Description</span>
            <span className="col-span-1 text-xs font-medium text-gray-600">Unit</span>
            <span className="col-span-2 text-xs font-medium text-gray-600">Qty</span>
            <span className="col-span-2 text-xs font-medium text-gray-600">Unit Rate (KES)</span>
            <span className="col-span-2 text-xs font-medium text-gray-600">Amount</span>
            <span className="col-span-1" />
          </div>

          <div className="space-y-2">
            {items.map((item, i) => {
              const amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.estimated_unit_rate) || 0)
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    required
                    placeholder="Description *"
                    className={`${inp} col-span-4 text-xs`}
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                  />
                  <input
                    required
                    placeholder="Unit *"
                    className={`${inp} col-span-1 text-xs`}
                    value={item.unit}
                    onChange={(e) => updateItem(i, 'unit', e.target.value)}
                  />
                  <input
                    required
                    placeholder="0"
                    type="number"
                    min="0"
                    step="any"
                    className={`${inp} col-span-2 text-xs`}
                    value={item.quantity}
                    onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  />
                  <input
                    placeholder="0.00"
                    type="number"
                    min="0"
                    step="any"
                    className={`${inp} col-span-2 text-xs`}
                    value={item.estimated_unit_rate}
                    onChange={(e) => updateItem(i, 'estimated_unit_rate', e.target.value)}
                  />
                  <span className="col-span-2 text-xs text-gray-600 font-medium">
                    {amount > 0 ? amount.toLocaleString() : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="col-span-1 text-red-400 hover:text-red-600 flex justify-center disabled:opacity-30"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>

          {total > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
              <div className="text-sm">
                <span className="text-gray-600 mr-3">Estimated Total:</span>
                <span className="font-bold text-brand-slate">KES {total.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-60 transition-colors"
          >
            {mutation.isPending ? 'Submitting…' : 'Submit Requisition'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/procurement')}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
