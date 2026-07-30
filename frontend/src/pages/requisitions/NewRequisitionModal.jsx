import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon, TrashIcon, XMarkIcon, TruckIcon, HomeIcon, BanknotesIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { createRequisition } from '../../api/requisitions'
import { getProjects } from '../../api/projects'
import { getStores, getStoreItems, getAssets } from '../../api/inventory'
import { getEmployees } from '../../api/hr'
import api from '../../api/client'

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

// ── Allowance constants (same as TransfersPage) ──────────────────────────────
const LUNCH_RATE             = 500
const OVERNIGHT_RATE         = 1500
const RELOCATION_SUBORDINATE = 10000
const RELOCATION_MANAGEMENT  = 15000

const emptyMovement = {
  employee: '',
  record_type: 'movement',
  destination_type: 'site',
  from_location: '',
  to_location: '',
  project: '',
  start_date: '',
  end_date: '',
  reason: '',
  allowance_eligible: true,
  staff_category: 'subordinate',
  lunch_days: 0,
  overnight_nights: 0,
  transport_to: '',
  transport_from: '',
}

function computeAllowances(m) {
  const tTo   = parseFloat(m.transport_to)   || 0
  const tFrom = parseFloat(m.transport_from) || 0
  if (m.record_type === 'relocation') {
    const fee = m.staff_category === 'management' ? RELOCATION_MANAGEMENT : RELOCATION_SUBORDINATE
    return fee + tTo + tFrom
  }
  if (m.destination_type === 'head_office' || !m.allowance_eligible) return 0
  return (parseInt(m.lunch_days) || 0) * LUNCH_RATE
       + (parseInt(m.overnight_nights) || 0) * OVERNIGHT_RATE
       + tTo + tFrom
}

// ── Store request state ───────────────────────────────────────────────────────
const emptyStore = { store: '', item_category: 'inventory', item: '', quantity: '', justification: '', date_required: '' }

export default function NewRequisitionModal({ onClose }) {
  const qc = useQueryClient()

  const [form, setForm] = useState({
    title: '', req_type: 'fuel', priority: 'medium',
    description: '', date_required: '', project: '',
    source_store: '',
    payment_method: '',
    payment_business_number: '', payment_account_number: '',
    payment_till_number: '', payment_send_money_phone: '',
    payment_bank_name: '', payment_account_name: '', payment_branch_name: '',
  })
  const [items,    setItems]    = useState([{ ...emptyItem }])
  const [movement, setMovement] = useState({ ...emptyMovement })
  const [sr,       setSr]       = useState({ ...emptyStore })

  const isStoreReq = form.req_type === 'store_request'
  const isMovement = form.req_type === 'staff_movement'

  const setMov = (k, v) => setMovement(p => ({ ...p, [k]: v }))

  useEffect(() => { if (movement.record_type === 'relocation') setMov('end_date', '') }, [movement.record_type])

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => getProjects({ page_size: 100 }),
    select:   r => r.data?.results ?? r.data ?? [],
  })
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-simple'],
    queryFn:  () => getEmployees({ is_active: 'true', page_size: 200 }),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  isMovement,
  })
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn:  () => api.get('/auth/branches/'),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  isMovement,
  })
  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn:  () => getStores(),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  isStoreReq,
  })
  const { data: storeItems = [], isFetching: fetchingItems } = useQuery({
    queryKey: ['store-items', sr.store],
    queryFn:  () => getStoreItems(sr.store),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  isStoreReq && !!sr.store && sr.item_category === 'inventory',
  })
  const { data: assetList = [], isFetching: fetchingAssets } = useQuery({
    queryKey: ['assets-simple'],
    queryFn:  () => getAssets({ page_size: 500 }),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  isStoreReq && sr.item_category === 'asset',
  })

  // ── Mutation ──────────────────────────────────────────────────────────────────
  const { mutate, isPending } = useMutation({
    mutationFn: createRequisition,
    onSuccess: (res) => {
      toast.success(`Requisition ${res.data.reference_number} submitted.`)
      qc.invalidateQueries({ queryKey: ['requisitions'] })
      onClose()
    },
    onError: e => {
      const msg = e.response?.data?.items?.[0] || e.response?.data?.detail || 'Failed to submit.'
      toast.error(msg)
    },
  })

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const setItem = (i, field, value) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))

  const estimatedTotal = items.reduce(
    (sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0
  )

  const totalMovementAllowance = (parseInt(movement.lunch_days) || 0) * LUNCH_RATE
                               + (parseInt(movement.overnight_nights) || 0) * OVERNIGHT_RATE
                               + (parseFloat(movement.transport_to)   || 0)
                               + (parseFloat(movement.transport_from) || 0)
  const relocationAmount = movement.staff_category === 'management' ? RELOCATION_MANAGEMENT : RELOCATION_SUBORDINATE
  const relocationTotal  = relocationAmount + (parseFloat(movement.transport_to) || 0) + (parseFloat(movement.transport_from) || 0)
  const isMovementToHQ   = movement.record_type === 'movement' && movement.destination_type === 'head_office'

  const handleEmployeeSelect = (empId) => {
    setMov('employee', empId)
    const emp = employees.find(e => String(e.id) === String(empId))
    if (emp) setMov('from_location', emp.branch_name || '')
  }

  const handleDestinationSelect = (val) => {
    if (val.startsWith('__project__:')) {
      setMov('project', val.replace('__project__:', ''))
      setMov('to_location', projects.find(p => String(p.id) === val.replace('__project__:', ''))?.name || val)
    } else {
      setMov('project', '')
      setMov('to_location', val)
    }
  }

  const selectedStoreItem = storeItems.find(i => String(i.id) === String(sr.item))
  const selectedAsset     = assetList.find(a => String(a.id) === String(sr.item))

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault()

    if (isMovement) {
      if (!movement.employee) return toast.error('Select an employee.')
      if (!movement.to_location) return toast.error('Destination is required.')
      if (!movement.start_date) return toast.error('Start date is required.')
      if (!movement.reason.trim()) return toast.error('Reason is required.')

      const emp = employees.find(e => String(e.id) === String(movement.employee))
      const movLabel = movement.record_type === 'relocation' ? 'Relocation' : 'Movement'
      const totalAllowance = computeAllowances(movement)
      const desc = [
        `Type: ${movLabel} (${movement.destination_type})`,
        `From: ${movement.from_location} → To: ${movement.to_location}`,
        `Dates: ${movement.start_date}${movement.end_date ? ` to ${movement.end_date}` : ''}`,
        movement.reason,
      ].join('\n')

      mutate({
        title: `${movLabel} — ${emp?.full_name || 'Employee'} → ${movement.to_location}`,
        req_type: 'staff_movement',
        priority: form.priority,
        date_required: movement.start_date,
        description: desc,
        ...(form.project || movement.project ? { project: form.project || movement.project } : {}),
        items: [{
          description: `${movLabel}: ${emp?.full_name || ''} (${emp?.employee_number || ''}) — ${movement.from_location} → ${movement.to_location}`,
          quantity: 1,
          unit: 'person',
          unit_price: totalAllowance || 0,
          notes: movement.reason,
        }],
      })
      return
    }

    if (isStoreReq) {
      const isAsset = sr.item_category === 'asset'
      if (!isAsset && !sr.store) return toast.error('Select a store.')
      if (!sr.item) return toast.error('Select an item.')
      if (!sr.quantity) return toast.error('Quantity is required.')
      if (!sr.justification.trim()) return toast.error('Justification is required.')

      const storeName = isAsset ? 'Assets Register' : (stores.find(s => String(s.id) === String(sr.store))?.name || 'Store')
      const itemName  = isAsset ? (selectedAsset?.name || 'Asset') : (selectedStoreItem?.name || 'Item')
      mutate({
        title: `Store Request — ${itemName} from ${storeName}`,
        req_type: 'store_request',
        priority: form.priority,
        source_store: isAsset ? undefined : sr.store,
        date_required: sr.date_required || undefined,
        description: sr.justification,
        items: [{
          description: itemName,
          quantity: Number(sr.quantity),
          unit: isAsset ? 'unit' : (selectedStoreItem?.unit || 'pcs'),
          unit_price: 0,
          stock_item: isAsset ? undefined : sr.item,
          asset_code: isAsset ? selectedAsset?.asset_code : undefined,
          notes: sr.justification,
        }],
      })
      return
    }

    // Standard types
    const payload = { ...form, items }
    if (!payload.project) delete payload.project
    delete payload.source_store
    mutate(payload)
  }

  const selectedType = REQ_TYPES.find(t => t.value === form.req_type)
  const cls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
  const clsXs = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-2 px-2 md:py-6 md:px-4">
      <div className="relative w-full max-w-5xl bg-gray-50 rounded-2xl shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-t-2xl border-b border-gray-200 sticky top-0 z-10">
          <div>
            <h1 className="text-base font-bold text-brand-slate">New Requisition</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {isMovement ? 'HR reviews → MD approves' : 'Submitted directly to MD for approval'}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 md:p-6">
      <form onSubmit={handleSubmit}>

        {/* Mobile-only type dropdown */}
        <div className="md:hidden mb-4">
          <label className="block text-xs font-semibold text-brand-slate mb-1 uppercase tracking-wide">Requisition Type</label>
          <select
            value={form.req_type}
            onChange={e => { setForm(f => ({ ...f, req_type: e.target.value })); setItems([{ ...emptyItem }]); setMovement({ ...emptyMovement }); setSr({ ...emptyStore }) }}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-red/30">
            {REQ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {form.req_type === 'repair_maintenance' && (
            <p className="mt-2 text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-2">A maintenance schedule will be created once submitted.</p>
          )}
          {form.req_type === 'fuel' && (
            <p className="mt-2 text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">Finance will record the fuel payment once approved.</p>
          )}
          {isStoreReq && (
            <p className="mt-2 text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2">Goes directly to MD. Storekeeper issues via Counter Issue Form.</p>
          )}
          {isMovement && (
            <p className="mt-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">HR reviews first, then MD gives final approval.</p>
          )}
        </div>

        {/* Two-column layout: type picker left, form right (desktop only) */}
        <div className="flex gap-5 items-start">

        {/* LEFT: type selector (fixed width, desktop only) */}
        <div className="hidden md:block w-56 shrink-0">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 sticky top-[73px]">
          <h2 className="text-xs font-semibold text-brand-slate mb-2 uppercase tracking-wide">Type</h2>
          <div className="flex flex-col gap-1.5">
            {REQ_TYPES.map(t => (
              <button type="button" key={t.value}
                onClick={() => { setForm(f => ({ ...f, req_type: t.value })); setItems([{ ...emptyItem }]); setMovement({ ...emptyMovement }); setSr({ ...emptyStore }) }}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition-colors
                  ${form.req_type === t.value
                    ? 'border-brand-red bg-red-50 text-brand-red'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <p className="font-semibold">{t.label}</p>
                <p className={`mt-0.5 text-[10px] leading-tight ${form.req_type === t.value ? 'text-red-400' : 'text-gray-500'}`}>{t.hint}</p>
              </button>
            ))}
          </div>
          {form.req_type === 'repair_maintenance' && (
            <p className="mt-3 text-[10px] text-purple-600 bg-purple-50 rounded-lg px-2.5 py-2">
              A maintenance schedule will be created by the site manager or admin once submitted.
            </p>
          )}
          {form.req_type === 'fuel' && (
            <p className="mt-3 text-[10px] text-orange-600 bg-orange-50 rounded-lg px-2.5 py-2">
              Finance will record the fuel payment once approved.
            </p>
          )}
          {isStoreReq && (
            <p className="mt-3 text-[10px] text-teal-600 bg-teal-50 rounded-lg px-2.5 py-2">
              Goes directly to MD. Storekeeper issues via Counter Issue Form.
            </p>
          )}
          {isMovement && (
            <p className="mt-3 text-[10px] text-blue-600 bg-blue-50 rounded-lg px-2.5 py-2">
              HR reviews first, then MD gives final approval.
            </p>
          )}
        </div>{/* end sticky card */}
        </div>{/* end hidden md:block */}

        {/* RIGHT: form content */}
        <div className="flex-1 min-w-0 space-y-4">

        {/* Hidden — type selector already in left panel, keep old one removed */}
        {/* Type selector — old block replaced by left panel above */}
        <div className="hidden">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-brand-slate mb-3">Requisition Type</h2>
          <div className="grid grid-cols-2 gap-2">
            {REQ_TYPES.map(t => (
              <button type="button" key={t.value}
                onClick={() => { setForm(f => ({ ...f, req_type: t.value })); setItems([{ ...emptyItem }]); setMovement({ ...emptyMovement }); setSr({ ...emptyStore }) }}
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
              Goes directly to MD for approval. The storekeeper will then issue items using a Counter Issue Form.
            </p>
          )}
          {isMovement && (
            <p className="mt-3 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              HR reviews and approves first, then MD gives final approval.
            </p>
          )}
        </div>
        </div>{/* end hidden */}

        {/* ── STORE REQUEST ─────────────────────────────────────────────────── */}
        {isStoreReq && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-brand-slate">Request Items from Store</h2>

            {/* Category toggle: Inventory | Assets */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Item Category <span className="text-red-500">*</span></label>
              <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden text-xs font-medium">
                {[{ v: 'inventory', label: 'Inventory Items' }, { v: 'asset', label: 'Assets' }].map(opt => (
                  <button key={opt.v} type="button"
                    onClick={() => setSr(p => ({ ...p, item_category: opt.v, store: opt.v === 'asset' ? '' : p.store, item: '' }))}
                    className={`px-4 py-2 transition-colors ${sr.item_category === opt.v ? 'bg-brand-red text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Store picker — only for inventory */}
            {sr.item_category === 'inventory' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Store <span className="text-red-500">*</span></label>
                <select className={clsXs} value={sr.store}
                  onChange={e => { setSr(p => ({ ...p, store: e.target.value, item: '' })) }}>
                  <option value="">— Select a store —</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Inventory item picker */}
            {sr.item_category === 'inventory' && sr.store && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Item <span className="text-red-500">*</span></label>
                {fetchingItems ? (
                  <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                ) : storeItems.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No items found in this store.</p>
                ) : (
                  <>
                    <select className={clsXs} value={sr.item}
                      onChange={e => setSr(p => ({ ...p, item: e.target.value }))}>
                      <option value="">— Select an item —</option>
                      {storeItems.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.item_code}) — {Number(i.stock_in_store).toLocaleString()} {i.unit} in stock
                        </option>
                      ))}
                    </select>
                    {selectedStoreItem && (
                      <p className={`text-xs mt-1 ${Number(selectedStoreItem.stock_in_store) === 0 ? 'text-red-600' : 'text-green-700'}`}>
                        In stock: <strong>{Number(selectedStoreItem.stock_in_store).toLocaleString()} {selectedStoreItem.unit}</strong>
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Asset picker */}
            {sr.item_category === 'asset' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Asset <span className="text-red-500">*</span></label>
                {fetchingAssets ? (
                  <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                ) : assetList.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No assets found.</p>
                ) : (
                  <select className={clsXs} value={sr.item}
                    onChange={e => setSr(p => ({ ...p, item: e.target.value }))}>
                    <option value="">— Select an asset —</option>
                    {assetList.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.asset_code}) — {a.status}
                      </option>
                    ))}
                  </select>
                )}
                {selectedAsset && (
                  <p className={`text-xs mt-1 ${selectedAsset.status === 'operational' ? 'text-green-700' : 'text-amber-600'}`}>
                    Status: <strong>{selectedAsset.status}</strong>
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity Requested <span className="text-red-500">*</span></label>
              <input type="number" min="0.01" step="any" className={clsXs}
                value={sr.quantity} onChange={e => setSr(p => ({ ...p, quantity: e.target.value }))} placeholder="0" />
              {selectedStoreItem && sr.quantity && Number(sr.quantity) > Number(selectedStoreItem.stock_in_store) && (
                <p className="text-[11px] text-amber-600 mt-1">⚠ Requested qty exceeds current stock — storekeeper may approve a partial quantity.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Justification <span className="text-red-500">*</span></label>
              <textarea rows={3} className={`${clsXs} resize-none`}
                value={sr.justification} onChange={e => setSr(p => ({ ...p, justification: e.target.value }))}
                placeholder="Explain why you need this item (e.g. Site works — Thika Road, replacing damaged equipment…)" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
              <select className={clsXs} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {['low', 'medium', 'high', 'urgent'].map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date Required <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="date" className={clsXs} value={sr.date_required}
                onChange={e => setSr(p => ({ ...p, date_required: e.target.value }))} />
              <p className="text-[10px] text-gray-400 mt-1">When do you need this by? Used to flag overdue requests.</p>
            </div>
          </div>
        )}

        {/* ── STAFF MOVEMENT ───────────────────────────────────────────────── */}
        {isMovement && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5 shadow-sm">
            <h3 className="font-bold text-brand-slate text-base">New Movement / Relocation Request</h3>

            {/* Type toggle */}
            <div className="flex gap-3">
              {[
                { key: 'movement',   label: 'Movement',   Icon: TruckIcon,  desc: 'Temporary — employee returns' },
                { key: 'relocation', label: 'Relocation', Icon: HomeIcon,   desc: 'Permanent — change of station' },
              ].map(({ key, label, Icon, desc }) => (
                <button type="button" key={key} onClick={() => setMov('record_type', key)}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
                    ${movement.record_type === key ? 'border-brand-red bg-red-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <Icon className={`h-5 w-5 flex-shrink-0 ${movement.record_type === key ? 'text-brand-red' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${movement.record_type === key ? 'text-brand-red' : 'text-gray-700'}`}>{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Employee *</label>
                <select value={movement.employee} onChange={e => handleEmployeeSelect(e.target.value)} className={cls} required>
                  <option value="">— Select employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.employee_number} — {e.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Destination Type *</label>
                <select value={movement.destination_type} onChange={e => { setMov('destination_type', e.target.value); setMov('to_location', '') }} className={cls}>
                  <option value="site">Site / Field</option>
                  <option value="head_office">Head Office</option>
                  <option value="branch">Branch Office</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">From Location *</label>
                <input value={movement.from_location} onChange={e => setMov('from_location', e.target.value)}
                  placeholder="Auto-filled from employee record" className={cls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">To Location *</label>
                <select onChange={e => handleDestinationSelect(e.target.value)} className={cls} required
                  value={movement.project ? `__project__:${movement.project}` : movement.to_location}>
                  <option value="">— Select destination —</option>
                  {movement.destination_type === 'head_office' && <option value="Head Office">Head Office</option>}
                  {movement.destination_type === 'branch' && branches.map(b => (
                    <option key={b.id} value={b.name}>{b.name}{b.location ? ` (${b.location})` : ''}</option>
                  ))}
                  {movement.destination_type === 'site' && projects.map(p => (
                    <option key={p.id} value={`__project__:${p.id}`}>{p.name}{p.location ? ` — ${p.location}` : ''}</option>
                  ))}
                  <option value="Isuzu East Africa">Isuzu East Africa</option>
                  <option value="Other">Other (specify in reason)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {movement.record_type === 'relocation' ? 'Effective Date' : 'Departure Date'} *
                </label>
                <input type="date" value={movement.start_date} onChange={e => setMov('start_date', e.target.value)} className={cls} required />
              </div>

              {movement.record_type === 'movement' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Return Date</label>
                  <input type="date" value={movement.end_date} onChange={e => setMov('end_date', e.target.value)} className={cls} />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={cls}>
                  {['low', 'medium', 'high', 'urgent'].map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reason / Purpose *</label>
              <textarea value={movement.reason} onChange={e => setMov('reason', e.target.value)} rows={3} className={cls} required />
            </div>

            {/* Allowances */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <p className="text-xs font-bold text-brand-slate uppercase tracking-wider flex items-center gap-1.5">
                <BanknotesIcon className="h-4 w-4" /> Allowances
              </p>

              {movement.record_type === 'movement' && (
                <>
                  {isMovementToHQ ? (
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <InformationCircleIcon className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700">No lunch allowance — lunch is provided at Head Office.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Employee eligible for allowances?</span>
                        <button type="button"
                          onClick={() => setMov('allowance_eligible', !movement.allowance_eligible)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${movement.allowance_eligible ? 'bg-brand-red' : 'bg-gray-300'}`}>
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${movement.allowance_eligible ? 'translate-x-5' : ''}`} />
                        </button>
                      </div>
                      {!movement.allowance_eligible && (
                        <p className="text-xs text-gray-500 italic">No allowances will be claimed for this movement.</p>
                      )}
                      {movement.allowance_eligible && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Lunch Days <span className="font-normal text-gray-400">(KES {LUNCH_RATE.toLocaleString()}/day)</span>
                            </label>
                            <input type="number" min="0" value={movement.lunch_days} onChange={e => setMov('lunch_days', e.target.value)} className={cls} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Overnight Nights <span className="font-normal text-gray-400">(KES {OVERNIGHT_RATE.toLocaleString()}/night)</span>
                            </label>
                            <input type="number" min="0" value={movement.overnight_nights} onChange={e => setMov('overnight_nights', e.target.value)} className={cls} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Transport To <span className="font-normal text-gray-400">(KES — actual cost)</span>
                            </label>
                            <input type="number" min="0" step="any" value={movement.transport_to} onChange={e => setMov('transport_to', e.target.value)} placeholder="0" className={cls} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Transport From <span className="font-normal text-gray-400">(KES — actual cost)</span>
                            </label>
                            <input type="number" min="0" step="any" value={movement.transport_from} onChange={e => setMov('transport_from', e.target.value)} placeholder="0" className={cls} />
                          </div>
                          {totalMovementAllowance > 0 && (
                            <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 space-y-1">
                              {(parseInt(movement.lunch_days) || 0) > 0 && (
                                <div className="flex justify-between text-xs text-green-700">
                                  <span>Lunch ({movement.lunch_days} day{movement.lunch_days != 1 ? 's' : ''})</span>
                                  <span>KES {((parseInt(movement.lunch_days) || 0) * LUNCH_RATE).toLocaleString()}</span>
                                </div>
                              )}
                              {(parseInt(movement.overnight_nights) || 0) > 0 && (
                                <div className="flex justify-between text-xs text-green-700">
                                  <span>Overnight ({movement.overnight_nights} night{movement.overnight_nights != 1 ? 's' : ''})</span>
                                  <span>KES {((parseInt(movement.overnight_nights) || 0) * OVERNIGHT_RATE).toLocaleString()}</span>
                                </div>
                              )}
                              {(parseFloat(movement.transport_to) || 0) > 0 && (
                                <div className="flex justify-between text-xs text-green-700">
                                  <span>Transport To</span>
                                  <span>KES {(parseFloat(movement.transport_to) || 0).toLocaleString()}</span>
                                </div>
                              )}
                              {(parseFloat(movement.transport_from) || 0) > 0 && (
                                <div className="flex justify-between text-xs text-green-700">
                                  <span>Transport From</span>
                                  <span>KES {(parseFloat(movement.transport_from) || 0).toLocaleString()}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between border-t border-green-200 pt-1.5">
                                <span className="text-xs text-green-700 font-semibold">Total Movement Allowance</span>
                                <span className="text-sm font-bold text-green-700">KES {totalMovementAllowance.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {movement.record_type === 'relocation' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Select staff category to determine the one-time relocation fee.</p>
                  <div className="flex gap-3">
                    {[
                      { key: 'subordinate', label: 'Subordinate Staff', amount: RELOCATION_SUBORDINATE },
                      { key: 'management',  label: 'Management Staff',  amount: RELOCATION_MANAGEMENT },
                    ].map(({ key, label, amount }) => (
                      <button type="button" key={key} onClick={() => setMov('staff_category', key)}
                        className={`flex-1 px-4 py-3 rounded-xl border-2 text-left transition-all
                          ${movement.staff_category === key ? 'border-brand-red bg-red-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <p className={`text-sm font-semibold ${movement.staff_category === key ? 'text-brand-red' : 'text-gray-700'}`}>{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">KES {amount.toLocaleString()} one-time</p>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Transport To <span className="font-normal text-gray-400">(KES)</span></label>
                      <input type="number" min="0" step="any" value={movement.transport_to} onChange={e => setMov('transport_to', e.target.value)} placeholder="0" className={cls} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Transport From <span className="font-normal text-gray-400">(KES)</span></label>
                      <input type="number" min="0" step="any" value={movement.transport_from} onChange={e => setMov('transport_from', e.target.value)} placeholder="0" className={cls} />
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-1">
                    <div className="flex justify-between text-xs text-green-700">
                      <span>Relocation Fee</span>
                      <span>KES {relocationAmount.toLocaleString()}</span>
                    </div>
                    {(parseFloat(movement.transport_to) || 0) > 0 && (
                      <div className="flex justify-between text-xs text-green-700">
                        <span>Transport To</span>
                        <span>KES {(parseFloat(movement.transport_to) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {(parseFloat(movement.transport_from) || 0) > 0 && (
                      <div className="flex justify-between text-xs text-green-700">
                        <span>Transport From</span>
                        <span>KES {(parseFloat(movement.transport_from) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-green-200 pt-1.5">
                      <span className="text-xs text-green-700 font-medium">Total Relocation Allowance</span>
                      <span className="text-base font-bold text-green-700">KES {relocationTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STANDARD form (fuel, materials, repair, general_purchase) ──── */}
        {!isStoreReq && !isMovement && (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-brand-slate mb-3">Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={`e.g. ${selectedType?.label} — Site A`}
                    className={clsXs} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority *</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={clsXs}>
                    {['low', 'medium', 'high', 'urgent'].map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date Required *</label>
                  <input required type="date" value={form.date_required}
                    onChange={e => setForm(f => ({ ...f, date_required: e.target.value }))} className={clsXs} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Project (optional)</label>
                  <select value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} className={clsXs}>
                    <option value="">— None —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description / Justification</label>
                  <textarea rows={3} value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Provide context or reason for this requisition…"
                    className={`${clsXs} resize-none`} />
                </div>
              </div>
            </div>

            {PAYMENT_TYPES.includes(form.req_type) && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-brand-slate mb-3">Payment Details <span className="text-gray-400 font-normal">(optional)</span></h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                    <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value, payment_business_number: '', payment_account_number: '', payment_till_number: '', payment_send_money_phone: '', payment_bank_name: '', payment_account_name: '', payment_branch_name: '' }))} className={clsXs}>
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
                        <label className="block text-xs font-medium text-gray-600 mb-1">Business Number</label>
                        <input value={form.payment_business_number} onChange={e => setForm(f => ({ ...f, payment_business_number: e.target.value }))} placeholder="e.g. 400200" className={clsXs} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Account Number</label>
                        <input value={form.payment_account_number} onChange={e => setForm(f => ({ ...f, payment_account_number: e.target.value }))} placeholder="e.g. REQ-2026-0001" className={clsXs} />
                      </div>
                    </div>
                  )}
                  {form.payment_method === 'mpesa_till' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Till Number</label>
                      <input value={form.payment_till_number} onChange={e => setForm(f => ({ ...f, payment_till_number: e.target.value }))} placeholder="e.g. 123456" className={clsXs} />
                    </div>
                  )}
                  {form.payment_method === 'mpesa_send_money' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                      <input value={form.payment_send_money_phone || ''} onChange={e => setForm(f => ({ ...f, payment_send_money_phone: e.target.value }))} placeholder="e.g. 0712 345 678" type="tel" className={clsXs} />
                    </div>
                  )}
                  {form.payment_method === 'bank_transfer' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
                        <input value={form.payment_bank_name} onChange={e => setForm(f => ({ ...f, payment_bank_name: e.target.value }))} placeholder="e.g. Equity Bank" className={clsXs} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Account Name</label>
                        <input value={form.payment_account_name} onChange={e => setForm(f => ({ ...f, payment_account_name: e.target.value }))} placeholder="Account holder name" className={clsXs} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Account Number</label>
                        <input value={form.payment_account_number} onChange={e => setForm(f => ({ ...f, payment_account_number: e.target.value }))} placeholder="e.g. 0123456789" className={clsXs} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Branch Name</label>
                        <input value={form.payment_branch_name} onChange={e => setForm(f => ({ ...f, payment_branch_name: e.target.value }))} placeholder="e.g. Nairobi CBD" className={clsXs} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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

        </div>{/* end right column */}
        </div>{/* end two-column flex */}

        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-200">
          <button type="button" onClick={onClose}
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
      </div>
    </div>
  )
}
