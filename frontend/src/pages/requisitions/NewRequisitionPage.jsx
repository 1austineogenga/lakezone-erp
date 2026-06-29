import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon, TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { createRequisition } from '../../api/requisitions'
import { getProjects } from '../../api/projects'

const emptyItem = { description: '', quantity: '', unit: '', unit_price: '', notes: '' }

const REQ_TYPES = [
  { value: 'fuel',               label: 'Fuel Requisition',      hint: 'Diesel / petrol for vehicles or equipment' },
  { value: 'materials',          label: 'Materials Requisition', hint: 'Construction or site materials for purchase' },
  { value: 'repair_maintenance', label: 'Repair & Maintenance',  hint: 'Equipment or facility repair / service' },
  { value: 'general_purchase',   label: 'General Purchase',      hint: 'Any other procurement need' },
]

export default function NewRequisitionPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', req_type: 'fuel', priority: 'medium',
    description: '', date_required: '', project: '',
  })
  const [items, setItems] = useState([{ ...emptyItem }])

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => getProjects({ page_size: 100 }),
    select:   r => r.data?.results ?? r.data ?? [],
  })

  const { mutate, isPending } = useMutation({
    mutationFn: createRequisition,
    onSuccess: (res) => {
      toast.success(`Requisition ${res.data.reference_number} submitted.`)
      navigate('/requisitions')
    },
    onError: e => {
      const msg = e.response?.data?.items?.[0] || e.response?.data?.detail || 'Failed to submit.'
      toast.error(msg)
    },
  })

  const setItem = (i, field, value) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))

  const estimatedTotal = items.reduce(
    (sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form, items }
    if (!payload.project) delete payload.project
    mutate(payload)
  }

  const selectedType = REQ_TYPES.find(t => t.value === form.req_type)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <button onClick={() => navigate('/requisitions')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-slate mb-3">
          <ArrowLeftIcon className="h-3.5 w-3.5" /> Back to Requisitions
        </button>
        <h1 className="text-lg font-bold text-brand-slate">New Requisition</h1>
        <p className="text-xs text-gray-400 mt-0.5">Submitted directly to MD for approval</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Type selector */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-brand-slate mb-3">Requisition Type</h2>
          <div className="grid grid-cols-2 gap-2">
            {REQ_TYPES.map(t => (
              <button type="button" key={t.value} onClick={() => setForm(f => ({ ...f, req_type: t.value }))}
                className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-colors
                  ${form.req_type === t.value
                    ? 'border-brand-red bg-red-50 text-brand-red'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <p className="font-semibold">{t.label}</p>
                <p className={`mt-0.5 ${form.req_type === t.value ? 'text-red-400' : 'text-gray-400'}`}>{t.hint}</p>
              </button>
            ))}
          </div>
          {form.req_type === 'repair_maintenance' && (
            <p className="mt-3 text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-2">
              A maintenance schedule will be created by the site manager or admin once this requisition is submitted.
            </p>
          )}
          {form.req_type === 'fuel' && (
            <p className="mt-3 text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
              Finance will record the fuel payment (raised by finance or MD direct payment) once approved.
            </p>
          )}
        </div>

        {/* Details */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-brand-slate mb-3">Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={`e.g. ${selectedType?.label} — Site A`}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority *</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                {['low', 'medium', 'high', 'urgent'].map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date Required *</label>
              <input required type="date" value={form.date_required}
                onChange={e => setForm(f => ({ ...f, date_required: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Project (optional)</label>
              <select value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                <option value="">— None —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Description / Justification</label>
              <textarea rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Provide context or reason for this requisition…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red resize-none" />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-brand-slate">Line Items</h2>
            <button type="button" onClick={() => setItems(p => [...p, { ...emptyItem }])}
              className="flex items-center gap-1 text-xs text-brand-red font-semibold hover:underline">
              <PlusIcon className="h-3.5 w-3.5" /> Add item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {i === 0 && <label className="block text-[10px] text-gray-400 mb-1">Description *</label>}
                  <input required value={item.description} onChange={e => setItem(i, 'description', e.target.value)}
                    placeholder="Item or service"
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-[10px] text-gray-400 mb-1">Qty *</label>}
                  <input required type="number" min="0.01" step="0.01" value={item.quantity}
                    onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="1"
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-[10px] text-gray-400 mb-1">Unit</label>}
                  <input value={item.unit} onChange={e => setItem(i, 'unit', e.target.value)} placeholder="pcs / L"
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div className="col-span-3">
                  {i === 0 && <label className="block text-[10px] text-gray-400 mb-1">Unit Price (KES)</label>}
                  <input type="number" min="0" step="0.01" value={item.unit_price}
                    onChange={e => setItem(i, 'unit_price', e.target.value)} placeholder="0.00"
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div className="col-span-1 flex justify-center">
                  {i === 0 && <div className="h-4 mb-1" />}
                  <button type="button" disabled={items.length === 1}
                    onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                    className="p-1.5 text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
            <div className="text-xs">
              <span className="text-gray-400 mr-3">Estimated Total</span>
              <span className="font-bold text-brand-slate text-sm">KES {estimatedTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/requisitions')}
            className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={isPending}
            className="px-5 py-2 text-xs font-semibold text-white bg-brand-red rounded-xl hover:opacity-90 disabled:opacity-60">
            {isPending ? 'Submitting…' : 'Submit Requisition'}
          </button>
        </div>
      </form>
    </div>
  )
}
