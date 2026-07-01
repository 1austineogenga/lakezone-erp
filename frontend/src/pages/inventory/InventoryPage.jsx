import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { Link } from 'react-router-dom'
import {
  PlusIcon, ArrowDownTrayIcon, ArrowUpTrayIcon,
  MagnifyingGlassIcon, ExclamationTriangleIcon,
  ArrowsRightLeftIcon, DocumentTextIcon, UserIcon,
} from '@heroicons/react/24/outline'
import {
  getStockItems, createStockItem, updateStockItem,
  getTransactions, createTransaction, getLowStockItems, getStores,
} from '../../api/inventory'
import usePermissions from '../../hooks/usePermissions'
import useAuthStore from '../../store/authStore'
import api from '../../api/client'

const getSystemUsers = () => api.get('/auth/users/?page_size=200')

// ── Constants ─────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)

const CATEGORY_LABELS = {
  office_consumables: 'Office Consumables',
  stationery: 'Stationery',
  cleaning: 'Cleaning Supplies',
  kitchen: 'Kitchen / Canteen',
  construction_materials: 'Construction Materials',
  spare_parts: 'Spare Parts',
  fuel: 'Fuel & Lubricants',
  ppe_safety: 'PPE & Safety',
  tools: 'Tools & Equipment',
  electronics: 'Electronics',
  uniforms: 'Uniforms & Clothing',
  other: 'Other',
}

const TX_LABELS = {
  grn: 'Received',
  issue: 'Issued',
  transfer: 'Transfer',
  return: 'Return',
  adjustment: 'Adjustment',
}

const TX_COLORS = {
  grn: 'bg-green-100 text-green-700',
  issue: 'bg-blue-100 text-blue-700',
  transfer: 'bg-purple-100 text-purple-700',
  return: 'bg-amber-100 text-amber-700',
  adjustment: 'bg-gray-100 text-gray-600',
}

const TABS = [
  { key: 'items', label: 'Items' },
  { key: 'issue', label: 'Issue' },
  { key: 'receive', label: 'Receive' },
  { key: 'history', label: 'History' },
  { key: 'lowstock', label: 'Low Stock' },
]

// ── Input style ───────────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'

// ── Add Item Modal ─────────────────────────────────────────────────────────────

const UNIT_CHIPS = ['pcs', 'reams', 'boxes', 'kg', 'litres', 'metres', 'pairs', 'sets', 'rolls', 'bags', 'tubes', 'packets', 'drums', 'bales', 'tonnes']

// ── Quick Create Store (inline, used when no stores exist) ────────────────────

function QuickCreateStore({ onCreated }) {
  const [name, setName]         = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving]     = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Store name is required')
    setSaving(true)
    try {
      const res = await api.post('/inventory/stores/', { name, location })
      toast.success(`Store "${name}" created`)
      onCreated(res.data)
    } catch {
      toast.error('Failed to create store')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-amber-800">No stores configured — create one to continue</p>
      <input value={name} onChange={e => setName(e.target.value)}
        className={inp} placeholder="Store name (e.g. Main Storeroom)" />
      <input value={location} onChange={e => setLocation(e.target.value)}
        className={inp} placeholder="Location (optional)" />
      <button onClick={handleCreate} disabled={saving || !name.trim()}
        className="w-full py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50">
        {saving ? 'Creating…' : 'Create Store & Continue'}
      </button>
    </div>
  )
}

const CATEGORY_GROUPS = [
  { label: 'Office & Admin',    items: ['office_consumables', 'stationery'] },
  { label: 'Facilities',        items: ['cleaning', 'kitchen'] },
  { label: 'Site & Operations', items: ['construction_materials', 'spare_parts', 'fuel', 'ppe_safety', 'tools'] },
  { label: 'Staff',             items: ['uniforms', 'electronics'] },
  { label: 'Other',             items: ['other'] },
]

function AddItemModal({ onClose, editItem, stores, departments }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(editItem ? {
    name:              editItem.name              || '',
    category:          editItem.category          || 'office_consumables',
    unit:              editItem.unit              || '',
    reorder_level:     editItem.reorder_level != null ? String(parseFloat(editItem.reorder_level)) : '',
    description:       editItem.description       || '',
    valuation_method:  editItem.valuation_method  || 'wac',
    department:        editItem.department         || '',
    is_active:         editItem.is_active != null ? editItem.is_active : true,
  } : {
    name: '', category: 'office_consumables', unit: '', reorder_level: '',
    description: '', valuation_method: 'wac', department: '', is_active: true,
  })
  const [openingQty,   setOpeningQty]   = useState('')
  const [openingCost,  setOpeningCost]  = useState('')
  const [openingStore, setOpeningStore] = useState(stores[0]?.id ?? '')

  const hasOpening = !editItem && Number(openingQty) > 0

  const itemMut = useMutation({
    mutationFn: async (data) => {
      const itemRes = editItem
        ? await updateStockItem(editItem.id, data)
        : await createStockItem(data)
      const newItem = itemRes.data
      if (hasOpening) {
        const storeId = openingStore || stores[0]?.id
        if (!storeId) throw new Error('Please select a store for the opening stock.')
        await createTransaction({
          transaction_type: 'grn',
          item: newItem.id,
          store: storeId,
          quantity: Number(openingQty),
          unit_cost: Number(openingCost || 0),
          transaction_date: new Date().toISOString().slice(0, 10),
          notes: 'Opening stock entry',
        })
      }
      return newItem
    },
    onSuccess: () => {
      toast.success(editItem ? 'Item updated' : `Item added${hasOpening ? ' with opening stock' : ''}`)
      qc.invalidateQueries({ queryKey: ['stock-items'] })
      qc.invalidateQueries({ queryKey: ['stock-transactions'] })
      onClose()
    },
    onError: e => {
      const d = e.response?.data
      const msg = e.message || d?.store?.[0] || d?.name?.[0] || d?.detail || JSON.stringify(d) || 'Failed to save item'
      toast.error(msg)
    },
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const canSubmit = form.name.trim() && form.unit.trim() && (!hasOpening || openingStore)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">{editItem ? 'Edit Stock Item' : 'New Stock Item'}</h2>
            <p className="text-white/50 text-xs mt-0.5">Fill in the details below</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Item Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Item Name <span className="text-brand-red">*</span></label>
            <input autoFocus className={inp} value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. A4 Printing Paper, Safety Helmet, Foam Cleaner…" />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category <span className="text-brand-red">*</span></label>
            <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORY_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map(v => (
                    <option key={v} value={v}>{CATEGORY_LABELS[v]}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Unit of Measure */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Unit of Measure <span className="text-brand-red">*</span></label>
            <input className={inp} value={form.unit}
              onChange={e => set('unit', e.target.value)}
              placeholder="Type or pick a quick unit below…" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {UNIT_CHIPS.map(u => (
                <button key={u} type="button" onClick={() => set('unit', u)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors
                    ${form.unit === u
                      ? 'bg-brand-red text-white border-brand-red'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Item code — read only, edit mode only */}
          {editItem && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Item Code</span>
              <span className="font-mono text-sm font-bold text-brand-slate ml-1">{editItem.item_code}</span>
            </div>
          )}

          {/* Reorder level + Description row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reorder Alert Level</label>
              <input type="number" min="0" className={inp} value={form.reorder_level}
                onChange={e => set('reorder_level', e.target.value)}
                placeholder="e.g. 5" />
              <p className="text-[10px] text-gray-400 mt-1">Trigger low-stock alert below this qty</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className={inp} value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Brief notes…" />
            </div>
          </div>

          {/* Valuation method + Department */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Valuation Method</label>
              <select className={inp} value={form.valuation_method} onChange={e => set('valuation_method', e.target.value)}>
                <option value="wac">Weighted Average Cost</option>
                <option value="fifo">FIFO</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Department <span className="text-gray-400 font-normal">(optional)</span></label>
              <select className={inp} value={form.department || ''} onChange={e => set('department', e.target.value || null)}>
                <option value="">— All departments —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Active toggle — edit mode only */}
          {editItem && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="is_active_chk" checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red" />
              <label htmlFor="is_active_chk" className="text-xs font-semibold text-gray-600">Item is Active</label>
              {!form.is_active && <span className="text-[11px] text-red-500">Inactive items are hidden from issue/receive forms</span>}
            </div>
          )}

          {/* Opening stock — new items only */}
          {!editItem && (
            <div className="border border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50/40 space-y-3">
              <p className="text-xs font-bold text-indigo-700">Opening Stock
                <span className="font-normal text-indigo-500 ml-1">(optional — skip if stock is 0)</span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                  <input type="number" min="0" step="any" className={inp} value={openingQty}
                    onChange={e => setOpeningQty(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unit Cost (KES)</label>
                  <input type="number" min="0" step="any" className={inp} value={openingCost}
                    onChange={e => setOpeningCost(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              {/* Store picker */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Store {hasOpening && <span className="text-brand-red">*</span>}
                </label>
                {stores.length === 0 ? (
                  <QuickCreateStore onCreated={(newStore) => {
                    qc.invalidateQueries({ queryKey: ['stores'] })
                    setOpeningStore(newStore.id)
                  }} />
                ) : (
                  <>
                    <select className={inp} value={openingStore} onChange={e => setOpeningStore(e.target.value)}>
                      <option value="">— Select store —</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {hasOpening && !openingStore && (
                      <p className="text-[11px] text-red-500 mt-1">A store is required when adding opening stock.</p>
                    )}
                  </>
                )}
              </div>

              {hasOpening && openingStore && (
                <p className="text-[11px] text-indigo-600">
                  Will record a GRN of <strong>{openingQty}</strong> units
                  {openingCost ? ` @ KES ${Number(openingCost).toLocaleString()} each` : ''} into selected store.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => {
              const payload = {
                ...form,
                reorder_level: form.reorder_level === '' ? 0 : Number(form.reorder_level),
                department: form.department || null,
              }
              itemMut.mutate(payload)
            }}
            disabled={itemMut.isPending || !canSubmit}
            className="flex-1 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity">
            {itemMut.isPending ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
          </button>
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Adjust Stock Modal ────────────────────────────────────────────────────────

function AdjustStockModal({ item, stores, onClose }) {
  const qc = useQueryClient()
  const currentStock = Number(item.current_stock ?? 0)
  const currentCost  = Number(item.weighted_avg_cost ?? 0)
  const [store, setStore]       = useState(stores[0]?.id ?? '')
  const [newQty, setNewQty]     = useState(String(currentStock))
  const [unitCost, setUnitCost] = useState(currentCost > 0 ? String(currentCost) : '')
  const [notes, setNotes]       = useState('')

  // Auto-select first store when stores load asynchronously
  useEffect(() => {
    if (!store && stores[0]?.id) setStore(stores[0].id)
  }, [stores])

  const diff = Number(newQty) - currentStock
  const diffLabel = diff === 0
    ? (costChanged ? 'Qty unchanged — cost update only' : 'No change')
    : diff > 0 ? `+${diff} (stock will increase)`
    : `${diff} (stock will decrease)`
  const diffColor = diff === 0
    ? (costChanged ? 'text-indigo-500' : 'text-gray-400')
    : diff > 0 ? 'text-green-600' : 'text-red-600'

  const adjMut = useMutation({
    mutationFn: () => createTransaction({
      transaction_type: 'adjustment',
      item: item.id,
      store,
      quantity: Number(newQty),
      unit_cost: unitCost !== '' ? Number(unitCost) : Number(item.weighted_avg_cost || 0),
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: notes || (diff === 0
        ? `Unit cost updated to KES ${unitCost}`
        : `Stock adjusted from ${currentStock} to ${newQty} ${item.unit}`),
    }),
    onSuccess: () => {
      toast.success('Stock adjusted successfully')
      qc.invalidateQueries({ queryKey: ['stock-items'] })
      qc.invalidateQueries({ queryKey: ['stock-transactions'] })
      onClose()
    },
    onError: e => {
      const d = e.response?.data
      toast.error(d?.detail || d?.quantity?.[0] || JSON.stringify(d) || 'Adjustment failed')
    },
  })

  const needsStore = stores.length > 0
  const costChanged = unitCost !== '' && Number(unitCost) !== currentCost
  const canSave = (!needsStore || store) && newQty !== '' && !isNaN(Number(newQty)) && Number(newQty) >= 0 && (diff !== 0 || costChanged)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">

        {/* Header */}
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Adjust Stock</h2>
            <p className="text-white/50 text-xs mt-0.5 font-mono">{item.item_code} — {item.name}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Current stock display */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-xs text-gray-500 font-semibold">Current Stock</span>
            <span className="text-lg font-extrabold text-brand-slate">{currentStock.toLocaleString()} <span className="text-xs font-normal text-gray-400">{item.unit}</span></span>
          </div>

          {/* New quantity + Unit cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">New Quantity <span className="text-brand-red">*</span></label>
              <input
                type="number" min="0" step="any"
                className={inp}
                value={newQty}
                onChange={e => setNewQty(e.target.value)}
                autoFocus
              />
              <p className={`text-[11px] mt-1.5 font-semibold ${diffColor}`}>{diffLabel}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Unit Cost (KES)</label>
              <input
                type="number" min="0" step="any"
                className={inp}
                value={unitCost}
                onChange={e => setUnitCost(e.target.value)}
                placeholder={currentCost > 0 ? `Current: ${currentCost.toLocaleString()}` : '0.00'}
              />
              <p className="text-[10px] text-gray-400 mt-1">Updates weighted avg cost</p>
            </div>
          </div>

          {/* Store */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Store <span className="text-brand-red">*</span></label>
            {stores.length === 0 ? (
              <QuickCreateStore onCreated={(newStore) => {
                qc.invalidateQueries({ queryKey: ['stores'] })
                setStore(newStore.id)
              }} />
            ) : (
              <select className={inp} value={store} onChange={e => setStore(e.target.value)}>
                <option value="">— Select store —</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason / Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Physical count correction, damaged goods…" />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => adjMut.mutate()}
            disabled={adjMut.isPending || !canSave}
            className="flex-1 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity">
            {adjMut.isPending ? 'Saving…' : 'Save Adjustment'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const user = useAuthStore(s => s.user)
  const role = user?.role || ''
  const canEdit = role === 'system_admin' || role === 'storekeeper' || role === 'procurement_officer' || role === 'admin_officer'

  const [tab, setTab] = useState('items')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showAddItem, setShowAddItem] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [adjustItem, setAdjustItem] = useState(null)

  // Issue form
  const [issueForm, setIssueForm] = useState({
    item: '', quantity: '', issued_to: '', issued_to_name: '', notes: '', date: today,
  })

  // Receive form
  const [receiveForm, setReceiveForm] = useState({
    item: '', quantity: '', unit_cost: '', notes: '', date: today, supplier: '',
  })

  // History filters
  const [hDateFrom, setHDateFrom] = useState('')
  const [hDateTo, setHDateTo] = useState('')
  const [hType, setHType] = useState('')
  const [hItem, setHItem] = useState('')
  const [hSearch, setHSearch] = useState('')

  const qc = useQueryClient()

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['stock-items'],
    queryFn: () => getStockItems({ page_size: 500 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['stock-transactions'],
    queryFn: () => getTransactions({ page_size: 500 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: lowStock = [] } = useQuery({
    queryKey: ['low-stock'],
    queryFn: getLowStockItems,
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: systemUsers = [] } = useQuery({
    queryKey: ['system-users'],
    queryFn: getSystemUsers,
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/auth/departments/'),
    select: r => r.data?.results ?? r.data ?? [],
  })

  // ── Mutations ────────────────────────────────────────────────────────────────

  const issueMut = useMutation({
    mutationFn: createTransaction,
    onSuccess: (_, vars) => {
      const item = items.find(i => String(i.id) === String(vars.item))
      const recipient = vars.issued_to_name ||
        systemUsers.find(u => String(u.id) === String(vars.issued_to))?.full_name ||
        systemUsers.find(u => String(u.id) === String(vars.issued_to))?.username ||
        'recipient'
      toast.success(`Issued ${vars.quantity} units of ${item?.name ?? 'item'} to ${recipient}`)
      qc.invalidateQueries({ queryKey: ['stock-items'] })
      qc.invalidateQueries({ queryKey: ['stock-transactions'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      setIssueForm({ item: '', quantity: '', issued_to: '', issued_to_name: '', notes: '', date: today })
    },
    onError: e => {
      const d = e.response?.data
      toast.error(d?.non_field_errors?.[0] || d?.detail || JSON.stringify(d) || 'Issue failed')
    },
  })

  const receiveMut = useMutation({
    mutationFn: createTransaction,
    onSuccess: (_, vars) => {
      const item = items.find(i => String(i.id) === String(vars.item))
      toast.success(`Received ${vars.quantity} units of ${item?.name ?? 'item'}`)
      qc.invalidateQueries({ queryKey: ['stock-items'] })
      qc.invalidateQueries({ queryKey: ['stock-transactions'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      setReceiveForm({ item: '', quantity: '', unit_cost: '', notes: '', date: today, supplier: '' })
    },
    onError: e => {
      const d = e.response?.data
      toast.error(d?.non_field_errors?.[0] || d?.detail || JSON.stringify(d) || 'Receive failed')
    },
  })

  // ── Derived data ─────────────────────────────────────────────────────────────

  const firstStoreId = stores[0]?.id ?? ''

  const totalValue = useMemo(() =>
    items.reduce((s, i) => s + Number(i.current_stock) * Number(i.weighted_avg_cost || 0), 0),
  [items])

  const issuesThisMonth = useMemo(() => {
    const now = new Date()
    return transactions.filter(tx => {
      if (tx.transaction_type !== 'issue') return false
      const d = new Date(tx.transaction_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, [transactions])

  const filteredItems = useMemo(() =>
    items.filter(i => {
      const matchSearch = !search ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.item_code || '').toLowerCase().includes(search.toLowerCase())
      const matchCat = !filterCat || i.category === filterCat
      return matchSearch && matchCat
    }),
  [items, search, filterCat])

  const filteredHistory = useMemo(() =>
    transactions.filter(tx => {
      if (hType && tx.transaction_type !== hType) return false
      if (hItem && String(tx.item) !== String(hItem)) return false
      if (hDateFrom && tx.transaction_date < hDateFrom) return false
      if (hDateTo && tx.transaction_date > hDateTo + 'T23:59:59') return false
      if (hSearch) {
        const q = hSearch.toLowerCase()
        const match =
          (tx.item_name || '').toLowerCase().includes(q) ||
          (tx.reference_number || '').toLowerCase().includes(q) ||
          (tx.issued_to_display || tx.issued_to_name || '').toLowerCase().includes(q) ||
          (tx.processed_by_name || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    }),
  [transactions, hType, hItem, hDateFrom, hDateTo, hSearch])

  // ── Issue submit ─────────────────────────────────────────────────────────────

  const handleIssue = () => {
    if (!issueForm.item || !issueForm.quantity) {
      toast.error('Item and quantity are required')
      return
    }
    if (!issueForm.issued_to && !issueForm.issued_to_name.trim()) {
      toast.error('Please select a system user or enter a recipient name')
      return
    }
    const selectedItem = items.find(i => String(i.id) === String(issueForm.item))
    const payload = {
      transaction_type: 'issue',
      item: issueForm.item,
      store: firstStoreId,
      quantity: Number(issueForm.quantity),
      unit_cost: Number(selectedItem?.weighted_avg_cost || 0),
      issued_to: issueForm.issued_to || undefined,
      issued_to_name: issueForm.issued_to_name.trim() || undefined,
      transaction_date: issueForm.date,
      notes: issueForm.notes,
      reference_number: '',
    }
    issueMut.mutate(payload)
  }

  // ── Receive submit ────────────────────────────────────────────────────────────

  const handleReceive = () => {
    if (!receiveForm.item || !receiveForm.quantity || !receiveForm.unit_cost) {
      toast.error('Item, quantity and unit cost are required')
      return
    }
    const payload = {
      transaction_type: 'grn',
      item: receiveForm.item,
      store: firstStoreId,
      quantity: Number(receiveForm.quantity),
      unit_cost: Number(receiveForm.unit_cost),
      transaction_date: receiveForm.date,
      notes: receiveForm.notes
        ? `${receiveForm.supplier ? 'Supplier: ' + receiveForm.supplier + '. ' : ''}${receiveForm.notes}`
        : receiveForm.supplier ? 'Supplier: ' + receiveForm.supplier : '',
      reference_number: '',
    }
    receiveMut.mutate(payload)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand-slate">Inventory</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            {user?.department_name ? `${user.department_name} · ` : ''}Stock management & transactions
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
            <PlusIcon className="h-4 w-4" /> Add Item
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <DocumentTextIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Items</p>
            <p className="text-lg font-bold text-brand-slate">{items.length}</p>
            <p className="text-xs text-gray-600">in catalog</p>
          </div>
        </div>

        {/* Total Stock Value */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50 text-green-600">
            <ArrowsRightLeftIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Stock Value</p>
            <p className="text-lg font-bold text-brand-slate">
              KES {totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-600">estimated value</p>
          </div>
        </div>

        {/* Issues This Month */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
            <ArrowUpTrayIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Issues This Month</p>
            <p className="text-lg font-bold text-brand-slate">{issuesThisMonth}</p>
            <p className="text-xs text-gray-600">transactions</p>
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${lowStock.length > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
            <ExclamationTriangleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Low Stock</p>
            <p className={`text-lg font-bold ${lowStock.length > 0 ? 'text-red-600' : 'text-brand-slate'}`}>{lowStock.length}</p>
            <p className="text-xs text-gray-600">items at/below reorder</p>
          </div>
        </div>
      </div>

      {/* Tab panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 px-5 pt-4 gap-5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`pb-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-brand-red text-brand-red'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
              {t.key === 'lowstock' && lowStock.length > 0 && (
                <span className="ml-1.5 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full font-bold">{lowStock.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ── TAB: Items ───────────────────────────────────────────────────── */}
          {tab === 'items' && (
            <div className="space-y-4">
              {/* Filters row */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name or code…"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red" />
                </div>
                <select
                  value={filterCat}
                  onChange={e => setFilterCat(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white">
                  <option value="">All Categories</option>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {canEdit && (
                  <button
                    onClick={() => setTab('issue')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 text-gray-600 ml-auto">
                    <ArrowUpTrayIcon className="h-3.5 w-3.5" /> Issue Stock
                  </button>
                )}
              </div>

              {/* Table */}
              {loadingItems ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}</div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <DocumentTextIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No items found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        {['Code', 'Name', 'Category', 'Unit', 'In Stock', 'Reorder', 'Unit Cost', 'Value', 'Status', ''].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredItems.map(item => {
                        const stock = Number(item.current_stock)
                        const reorder = Number(item.reorder_level ?? 0)
                        const wac = Number(item.weighted_avg_cost || 0)
                        const isOut = stock === 0
                        const isLow = stock > 0 && stock <= reorder
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5">
                              <Link to={`/inventory/${item.id}`} className="font-mono text-brand-red hover:underline text-xs">
                                {item.item_code}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-800">{item.name}</td>
                            <td className="px-3 py-2.5 text-gray-600">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                            <td className="px-3 py-2.5 text-gray-600">{item.unit}</td>
                            <td className={`px-3 py-2.5 font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-green-700'}`}>
                              {stock.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">{reorder.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-gray-600">
                              {wac > 0 ? `KES ${wac.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">
                              {wac > 0
                                ? `KES ${(stock * wac).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                : '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                isOut ? 'bg-red-100 text-red-700' :
                                isLow ? 'bg-amber-100 text-amber-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {isOut ? 'Out of Stock' : isLow ? 'Low' : 'OK'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      setIssueForm(f => ({ ...f, item: String(item.id) }))
                                      setTab('issue')
                                    }}
                                    className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                                    Issue
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    onClick={() => setAdjustItem(item)}
                                    className="px-2 py-1 text-xs border border-amber-200 rounded hover:bg-amber-50 text-amber-700 font-medium">
                                    Adjust
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    onClick={() => setEditItem(item)}
                                    className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                                    Edit
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Issue ───────────────────────────────────────────────────── */}
          {tab === 'issue' && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div>
                  <h2 className="text-sm font-bold text-brand-slate uppercase tracking-wide">Issue Stock to Person</h2>
                  <div className="mt-2 border-b border-gray-100" />
                </div>

                {/* Item */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Item *</label>
                  <select
                    className={inp}
                    value={issueForm.item}
                    onChange={e => setIssueForm(f => ({ ...f, item: e.target.value }))}>
                    <option value="">— Select item —</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.item_code}) — {Number(i.current_stock).toLocaleString()} {i.unit} in stock
                      </option>
                    ))}
                  </select>
                  {issueForm.item && (() => {
                    const sel = items.find(i => String(i.id) === String(issueForm.item))
                    return sel ? (
                      <p className="mt-1 text-xs text-gray-600">
                        Current stock: <span className="font-semibold text-gray-700">{Number(sel.current_stock).toLocaleString()} {sel.unit}</span>
                      </p>
                    ) : null
                  })()}
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className={inp}
                    value={issueForm.quantity}
                    onChange={e => setIssueForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0" />
                </div>

                {/* System user */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> Issued To (System User)</span>
                  </label>
                  <select
                    className={inp}
                    value={issueForm.issued_to}
                    onChange={e => setIssueForm(f => ({ ...f, issued_to: e.target.value, issued_to_name: '' }))}>
                    <option value="">— Select system user —</option>
                    {systemUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.username} {u.role ? `(${u.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-b border-gray-100" />
                  <span className="text-xs text-gray-600 font-medium">— OR —</span>
                  <div className="flex-1 border-b border-gray-100" />
                </div>

                {/* External recipient */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Recipient Name (External)</label>
                  <input
                    className={inp}
                    value={issueForm.issued_to_name}
                    onChange={e => setIssueForm(f => ({ ...f, issued_to_name: e.target.value, issued_to: '' }))}
                    placeholder="Enter name if not in system" />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input
                    type="date"
                    className={inp}
                    value={issueForm.date}
                    onChange={e => setIssueForm(f => ({ ...f, date: e.target.value }))} />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    className={`${inp} resize-none`}
                    value={issueForm.notes}
                    onChange={e => setIssueForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes or purpose" />
                </div>

                {/* Submit */}
                <div className="pt-1">
                  <button
                    onClick={handleIssue}
                    disabled={issueMut.isPending || !issueForm.item || !issueForm.quantity}
                    className="w-full flex items-center justify-center gap-2 bg-brand-red text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 hover:opacity-90">
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    {issueMut.isPending ? 'Processing…' : 'Issue Stock →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Receive ─────────────────────────────────────────────────── */}
          {tab === 'receive' && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div>
                  <h2 className="text-sm font-bold text-brand-slate uppercase tracking-wide">Receive Stock (Goods Received)</h2>
                  <div className="mt-2 border-b border-gray-100" />
                </div>

                {/* Item */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Item *</label>
                  <select
                    className={inp}
                    value={receiveForm.item}
                    onChange={e => setReceiveForm(f => ({ ...f, item: e.target.value }))}>
                    <option value="">— Select item —</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className={inp}
                    value={receiveForm.quantity}
                    onChange={e => setReceiveForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0" />
                </div>

                {/* Unit Cost */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit Cost (KES) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={inp}
                    value={receiveForm.unit_cost}
                    onChange={e => setReceiveForm(f => ({ ...f, unit_cost: e.target.value }))}
                    placeholder="0.00" />
                </div>

                {/* Supplier */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Supplier / Source</label>
                  <input
                    className={inp}
                    value={receiveForm.supplier}
                    onChange={e => setReceiveForm(f => ({ ...f, supplier: e.target.value }))}
                    placeholder="Supplier name or source" />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input
                    type="date"
                    className={inp}
                    value={receiveForm.date}
                    onChange={e => setReceiveForm(f => ({ ...f, date: e.target.value }))} />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    className={`${inp} resize-none`}
                    value={receiveForm.notes}
                    onChange={e => setReceiveForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes" />
                </div>

                {/* Submit */}
                <div className="pt-1">
                  <button
                    onClick={handleReceive}
                    disabled={receiveMut.isPending || !receiveForm.item || !receiveForm.quantity || !receiveForm.unit_cost}
                    className="w-full flex items-center justify-center gap-2 bg-brand-red text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 hover:opacity-90">
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    {receiveMut.isPending ? 'Processing…' : 'Record Receipt →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: History ─────────────────────────────────────────────────── */}
          {tab === 'history' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white"
                  value={hDateFrom}
                  onChange={e => setHDateFrom(e.target.value)}
                  placeholder="Date from" />
                <input
                  type="date"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white"
                  value={hDateTo}
                  onChange={e => setHDateTo(e.target.value)}
                  placeholder="Date to" />
                <select
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white"
                  value={hType}
                  onChange={e => setHType(e.target.value)}>
                  <option value="">All Types</option>
                  {Object.entries(TX_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white"
                  value={hItem}
                  onChange={e => setHItem(e.target.value)}>
                  <option value="">All Items</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red"
                    placeholder="Search…"
                    value={hSearch}
                    onChange={e => setHSearch(e.target.value)} />
                </div>
              </div>

              {/* Table */}
              {filteredHistory.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <DocumentTextIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No transactions found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        {['Date', 'Type', 'Item', 'Qty', 'Issued To / Source', 'Recorded By', 'Notes', 'Ref'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredHistory.map(tx => (
                        <tr key={tx.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                            {new Date(tx.transaction_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TX_COLORS[tx.transaction_type] ?? 'bg-gray-100 text-gray-600'}`}>
                              {TX_LABELS[tx.transaction_type] ?? tx.transaction_type}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{tx.item_name}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-700">{Number(tx.quantity).toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-gray-600">{tx.issued_to_display || tx.issued_to_name || '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600">{tx.processed_by_name || '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600 max-w-[180px] truncate" title={tx.notes}>{tx.notes || '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-600 whitespace-nowrap">{tx.reference_number || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs text-gray-600">{filteredHistory.length} transaction{filteredHistory.length !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Low Stock ───────────────────────────────────────────────── */}
          {tab === 'lowstock' && (
            <div>
              {lowStock.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <ExclamationTriangleIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">All stock levels are healthy.</p>
                  <p className="text-xs mt-1">No items are at or below their reorder level.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600 mb-4">{lowStock.length} item{lowStock.length !== 1 ? 's' : ''} require restocking</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {lowStock.map(item => {
                      const stock = Number(item.current_stock)
                      const reorder = Number(item.reorder_level ?? 0)
                      const pct = reorder > 0 ? Math.min((stock / reorder) * 100, 100) : 0
                      const isOut = stock === 0
                      return (
                        <div key={item.id}
                          className={`rounded-xl border p-4 ${isOut ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <div>
                              <p className="font-semibold text-sm text-gray-800 leading-tight">{item.name}</p>
                              <p className="text-xs text-gray-600 mt-0.5">{item.item_code} · {item.unit}</p>
                            </div>
                            <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${isOut ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {isOut ? 'Out of Stock' : 'Low Stock'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs mb-2">
                            <span className="text-gray-600">Stock: <strong className={isOut ? 'text-red-600' : 'text-amber-600'}>{stock.toLocaleString()}</strong></span>
                            <span className="text-gray-600">/ reorder: {reorder.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 bg-white rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isOut ? 'bg-red-400' : 'bg-amber-400'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => {
                                setReceiveForm(f => ({ ...f, item: String(item.id) }))
                                setTab('receive')
                              }}
                              className="mt-3 w-full text-xs font-medium py-1.5 rounded-lg border border-brand-red text-brand-red hover:bg-red-50 transition-colors">
                              + Receive Stock
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      {(showAddItem || editItem) && (
        <AddItemModal
          editItem={editItem}
          stores={stores}
          departments={departments}
          onClose={() => { setShowAddItem(false); setEditItem(null) }} />
      )}
      {adjustItem && (
        <AdjustStockModal
          item={adjustItem}
          stores={stores}
          onClose={() => setAdjustItem(null)} />
      )}
    </div>
  )
}
