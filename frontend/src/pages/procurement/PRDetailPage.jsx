import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getPR, approvePR, createPO, getSuppliers } from '../../api/procurement'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  XMarkIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline'
import { printPR } from '../../utils/print'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  draft:              'bg-gray-100 text-gray-600',
  pending:            'bg-amber-100 text-amber-700',
  dept_approved:      'bg-blue-100 text-blue-700',
  procurement_review: 'bg-purple-100 text-purple-700',
  finance_approved:   'bg-teal-100 text-teal-700',
  md_approved:        'bg-green-100 text-green-700',
  rejected:           'bg-red-100 text-red-700',
  converted:          'bg-slate-100 text-slate-600',
}

// Approval flow steps (visual progress)
const FLOW_STEPS = [
  { key: 'draft',              label: 'Draft' },
  { key: 'pending',            label: 'Pending' },
  { key: 'dept_approved',      label: 'Dept Approved' },
  { key: 'procurement_review', label: 'Procurement Review' },
  { key: 'finance_approved',   label: 'Finance Approved' },
  { key: 'md_approved',        label: 'MD Approved' },
]

// Statuses where approval actions are possible
const ACTIONABLE_STATUSES = ['draft', 'pending', 'dept_approved', 'procurement_review', 'finance_approved']

// ── Convert to PO Modal ────────────────────────────────────────────────────────

function ConvertToPOModal({ pr, onClose, onSuccess }) {
  const navigate = useNavigate()
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers({ page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })
  const suppliers = suppliersData ?? []

  const [form, setForm] = useState({
    supplier: '',
    delivery_date: '',
    delivery_address: '',
    notes: '',
  })

  const mutation = useMutation({
    mutationFn: (data) => createPO(data),
    onSuccess: (res) => {
      toast.success('Purchase Order created')
      onClose()
      navigate(`/procurement/po/${res.data.id}`)
    },
    onError: (err) => {
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : 'Failed to create PO'
      toast.error(msg)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    // Build PO line items from PR line items
    const line_items = (pr.line_items || []).map(item => ({
      description: item.description,
      unit: item.unit,
      quantity: Number(item.quantity),
      unit_price: Number(item.estimated_unit_rate) || 0,
      received_quantity: 0,
    }))
    mutation.mutate({
      pr: pr.id,
      supplier: form.supplier,
      project: pr.project ?? undefined,
      delivery_date: form.delivery_date,
      delivery_address: form.delivery_address,
      notes: form.notes,
      line_items,
    })
  }

  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold text-base">Convert to Purchase Order</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Supplier *</label>
              <select required className={inp} value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}>
                <option value="">— Select supplier —</option>
                {suppliers.filter(s => s.status === 'active').map(s => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Date *</label>
              <input required type="date" className={inp} value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Address *</label>
              <input required className={inp} placeholder="e.g. Site A, Nairobi" value={form.delivery_address} onChange={e => setForm({ ...form, delivery_address: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea rows={2} className={inp} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <p className="text-xs text-gray-600">
              {pr.line_items?.length ?? 0} line item(s) will be copied from this PR.
            </p>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90">
              {mutation.isPending ? 'Creating…' : 'Create PO'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PRDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [showConvertModal, setShowConvertModal] = useState(false)

  const { data: pr, isLoading } = useQuery({
    queryKey: ['pr', id],
    queryFn: () => getPR(id),
    select: r => r.data,
  })

  const approveMutation = useMutation({
    mutationFn: (payload) => approvePR(id, payload),
    onSuccess: (res) => {
      toast.success(`PR ${res.data.status === 'rejected' ? 'rejected' : 'advanced'} successfully`)
      setComment('')
      qc.invalidateQueries(['pr', id])
      qc.invalidateQueries(['prs'])
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail ?? 'Action failed'
      toast.error(msg)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-4 bg-gray-100 rounded animate-pulse mb-3 w-1/3" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (!pr) return null

  const isActionable = ACTIONABLE_STATUSES.includes(pr.status)
  const canConvert = pr.status === 'md_approved'

  // Compute current step index for progress bar
  const currentStepIdx = FLOW_STEPS.findIndex(s => s.key === pr.status)

  const total = Number(pr.total_estimated_value) || 0

  return (
    <div className="">
      <button onClick={() => navigate('/procurement')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-slate mb-5">
        <ArrowLeftIcon className="h-4 w-4" /> Back to Procurement
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-mono text-gray-600 mb-1">Purchase Requisition</p>
            <h1 className="text-xl font-bold text-brand-slate">{pr.pr_number}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Requested by <span className="font-medium text-gray-700">{pr.requested_by_name || '—'}</span>
              {' · '}
              {pr.created_at ? new Date(pr.created_at).toLocaleDateString() : '—'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[pr.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {pr.status_display ?? pr.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            <button onClick={() => printPR(pr)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
              <PrinterIcon className="h-3.5 w-3.5" /> Print
            </button>
            {canConvert && (
              <button
                onClick={() => setShowConvertModal(true)}
                className="flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <ShoppingCartIcon className="h-4 w-4" /> Convert to PO
              </button>
            )}
          </div>
        </div>

        {/* Approval progress steps */}
        <div className="mt-6 overflow-x-auto">
          <div className="flex items-center min-w-max">
            {FLOW_STEPS.map((step, i) => {
              const stepIdx = i
              const done = stepIdx < currentStepIdx || (pr.status === step.key && pr.status !== 'rejected')
              const active = pr.status === step.key
              const rejected = pr.status === 'rejected'
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full border-2 transition-colors
                      ${rejected && active ? 'border-red-500 bg-red-500'
                        : active ? 'border-brand-red bg-brand-red'
                        : done ? 'border-brand-slate bg-brand-slate'
                        : 'border-gray-300 bg-white'}`}
                    />
                    <span className={`text-xs mt-1.5 whitespace-nowrap
                      ${rejected && active ? 'text-red-500 font-semibold'
                        : active ? 'text-brand-red font-semibold'
                        : done ? 'text-brand-slate'
                        : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < FLOW_STEPS.length - 1 && (
                    <div className={`w-12 h-0.5 mx-1 ${stepIdx < currentStepIdx ? 'bg-brand-slate' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {pr.status === 'rejected' && pr.rejection_reason && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <span className="font-semibold">Rejection reason: </span>{pr.rejection_reason}
          </div>
        )}
      </div>

      {/* Info cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Department', value: pr.department_name ?? (pr.department ? String(pr.department) : '—') },
          { label: 'Project', value: pr.project_name ?? (pr.project ? String(pr.project) : '—') },
          { label: 'Required By', value: pr.required_by_date || '—' },
          { label: 'Est. Total (KES)', value: total > 0 ? total.toLocaleString() : '—', bold: true },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-600 mb-1">{card.label}</p>
            <p className={`text-sm ${card.bold ? 'font-bold text-brand-slate' : 'font-medium text-gray-800'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left: line items */}
        <div className="md:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4 text-gray-400" />
              <h2 className="font-semibold text-brand-slate text-sm">Line Items</h2>
            </div>
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {['Description', 'Unit', 'Qty', 'Unit Rate (KES)', 'Amount (KES)', 'Notes'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!pr.line_items?.length ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">No line items</td></tr>
                ) : pr.line_items.map(item => {
                  const amount = Number(item.quantity) * Number(item.estimated_unit_rate)
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800">{item.description}</td>
                      <td className="px-4 py-2.5 text-gray-600">{item.unit}</td>
                      <td className="px-4 py-2.5 text-gray-700">{Number(item.quantity).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-gray-700">{Number(item.estimated_unit_rate).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{amount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-gray-600 italic">{item.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              {total > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Total Estimated Value</td>
                    <td className="px-4 py-2.5 font-bold text-brand-slate">KES {total.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Right: approvals + actions */}
        <div className="space-y-5">
          {/* Approval history */}
          {pr.approvals?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-brand-slate text-sm mb-3">Approval History</h2>
              <div className="space-y-3">
                {pr.approvals.map(a => (
                  <div key={a.id} className="text-xs border-l-2 border-gray-200 pl-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`font-semibold ${a.action === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                        {a.action.charAt(0).toUpperCase() + a.action.slice(1)}
                      </span>
                      <span className="text-gray-600">· {a.approved_by_name || '—'}</span>
                    </div>
                    <p className="text-gray-600 capitalize">{a.stage?.replace(/_/g, ' ')}</p>
                    <p className="text-gray-600">{a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}</p>
                    {a.comment && <p className="text-gray-600 mt-1 italic">"{a.comment}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action panel */}
          {isActionable && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-brand-slate text-sm mb-3">Take Action</h2>
              <textarea
                rows={3}
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red resize-none mb-3"
                placeholder="Comment (optional)…"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => approveMutation.mutate({ action: 'approve', comment })}
                  disabled={approveMutation.isPending}
                  className="flex items-center justify-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  <CheckCircleIcon className="h-4 w-4" /> Approve / Advance
                </button>
                <button
                  onClick={() => approveMutation.mutate({ action: 'reject', comment })}
                  disabled={approveMutation.isPending}
                  className="flex items-center justify-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  <XCircleIcon className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showConvertModal && (
        <ConvertToPOModal
          pr={pr}
          onClose={() => setShowConvertModal(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  )
}
