import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getTransfers, createTransfer, submitTransfer, reviewTransfer } from '../../api/transfers'
import { getEmployees } from '../../api/hr'
import api from '../../api/client'
import { PlusIcon, ArrowRightIcon, CheckCircleIcon, XCircleIcon, BanknotesIcon } from '@heroicons/react/24/outline'

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-yellow-100 text-yellow-700',
}

const DEST_LABELS = {
  site:        'Site / Field',
  head_office: 'Head Office',
  branch:      'Branch Office',
}

const empty = {
  employee: '', transfer_type: 'temporary', destination_type: 'site',
  from_location: '', to_location: '', project: '', start_date: '', end_date: '',
  reason: '', relocation_allowance: '', daily_allowance: '', daily_allowance_days: '',
}

export default function TransfersPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm]         = useState(false)
  const [reviewModal, setReviewModal]   = useState(null)
  const [reviewNotes, setReviewNotes]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm]                 = useState(empty)

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['transfers', statusFilter],
    queryFn:  () => getTransfers(statusFilter ? { status: statusFilter } : {}),
    select:   r => r.data?.results ?? r.data,
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-simple'],
    queryFn:  () => getEmployees({ is_active: 'true' }),
    select:   r => r.data?.results ?? r.data,
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-active'],
    queryFn:  () => api.get('/projects/'),
    select:   r => r.data?.results ?? r.data,
  })

  const createMut = useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      toast.success('Transfer request created.')
      setShowForm(false)
      setForm(empty)
    },
    onError: () => toast.error('Failed to create transfer request.'),
  })

  const submitMut = useMutation({
    mutationFn: submitTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      toast.success('Transfer submitted for approval.')
    },
    onError: () => toast.error('Failed to submit transfer.'),
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, data }) => reviewTransfer(id, data),
    onSuccess: (_, { data }) => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      toast.success(
        data.action === 'approved'
          ? 'Transfer approved. An expense claim has been raised in Finance if allowances were included.'
          : 'Transfer rejected.'
      )
      setReviewModal(null)
      setReviewNotes('')
    },
    onError: () => toast.error('Failed to review transfer.'),
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const f   = k => ({ value: form[k], onChange: e => set(k, e.target.value) })

  const isSite = form.destination_type === 'site'

  const handleProjectSelect = e => {
    const pid = e.target.value
    set('project', pid)
    if (pid) {
      const proj = projects.find(p => p.id === pid)
      if (proj) set('to_location', proj.project_location)
    } else {
      set('to_location', '')
    }
  }

  const handleSubmitForm = e => {
    e.preventDefault()
    const payload = { ...form }
    if (!isSite) {
      payload.relocation_allowance = 0
      payload.daily_allowance      = 0
      payload.daily_allowance_days = 0
      payload.project              = null
    }
    if (form.transfer_type === 'permanent') payload.end_date = null
    if (!payload.relocation_allowance) payload.relocation_allowance = 0
    if (!payload.daily_allowance)      payload.daily_allowance      = 0
    if (!payload.daily_allowance_days) payload.daily_allowance_days = 0
    if (!payload.project)              delete payload.project
    createMut.mutate(payload)
  }

  const totalAllowance = (parseFloat(form.relocation_allowance || 0) +
    parseFloat(form.daily_allowance || 0) * parseInt(form.daily_allowance_days || 0))

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
          <option value="">All Statuses</option>
          {['draft','submitted','approved','rejected','cancelled'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <button onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
          <PlusIcon className="h-4 w-4" /> New Transfer Request
        </button>
      </div>

      {/* New transfer form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate mb-4">New Transfer / Movement Request</h3>
          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Employee *</label>
                <select required {...f('employee')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
                  <option value="">Select employee…</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.employee_number} — {e.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Transfer Type *</label>
                <select required {...f('transfer_type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
                  <option value="temporary">Temporary Transfer</option>
                  <option value="permanent">Permanent Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Destination Type *</label>
                <select required {...f('destination_type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
                  <option value="site">Site / Field</option>
                  <option value="head_office">Head Office</option>
                  <option value="branch">Branch Office</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">From Location *</label>
                <input required {...f('from_location')} placeholder="e.g. Magumu Site"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
              </div>

              {/* Site: project dropdown that auto-fills to_location */}
              {isSite ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Project Site *</label>
                    <select required value={form.project} onChange={handleProjectSelect}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
                      <option value="">Select project…</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.project_name} — {p.project_location}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Site Location</label>
                    <input {...f('to_location')} placeholder="Auto-filled from project"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand-red" />
                    <p className="text-xs text-gray-400 mt-0.5">Auto-filled; edit if needed</p>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">To Location *</label>
                  <input required {...f('to_location')} placeholder="e.g. Magumu Site"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date *</label>
                <input required type="date" {...f('start_date')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
              </div>
              {form.transfer_type === 'temporary' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" {...f('end_date')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason for Transfer *</label>
              <textarea required {...f('reason')} rows={3} placeholder="Describe the reason for this transfer…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
            </div>

            {/* Allowances — only for site moves */}
            {isSite && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BanknotesIcon className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                    Site Allowances
                  </p>
                  <span className="text-xs text-blue-600 ml-auto">
                    On approval, these will auto-create an Expense Claim in Finance
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Relocation Allowance (KES)</label>
                    <input type="number" min="0" step="0.01" {...f('relocation_allowance')} placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
                    <p className="text-xs text-gray-400 mt-0.5">One-off payment for relocation costs</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Daily Allowance Rate (KES)</label>
                    <input type="number" min="0" step="0.01" {...f('daily_allowance')} placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Number of Days</label>
                    <input type="number" min="0" {...f('daily_allowance_days')} placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
                  </div>
                </div>
                {totalAllowance > 0 && (
                  <p className="text-sm text-blue-800 mt-3 font-semibold">
                    Total Allowance: KES {totalAllowance.toLocaleString()}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setForm(empty) }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={createMut.isPending}
                className="px-4 py-2 text-sm bg-brand-red text-white font-medium rounded-lg hover:bg-brand-red-dark disabled:opacity-50">
                {createMut.isPending ? 'Saving…' : 'Save Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transfers table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading
          ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
          : transfers.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No transfer requests found.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Employee', 'Type', 'Destination', 'Route', 'Dates', 'Allowances', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transfers.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-brand-slate text-xs">{t.employee_name}</p>
                          <p className="text-xs text-gray-400">{t.employee_number}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            t.transfer_type === 'permanent' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {t.transfer_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          <p>{DEST_LABELS[t.destination_type]}</p>
                          {t.project_name && <p className="text-gray-400">{t.project_name}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <span>{t.from_location}</span>
                            <ArrowRightIcon className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="font-medium text-brand-slate">{t.to_location}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          <p>{t.start_date}</p>
                          {t.end_date && <p className="text-gray-400">→ {t.end_date}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {parseFloat(t.total_allowance) > 0 ? (
                            <div>
                              <span className="text-green-700 font-medium">KES {parseFloat(t.total_allowance).toLocaleString()}</span>
                              {t.status === 'approved' && (
                                <p className="text-gray-400 flex items-center gap-0.5 mt-0.5">
                                  <BanknotesIcon className="h-3 w-3" /> Expense raised
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {t.status === 'draft' && (
                              <button onClick={() => submitMut.mutate(t.id)}
                                disabled={submitMut.isPending}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                                Submit
                              </button>
                            )}
                            {t.status === 'submitted' && (
                              <>
                                <button onClick={() => { setReviewModal({ transfer: t, action: 'approved' }); setReviewNotes('') }}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve">
                                  <CheckCircleIcon className="h-4 w-4" />
                                </button>
                                <button onClick={() => { setReviewModal({ transfer: t, action: 'rejected' }); setReviewNotes('') }}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded" title="Reject">
                                  <XCircleIcon className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </div>

      {/* Review modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-brand-slate mb-1 capitalize">
              {reviewModal.action} Transfer
            </h3>
            <p className="text-sm text-gray-500 mb-1">
              {reviewModal.transfer.employee_name} → {reviewModal.transfer.to_location}
            </p>
            {reviewModal.action === 'approved' && parseFloat(reviewModal.transfer.total_allowance) > 0 && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 text-xs text-green-800">
                <BanknotesIcon className="h-4 w-4 text-green-600 shrink-0" />
                An Expense Claim of <strong className="mx-1">KES {parseFloat(reviewModal.transfer.total_allowance).toLocaleString()}</strong> will be auto-raised in Finance → Expenses.
              </div>
            )}
            <label className="block text-xs font-medium text-gray-700 mb-1">Review Notes</label>
            <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
              rows={3} placeholder="Optional notes…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red mb-4" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReviewModal(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => reviewMut.mutate({ id: reviewModal.transfer.id, data: { action: reviewModal.action, review_notes: reviewNotes } })}
                disabled={reviewMut.isPending}
                className={`px-4 py-2 text-sm text-white font-medium rounded-lg disabled:opacity-50
                  ${reviewModal.action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-brand-red hover:bg-brand-red-dark'}`}>
                {reviewMut.isPending ? 'Saving…' : (reviewModal.action === 'approved' ? 'Approve & Raise Expense' : 'Reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
