import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  PlusIcon, ArrowsRightLeftIcon, ExclamationTriangleIcon,
  BuildingOfficeIcon, CubeIcon,
} from '@heroicons/react/24/outline'
import {
  getStockItems, createStockItem, getTransactions, createTransaction,
  getStores, getLowStockItems,
} from '../../api/inventory'
import useAuthStore from '../../store/authStore'
import api from '../../api/client'

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEW_ALL_READONLY = ['managing_director', 'finance_officer', 'finance_manager', 'admin_officer', 'general_manager']

const CATEGORY_LABELS = {
  construction_materials: 'Construction',
  spare_parts: 'Spare Parts',
  fuel: 'Fuel',
  ppe_safety: 'PPE & Safety',
  office_consumables: 'Office',
  other: 'Other',
}

const TX_LABELS = {
  grn: 'GRN', issue: 'Issue', transfer: 'Transfer', return: 'Return', adjustment: 'Adjustment',
}
const TX_COLORS = {
  grn: 'bg-green-100 text-green-700',
  issue: 'bg-red-100 text-red-700',
  transfer: 'bg-blue-100 text-blue-700',
  return: 'bg-amber-100 text-amber-700',
  adjustment: 'bg-purple-100 text-purple-700',
}

const emptyItem = { item_code: '', name: '', category: 'office_consumables', unit: '', reorder_level: '', description: '', valuation_method: 'wac' }
const emptyTx = { transaction_type: 'grn', item: '', store: '', quantity: '', unit_cost: '', reference_number: '', notes: '', transaction_date: new Date().toISOString().slice(0, 16), reason: '' }

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', green: 'bg-green-50 text-green-600', purple: 'bg-purple-50 text-purple-600' }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${colors[color]}`}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-bold text-brand-slate">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

function DeptBanner({ name, canEdit }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border ${canEdit ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
      <BuildingOfficeIcon className="h-4 w-4 flex-shrink-0" />
      <span>{canEdit ? `${name} — Your Department` : `Viewing: ${name}`}</span>
      {!canEdit && <span className="ml-auto text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">View only</span>}
    </div>
  )
}

// ── Add Item Modal ─────────────────────────────────────────────────────────────

function AddItemModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ ...emptyItem })
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: createStockItem,
    onSuccess: () => {
      toast.success('Stock item added')
      qc.invalidateQueries(['stock-items'])
      onSuccess?.()
      onClose()
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to add item'),
  })
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-brand-slate">Add Stock Item</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Item Code *</label><input required className={inp} value={form.item_code} onChange={e => setForm(f => ({...f, item_code: e.target.value}))} /></div>
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Name *</label><input required className={inp} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select className={inp} value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Unit *</label><input required className={inp} value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))} placeholder="pcs / kg / L" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Reorder Level</label><input type="number" min="0" className={inp} value={form.reorder_level} onChange={e => setForm(f => ({...f, reorder_level: e.target.value}))} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Valuation</label>
            <select className={inp} value={form.valuation_method} onChange={e => setForm(f => ({...f, valuation_method: e.target.value}))}>
              <option value="wac">Weighted Average</option>
              <option value="fifo">FIFO</option>
            </select>
          </div>
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Description</label><textarea rows={2} className={`${inp} resize-none`} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.item_code || !form.name || !form.unit}
            className="flex-1 bg-brand-red text-white text-sm font-medium py-2 rounded-lg disabled:opacity-60">
            {mut.isPending ? 'Saving…' : 'Add Item'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Record Movement Modal ──────────────────────────────────────────────────────

function RecordMovementModal({ items, stores, prefillItem, onClose, onSuccess }) {
  const [form, setForm] = useState({ ...emptyTx, item: prefillItem || '' })
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      toast.success('Movement recorded')
      qc.invalidateQueries(['transactions'])
      qc.invalidateQueries(['stock-items'])
      onSuccess?.()
      onClose()
    },
    onError: e => {
      const d = e.response?.data
      toast.error(d?.non_field_errors?.[0] || d?.detail || JSON.stringify(d) || 'Failed')
    },
  })
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-brand-slate">Record Stock Movement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select className={inp} value={form.transaction_type} onChange={e => setForm(f => ({...f, transaction_type: e.target.value}))}>
              {Object.entries(TX_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Item *</label>
            <select required className={inp} value={form.item} onChange={e => setForm(f => ({...f, item: e.target.value}))}>
              <option value="">— Select —</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Store *</label>
            <select required className={inp} value={form.store} onChange={e => setForm(f => ({...f, store: e.target.value}))}>
              <option value="">— Select —</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Date *</label><input type="datetime-local" required className={inp} value={form.transaction_date} onChange={e => setForm(f => ({...f, transaction_date: e.target.value}))} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Quantity *</label><input type="number" min="0.01" step="any" required className={inp} value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Unit Cost (KES)</label><input type="number" min="0" step="any" className={inp} value={form.unit_cost} onChange={e => setForm(f => ({...f, unit_cost: e.target.value}))} /></div>
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Reference No. *</label><input required className={inp} value={form.reference_number} onChange={e => setForm(f => ({...f, reference_number: e.target.value}))} /></div>
          {form.transaction_type === 'adjustment' && (
            <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Reason (required for adjustments)</label><textarea rows={2} className={`${inp} resize-none`} value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} /></div>
          )}
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Notes</label><textarea rows={2} className={`${inp} resize-none`} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => mut.mutate({ ...form, quantity: Number(form.quantity), unit_cost: Number(form.unit_cost || 0) })}
            disabled={mut.isPending || !form.item || !form.store || !form.quantity || !form.reference_number}
            className="flex-1 bg-brand-red text-white text-sm font-medium py-2 rounded-lg disabled:opacity-60">
            {mut.isPending ? 'Saving…' : 'Record Movement'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const user = useAuthStore(s => s.user)
  const role = user?.role || ''
  const canEdit = role === 'system_admin' || !VIEW_ALL_READONLY.includes(role)
  const canViewAll = role === 'system_admin' || VIEW_ALL_READONLY.includes(role)

  const [tab, setTab] = useState('items')
  const [search, setSearch] = useState('')
  const [showAddItem, setShowAddItem] = useState(false)
  const [showMovement, setShowMovement] = useState(false)
  const [movementPrefill, setMovementPrefill] = useState(null)
  const [selectedDept, setSelectedDept] = useState(null) // dept id for view-all users, null = all

  // Fetch departments for view-all users
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/core/departments/').then(r => r.data?.results ?? r.data ?? []),
    enabled: canViewAll,
  })

  // Build query params
  const itemParams = { page_size: 200 }
  if (canViewAll && selectedDept) itemParams.department = selectedDept

  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ['stock-items', itemParams],
    queryFn: () => getStockItems(itemParams),
    select: r => r.data?.results ?? r.data ?? [],
  })
  const items = itemsData ?? []

  const txParams = { page_size: 200 }
  const { data: txData } = useQuery({
    queryKey: ['transactions', txParams],
    queryFn: () => getTransactions(txParams),
    select: r => r.data?.results ?? r.data ?? [],
  })
  const transactions = txData ?? []

  const { data: storesData } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
    select: r => r.data?.results ?? r.data ?? [],
  })
  const stores = storesData ?? []

  const lowItems = items.filter(i => Number(i.current_stock) <= Number(i.reorder_level))
  const totalValue = items.reduce((s, i) => s + Number(i.current_stock) * Number(i.weighted_avg_cost || 0), 0)

  const filteredItems = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.item_code.toLowerCase().includes(search.toLowerCase())
  )

  // Department display label for the banner
  const currentDeptLabel = canViewAll
    ? (selectedDept ? departments.find(d => d.id === selectedDept)?.name : 'All Departments')
    : (user?.department_name || 'Your Department')

  const TABS = [
    { key: 'items', label: 'Stock Items' },
    { key: 'movements', label: 'Stock Movements' },
    { key: 'alerts', label: `Low Stock Alerts${lowItems.length ? ` (${lowItems.length})` : ''}` },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand-slate">Inventory</h1>
          <p className="text-xs text-gray-400 mt-0.5">Stock items, movements &amp; alerts</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setShowMovement(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-xs font-medium rounded-xl hover:bg-gray-50 text-gray-600">
              <ArrowsRightLeftIcon className="h-4 w-4" /> Record Movement
            </button>
            <button onClick={() => setShowAddItem(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
              <PlusIcon className="h-4 w-4" /> Add Item
            </button>
          </div>
        )}
      </div>

      {/* Department context */}
      {canViewAll ? (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 mr-1">Department:</span>
          <button onClick={() => setSelectedDept(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!selectedDept ? 'bg-brand-slate text-white border-brand-slate' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            All
          </button>
          {departments.map(d => (
            <button key={d.id} onClick={() => setSelectedDept(d.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedDept === d.id ? 'bg-brand-slate text-white border-brand-slate' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {d.name}
            </button>
          ))}
        </div>
      ) : (
        <DeptBanner name={user?.department_name || 'Unknown Department'} canEdit={canEdit} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={CubeIcon} label="Total Items" value={items.length} color="blue" />
        <StatCard icon={ExclamationTriangleIcon} label="Low Stock" value={lowItems.length} color="amber" />
        <StatCard icon={ArrowsRightLeftIcon} label="Movements" value={transactions.length} color="purple" />
        <StatCard icon={CubeIcon} label="Total Value" value={`KES ${totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}`} color="green" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 px-5 pt-4 gap-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`pb-3 text-xs font-semibold transition-colors border-b-2 ${tab === t.key ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Stock Items Tab */}
          {tab === 'items' && (
            <div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className="mb-4 w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red" />
              {loadingItems ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <CubeIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No stock items found.</p>
                  {canEdit && <button onClick={() => setShowAddItem(true)} className="mt-3 text-xs text-brand-red font-medium hover:underline">+ Add your first item</button>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>{['Code','Name','Category','Unit','Stock','Reorder','WAC','Value','Status'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredItems.map(item => {
                        const stock = Number(item.current_stock)
                        const reorder = Number(item.reorder_level)
                        const wac = Number(item.weighted_avg_cost || 0)
                        const isOut = stock === 0
                        const isLow = stock > 0 && stock <= reorder
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-mono text-gray-500">{item.item_code}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-800">{item.name}</td>
                            <td className="px-3 py-2.5 text-gray-500">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                            <td className="px-3 py-2.5 text-gray-500">{item.unit}</td>
                            <td className={`px-3 py-2.5 font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-green-700'}`}>{stock.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-gray-500">{reorder.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-gray-500">{wac.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-gray-700">{(stock * wac).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                {isOut ? 'Out' : isLow ? 'Low' : 'OK'}
                              </span>
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

          {/* Movements Tab */}
          {tab === 'movements' && (
            <div className="overflow-x-auto">
              {transactions.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <ArrowsRightLeftIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No movements recorded yet.</p>
                </div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>{['Date','Item','Type','Qty','Unit Cost','Reference','Recorded By'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{new Date(tx.transaction_date).toLocaleDateString()}</td>
                        <td className="px-3 py-2.5 text-gray-800">{tx.item_name}</td>
                        <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TX_COLORS[tx.transaction_type] ?? 'bg-gray-100 text-gray-600'}`}>{TX_LABELS[tx.transaction_type] ?? tx.transaction_type}</span></td>
                        <td className="px-3 py-2.5 font-medium text-gray-700">{Number(tx.quantity).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-gray-500">{Number(tx.unit_cost).toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-400">{tx.reference_number}</td>
                        <td className="px-3 py-2.5 text-gray-500">{tx.processed_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Low Stock Tab */}
          {tab === 'alerts' && (
            <div>
              {lowItems.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <ExclamationTriangleIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">All stock levels are healthy.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lowItems.map(item => {
                    const stock = Number(item.current_stock)
                    const reorder = Number(item.reorder_level)
                    const pct = reorder > 0 ? Math.min((stock / reorder) * 100, 100) : 0
                    return (
                      <div key={item.id} className={`rounded-xl border p-4 ${stock === 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm text-gray-800">{item.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {stock === 0 ? 'Out of Stock' : 'Low Stock'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{item.item_code} · {item.unit}</p>
                        <div className="flex items-center gap-2 text-xs mb-2">
                          <span className="text-gray-500">Stock: <strong className={stock === 0 ? 'text-red-600' : 'text-amber-600'}>{stock}</strong></span>
                          <span className="text-gray-400">/ reorder: {reorder}</span>
                        </div>
                        <div className="h-1.5 bg-white rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${stock === 0 ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                        {canEdit && (
                          <button onClick={() => { setMovementPrefill(item.id); setShowMovement(true) }}
                            className="mt-3 w-full text-xs font-medium py-1.5 rounded-lg border border-current text-brand-red hover:bg-red-50">
                            + Record Movement
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddItem && <AddItemModal onClose={() => setShowAddItem(false)} />}
      {showMovement && <RecordMovementModal items={items} stores={stores} prefillItem={movementPrefill} onClose={() => { setShowMovement(false); setMovementPrefill(null) }} />}
    </div>
  )
}
