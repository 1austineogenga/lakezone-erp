import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  ArrowLeftIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon,
  CalendarDaysIcon, CurrencyDollarIcon, UserIcon, WrenchScrewdriverIcon,
  BeakerIcon, PlusIcon,
} from '@heroicons/react/24/outline'
import {
  getRequisition, approveRequisition, fulfillRequisition,
  createMaintenanceSchedule, updateMaintenanceSchedule,
  recordFuelPayment,
} from '../../api/requisitions'
import useAuthStore from '../../store/authStore'

const STATUS_STYLE = {
  draft:       'bg-gray-100 text-gray-600',
  submitted:   'bg-blue-100 text-blue-700',
  approved:    'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-700',
  fulfilled:   'bg-teal-100 text-teal-700',
  dept_review: 'bg-yellow-100 text-yellow-700',
  finance:     'bg-orange-100 text-orange-700',
  md_review:   'bg-purple-100 text-purple-700',
}

const SCHED_STATUS_STYLE = {
  logged:           'bg-gray-100 text-gray-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved:         'bg-green-100 text-green-700',
  in_progress:      'bg-blue-100 text-blue-700',
  completed:        'bg-teal-100 text-teal-700',
  cancelled:        'bg-red-100 text-red-700',
}

const FLOW = ['submitted', 'approved', 'fulfilled']

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-xs font-medium text-brand-slate">{value || '—'}</dd>
    </div>
  )
}

// ── Maintenance schedule panel ────────────────────────────────────────────────
function MaintenanceSchedulePanel({ req, schedule, canLog }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    assigned_to: schedule?.assigned_to || '',
    work_description: schedule?.work_description || '',
    notes: schedule?.notes || '',
    scheduled_date: schedule?.scheduled_date || '',
    payment_amount: schedule?.payment_amount || '',
    payment_details: schedule?.payment_details || '',
  })

  const createMut = useMutation({
    mutationFn: data => createMaintenanceSchedule({ requisition: req.id, ...data }),
    onSuccess: () => {
      toast.success('Maintenance schedule logged.')
      qc.invalidateQueries({ queryKey: ['requisition', req.id] })
      qc.invalidateQueries({ queryKey: ['maintenance-schedules'] })
      setShowForm(false)
    },
    onError: e => toast.error(e.response?.data?.detail || e.response?.data?.requisition?.[0] || 'Failed to log schedule.'),
  })

  const updateMut = useMutation({
    mutationFn: data => updateMaintenanceSchedule(schedule.id, data),
    onSuccess: () => {
      toast.success('Schedule updated.')
      qc.invalidateQueries({ queryKey: ['requisition', req.id] })
      setShowForm(false)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to update.'),
  })

  const handleSave = () => {
    const data = { ...form }
    if (!data.payment_amount) delete data.payment_amount
    if (!data.scheduled_date) delete data.scheduled_date
    if (schedule) updateMut.mutate(data)
    else createMut.mutate(data)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WrenchScrewdriverIcon className="h-4 w-4 text-purple-600" />
          <h3 className="font-semibold text-brand-slate text-sm">Maintenance Schedule</h3>
        </div>
        {schedule && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${SCHED_STATUS_STYLE[schedule.status] || 'bg-gray-100 text-gray-600'}`}>
            {schedule.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <div className="p-5">
        {!schedule && !showForm ? (
          canLog ? (
            <div className="text-center py-4">
              <p className="text-xs text-gray-600 mb-3">No schedule logged yet. Log one to assign and plan this repair.</p>
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-xs font-semibold rounded-xl hover:opacity-90 mx-auto">
                <PlusIcon className="h-3.5 w-3.5" /> Log Schedule
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-600 text-center py-4">Awaiting site manager or admin to log a schedule.</p>
          )
        ) : schedule && !showForm ? (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Assigned To" value={schedule.assigned_to} />
              <Field label="Scheduled Date" value={schedule.scheduled_date} />
              <Field label="Payment Amount" value={schedule.payment_amount ? `KES ${Number(schedule.payment_amount).toLocaleString()}` : null} />
              <Field label="Logged By" value={schedule.logged_by_name} />
            </dl>
            {schedule.work_description && (
              <div>
                <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide mb-1">Work Description</p>
                <p className="text-xs text-gray-700">{schedule.work_description}</p>
              </div>
            )}
            {schedule.payment_details && (
              <div>
                <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide mb-1">Payment Details</p>
                <p className="text-xs text-gray-700">{schedule.payment_details}</p>
              </div>
            )}
            {schedule.notes && (
              <div>
                <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-xs text-gray-600 italic">{schedule.notes}</p>
              </div>
            )}
            {schedule.admin_comments && (
              <div className="bg-amber-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-amber-600 font-medium">Admin comment: {schedule.admin_comments}</p>
              </div>
            )}
            {schedule.expense_claim && (
              <div className="bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckCircleIcon className="h-3.5 w-3.5 text-green-600" />
                <p className="text-xs text-green-700 font-medium">Finance expense claim raised successfully.</p>
              </div>
            )}
            {canLog && ['logged', 'pending_approval'].includes(schedule.status) && (
              <button onClick={() => { setForm({
                assigned_to: schedule.assigned_to || '',
                work_description: schedule.work_description || '',
                notes: schedule.notes || '',
                scheduled_date: schedule.scheduled_date || '',
                payment_amount: schedule.payment_amount || '',
                payment_details: schedule.payment_details || '',
              }); setShowForm(true) }}
                className="text-xs text-purple-600 font-semibold hover:underline">
                Edit schedule
              </button>
            )}
          </div>
        ) : null}

        {showForm && (
          <div className="space-y-3">
            {[
              { label: 'Assigned To', key: 'assigned_to', placeholder: 'Mechanic / contractor name' },
              { label: 'Scheduled Date', key: 'scheduled_date', type: 'date' },
              { label: 'Payment Amount (KES)', key: 'payment_amount', type: 'number', placeholder: '0.00' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type || 'text'} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Work Description</label>
              <textarea rows={2} value={form.work_description} onChange={e => setForm(f => ({ ...f, work_description: e.target.value }))}
                placeholder="What needs to be done…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Details</label>
              <textarea rows={2} value={form.payment_details} onChange={e => setForm(f => ({ ...f, payment_details: e.target.value }))}
                placeholder="Bank account / mobile money / cash…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}
                className="flex-1 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
                {createMut.isPending || updateMut.isPending ? 'Saving…' : schedule ? 'Update Schedule' : 'Log Schedule'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-200 text-xs rounded-lg">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Fuel payment panel (finance) ──────────────────────────────────────────────
function FuelPaymentPanel({ req, fuelPayment, canRecord }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ payment_mode: 'finance_raised', amount_paid: '', payment_ref: '', notes: '' })

  const mut = useMutation({
    mutationFn: data => recordFuelPayment(req.id, data),
    onSuccess: () => {
      toast.success('Fuel payment recorded and expense claim raised.')
      qc.invalidateQueries({ queryKey: ['requisition', req.id] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to record payment.'),
  })

  if (fuelPayment) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <BeakerIcon className="h-4 w-4 text-orange-600" />
          <h3 className="font-semibold text-brand-slate text-sm">Fuel Payment</h3>
          <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">Recorded</span>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <Field label="Mode" value={fuelPayment.payment_mode === 'finance_raised' ? 'Finance Raised' : 'MD Paid Directly'} />
          <Field label="Amount Paid" value={`KES ${Number(fuelPayment.amount_paid).toLocaleString()}`} />
          {fuelPayment.payment_ref && <Field label="Reference" value={fuelPayment.payment_ref} />}
          <Field label="Recorded By" value={fuelPayment.created_by_name} />
        </dl>
        {fuelPayment.expense_claim && (
          <div className="mt-3 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircleIcon className="h-3.5 w-3.5 text-green-600" />
            <p className="text-xs text-green-700 font-medium">Expense claim raised in finance.</p>
          </div>
        )}
      </div>
    )
  }

  if (!canRecord || req.status !== 'approved') return null

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <BeakerIcon className="h-4 w-4 text-orange-600" />
        <h3 className="font-semibold text-brand-slate text-sm">Record Fuel Payment</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode *</label>
          <select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="finance_raised">Finance Raised Payment</option>
            <option value="md_paid">MD Paid Directly (Update Record)</option>
          </select>
          <p className="text-[10px] text-gray-600 mt-1">
            {form.payment_mode === 'finance_raised'
              ? 'Finance will process the payment and raise an expense claim.'
              : 'Record that the MD has already paid — an expense claim will still be created.'}
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount Paid (KES) *</label>
          <input required type="number" min="0" step="0.01" value={form.amount_paid}
            onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payment Reference</label>
          <input value={form.payment_ref} onChange={e => setForm(f => ({ ...f, payment_ref: e.target.value }))}
            placeholder="Receipt / bank ref"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red resize-none" />
        </div>
        <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.amount_paid}
          className="w-full py-2 bg-orange-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60 hover:opacity-90">
          {mut.isPending ? 'Recording…' : 'Record Payment & Raise Claim'}
        </button>
      </div>
    </div>
  )
}

// ── Main detail page ──────────────────────────────────────────────────────────
export default function RequisitionDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const { user } = useAuthStore()
  const role     = user?.role || ''

  const canApprove     = ['managing_director', 'system_admin'].includes(role)
  const canFulfill     = ['admin_officer', 'finance_officer', 'finance_manager', 'system_admin', 'managing_director', 'general_manager'].includes(role)
  const canFuelPayment = ['finance_officer', 'finance_manager', 'system_admin', 'managing_director'].includes(role)
  const canLogSchedule = ['site_manager', 'admin_officer', 'system_admin', 'managing_director', 'general_manager'].includes(role)

  const [comments, setComments]     = useState('')
  const [fulfillNotes, setFulfillNotes] = useState('')

  const { data: req, isLoading } = useQuery({
    queryKey: ['requisition', id],
    queryFn:  () => getRequisition(id),
    select:   r => r.data,
  })

  const approveMut = useMutation({
    mutationFn: (payload) => approveRequisition(id, payload),
    onSuccess: () => { toast.success('Action recorded.'); qc.invalidateQueries({ queryKey: ['requisition', id] }) },
    onError: e => toast.error(e.response?.data?.detail || 'Action failed.'),
  })

  const fulfillMut = useMutation({
    mutationFn: () => fulfillRequisition(id, { notes: fulfillNotes }),
    onSuccess: () => { toast.success('Marked as fulfilled.'); qc.invalidateQueries({ queryKey: ['requisition', id] }) },
    onError: () => toast.error('Failed to mark fulfilled.'),
  })

  if (isLoading) return (
    <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded-xl w-48" />
      <div className="h-40 bg-gray-100 rounded-2xl" />
    </div>
  )
  if (!req) return null

  const pendingAction = !['approved', 'rejected', 'fulfilled'].includes(req.status)
  const flowIdx = FLOW.indexOf(req.status)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button onClick={() => navigate('/requisitions')}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-slate">
        <ArrowLeftIcon className="h-3.5 w-3.5" /> Back to Requisitions
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-mono text-gray-600">{req.reference_number}</p>
            <h1 className="text-lg font-bold text-brand-slate mt-0.5">{req.title}</h1>
            <p className="text-xs text-gray-600 capitalize mt-1">
              {req.req_type.replace(/_/g, ' ')} · {req.priority} priority
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[req.status] || 'bg-gray-100 text-gray-600'}`}>
            {req.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Progress flow */}
        <div className="mt-5 flex items-center">
          {FLOW.map((stage, i) => {
            const done   = i <= flowIdx
            const active = req.status === stage
            return (
              <div key={stage} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full border-2 transition-colors
                    ${active ? 'border-brand-red bg-brand-red' : done ? 'border-green-600 bg-green-600' : 'border-gray-300 bg-white'}`} />
                  <span className={`text-[10px] mt-1 whitespace-nowrap capitalize
                    ${active ? 'text-brand-red font-bold' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {stage}
                  </span>
                </div>
                {i < FLOW.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1.5 ${i < flowIdx ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {req.rejection_reason && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-red-700">Rejection reason</p>
            <p className="text-xs text-red-600 mt-0.5">{req.rejection_reason}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left: details + items */}
        <div className="lg:col-span-2 space-y-5">

          {/* Details */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-brand-slate mb-3">Details</h2>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Requested By" value={`${req.requested_by_name} (${req.requested_by_role?.replace(/_/g, ' ')})`} />
              <Field label="Date Required" value={req.date_required} />
              <Field label="Project" value={req.project_name} />
              <Field label="Total Amount" value={`KES ${Number(req.total_amount).toLocaleString()}`} />
              <Field label="Submitted" value={new Date(req.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })} />
            </dl>
            {req.description && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Description</p>
                <p className="text-xs text-gray-700">{req.description}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-brand-slate">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Description', 'Qty', 'Unit', 'Unit Price', 'Total'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {req.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5 text-gray-700">{item.description}</td>
                      <td className="px-4 py-2.5 text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-gray-600">{item.unit || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{Number(item.unit_price).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-semibold text-brand-slate">{Number(item.total_price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Total</td>
                    <td className="px-4 py-2.5 font-bold text-brand-slate">KES {Number(req.total_amount).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Type-specific panels */}
          {req.req_type === 'repair_maintenance' && (
            <MaintenanceSchedulePanel
              req={req}
              schedule={req.maintenance_schedule}
              canLog={canLogSchedule}
            />
          )}

          {req.req_type === 'fuel' && (
            <FuelPaymentPanel
              req={req}
              fuelPayment={req.fuel_payment}
              canRecord={canFuelPayment}
            />
          )}
        </div>

        {/* Right: approval trail + actions */}
        <div className="space-y-5">

          {/* Approval trail */}
          {req.approvals?.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-brand-slate mb-3">Approval Trail</h2>
              <div className="space-y-3">
                {req.approvals.map(a => (
                  <div key={a.id} className={`border-l-2 pl-3 ${a.action === 'approved' ? 'border-green-400' : a.action === 'rejected' ? 'border-red-400' : 'border-amber-400'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold ${a.action === 'approved' ? 'text-green-600' : a.action === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>
                        {a.action.charAt(0).toUpperCase() + a.action.slice(1)}
                      </span>
                      <span className="text-[10px] text-gray-600">· {a.approved_by_name}</span>
                    </div>
                    <p className="text-[10px] text-gray-600">{new Date(a.actioned_at).toLocaleString('en-KE')}</p>
                    {a.comments && <p className="text-[10px] text-gray-600 mt-0.5 italic">"{a.comments}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MD action panel */}
          {canApprove && pendingAction && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-brand-slate mb-3">MD Decision</h2>
              <textarea rows={3} value={comments} onChange={e => setComments(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-brand-red resize-none mb-3"
                placeholder="Comments (optional)…" />
              <div className="space-y-2">
                <button onClick={() => approveMut.mutate({ action: 'approved', comments })}
                  disabled={approveMut.isPending}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
                </button>
                <button onClick={() => approveMut.mutate({ action: 'returned', comments })}
                  disabled={approveMut.isPending}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
                  <ArrowPathIcon className="h-3.5 w-3.5" /> Return for Revision
                </button>
                <button onClick={() => approveMut.mutate({ action: 'rejected', comments })}
                  disabled={approveMut.isPending}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
                  <XCircleIcon className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </div>
          )}

          {/* Fulfill panel (admin / finance / MD) */}
          {canFulfill && req.status === 'approved' && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-brand-slate mb-3">Mark as Fulfilled</h2>
              <textarea rows={2} value={fulfillNotes} onChange={e => setFulfillNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-brand-red resize-none mb-3"
                placeholder="Fulfillment notes…" />
              <button onClick={() => fulfillMut.mutate()} disabled={fulfillMut.isPending}
                className="w-full py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
                {fulfillMut.isPending ? 'Processing…' : 'Mark Fulfilled'}
              </button>
            </div>
          )}

          {/* Recall (own draft only) */}
          {req.status === 'submitted' && req.requested_by === user?.id && !canApprove && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-brand-slate mb-2">Recall Requisition</h2>
              <p className="text-xs text-gray-600 mb-3">Withdraw this requisition before it is reviewed.</p>
              <button onClick={() => {
                import('../../api/requisitions').then(({ recallRequisition }) => {
                  recallRequisition(id).then(() => {
                    toast.success('Requisition recalled.')
                    qc.invalidateQueries({ queryKey: ['requisition', id] })
                  }).catch(() => toast.error('Failed to recall.'))
                })
              }}
                className="w-full py-2 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-300">
                Recall
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
