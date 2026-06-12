import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getRequisition, approveRequisition, fulfillRequisition } from '../../api/requisitions'
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600', submitted: 'bg-blue-100 text-blue-700',
  dept_review: 'bg-yellow-100 text-yellow-700', finance: 'bg-orange-100 text-orange-700',
  md_review: 'bg-purple-100 text-purple-700', approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700', fulfilled: 'bg-teal-100 text-teal-700',
}

const STAGE_LABELS = {
  submitted: 'Submitted', dept_review: 'Dept Review', finance: 'Finance Review',
  md_review: 'MD Review', approved: 'Approved', rejected: 'Rejected', fulfilled: 'Fulfilled',
}

const FLOW = ['submitted', 'dept_review', 'finance', 'md_review', 'approved', 'fulfilled']

export default function RequisitionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [comments, setComments] = useState('')
  const [fulfillNotes, setFulfillNotes] = useState('')

  const { data: req, isLoading } = useQuery({
    queryKey: ['requisition', id],
    queryFn:  () => getRequisition(id),
    select:   r => r.data,
  })

  const approveMutation = useMutation({
    mutationFn: (payload) => approveRequisition(id, payload),
    onSuccess:  () => { toast.success('Action recorded.'); qc.invalidateQueries(['requisition', id]) },
    onError:    () => toast.error('Action failed.'),
  })

  const fulfillMutation = useMutation({
    mutationFn: () => fulfillRequisition(id, { notes: fulfillNotes }),
    onSuccess:  () => { toast.success('Marked as fulfilled.'); qc.invalidateQueries(['requisition', id]) },
    onError:    () => toast.error('Failed to mark fulfilled.'),
  })

  if (isLoading) return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  if (!req) return null

  const actionable = !['approved', 'rejected', 'fulfilled'].includes(req.status)

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/requisitions')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-slate mb-5">
        <ArrowLeftIcon className="h-4 w-4" /> Back to Requisitions
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono text-brand-slate font-medium mb-1">{req.reference_number}</p>
            <h1 className="text-lg font-bold text-gray-800 mb-1">{req.title}</h1>
            <p className="text-sm text-gray-500 capitalize">{req.req_type.replace('_', ' ')} · {req.priority} priority</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
            {req.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex items-center">
            {FLOW.map((stage, i) => {
              const idx = FLOW.indexOf(req.status)
              const done = i < idx || (req.status === stage)
              const active = req.status === stage
              return (
                <div key={stage} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex flex-col items-center`}>
                    <div className={`h-2.5 w-2.5 rounded-full border-2 transition-colors
                      ${active ? 'border-brand-red bg-brand-red' : done ? 'border-brand-slate bg-brand-slate' : 'border-gray-300 bg-white'}`} />
                    <span className={`text-xs mt-1 whitespace-nowrap ${active ? 'text-brand-red font-semibold' : done ? 'text-brand-slate' : 'text-gray-400'}`}>
                      {STAGE_LABELS[stage]}
                    </span>
                  </div>
                  {i < FLOW.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${i < idx ? 'bg-brand-slate' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left: details + items */}
        <div className="md:col-span-2 space-y-5">
          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-brand-slate mb-3">Details</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-400 text-xs">Requested By</dt><dd className="font-medium">{req.requested_by_name}</dd></div>
              <div><dt className="text-gray-400 text-xs">Department</dt><dd className="font-medium">{req.department_name || '—'}</dd></div>
              <div><dt className="text-gray-400 text-xs">Project</dt><dd className="font-medium">{req.project_name || '—'}</dd></div>
              <div><dt className="text-gray-400 text-xs">Date Required</dt><dd className="font-medium">{req.date_required}</dd></div>
              <div><dt className="text-gray-400 text-xs">Total Amount</dt><dd className="font-bold text-brand-slate">KES {Number(req.total_amount).toLocaleString()}</dd></div>
              <div><dt className="text-gray-400 text-xs">Created</dt><dd className="font-medium">{new Date(req.created_at).toLocaleDateString()}</dd></div>
            </dl>
            {req.description && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <p className="text-sm text-gray-700">{req.description}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-brand-slate">Line Items</h2>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Description', 'Qty', 'Unit', 'Unit Price', 'Total'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {req.items.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5">{item.description}</td>
                    <td className="px-4 py-2.5 text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-gray-500">{item.unit || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{Number(item.unit_price).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-medium">{Number(item.total_price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-semibold text-gray-600">Total</td>
                  <td className="px-4 py-2.5 font-bold text-brand-slate">KES {Number(req.total_amount).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right: approvals + action */}
        <div className="space-y-5">
          {/* Approval trail */}
          {req.approvals.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-brand-slate mb-3">Approval Trail</h2>
              <div className="space-y-3">
                {req.approvals.map(a => (
                  <div key={a.id} className="text-sm border-l-2 border-gray-200 pl-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-medium ${a.action === 'approved' ? 'text-green-600' : a.action === 'rejected' ? 'text-red-600' : 'text-orange-500'}`}>
                        {a.action.charAt(0).toUpperCase() + a.action.slice(1)}
                      </span>
                      <span className="text-gray-400 text-xs">· {a.approved_by_name}</span>
                    </div>
                    <p className="text-xs text-gray-400">{new Date(a.actioned_at).toLocaleString()}</p>
                    {a.comments && <p className="text-xs text-gray-600 mt-1 italic">"{a.comments}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action panel */}
          {actionable && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-brand-slate mb-3">Take Action</h2>
              <textarea
                rows={3} value={comments}
                onChange={e => setComments(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red resize-none mb-3"
                placeholder="Comments (optional)…"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => approveMutation.mutate({ action: 'approved', comments })}
                  disabled={approveMutation.isPending}
                  className="flex items-center justify-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  <CheckCircleIcon className="h-4 w-4" /> Approve
                </button>
                <button
                  onClick={() => approveMutation.mutate({ action: 'returned', comments })}
                  disabled={approveMutation.isPending}
                  className="flex items-center justify-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  <ArrowPathIcon className="h-4 w-4" /> Return for Revision
                </button>
                <button
                  onClick={() => approveMutation.mutate({ action: 'rejected', comments })}
                  disabled={approveMutation.isPending}
                  className="flex items-center justify-center gap-1.5 text-sm bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  <XCircleIcon className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          )}

          {/* Fulfill panel */}
          {req.status === 'approved' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-brand-slate mb-3">Mark as Fulfilled</h2>
              <textarea
                rows={2} value={fulfillNotes}
                onChange={e => setFulfillNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red resize-none mb-3"
                placeholder="Fulfillment notes…"
              />
              <button
                onClick={() => fulfillMutation.mutate()}
                disabled={fulfillMutation.isPending}
                className="w-full text-sm bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                {fulfillMutation.isPending ? 'Processing…' : 'Mark Fulfilled'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
