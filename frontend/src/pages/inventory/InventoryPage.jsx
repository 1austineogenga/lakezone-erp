import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  CubeIcon, PlusIcon, MagnifyingGlassIcon,
  ExclamationTriangleIcon, ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'
import {
  getStockItems, getTransactions, createStockItem, getStores,
} from '../../api/inventory'

/* ── helpers ── */
const CATEGORY_LABELS = {
  construction_materials: 'Construction',
  spare_parts:            'Spare Parts',
  fuel:                   'Fuel & Lubes',
  ppe_safety:             'PPE & Safety',
  office_consumables:     'Office',
  other:                  'Other',
}

const TX_TYPE_COLORS = {
  grn:        'bg-green-100 text-green-700',
  issue:      'bg-red-100 text-red-700',
  transfer:   'bg-blue-100 text-blue-700',
  return:     'bg-yellow-100 text-yellow-700',
  adjustment: 'bg-purple-100 text-purple-700',
}
const TX_TYPE_LABELS = {
  grn: 'GRN', issue: 'Issue', transfer: 'Transfer', return: 'Return', adjustment: 'Adjustment',
}

function stockStatus(current, reorder) {
  const c = parseFloat(current)
  const r = parseFloat(reorder)
  if (c <= 0)   return { label: 'Out of Stock', cls: 'bg-red-100 text-red-700' }
  if (c <= r)   return { label: 'Low Stock',    cls: 'bg-yellow-100 text-yellow-700' }
  return           { label: 'In Stock',         cls: 'bg-green-100 text-green-700' }
}

/* ── Add Item Modal ── */
function AddItemModal({ stores, onClose, onSaved }) {
  const [form, setForm] = useState({
    item_code: '', name: '', category: 'other', unit: '',
    reorder_level: '', valuation_method: 'wac', description: '',
  })
  const { mutate, isPending } = useMutation({
    mutationFn: createStockItem,
    onSuccess: (res) => { toast.success(`Item ${res.data.item_code} created.`); onSaved() },
    onError:   () => toast.error('Failed to create item.'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg p-6 shadow-xl">
        <h2 className="font-bold text-brand-slate text-lg mb-4">Add Stock Item</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Item Code *</label>
            <input required value={form.item_code} onChange={e => set('item_code', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
              placeholder="MAT-001" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
              placeholder="Cement 50kg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unit *</label>
            <input required value={form.unit} onChange={e => set('unit', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
              placeholder="bags" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Level</label>
            <input type="number" min="0" step="0.01" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
              placeholder="50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Valuation</label>
            <select value={form.valuation_method} onChange={e => set('valuation_method', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
              <option value="wac">Weighted Avg Cost</option>
              <option value="fifo">FIFO</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red resize-none"
              placeholder="Optional description…" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button disabled={isPending} onClick={() => mutate(form)}
            className="px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            {isPending ? 'Saving…' : 'Save Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Stock Items Tab ── */
function StockItemsTab({ items, onAddItem }) {
  const [search, setSearch] = useState('')
  const filtered = items.filter(it =>
    it.name.toLowerCase().includes(search.toLowerCase()) ||
    it.item_code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red w-64"
            placeholder="Search items…" />
        </div>
        <button onClick={onAddItem}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-4 w-4" /> Add Item
        </button>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {!filtered.length ? (
          <div className="p-10 text-center text-gray-400 text-sm">No stock items found.</div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Item Code', 'Name', 'Category', 'Unit', 'Current Stock', 'Reorder Level', 'Unit Cost (WAC)', 'Total Value', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(it => {
                const current = parseFloat(it.current_stock) || 0
                const wac = parseFloat(it.weighted_avg_cost) || 0
                const totalVal = current * wac
                const st = stockStatus(current, it.reorder_level)
                return (
                  <tr key={it.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-brand-slate font-medium">{it.item_code}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-800">{it.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{CATEGORY_LABELS[it.category] ?? it.category}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{it.unit}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 font-medium">{Number(current).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{Number(it.reorder_level).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{wac ? `KES ${wac.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{totalVal ? `KES ${totalVal.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/inventory/${it.id}`} className="text-brand-red hover:underline text-xs font-medium">View</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ── Stock Movements Tab ── */
function StockMovementsTab({ transactions }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {!transactions.length ? (
        <div className="p-10 text-center text-gray-400 text-sm">No stock movements recorded.</div>
      ) : (
        <table className="min-w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Date', 'Item', 'Type', 'Quantity', 'Unit Cost', 'Reference', 'Notes', 'Recorded By'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map(tx => (
              <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs text-gray-500">
                  {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-800 font-medium">
                  <span className="block">{tx.item_name}</span>
                  <span className="text-gray-400 font-mono">{tx.item_code}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TX_TYPE_COLORS[tx.transaction_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {TX_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">{Number(tx.quantity).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{tx.unit_cost ? `KES ${Number(tx.unit_cost).toLocaleString()}` : '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-brand-slate">{tx.reference_number}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{tx.notes || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{tx.processed_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ── Low Stock Alerts Tab ── */
function LowStockTab({ items }) {
  const lowStockItems = items.filter(it => parseFloat(it.current_stock) <= parseFloat(it.reorder_level))

  return (
    <div>
      {!lowStockItems.length ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <CubeIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No low-stock alerts. All items are well-stocked.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
            <span><strong>{lowStockItems.length}</strong> item{lowStockItems.length !== 1 ? 's' : ''} at or below reorder level and need restocking.</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStockItems.map(it => {
              const current = parseFloat(it.current_stock) || 0
              const reorder = parseFloat(it.reorder_level) || 0
              const pct = reorder > 0 ? Math.min((current / reorder) * 100, 100) : 0
              const out = current <= 0
              return (
                <div key={it.id} className={`bg-white border border-gray-200 rounded-xl p-5 border-l-4 ${out ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-brand-slate text-sm">{it.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{it.item_code}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${out ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {out ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Current: <strong className="text-gray-800">{current.toLocaleString()} {it.unit}</strong></span>
                      <span>Reorder: {reorder.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${out ? 'bg-red-500' : 'bg-yellow-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <Link to={`/inventory/${it.id}`}
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
                    <ArrowsRightLeftIcon className="h-3.5 w-3.5" /> Record Movement
                  </Link>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className={`border-l-4 border-l-${color}-500 bg-${color}-50 rounded-xl p-4 flex items-center gap-4`}>
      <div className={`p-2 bg-${color}-100 rounded-lg`}>
        <Icon className={`h-5 w-5 text-${color}-600`} />
      </div>
      <div>
        <p className="font-bold text-brand-slate text-lg">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

/* ── Main Page ── */
const TABS = [
  { key: 'items',       label: 'Stock Items' },
  { key: 'movements',   label: 'Stock Movements' },
  { key: 'low_stock',   label: 'Low Stock Alerts' },
]

export default function InventoryPage() {
  const [tab, setTab] = useState('items')
  const [showAddModal, setShowAddModal] = useState(false)
  const qc = useQueryClient()

  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ['stock-items'],
    queryFn:  () => getStockItems({ page_size: 200 }),
    select:   r => r.data?.results ?? r.data ?? [],
  })
  const { data: txData, isLoading: loadingTx } = useQuery({
    queryKey: ['stock-transactions'],
    queryFn:  () => getTransactions({ page_size: 200 }),
    select:   r => r.data?.results ?? r.data ?? [],
  })
  const { data: storesData } = useQuery({
    queryKey: ['stores'],
    queryFn:  getStores,
    select:   r => r.data?.results ?? r.data ?? [],
  })

  const items       = itemsData  ?? []
  const transactions = txData    ?? []
  const stores       = storesData ?? []
  const lowStockCount = items.filter(it => parseFloat(it.current_stock) <= parseFloat(it.reorder_level)).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-red bg-opacity-10 rounded-lg">
            <CubeIcon className="h-6 w-6 text-brand-red" />
          </div>
          <div>
            <h1 className="font-bold text-brand-slate text-lg">Inventory</h1>
            <p className="text-sm text-gray-500">Stock items, movements, and alerts</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Items"    value={items.length}        color="blue"   icon={CubeIcon} />
        <StatCard label="Low Stock"      value={lowStockCount}       color="yellow" icon={ExclamationTriangleIcon} />
        <StatCard label="Movements"      value={transactions.length} color="green"  icon={ArrowsRightLeftIcon} />
        <StatCard label="Stores"         value={stores.length}       color="purple" icon={CubeIcon} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors
              ${tab === t.key ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
            {t.key === 'low_stock' && lowStockCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-yellow-500 text-white text-xs rounded-full">{lowStockCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loadingItems || loadingTx ? (
        <div className="p-10 text-center text-gray-400 text-sm">Loading inventory…</div>
      ) : (
        <>
          {tab === 'items'     && <StockItemsTab items={items} onAddItem={() => setShowAddModal(true)} />}
          {tab === 'movements' && <StockMovementsTab transactions={transactions} />}
          {tab === 'low_stock' && <LowStockTab items={items} />}
        </>
      )}

      {showAddModal && (
        <AddItemModal
          stores={stores}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); qc.invalidateQueries(['stock-items']) }}
        />
      )}
    </div>
  )
}
