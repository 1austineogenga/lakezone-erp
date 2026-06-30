import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  PlusIcon, ClipboardDocumentListIcon, BeakerIcon,
  WrenchScrewdriverIcon, ShoppingCartIcon, CubeIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, CalendarDaysIcon,
  ChevronRightIcon, BellAlertIcon, CurrencyDollarIcon,
  UserIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'
import {
  getRequisitions, approveRequisition, getMaintenanceSchedules,
  approveMaintenanceSchedule,
} from '../../api/requisitions'
import useAuthStore from '../../store/authStore'

// ── Constants ─────────────────────────────────────────────────────────────────
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

const PRIORITY_STYLE = {
  low:    'text-gray-400',
  medium: 'text-blue-500',
  high:   'text-orange-500',
  urgent: 'text-red-600 font-bold',
}

const SCHED_STATUS_STYLE = {
  logged:           'bg-gray-100 text-gray-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved:         'bg-green-100 text-green-700',
  in_progress:      'bg-blue-100 text-blue-700',
  completed:        'bg-teal-100 text-teal-700',
  cancelled:        'bg-red-100 text-red-700',
}

const TYPE_META = {
  fuel:              { label: 'Fuel',            icon: BeakerIcon,              color: 'text-orange-600 bg-orange-50' },
  materials:         { label: 'Materials',        icon: CubeIcon,                color: 'text-blue-600 bg-blue-50' },
  repair_maintenance:{ label: 'Repair & Maint.', icon: WrenchScrewdriverIcon,   color: 'text-purple-600 bg-purple-50' },
  general_purchase:  { label: 'General Purchase', icon: ShoppingCartIcon,        color: 'text-teal-600 bg-teal-50' },
  store_item:        { label: 'Store Item',       icon: CubeIcon,                color: 'text-gray-600 bg-gray-50' },
  external_purchase: { label: 'External Purchase',icon: ShoppingCartIcon,        color: 'text-gray-600 bg-gray-50' },
  service:           { label: 'Service',          icon: ClipboardDocumentListIcon, color: 'text-gray-600 bg-gray-50' },
}

const TABS = [
  { key: 'all',              label: 'All',              icon: ClipboardDocumentListIcon },
  { key: 'fuel',             label: 'Fuel',             icon: BeakerIcon },
  { key: 'materials',        label: 'Materials',        icon: CubeIcon },
  { key: 'repair_maintenance',label: 'Repair & Maint.', icon: WrenchScrewdriverIcon },
  { key: 'general_purchase', label: 'General Purchase', icon: ShoppingCartIcon },
  { key: 'maintenance_schedule', label: 'Maintenance Schedule', icon: CalendarDaysIcon },
]

const fmt = n => `KES ${Number(n || 0).toLocaleString()}`
const fmtDate = s => s ? new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// ── Approve inline (MD only) ──────────────────────────────────────────────────
function ApproveButtons({ reqId, onDone }) {
  const qc = useQueryClient()
  const [comments, setComments] = useState('')
  const [open, setOpen] = useState(false)

  const mut = useMutation({
    mutationFn: ({ action }) => approveRequisition(reqId, { action, comments }),
    onSuccess: () => {
      toast.success('Action recorded.')
      qc.invalidateQueries({ queryKey: ['requisitions'] })
      onDone?.()
    },
    onError: e => toast.error(e.response?.data?.detail || 'Action failed.'),
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-100 transition-colors">
        <CheckCircleIcon className="h-3.5 w-3.5" /> Review
      </button>
    )
  }

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
      <input
        value={comments} onChange={e => setComments(e.target.value)}
        placeholder="Comments (optional)"
        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-brand-red"
      />
      <div className="flex gap-2">
        <button onClick={() => mut.mutate({ action: 'approved' })} disabled={mut.isPending}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
          <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
        </button>
        <button onClick={() => mut.mutate({ action: 'rejected' })} disabled={mut.isPending}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
          <XCircleIcon className="h-3.5 w-3.5" /> Reject
        </button>
        <button onClick={() => mut.mutate({ action: 'returned' })} disabled={mut.isPending}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
          <ArrowPathIcon className="h-3.5 w-3.5" /> Return
        </button>
        <button onClick={() => setOpen(false)} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg">✕</button>
      </div>
    </div>
  )
}

// ── Requisition card ──────────────────────────────────────────────────────────
function ReqCard({ req, canApprove, canSeeFuelPayment }) {
  const navigate = useNavigate()
  const meta = TYPE_META[req.req_type] || TYPE_META.store_item
  const Icon = meta.icon

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="text-[10px] font-mono text-gray-600">{req.reference_number}</p>
              <p className="text-sm font-semibold text-brand-slate mt-0.5 truncate max-w-xs">{req.title}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${STATUS_STYLE[req.status] || 'bg-gray-100 text-gray-600'}`}>
                {req.status.replace(/_/g, ' ')}
              </span>
              <span className={`text-[10px] font-medium capitalize ${PRIORITY_STYLE[req.priority]}`}>
                {req.priority}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600 flex-wrap">
            <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {req.requested_by_name}</span>
            {req.project_name && <span>{req.project_name}</span>}
            <span className="flex items-center gap-1"><ClockIcon className="h-3 w-3" /> Need by {fmtDate(req.date_required)}</span>
            <span className="font-semibold text-brand-slate">{fmt(req.total_amount)}</span>
          </div>

          {/* Maintenance schedule badge */}
          {req.has_maintenance_schedule && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-medium">
              <CalendarDaysIcon className="h-3 w-3" /> Schedule logged
            </div>
          )}

          {/* Finance fuel payment badge */}
          {canSeeFuelPayment && req.req_type === 'fuel' && req.status === 'approved' && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-[10px] font-medium">
              <CurrencyDollarIcon className="h-3 w-3" /> Payment required
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => navigate(`/requisitions/${req.id}`)}
              className="flex items-center gap-1 text-xs text-brand-red font-semibold hover:underline">
              View details <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {canApprove && req.status === 'submitted' && (
            <ApproveButtons reqId={req.id} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Maintenance Schedule card ─────────────────────────────────────────────────
function ScheduleCard({ schedule, canApprove }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState('')

  const approveMut = useMutation({
    mutationFn: ({ action }) => approveMaintenanceSchedule(schedule.id, { action, comments }),
    onSuccess: () => {
      toast.success('Schedule updated.')
      qc.invalidateQueries({ queryKey: ['maintenance-schedules'] })
      setOpen(false)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Action failed.'),
  })

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] font-mono text-gray-600">{schedule.requisition_ref}</p>
          <p className="text-sm font-semibold text-brand-slate mt-0.5">{schedule.requisition_title}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${SCHED_STATUS_STYLE[schedule.status] || 'bg-gray-100 text-gray-600'}`}>
          {schedule.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
        {schedule.assigned_to && (
          <div><span className="text-gray-600">Assigned:</span> <span className="font-medium">{schedule.assigned_to}</span></div>
        )}
        {schedule.scheduled_date && (
          <div><span className="text-gray-600">Date:</span> <span className="font-medium">{fmtDate(schedule.scheduled_date)}</span></div>
        )}
        {schedule.payment_amount && (
          <div><span className="text-gray-600">Payment:</span> <span className="font-semibold text-emerald-600">{fmt(schedule.payment_amount)}</span></div>
        )}
        <div><span className="text-gray-600">Logged by:</span> <span className="font-medium">{schedule.logged_by_name}</span></div>
      </div>

      {schedule.work_description && (
        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{schedule.work_description}</p>
      )}

      {schedule.payment_details && (
        <p className="text-[10px] text-gray-600 mt-1">Payment details: {schedule.payment_details}</p>
      )}

      {schedule.expense_claim && (
        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-medium">
          <CheckCircleIcon className="h-3 w-3" /> Finance claim raised
        </div>
      )}

      {schedule.admin_comments && (
        <p className="mt-2 text-xs italic text-gray-600">Admin: "{schedule.admin_comments}"</p>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => navigate(`/requisitions/${schedule.requisition}`)}
          className="text-xs text-brand-red font-semibold hover:underline flex items-center gap-1">
          View requisition <ChevronRightIcon className="h-3.5 w-3.5" />
        </button>
        {canApprove && schedule.status === 'pending_approval' && (
          <button onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-100">
            <CheckCircleIcon className="h-3 w-3" /> Approve / Cancel
          </button>
        )}
      </div>

      {open && canApprove && (
        <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
          <input value={comments} onChange={e => setComments(e.target.value)}
            placeholder="Admin comments (optional)"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-brand-red" />
          <div className="flex gap-2">
            <button onClick={() => approveMut.mutate({ action: 'approved' })} disabled={approveMut.isPending}
              className="flex-1 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
              Approve & Raise Claim
            </button>
            <button onClick={() => approveMut.mutate({ action: 'cancelled' })} disabled={approveMut.isPending}
              className="flex-1 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
              Cancel Schedule
            </button>
            <button onClick={() => setOpen(false)} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────
function SummaryStrip({ data }) {
  const submitted = data.filter(r => r.status === 'submitted').length
  const approved  = data.filter(r => r.status === 'approved').length
  const rejected  = data.filter(r => r.status === 'rejected').length
  const fulfilled = data.filter(r => r.status === 'fulfilled').length

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Pending',   value: submitted, bg: 'bg-blue-50',   color: 'text-blue-600' },
        { label: 'Approved',  value: approved,  bg: 'bg-green-50',  color: 'text-green-600' },
        { label: 'Rejected',  value: rejected,  bg: 'bg-red-50',    color: 'text-red-600' },
        { label: 'Fulfilled', value: fulfilled, bg: 'bg-teal-50',   color: 'text-teal-600' },
      ].map(c => (
        <div key={c.label} className={`${c.bg} rounded-2xl p-3 text-center`}>
          <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          <p className="text-xs text-gray-600 mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RequisitionsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const role = user?.role || ''

  const canApprove        = ['managing_director', 'system_admin'].includes(role)
  const canSeeFuelPayment = ['finance_officer', 'finance_manager', 'system_admin', 'managing_director'].includes(role)
  const canLogSchedule    = ['site_manager', 'admin_officer', 'system_admin', 'managing_director', 'general_manager'].includes(role)
  const canApproveSchedule = ['managing_director', 'system_admin'].includes(role)

  const [tab, setTab]           = useState('all')
  const [statusFilter, setStatus] = useState('')
  const [search, setSearch]     = useState('')

  const params = {}
  if (tab !== 'all' && tab !== 'maintenance_schedule') params.req_type = tab
  if (statusFilter) params.status = statusFilter

  const { data: reqs = [], isLoading: reqLoading } = useQuery({
    queryKey: ['requisitions', tab, statusFilter],
    queryFn:  () => getRequisitions({ ...params, page_size: 200 }),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  tab !== 'maintenance_schedule',
  })

  const { data: schedules = [], isLoading: schedLoading } = useQuery({
    queryKey: ['maintenance-schedules'],
    queryFn:  () => getMaintenanceSchedules({ page_size: 200 }),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  tab === 'maintenance_schedule',
  })

  const filtered = reqs.filter(r =>
    !search ||
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.reference_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.requested_by_name?.toLowerCase().includes(search.toLowerCase())
  )

  const pendingCount = reqs.filter(r => r.status === 'submitted').length
  const pendingSchedCount = schedules.filter(s => s.status === 'pending_approval').length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Requisitions</h2>
          <p className="text-xs text-gray-600 mt-0.5">Fuel · Materials · Repairs · General purchases</p>
        </div>
        <button onClick={() => navigate('/requisitions/new')}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity">
          <PlusIcon className="h-3.5 w-3.5" /> New Requisition
        </button>
      </div>

      {/* MD alert */}
      {canApprove && pendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <BellAlertIcon className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            <span className="font-bold">{pendingCount}</span> requisition{pendingCount !== 1 ? 's' : ''} awaiting your approval.
          </p>
          <button onClick={() => { setTab('all'); setStatus('submitted') }}
            className="ml-auto text-xs text-amber-700 font-semibold underline whitespace-nowrap">
            View pending
          </button>
        </div>
      )}

      {/* Admin schedule alert */}
      {canApproveSchedule && pendingSchedCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-2xl">
          <CalendarDaysIcon className="h-5 w-5 text-purple-600 shrink-0" />
          <p className="text-sm font-medium text-purple-800">
            <span className="font-bold">{pendingSchedCount}</span> maintenance schedule{pendingSchedCount !== 1 ? 's' : ''} pending your approval.
          </p>
          <button onClick={() => setTab('maintenance_schedule')}
            className="ml-auto text-xs text-purple-700 font-semibold underline whitespace-nowrap">
            Review
          </button>
        </div>
      )}

      {/* Summary strip */}
      {tab !== 'maintenance_schedule' && reqs.length > 0 && <SummaryStrip data={reqs} />}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon
          const badge = t.key === 'maintenance_schedule' ? pendingSchedCount
                      : t.key === 'all' ? pendingCount : 0
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setStatus('') }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border
                ${tab === t.key
                  ? 'bg-brand-red text-white border-brand-red'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-white/30' : 'bg-red-100 text-red-700'}`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Status filters (not for schedule tab) */}
      {tab !== 'maintenance_schedule' && (
        <div className="flex items-center gap-2 flex-wrap">
          {['', 'submitted', 'approved', 'rejected', 'fulfilled'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize
                ${statusFilter === s
                  ? 'bg-brand-slate text-white border-brand-slate'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-brand-slate'}`}>
              {s || 'All Statuses'}
            </button>
          ))}
          <div className="ml-auto">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-brand-red" />
          </div>
        </div>
      )}

      {/* Content */}
      {tab === 'maintenance_schedule' ? (
        schedLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse h-24" />)}
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-14 text-center">
            <CalendarDaysIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">No maintenance schedules yet.</p>
            {canLogSchedule && (
              <p className="text-xs text-gray-600 mt-1">Open a Repair & Maintenance requisition to log a schedule.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map(s => (
              <ScheduleCard key={s.id} schedule={s} canApprove={canApproveSchedule} />
            ))}
          </div>
        )
      ) : reqLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-14 text-center">
          <ClipboardDocumentListIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No requisitions found.</p>
          <button onClick={() => navigate('/requisitions/new')}
            className="mt-3 text-xs text-brand-red font-semibold hover:underline flex items-center gap-1 mx-auto">
            <PlusIcon className="h-3.5 w-3.5" /> Create one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <ReqCard key={req.id} req={req} canApprove={canApprove} canSeeFuelPayment={canSeeFuelPayment} />
          ))}
        </div>
      )}
    </div>
  )
}
