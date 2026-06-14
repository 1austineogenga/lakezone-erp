import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getPO, updatePO } from '../../api/procurement'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  TruckIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  approved:  'bg-blue-100 text-blue-700',
  sent:      'bg-purple-100 text-purple-700',
  partial:   'bg-amber-100 text-amber-700',
  received:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const FLOW_STEPS = [
  { key: 'draft',    label: 'Draft' },
  { key: 'approved', label: 'Approved' },
  { key: 'sent',     label: 'Sent to Supplier' },
  { key: 'partial',  label: 'Partially Received' },
  { key: 'received', label: 'Fully Received' },
]

// ── Receive Items Modal ────────────────────────────────────────────────────────

function ReceiveItemsModal({ po, onClose, onSuccess }) {
  const [received, setReceived] = useState(
    (po.line_items || []).reduce((acc, item) => {
      acc[item.id] = item.received_quantity ?? 0
      return acc
    }, {})
  )

  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (data) => updatePO(po.id, data),
    onSuccess: () => {
      toast.success('Received quantities updated')
      qc.invalidateQueries(['po', po.id])
      qc.invalidateQueries(['pos'])
      onClose()
    },
    onError: () => toast.error('Failed to update received quantities'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const line_items = (po.line_items || []).map(item => ({
      id: item.id,
      description: item.description,
      unit: item.unit,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      received_quantity: Number(received[item.id] ?? item.received_quantity),
    }))
    mutation.mutate({ line_items })
  }

  const inp = 'w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-brand-slate">Update Received Quantities</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <table className="min-w-full text-xs mb-4">
            <thead className="bg-gray-50">
              <tr>
                {['Description', 'Unit', 'Ordered', 'Received'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(po.line_items || []).map(item => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-gray-800">{item.description}</td>
                  <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                  <td className="px-3 py-2 text-gray-700">{Number(item.quantity).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      max={item.quantity}
                      step="any"
                      className={inp}
                      value={received[item.id] ?? item.received_quantity}
                      onChange={e => setReceived({ ...received, [item.id]: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-3">
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium py-2 rounded-lg disabled:opacity-60">
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PODetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showReceiveModal, setShowReceiveModal] = useState(false)

  const { data: po, isLoading } = useQuery({
    queryKey: ['po', id],
    queryFn: () => getPO(id),
    select: r => r.data,
  })

  const approveMutation = useMutation({
    mutationFn: () => updatePO(id, { status: 'approved' }),
    onSuccess: () => {
      toast.success('PO approved')
      qc.invalidateQueries(['po', id])
      qc.invalidateQueries(['pos'])
    },
    onError: () => toast.error('Failed to approve PO'),
  })

  const sendMutation = useMutation({
    mutationFn: () => updatePO(id, { status: 'sent' }),
    onSuccess: () => {
      toast.success('PO marked as sent to supplier')
      qc.invalidateQueries(['po', id])
    },
    onError: () => toast.error('Failed to update PO'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => updatePO(id, { status: 'cancelled' }),
    onSuccess: () => {
      toast.success('PO cancelled')
      qc.invalidateQueries(['po', id])
    },
    onError: () => toast.error('Failed to cancel PO'),
  })

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-4 bg-gray-100 rounded animate-pulse mb-3 w-1/3" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (!po) return null

  const total = Number(po.total_value) || 0
  const currentStepIdx = FLOW_STEPS.findIndex(s => s.key === po.status)
  const isCancelled = po.status === 'cancelled'

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/procurement')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-slate mb-5">
        <ArrowLeftIcon className="h-4 w-4" /> Back to Procurement
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-mono text-gray-400 mb-1">Purchase Order</p>
            <h1 className="text-xl font-bold text-brand-slate">{po.po_number}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Supplier: <span className="font-medium text-gray-700">{po.supplier_name || '—'}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {po.status_display ?? po.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            {po.status === 'draft' && (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                <CheckCircleIcon className="h-4 w-4" /> Approve PO
              </button>
            )}
            {po.status === 'approved' && (
              <button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                <TruckIcon className="h-4 w-4" /> Mark Sent
              </button>
            )}
            {['sent', 'partial'].includes(po.status) && (
              <button
                onClick={() => setShowReceiveModal(true)}
                className="flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <TruckIcon className="h-4 w-4" /> Receive Items
              </button>
            )}
            {['draft', 'approved'].includes(po.status) && (
              <button
                onClick={() => {
                  if (window.confirm('Cancel this PO?')) cancelMutation.mutate()
                }}
                disabled={cancelMutation.isPending}
                className="text-xs text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                Cancel PO
              </button>
            )}
          </div>
        </div>

        {/* Status timeline */}
        {!isCancelled && (
          <div className="mt-6 overflow-x-auto">
            <div className="flex items-center min-w-max">
              {FLOW_STEPS.map((step, i) => {
                const done = i <= currentStepIdx
                const active = po.status === step.key
                return (
                  <div key={step.key} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full border-2 transition-colors
                        ${active ? 'border-brand-red bg-brand-red'
                          : done ? 'border-brand-slate bg-brand-slate'
                          : 'border-gray-300 bg-white'}`}
                      />
                      <span className={`text-xs mt-1.5 whitespace-nowrap
                        ${active ? 'text-brand-red font-semibold'
                          : done ? 'text-brand-slate'
                          : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                    {i < FLOW_STEPS.length - 1 && (
                      <div className={`w-12 h-0.5 mx-1 ${i < currentStepIdx ? 'bg-brand-slate' : 'bg-gray-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            This Purchase Order has been cancelled.
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'PR Reference', value: po.pr_number ?? (po.pr ? String(po.pr) : '—') },
          { label: 'Delivery Date', value: po.delivery_date || '—' },
          { label: 'Delivery Address', value: po.delivery_address || '—' },
          { label: 'Total Value (KES)', value: total > 0 ? total.toLocaleString() : '—', bold: true },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">{card.label}</p>
            <p className={`text-sm ${card.bold ? 'font-bold text-brand-slate' : 'font-medium text-gray-800'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-brand-slate text-sm">Line Items</h2>
        </div>
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              {['Description', 'Unit', 'Ordered Qty', 'Received Qty', 'Unit Price (KES)', 'Total (KES)'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!po.line_items?.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No line items</td></tr>
            ) : po.line_items.map(item => {
              const ordered = Number(item.quantity)
              const received = Number(item.received_quantity ?? 0)
              const fullyReceived = received >= ordered
              const pct = ordered > 0 ? Math.min((received / ordered) * 100, 100) : 0
              const lineTotal = Number(item.line_total) || (ordered * Number(item.unit_price))
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{item.description}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                  <td className="px-4 py-3 text-gray-700">{ordered.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${fullyReceived ? 'text-green-600' : received > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {received.toLocaleString()}
                      </span>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${fullyReceived ? 'bg-green-500' : 'bg-amber-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{Number(item.unit_price).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{lineTotal.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
          {total > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={5} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Total Value</td>
                <td className="px-4 py-2.5 font-bold text-brand-slate">KES {total.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Notes */}
      {po.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-brand-slate text-sm mb-2">Notes</h2>
          <p className="text-sm text-gray-600">{po.notes}</p>
        </div>
      )}

      {showReceiveModal && (
        <ReceiveItemsModal
          po={po}
          onClose={() => setShowReceiveModal(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  )
}
