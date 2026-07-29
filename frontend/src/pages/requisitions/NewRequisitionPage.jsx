import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon, TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { createRequisition } from '../../api/requisitions'
import { getProjects } from '../../api/projects'
import { getStores, getStoreItems, getAssets } from '../../api/inventory'

const emptyItem = { description: '', quantity: '', unit: '', unit_price: '', notes: '', stock_item: '', asset_code: '' }
const PAYMENT_TYPES = ['fuel', 'materials', 'general_purchase']

const REQ_TYPES = [
  { value: 'fuel',               label: 'Fuel Requisition',      hint: 'Diesel / petrol for vehicles or equipment' },
  { value: 'materials',          label: 'Materials Requisition', hint: 'Construction or site materials for purchase' },
  { value: 'repair_maintenance', label: 'Repair & Maintenance',  hint: 'Equipment or facility repair / service' },
  { value: 'general_purchase',   label: 'General Purchase',      hint: 'Any other procurement need' },
  { value: 'store_request',      label: 'Store Request',         hint: 'Request items from a store (inventory or assets)' },
  { value: 'staff_movement',     label: 'Staff Movement',        hint: 'Employee transfer / deployment to site or office' },
]

const MOVEMENT_TYPES = [
  { value: 'transfer',    label: 'Permanent Transfer' },
  { value: 'deployment',  label: 'Site Deployment' },
  { value: 'temporary',   label: 'Temporary Assignment' },
  { value: 'recall',      label: 'Recall to Base' },
]

const emptyMovement = {
  employee_name: '', employee_id: '', department: '',
  movement_type: 'deployment',
  from_location: '', to_location: '',
  effective_date: '', end_date: '',
  allowance_amount: '',
  reason: '',
}

export default function NewRequisitionPage() {
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const [form, setForm] = useState({
    title: '', req_type: 'fuel', priority: 'medium',
    description: '', date_required: '', project: '',
    source_store: '',
    payment_method: '',
    payment_business_number: '', payment_account_number: '',
    payment_till_number: '', payment_send_money_phone: '',
    payment_bank_name: '', payment_account_name: '', payment_branch_name: '',
  })
  const [items, setItems]       = useState([{ ...emptyItem }])
  const [movement, setMovement] = useState({ ...emptyMovement })

  const isStoreReq = form.req_type === 'store_request'
  const isMovement = form.req_type === 'staff_movement'

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => getProjects({ page_size: 100 }),
    select:   r => r.data?.results ?? r.data ?? [],
  })

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn:  () => getStores(),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  isStoreReq,
  })

  const { data: storeStockItems = [] } = useQuery({
    queryKey: ['store-items', form.source_store],
    queryFn:  () => getStoreItems(form.source_store),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  isStoreReq && !!form.source_store,
  })

  const { data: storeAssets = [] } = useQuery({
    queryKey: ['assets-simple'],
    queryFn:  () => getAssets({ page_size: 300, status: 'operational' }),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  isStoreReq,
  })

  const allStoreItems = [
    ...storeStockItems.map(si => ({ value: si.id, label: `[STOCK] ${si.name}`, unit: si.unit, asset_code: '' })),
    ...storeAssets.map(a  => ({ value: a.id,  label: `[ASSET] ${a.name} (${a.asset_code})`, unit: 'unit', asset_code: a.asset_code })),
  ]

  const { mutate, isPending } = useMutation({
    mutationFn: createRequisition,
    onSuccess: (res) => {
      toast.success(`Requisition ${res.data.reference_number} submitted.`)
      qc.invalidateQueries({ queryKey: ['requisitions'] })
      navigate('/requisitions')
    },
    onError: e => {
      const msg = e.response?.data?.items?.[0] || e.response?.data?.detail || 'Failed to submit.'
      toast.error(msg)
    },
  })

  const setItem = (i, field, value) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))

  const handleStoreItemSelect = (i, selectedValue) => {
    const found = allStoreItems.find(s => s.value === selectedValue || s.asset_code === selectedValue)
    if (!found) { setItem(i, 'stock_item', selectedValue); return }
    const isAsset = found.label.startsWith('[ASSET]')
    setItems(prev => prev.map((it, idx) => idx !== i ? it : {
      ...it,
      description: found.label.replace('[STOCK] ', '').replace('[ASSET] ', ''),
      unit:        found.unit || 'unit',
      stock_item:  isAsset ? '' : found.value,
      asset_code:  isAsset ? found.asset_code : '',
    }))
  }

  const estimatedTotal = items.reduce(
    (sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0
  )

  const handleSubmit = (e) => {
    e.preventDefault()

    if (isMovement) {
      // Build a single item from the movement form fields
      const mv = movement
      const movLabel = MOVEMENT_TYPES.find(m => m.value === mv.movement_type)?.label || mv.movement_type
      const desc = `${movLabel}: ${mv.employee_name}${mv.employee_id ? ` (${mv.employee_id})` : ''} — From: ${mv.from_location} → To: ${mv.to_location}. Effective: ${mv.effective_date}${mv.end_date ? ` to ${mv.end_date}` : ''}.${mv.department ? ` Dept: ${mv.department}.` : ''}`
      const movItems = [{ description: desc, quantity: 1, unit: 'person', unit_price: parseFloat(mv.allowance_amount) || 0, notes: mv.reason }]
      const payload = {
        ...form,
        description: mv.reason || form.description,
        date_required: mv.effective_date || form.date_required,
        items: movItems,
      }
      delete payload.source_store
      mutate(payload)
      return
    }

    const payload = { ...form, items }
    if (!payload.project) delete payload.project
    if (!payload.source_store) delete payload.source_store
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
        <p className="text-xs text-gray-600 mt-0.5">
          {isStoreReq ? 'HR approves → MD approves → Storekeeper issues' :
           isMovement  ? 'HR reviews → MD approves' :
           'Submitted directly to MD for approval'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Type selector */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-brand-slate mb-3">Requisition Type</h2>
          <div className="grid grid-cols-2 gap-2">
            {REQ_TYPES.map(t => (
              <button type="button" key={t.value}
                onClick={() => { setForm(f => ({ ...f, req_type: t.value, source_store: '' })); setItems([{ ...emptyItem }]); setMovement({ ...emptyMovement }) }}
                className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-colors
                  ${form.req_type === t.value
                    ? 'border-brand-red bg-red-50 text-brand-red'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <p className="font-semibold">{t.label}</p>
                <p className={`mt-0.5 ${form.req_type === t.value ? 'text-red-400' : 'text-gray-600'}`}>{t.hint}</p>
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
          {isStoreReq && (
            <p className="mt-3 text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2">
              HR will approve first, then MD. The storekeeper will issue items using a Counter Issue Form which requires both signatures.
            </p>
          )}
          {isMovement && (
            <p className="mt-3 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              HR reviews and approves, then MD gives final approval.
            </p>
          )}
        </div>

        {/* ── STAFF MOVEMENT form ─────────────────────────────────────── */}
        {isMovement && (
          <>
            {/* Common header fields */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-brand-slate mb-3">Requisition Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Site Deployment — Site A"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority *</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                    {['low', 'medium', 'high', 'urgent'].map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Project (optional)</label>
                  <select value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                    <option value="">— None —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Movement-specific fields */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-brand-slate mb-3">Movement Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Employee Name *</label>
                  <input required value={movement.employee_name}
                    onChange={e => setMovement(m => ({ ...m, employee_name: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID / Staff No.</label>
                  <input value={movement.employee_id}
                    onChange={e => setMovement(m => ({ ...m, employee_id: e.target.value }))}
                    placeholder="e.g. LZ-001"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                  <input value={movement.department}
                    onChange={e => setMovement(m => ({ ...m, department: e.target.value }))}
                    placeholder="e.g. Civil Works"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Movement Type *</label>
                  <select required value={movement.movement_type}
                    onChange={e => setMovement(m => ({ ...m, movement_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                    {MOVEMENT_TYPES.map(mt => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From Location *</label>
                  <input required value={movement.from_location}
                    onChange={e => setMovement(m => ({ ...m, from_location: e.target.value }))}
                    placeholder="e.g. Head Office / Site B"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To Location *</label>
                  <input required value={movement.to_location}
                    onChange={e => setMovement(m => ({ ...m, to_location: e.target.value }))}
                    placeholder="e.g. Site A"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date *</label>
                  <input required type="date" value={movement.effective_date}
                    onChange={e => setMovement(m => ({ ...m, effective_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date (if temporary)</label>
                  <input type="date" value={movement.end_date}
                    onChange={e => setMovement(m => ({ ...m, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Allowance / Claim (KES)</label>
                  <input type="number" min="0" step="0.01" value={movement.allowance_amount}
                    onChange={e => setMovement(m => ({ ...m, allowance_amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason / Justification *</label>
                  <textarea required rows={3} value={movement.reason}
                    onChange={e => setMovement(m => ({ ...m, reason: e.target.value }))}
                    placeholder="State the reason for this movement / transfer…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red resize-none" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── STORE REQUEST form ──────────────────────────────────────── */}
        {isStoreReq && (
          <>
            {/* Common header fields */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-brand-slate mb-3">Requisition Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Store Request — Site A"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority *</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                    {['low', 'medium', 'high', 'urgent'].map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date Required *</label>
                  <input required type="date" value={form.date_required}
                    onChange={e => setForm(f => ({ ...f, date_required: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Project (optional)</label>
                  <select value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                    <option value="">— None —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description / Justification</label>
                  <textarea rows={2} value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Provide context or reason for this request…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red resize-none" />
                </div>
              </div>
            </div>

            {/* Store selector */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-brand-slate mb-3">Select Store</h2>
              <select required value={form.source_store}
                onChange={e => { setForm(f => ({ ...f, source_store: e.target.value })); setItems([{ ...emptyItem }]) }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                <option value="">— Select a store —</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.location ? ` — ${s.location}` : ''}</option>)}
              </select>
            </div>

            {/* Items to request */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-brand-slate">Items to Request</h2>
                <button type="button" onClick={() => setItems(p => [...p, { ...emptyItem }])}
                  className="flex items-center gap-1 text-xs text-brand-red font-semibold hover:underline">
                  <PlusIcon className="h-3.5 w-3.5" /> Add item
                </button>
              </div>
              {form.source_store && allStoreItems.length > 0 && (
                <p className="text-[10px] text-gray-500 mb-2">Select from the store's inventory or assets, or type a custom description.</p>
              )}
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      {i === 0 && <label className="block text-[10px] text-gray-600 mb-1">Item (stock or asset)</label>}
                      <select value={item.stock_item || item.asset_code || ''}
                        onChange={e => handleStoreItemSelect(i, e.target.value)}
                        disabled={!form.source_store}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red disabled:bg-gray-50">
                        <option value="">— Select or type below —</option>
                        {allStoreItems.map(si => <option key={si.value} value={si.value}>{si.label}</option>)}
                      </select>
                    </div>
                    <div className="col-span-4">
                      {i === 0 && <label className="block text-[10px] text-gray-600 mb-1">Description *</label>}
                      <input required value={item.description} onChange={e => setItem(i, 'description', e.target.value)}
                        placeholder="Item description"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <label className="block text-[10px] text-gray-600 mb-1">Qty *</label>}
                      <input required type="number" min="0.01" step="0.01" value={item.quantity}
                        onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="1"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {i === 0 && <div className="h-4 mb-1" />}
                      <button type="button" disabled={items.length === 1}
                        onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-gray-500 hover:text-red-500 disabled:opacity-30">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── STANDARD form (fuel, materials, repair, general_purchase) ── */}
        {!isStoreReq && !isMovement && (
          <>
            {/* Details */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-brand-slate mb-3">Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={`e.g. ${selectedType?.label} — Site A`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority *</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                    {['low', 'medium', 'high', 'urgent'].map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date Required *</label>
                  <input required type="date" value={form.date_required}
                    onChange={e => setForm(f => ({ ...f, date_required: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Project (optional)</label>
                  <select value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                    <option value="">— None —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description / Justification</label>
                  <textarea rows={3} value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Provide context or reason for this requisition…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red resize-none" />
                </div>
              </div>
            </div>

            {/* Payment Details */}
            {PAYMENT_TYPES.includes(form.req_type) && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-brand-slate mb-3">Payment Details <span className="text-gray-400 font-normal">(optional)</span></h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                    <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value, payment_business_number: '', payment_account_number: '', payment_till_number: '', payment_send_money_phone: '', payment_bank_name: '', payment_account_name: '', payment_branch_name: '' }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                      <option value="">— Select method —</option>
                      <option value="mpesa_paybill">M-Pesa Paybill</option>
                      <option value="mpesa_till">M-Pesa Till</option>
                      <option value="mpesa_send_money">M-Pesa Send Money</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                  {form.payment_method === 'mpesa_paybill' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Business Number *</label>
                        <input value={form.payment_business_number} onChange={e => setForm(f => ({ ...f, payment_business_number: e.target.value }))} placeholder="e.g. 400200"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Account Number *</label>
                        <input value={form.payment_account_number} onChange={e => setForm(f => ({ ...f, payment_account_number: e.target.value }))} placeholder="e.g. REQ-2026-0001"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                      </div>
                    </div>
                  )}
                  {form.payment_method === 'mpesa_till' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Till Number *</label>
                      <input value={form.payment_till_number} onChange={e => setForm(f => ({ ...f, payment_till_number: e.target.value }))} placeholder="e.g. 123456"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                    </div>
                  )}
                  {form.payment_method === 'mpesa_send_money' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number *</label>
                      <input value={form.payment_send_money_phone || ''} onChange={e => setForm(f => ({ ...f, payment_send_money_phone: e.target.value }))} placeholder="e.g. 0712 345 678" type="tel"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                    </div>
                  )}
                  {form.payment_method === 'bank_transfer' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name *</label>
                        <input value={form.payment_bank_name} onChange={e => setForm(f => ({ ...f, payment_bank_name: e.target.value }))} placeholder="e.g. Equity Bank"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Account Name *</label>
                        <input value={form.payment_account_name} onChange={e => setForm(f => ({ ...f, payment_account_name: e.target.value }))} placeholder="Account holder name"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Account Number *</label>
                        <input value={form.payment_account_number} onChange={e => setForm(f => ({ ...f, payment_account_number: e.target.value }))} placeholder="e.g. 0123456789"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Branch Name *</label>
                        <input value={form.payment_branch_name} onChange={e => setForm(f => ({ ...f, payment_branch_name: e.target.value }))} placeholder="e.g. Nairobi CBD"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                      {i === 0 && <label className="block text-[10px] text-gray-600 mb-1">Description *</label>}
                      <input required value={item.description} onChange={e => setItem(i, 'description', e.target.value)}
                        placeholder="Item or service"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <label className="block text-[10px] text-gray-600 mb-1">Qty *</label>}
                      <input required type="number" min="0.01" step="0.01" value={item.quantity}
                        onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="1"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <label className="block text-[10px] text-gray-600 mb-1">Unit</label>}
                      <input value={item.unit} onChange={e => setItem(i, 'unit', e.target.value)} placeholder="pcs / L"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                    </div>
                    <div className="col-span-3">
                      {i === 0 && <label className="block text-[10px] text-gray-600 mb-1">Unit Price (KES)</label>}
                      <input type="number" min="0" step="0.01" value={item.unit_price}
                        onChange={e => setItem(i, 'unit_price', e.target.value)} placeholder="0.00"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {i === 0 && <div className="h-4 mb-1" />}
                      <button type="button" disabled={items.length === 1}
                        onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-gray-500 hover:text-red-500 disabled:opacity-30">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <div className="text-xs">
                  <span className="text-gray-600 mr-3">Estimated Total</span>
                  <span className="font-bold text-brand-slate text-sm">KES {estimatedTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </>
        )}

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
