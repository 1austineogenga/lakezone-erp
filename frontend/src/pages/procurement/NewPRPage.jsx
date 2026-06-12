import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createPR } from '../../api/procurement'
import { getProjects } from '../../api/projects'
import PageHeader from '../../components/common/PageHeader'
import { toast } from 'react-toastify'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const emptyItem = { description: '', quantity: '', unit_price: '', unit: '' }

export default function NewPRPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', project: '', date_required: '', notes: '' })
  const [items, setItems] = useState([{ ...emptyItem }])

  const { data: projData } = useQuery({ queryKey: ['projects'], queryFn: () => getProjects({ page_size: 100 }) })
  const projects = projData?.data?.results ?? []

  const mutation = useMutation({
    mutationFn: (data) => createPR(data),
    onSuccess: () => { toast.success('Requisition created'); navigate('/procurement') },
    onError: () => toast.error('Failed to create requisition'),
  })

  const addItem = () => setItems([...items, { ...emptyItem }])
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it))

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({ ...form, items })
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent'

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New Purchase Requisition"
        action={<button onClick={() => navigate('/procurement')} className="text-sm text-brand-slate underline">← Back</button>}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-brand-slate">Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input required className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
              <select className={inputCls} value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>
                <option value="">— Select project —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date Required *</label>
              <input required type="date" className={inputCls} value={form.date_required} onChange={(e) => setForm({ ...form, date_required: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-brand-slate">Line Items</h3>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-brand-red hover:text-brand-red-dark font-medium">
              <PlusIcon className="h-4 w-4" /> Add Item
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input placeholder="Description" className={`${inputCls} col-span-4`} value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} />
                <input placeholder="Unit" className={`${inputCls} col-span-2`} value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} />
                <input placeholder="Qty" type="number" className={`${inputCls} col-span-2`} value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
                <input placeholder="Unit Price" type="number" className={`${inputCls} col-span-3`} value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} />
                <button type="button" onClick={() => removeItem(i)} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={mutation.isPending} className="bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-60">
            {mutation.isPending ? 'Submitting…' : 'Submit Requisition'}
          </button>
          <button type="button" onClick={() => navigate('/procurement')} className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
