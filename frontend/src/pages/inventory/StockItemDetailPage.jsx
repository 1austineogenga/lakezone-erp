import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline'
import { getStockItem, getTransactions, getStores, createTransaction } from '../../api/inventory'

const CATEGORY_LABELS = {
  construction_materials: 'Construction Materials',
  spare_parts:            'Spare Parts',
  fuel:                   'Fuel & Lubricants',
  ppe_safety:             'PPE & Safety',
  office_consumables:     'Office Consumables',
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
  grn: 'GRN (Received)', issue: 'Issue', transfer: 'Transfer',
  return: 'Return', adjustment: 'Adjustment',
}

/* ── Record Movement Modal ── */
function RecordMovementModal({ item, stores, onClose, onSaved }) {
  const [form, setForm] = useState({
    transaction_type: 'grn',
    store: stores[0]?.id ?? '',
    quantity: '',
    unit_cost: '',
    reference_number: '',
    notes: '',
    transaction_date: new Date().toISOString().slice(0, 16),
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { mutate, isPending } = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => { toast.success('Movement recorded.'); onSaved() },
    onError:   (err) => {
      const msg = err?.response?.data
        ? Object.values(err.response.data).flat().join(' ')
        : 'Failed to record movement.'
      toast.error(msg)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutate({ ...form, item: item.id })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg p-6 shadow-xl">
        <h2 className="font-bold text-brand-slate text-lg mb-1">Record Movement</h2>
        <p className="text-xs text-gray-500 mb-5">Item: <strong>{item.item_code} — {item.name}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select required value={form.transaction_type} onChange={e => set('transaction_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
                {Object.entries(TX_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Store *</label>
              <select required value={form.store} onChange={e => set('store', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
              <input required type="number" min="0.0001" step="0.0001" value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit Cost (KES) *</label>
              <input required type="number" min="0" step="0.01" value={form.unit_cost}
                onChange={e => set('unit_cost', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reference # *</label>
              <input required value={form.reference_number} onChange={e => set('reference_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                placeholder="GRN-2026-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date &amp; Time *</label>
              <input required type="datetime-local" value={form.transaction_date}
                onChange={e => set('transaction_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red resize-none"
                placeholder="Optional notes…" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
              {isPending ? 'Saving…' : 'Record Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function StockItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: item, isLoading } = useQuery({
    queryKey: ['stock-item', id],
    queryFn:  () => getStockItem(id),
    select:   r => r.data,
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['stock-transactions', id],
    queryFn:  () => getTransactions({ item: id, page_size: 100 }),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  !!id,
  })

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn:  getStores,
    select:   r => r.data?.results ?? r.data ?? [],
  })

  if (isLoading) return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  if (!item) return null

  const current = parseFloat(item.current_stock) || 0
  const reorder = parseFloat(item.reorder_level) || 0
  const wac     = parseFloat(item.weighted_avg_cost) || 0
  const totalVal = current * wac
  const isLow   = current <= reorder && reorder > 0
  const isOut   = current <= 0
  const pct     = reorder > 0 ? Math.min((current / reorder) * 100, 100) : 100

  const stockColor  = isOut ? 'red' : isLow ? 'yellow' : 'green'
  const stockLabel  = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'
  const stockBadge  = isOut
    ? 'bg-red-100 text-red-700'
    : isLow
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-green-100 text-green-700'

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate('/inventory')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-slate mb-5">
        <ArrowLeftIcon className="h-4 w-4" /> Back to Inventory
      </button>

      {/* Item info card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-mono text-xs text-brand-slate font-medium mb-0.5">{item.item_code}</p>
            <h1 className="font-bold text-brand-slate text-lg">{item.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {CATEGORY_LABELS[item.category] ?? item.category} · {item.unit}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockBadge}`}>{stockLabel}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className={`border-l-4 border-l-${stockColor}-500 bg-${stockColor}-50 rounded-xl p-4`}>
            <p className="text-xs text-gray-500 mb-0.5">Current Stock</p>
            <p className="font-bold text-brand-slate text-lg">{current.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{item.unit}</p>
          </div>
          <div className="border-l-4 border-l-blue-500 bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-0.5">Reorder Level</p>
            <p className="font-bold text-brand-slate text-lg">{reorder.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{item.unit}</p>
          </div>
          <div className="border-l-4 border-l-purple-500 bg-purple-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-0.5">Unit Cost (WAC)</p>
            <p className="font-bold text-brand-slate text-lg">{wac ? `KES ${wac.toLocaleString()}` : '—'}</p>
          </div>
          <div className="border-l-4 border-l-green-500 bg-green-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-0.5">Total Value</p>
            <p className="font-bold text-brand-slate text-lg">{totalVal ? `KES ${totalVal.toLocaleString()}` : '—'}</p>
          </div>
        </div>

        {/* Stock level visual bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Stock Level</span>
            <span>{current.toLocaleString()} / {reorder > 0 ? `${reorder.toLocaleString()} reorder` : 'no reorder set'}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOut ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {item.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Description</p>
            <p className="text-sm text-gray-700">{item.description}</p>
          </div>
        )}
      </div>

      {/* Movement history */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-brand-slate text-sm">Movement History</h2>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
            <PlusIcon className="h-3.5 w-3.5" /> Record Movement
          </button>
        </div>

        {!transactions.length ? (
          <div className="p-10 text-center text-gray-400 text-sm">No movements recorded for this item.</div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Type', 'Store', 'Quantity', 'Unit Cost', 'Reference', 'Notes', 'Recorded By'].map(h => (
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
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TX_TYPE_COLORS[tx.transaction_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TX_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{tx.store_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-800">{Number(tx.quantity).toLocaleString()} {item.unit}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {tx.unit_cost ? `KES ${Number(tx.unit_cost).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-slate">{tx.reference_number}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{tx.notes || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{tx.processed_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <RecordMovementModal
          item={item}
          stores={stores}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            qc.invalidateQueries(['stock-item', id])
            qc.invalidateQueries(['stock-transactions', id])
          }}
        />
      )}
    </div>
  )
}
