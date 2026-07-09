import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import axios from 'axios'
import {
  PlusIcon, XMarkIcon, PencilIcon, TrashIcon,
  ChartBarIcon, DocumentTextIcon, TruckIcon,
  ChevronDownIcon, ChevronRightIcon, CheckCircleIcon,
  ExclamationTriangleIcon, StarIcon,
} from '@heroicons/react/24/outline'
import {
  getRFQDashboard, getRFQs, createRFQ, updateRFQ, deleteRFQ, awardRFQ,
  getRFQQuotes, createRFQQuote, updateRFQQuote, deleteRFQQuote,
  getSuppliers,
} from '../../api/rfq'

const TABS = [
  { id: 'dashboard', label: 'Dashboard',   Icon: ChartBarIcon },
  { id: 'rfqs',      label: 'RFQ Register',Icon: DocumentTextIcon },
]

const RFQ_STATUSES = [
  { value: 'draft',      label: 'Draft' },
  { value: 'issued',     label: 'Issued' },
  { value: 'evaluating', label: 'Evaluating' },
  { value: 'awarded',    label: 'Awarded' },
  { value: 'cancelled',  label: 'Cancelled' },
]

const STATUS_COLORS = {
  draft:      'bg-gray-100 text-gray-600',
  issued:     'bg-blue-100 text-blue-700',
  evaluating: 'bg-yellow-100 text-yellow-700',
  awarded:    'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
}

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-red focus:border-transparent'
const lbl = 'block text-xs font-medium text-gray-700 mb-1'

function Badge({ text, colorMap }) {
  const cls = colorMap?.[text] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {text?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  )
}

function StatCard({ label, value, color = 'text-brand-slate' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="bg-brand-slate px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><XMarkIcon className="h-5 w-5 text-white" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label className={lbl}>{label}</label>{children}</div>
}

// ── Supplier select ──────────────────────────────────────────────────────────
function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers-active'],
    queryFn: () => getSuppliers({ status: 'active', page_size: 200 }),
    staleTime: 60_000,
    select: r => r.data?.results ?? r.data ?? [],
  })
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data, isLoading } = useQuery({ queryKey: ['rfq-dashboard'], queryFn: getRFQDashboard })
  const d = data?.data ?? {}
  if (isLoading) return <p className="text-center py-12 text-gray-400">Loading…</p>

  const byStatus = d.by_status ?? {}

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total RFQs"         value={d.total_rfqs ?? 0}        color="text-brand-slate" />
        <StatCard label="Open RFQs"          value={d.open_rfqs ?? 0}         color="text-blue-600" />
        <StatCard label="Overdue RFQs"       value={d.overdue_rfqs ?? 0}      color="text-red-600" />
        <StatCard label="Awarded"            value={d.awarded_rfqs ?? 0}      color="text-green-600" />
        <StatCard label="Total Deliveries"   value={d.total_deliveries ?? 0}  color="text-purple-600" />
        <StatCard label="Overdue Deliveries" value={d.overdue_deliveries ?? 0} color="text-red-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-brand-slate mb-3">RFQs by Status</h3>
          {Object.entries(byStatus).map(([s, count]) => count > 0 && (
            <div key={s} className="flex items-center gap-2 mb-2">
              <span className="w-24 text-xs text-gray-600 capitalize">{s}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-brand-red h-2 rounded-full" style={{ width: `${Math.min(100, (count / (d.total_rfqs || 1)) * 100)}%` }} />
              </div>
              <span className="text-xs font-semibold text-brand-slate w-6 text-right">{count}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-brand-slate mb-3">Recent RFQs</h3>
          {(d.recent_rfqs ?? []).length === 0
            ? <p className="text-xs text-gray-400">No RFQs yet</p>
            : (d.recent_rfqs ?? []).map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-xs font-medium text-brand-slate">{r.rfq_number}: {r.title}</p>
                  <p className="text-xs text-gray-400">Closes {r.closing_date} · {r.quote_count} quote{r.quote_count !== 1 ? 's' : ''}</p>
                </div>
                <Badge text={r.status} colorMap={STATUS_COLORS} />
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ── RFQ Items editor ──────────────────────────────────────────────────────────
function ItemsEditor({ items, onChange }) {
  const add = () => onChange([...items, { description: '', qty: '', unit: '' }])
  const upd = (i, k, v) => { const next = [...items]; next[i] = { ...next[i], [k]: v }; onChange(next) }
  const rem = (i) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input className={`${inp} col-span-7`} placeholder="Description" value={item.description} onChange={e => upd(i, 'description', e.target.value)} />
          <input className={`${inp} col-span-2`} placeholder="Qty" type="number" value={item.qty} onChange={e => upd(i, 'qty', e.target.value)} />
          <input className={`${inp} col-span-2`} placeholder="Unit" value={item.unit} onChange={e => upd(i, 'unit', e.target.value)} />
          <button type="button" onClick={() => rem(i)} className="col-span-1 p-1.5 text-red-400 hover:bg-red-50 rounded-lg flex justify-center"><TrashIcon className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-brand-red hover:underline mt-1">
        <PlusIcon className="h-3.5 w-3.5" /> Add Item
      </button>
    </div>
  )
}

// ── RFQ Modal ─────────────────────────────────────────────────────────────────
function RFQModal({ initial, onClose, onSave }) {
  const { data: suppliers = [] } = useSuppliers()
  const [form, setForm] = useState({
    title: '', description: '', category: '',
    issue_date: new Date().toISOString().slice(0, 10),
    closing_date: '', status: 'draft',
    items: [{ description: '', qty: '', unit: '' }],
    supplier_ids: [],
    ...(initial ? {
      ...initial,
      supplier_ids: initial.suppliers?.map(s => s.id ?? s) ?? [],
    } : {}),
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleSupplier = (id) => {
    setForm(f => ({
      ...f,
      supplier_ids: f.supplier_ids.includes(id)
        ? f.supplier_ids.filter(x => x !== id)
        : [...f.supplier_ids, id],
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.closing_date) { toast.error('Closing date required'); return }
    onSave(payload)
  }

  return (
    <Modal title={initial ? 'Edit RFQ' : 'New RFQ'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Title *"><input required className={inp} value={form.title} onChange={e => set('title', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category"><input className={inp} placeholder="e.g. Civil Materials" value={form.category} onChange={e => set('category', e.target.value)} /></Field>
          <Field label="Status">
            <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
              {RFQ_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Issue Date"><input type="date" className={inp} value={form.issue_date} onChange={e => set('issue_date', e.target.value)} /></Field>
          <Field label="Closing Date *"><input required type="date" className={inp} value={form.closing_date} onChange={e => set('closing_date', e.target.value)} /></Field>
        </div>
        <Field label="Description"><textarea className={inp} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>

        <div>
          <label className={lbl}>Items to Quote</label>
          <ItemsEditor items={form.items} onChange={v => set('items', v)} />
        </div>

        <div>
          <label className={lbl}>Invite Suppliers</label>
          <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
            {suppliers.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No active suppliers</p>}
            {suppliers.map(s => (
              <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={form.supplier_ids.includes(s.id)} onChange={() => toggleSupplier(s.id)} className="accent-brand-red" />
                <div>
                  <p className="text-xs font-medium text-brand-slate">{s.company_name}</p>
                  <p className="text-xs text-gray-400">{s.supply_categories?.join(', ')}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium hover:bg-red-700">Save RFQ</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Quote line items editor ───────────────────────────────────────────────────
function QuoteItemsEditor({ items, onChange }) {
  const add = () => onChange([...items, { description: '', qty: '', unit: '', unit_price: '', total: '' }])
  const upd = (i, k, v) => {
    const next = [...items]
    next[i] = { ...next[i], [k]: v }
    if (k === 'qty' || k === 'unit_price') {
      const qty = parseFloat(k === 'qty' ? v : next[i].qty) || 0
      const up  = parseFloat(k === 'unit_price' ? v : next[i].unit_price) || 0
      next[i].total = (qty * up).toFixed(2)
    }
    onChange(next)
  }
  const rem = (i) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-1">
        <span className="col-span-5">Description</span>
        <span className="col-span-2">Qty</span>
        <span className="col-span-1">Unit</span>
        <span className="col-span-2">Unit Price</span>
        <span className="col-span-1">Total</span>
        <span className="col-span-1"></span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input className={`${inp} col-span-5`} placeholder="Description" value={item.description} onChange={e => upd(i, 'description', e.target.value)} />
          <input className={`${inp} col-span-2`} type="number" placeholder="Qty" value={item.qty} onChange={e => upd(i, 'qty', e.target.value)} />
          <input className={`${inp} col-span-1`} placeholder="Unit" value={item.unit} onChange={e => upd(i, 'unit', e.target.value)} />
          <input className={`${inp} col-span-2`} type="number" placeholder="0.00" value={item.unit_price} onChange={e => upd(i, 'unit_price', e.target.value)} />
          <span className="col-span-1 text-xs text-gray-600 font-medium">{item.total || '—'}</span>
          <button type="button" onClick={() => rem(i)} className="col-span-1 p-1.5 text-red-400 hover:bg-red-50 rounded-lg flex justify-center"><TrashIcon className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-brand-red hover:underline mt-1">
        <PlusIcon className="h-3.5 w-3.5" /> Add Line
      </button>
    </div>
  )
}

// ── Quote Modal ───────────────────────────────────────────────────────────────
function QuoteModal({ rfqId, initial, onClose, onSave }) {
  const { data: suppliers = [] } = useSuppliers()
  const [form, setForm] = useState({
    supplier: '', received_date: new Date().toISOString().slice(0, 10),
    validity_days: 30, delivery_days: '', payment_terms: '', notes: '',
    line_items: [{ description: '', qty: '', unit: '', unit_price: '', total: '' }],
    total_amount: 0, is_recommended: false,
    ...(initial || {}),
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const total = form.line_items.reduce((sum, li) => sum + (parseFloat(li.total) || 0), 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({ ...form, total_amount: total.toFixed(2) })
  }

  return (
    <Modal title={initial ? 'Edit Quote' : 'Add Supplier Quote'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Supplier *">
            <select required className={inp} value={form.supplier} onChange={e => set('supplier', e.target.value)}>
              <option value="">— Select —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
            </select>
          </Field>
          <Field label="Received Date"><input type="date" className={inp} value={form.received_date} onChange={e => set('received_date', e.target.value)} /></Field>
          <Field label="Validity (days)"><input type="number" className={inp} value={form.validity_days} onChange={e => set('validity_days', e.target.value)} /></Field>
          <Field label="Delivery (days)"><input type="number" className={inp} value={form.delivery_days || ''} onChange={e => set('delivery_days', e.target.value)} /></Field>
          <Field label="Payment Terms"><input className={inp} placeholder="e.g. 30 days net" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} /></Field>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="recommended" checked={form.is_recommended} onChange={e => set('is_recommended', e.target.checked)} className="accent-brand-red" />
            <label htmlFor="recommended" className="text-sm text-gray-700">Recommended quote</label>
          </div>
        </div>

        <div>
          <label className={lbl}>Line Items</label>
          <QuoteItemsEditor items={form.line_items} onChange={v => set('line_items', v)} />
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
          <div className="text-sm font-semibold text-brand-slate">Total: KES {total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium hover:bg-red-700">Save Quote</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Award Modal ───────────────────────────────────────────────────────────────
function AwardModal({ rfq, onClose, onAward }) {
  const quotes = rfq.quotes ?? []
  const [selectedSupplier, setSelectedSupplier] = useState(rfq.awarded_to ?? '')
  const [notes, setNotes] = useState(rfq.award_notes ?? '')

  return (
    <Modal title={`Award RFQ — ${rfq.rfq_number}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Select the winning supplier and confirm the award.</p>

        {quotes.length === 0 && <p className="text-sm text-orange-600 bg-orange-50 rounded-lg px-3 py-2">No quotes received yet. You can still award manually.</p>}

        <div className="space-y-2">
          {quotes.map(q => (
            <label key={q.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selectedSupplier === q.supplier ? 'border-brand-red bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
              onClick={() => setSelectedSupplier(q.supplier)}>
              <input type="radio" name="supplier" value={q.supplier} checked={selectedSupplier === q.supplier} onChange={() => setSelectedSupplier(q.supplier)} className="accent-brand-red" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-brand-slate">{q.supplier_name}</p>
                  {q.is_recommended && <span className="inline-flex items-center gap-0.5 text-xs text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded"><StarIcon className="h-3 w-3" /> Recommended</span>}
                </div>
                <p className="text-xs text-gray-500">KES {parseFloat(q.total_amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })} · {q.delivery_days ? `${q.delivery_days} days delivery` : ''} · {q.payment_terms}</p>
              </div>
            </label>
          ))}
        </div>

        <Field label="Award Notes">
          <textarea className={inp} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for selection, conditions, etc." />
        </Field>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => { if (!selectedSupplier) { toast.error('Select a supplier'); return } onAward(selectedSupplier, notes) }}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4" /> Confirm Award
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── RFQ Row (expandable) ──────────────────────────────────────────────────────
function RFQRow({ rfq, onEdit, onDelete }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [editingQuote, setEditingQuote] = useState(null)
  const [showAwardModal, setShowAwardModal] = useState(false)

  const quoteMut = useMutation({
    mutationFn: (data) => editingQuote
      ? updateRFQQuote(rfq.id, editingQuote.id, data)
      : createRFQQuote(rfq.id, data),
    onSuccess: () => { qc.invalidateQueries(['rfqs']); setShowQuoteModal(false); setEditingQuote(null); toast.success('Quote saved') },
    onError: () => toast.error('Failed to save quote'),
  })

  const delQuoteMut = useMutation({
    mutationFn: (qid) => deleteRFQQuote(rfq.id, qid),
    onSuccess: () => { qc.invalidateQueries(['rfqs']); toast.success('Quote removed') },
  })

  const awardMut = useMutation({
    mutationFn: ({ supplierId, notes }) => awardRFQ(rfq.id, { supplier_id: supplierId, notes }),
    onSuccess: () => { qc.invalidateQueries(['rfqs']); qc.invalidateQueries(['rfq-dashboard']); setShowAwardModal(false); toast.success('RFQ awarded') },
    onError: () => toast.error('Failed to award'),
  })

  const quotes = rfq.quotes ?? []
  const lowestQuote = quotes.length > 0 ? Math.min(...quotes.map(q => parseFloat(q.total_amount))) : null

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDownIcon className="h-4 w-4 text-gray-400" /> : <ChevronRightIcon className="h-4 w-4 text-gray-400" />}
            <span className="font-mono text-xs font-semibold text-brand-red">{rfq.rfq_number}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-brand-slate font-medium">{rfq.title}</td>
        <td className="px-4 py-3 text-xs text-gray-500 capitalize">{rfq.category || '—'}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <Badge text={rfq.status} colorMap={STATUS_COLORS} />
            {rfq.is_overdue && <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500" title="Overdue" />}
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{rfq.closing_date}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</td>
        <td className="px-4 py-3 text-xs text-gray-500">
          {lowestQuote !== null ? `KES ${lowestQuote.toLocaleString('en-KE', { minimumFractionDigits: 2 })}` : '—'}
        </td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex gap-1">
            {rfq.status !== 'awarded' && rfq.status !== 'cancelled' && (
              <button onClick={() => setShowAwardModal(true)} className="px-2 py-1 text-xs text-green-700 bg-green-50 hover:bg-green-100 rounded-lg font-medium">Award</button>
            )}
            <button onClick={() => onEdit(rfq)} className="p-1.5 text-gray-400 hover:text-brand-slate hover:bg-gray-100 rounded-lg"><PencilIcon className="h-4 w-4" /></button>
            <button onClick={() => { if (confirm('Delete this RFQ?')) onDelete(rfq.id) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><TrashIcon className="h-4 w-4" /></button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={8} className="bg-gray-50 px-6 pb-4 pt-2">
            <div className="space-y-3">
              {/* Items */}
              {(rfq.items ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Items to Quote</p>
                  <div className="flex flex-wrap gap-2">
                    {rfq.items.map((item, i) => (
                      <span key={i} className="text-xs bg-white border border-gray-200 rounded px-2 py-1 text-gray-600">
                        {item.description} — {item.qty} {item.unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quotes comparison */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier Quotes</p>
                  {rfq.status !== 'awarded' && rfq.status !== 'cancelled' && (
                    <button onClick={() => { setEditingQuote(null); setShowQuoteModal(true) }}
                      className="flex items-center gap-1 text-xs text-brand-red hover:underline">
                      <PlusIcon className="h-3.5 w-3.5" /> Add Quote
                    </button>
                  )}
                </div>

                {quotes.length === 0
                  ? <p className="text-xs text-gray-400">No quotes yet</p>
                  : (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {['Supplier', 'Total (KES)', 'Delivery', 'Payment Terms', 'Validity', ''].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {quotes.map(q => {
                            const isLowest = parseFloat(q.total_amount) === lowestQuote
                            return (
                              <tr key={q.id} className={isLowest ? 'bg-green-50' : ''}>
                                <td className="px-3 py-2 font-medium text-brand-slate">
                                  <div className="flex items-center gap-1">
                                    {q.supplier_name}
                                    {q.is_recommended && <StarIcon className="h-3 w-3 text-yellow-500" />}
                                    {rfq.awarded_to === q.supplier && <CheckCircleIcon className="h-3.5 w-3.5 text-green-600" />}
                                  </div>
                                </td>
                                <td className={`px-3 py-2 font-semibold ${isLowest ? 'text-green-700' : 'text-brand-slate'}`}>
                                  {parseFloat(q.total_amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-gray-500">{q.delivery_days ? `${q.delivery_days} days` : '—'}</td>
                                <td className="px-3 py-2 text-gray-500">{q.payment_terms || '—'}</td>
                                <td className="px-3 py-2 text-gray-500">{q.validity_days} days</td>
                                <td className="px-3 py-2">
                                  <div className="flex gap-1">
                                    <button onClick={() => { setEditingQuote(q); setShowQuoteModal(true) }} className="p-1 text-gray-400 hover:text-brand-slate hover:bg-gray-100 rounded"><PencilIcon className="h-3 w-3" /></button>
                                    <button onClick={() => { if (confirm('Remove this quote?')) delQuoteMut.mutate(q.id) }} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><TrashIcon className="h-3 w-3" /></button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </div>

              {rfq.awarded_to_name && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Awarded to <strong>{rfq.awarded_to_name}</strong>{rfq.award_notes && ` — ${rfq.award_notes}`}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {showQuoteModal && (
        <QuoteModal rfqId={rfq.id} initial={editingQuote} onClose={() => { setShowQuoteModal(false); setEditingQuote(null) }} onSave={d => quoteMut.mutate(d)} />
      )}
      {showAwardModal && (
        <AwardModal rfq={rfq} onClose={() => setShowAwardModal(false)} onAward={(supplierId, notes) => awardMut.mutate({ supplierId, notes })} />
      )}
    </>
  )
}

// ── RFQ Register Tab ──────────────────────────────────────────────────────────
function RFQsTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['rfqs', filterStatus],
    queryFn: () => getRFQs({ status: filterStatus || undefined, page_size: 100 }),
  })
  const rfqs = data?.data?.results ?? data?.data ?? []

  const saveMut = useMutation({
    mutationFn: (p) => editing ? updateRFQ(editing.id, p) : createRFQ(p),
    onSuccess: () => { qc.invalidateQueries(['rfqs']); qc.invalidateQueries(['rfq-dashboard']); setShowModal(false); setEditing(null); toast.success('RFQ saved') },
    onError: () => toast.error('Failed to save'),
  })

  const delMut = useMutation({
    mutationFn: deleteRFQ,
    onSuccess: () => { qc.invalidateQueries(['rfqs']); qc.invalidateQueries(['rfq-dashboard']); toast.success('Deleted') },
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {RFQ_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-red-700">
          <PlusIcon className="h-4 w-4" /> New RFQ
        </button>
      </div>

      {isLoading ? <p className="text-center py-12 text-gray-400">Loading…</p> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['RFQ No.', 'Title', 'Category', 'Status', 'Closes', 'Quotes', 'Lowest Bid', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rfqs.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">No RFQs found</td></tr>
              )}
              {rfqs.map(r => (
                <RFQRow key={r.id} rfq={r} onEdit={rfq => { setEditing(rfq); setShowModal(true) }} onDelete={id => delMut.mutate(id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <RFQModal initial={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSave={p => saveMut.mutate(p)} />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RFQPage() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-slate">RFQ & Bid Evaluation</h1>
        <p className="text-sm text-gray-500 mt-1">Request for Quotations, supplier bid comparison, and award management</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === id ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'rfqs'      && <RFQsTab />}
    </div>
  )
}
