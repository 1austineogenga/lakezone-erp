import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import {
  ExclamationTriangleIcon, CheckCircleIcon, XMarkIcon,
  PlusIcon, ChevronDownIcon, ChevronUpIcon, CalendarDaysIcon,
  UserCircleIcon, BellAlertIcon, ShieldExclamationIcon,
  BeakerIcon, CheckIcon,
} from '@heroicons/react/24/outline'

// ── API helpers ───────────────────────────────────────────────────────────────
const getComplianceAlerts  = () => api.get('/notifications/compliance-alerts/')
const getFleetAlerts       = (params) => api.get('/fleet/alerts/', { params })
const acknowledgeAlert     = (id) => api.post(`/fleet/alerts/${id}/acknowledge/`)
const getActions           = (params) => api.get('/notifications/actions/', { params })
const createAction         = (d)  => api.post('/notifications/actions/', d)
const updateAction         = (id, d) => api.patch(`/notifications/actions/${id}/`, d)
const addComment           = (d)  => api.post('/notifications/actions/comments/', d)
const getUsers             = () => api.get('/auth/users/', { params: { page_size: 200 } })

// ── Alert categories ──────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key:   'compliance',
    label: 'Compliance',
    icon:  ShieldExclamationIcon,
    color: 'text-red-600',
    bg:    'bg-red-50',
    border:'border-red-200',
    types: ['insurance_expiry', 'inspection_expiry', 'speed_governor_expiry', 'compliance_issue'],
    description: 'Insurance, speed governor & inspection certificate expiry',
  },
  {
    key:   'fuel',
    label: 'Fuel',
    icon:  BeakerIcon,
    color: 'text-blue-600',
    bg:    'bg-blue-50',
    border:'border-blue-200',
    types: ['low_fuel', 'fuel_fill', 'fuel_drain'],
    description: 'Fuel fill, drain/theft and low-fuel alerts',
  },
  {
    key:   'safety',
    label: 'Safety & Operations',
    icon:  ExclamationTriangleIcon,
    color: 'text-orange-600',
    bg:    'bg-orange-50',
    border:'border-orange-200',
    types: ['sos', 'speeding', 'ignition_off_moving', 'idle_long', 'device_offline'],
    description: 'SOS, speeding, idle, offline device and ignition alerts',
  },
]

const ALERT_TYPE_LABELS = {
  sos:                   'SOS Emergency',
  speeding:              'Overspeeding',
  low_fuel:              'Low Fuel',
  fuel_fill:             'Fuel Refill',
  fuel_drain:            'Fuel Drain / Theft',
  ignition_off_moving:   'Moving Without Ignition',
  idle_long:             'Long Idle',
  device_offline:        'Device Offline',
  insurance_expiry:      'Insurance Expiry',
  inspection_expiry:     'Inspection Certificate',
  speed_governor_expiry: 'Speed Governor',
  compliance_issue:      'Compliance Issue',
}

const SEVERITY_COLORS = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const COMPLIANCE_LEVEL_STYLES = {
  expired:  { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    label: 'EXPIRED' },
  critical: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'CRITICAL' },
  warning:  { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', label: 'DUE SOON' },
  ok:       { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  label: 'VALID' },
}

const COMPLIANCE_TYPE_LABELS = {
  insurance:      'Insurance',
  inspection:     'Inspection Certificate',
  speed_governor: 'Speed Governor',
}

const STATUS_COLORS = {
  pending:     'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-gray-100 text-gray-400',
}
const PRIORITY_COLORS = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const EMPTY_ACTION = { title: '', description: '', due_date: '', priority: 'medium', status: 'pending', assigned_to: '' }

function timeAgo(dt) {
  const diff = (Date.now() - new Date(dt)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const qc = useQueryClient()
  const [tab, setTab]               = useState('compliance')
  const [activeCat, setActiveCat]   = useState('compliance')
  const [showAcked, setShowAcked]   = useState(false)
  const [filterAlert, setFilterAlert] = useState('')

  // Scheduled actions state
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(EMPTY_ACTION)
  const [editingId, setEditingId]   = useState(null)
  const [expanded, setExpanded]     = useState(null)
  const [comment, setComment]       = useState('')
  const [commentingId, setCommentingId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: complianceAlerts = [], isLoading: compLoading } = useQuery({
    queryKey: ['compliance-alerts'],
    queryFn:  () => getComplianceAlerts().then(r => r.data ?? []),
    refetchInterval: 5 * 60 * 1000,
  })

  const { data: fleetAlerts = [], isLoading: fleetLoading } = useQuery({
    queryKey: ['fleet-alerts', showAcked],
    queryFn:  () => getFleetAlerts({ acknowledged: showAcked || undefined, page_size: 200 }).then(r => r.data?.results ?? r.data ?? []),
    refetchInterval: 60_000,
  })

  const { data: actions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ['scheduled-actions', filterStatus],
    queryFn:  () => getActions(filterStatus ? { status: filterStatus } : {}).then(r => r.data?.results ?? r.data ?? []),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn:  () => getUsers().then(r => r.data?.results ?? r.data ?? []),
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const ackMut = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess:  () => qc.invalidateQueries(['fleet-alerts']),
  })

  const createMut = useMutation({
    mutationFn: d => editingId ? updateAction(editingId, d) : createAction(d),
    onSuccess: () => { qc.invalidateQueries(['scheduled-actions']); setShowForm(false); setForm(EMPTY_ACTION); setEditingId(null) },
  })

  const commentMut = useMutation({
    mutationFn: addComment,
    onSuccess: () => { qc.invalidateQueries(['scheduled-actions']); setComment(''); setCommentingId(null) },
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => updateAction(id, { status }),
    onSuccess: () => qc.invalidateQueries(['scheduled-actions']),
  })

  // ── Derived counts ────────────────────────────────────────────────────────
  const expiredCount  = complianceAlerts.filter(a => a.alert_level === 'expired').length
  const criticalCount = complianceAlerts.filter(a => a.alert_level === 'critical').length
  const warningCount  = complianceAlerts.filter(a => a.alert_level === 'warning').length

  const fuelAlerts   = fleetAlerts.filter(a => ['low_fuel','fuel_fill','fuel_drain'].includes(a.alert_type))
  const safetyAlerts = fleetAlerts.filter(a => ['sos','speeding','ignition_off_moving','idle_long','device_offline'].includes(a.alert_type))
  const unAckedFuel  = fuelAlerts.filter(a => !a.acknowledged).length
  const unAckedSafety= safetyAlerts.filter(a => !a.acknowledged).length
  const overdueActions = actions.filter(a => a.is_overdue)

  const f = k => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })
  const inputCls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

  const handleEdit = (action) => {
    setForm({ title: action.title, description: action.description || '', due_date: action.due_date, priority: action.priority, status: action.status, assigned_to: action.assigned_to || '' })
    setEditingId(action.id)
    setShowForm(true)
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderFleetAlerts = (alerts) => {
    const shown = showAcked ? alerts : alerts.filter(a => !a.acknowledged)
    if (shown.length === 0) return (
      <div className="text-center py-12 text-gray-400">
        <CheckCircleIcon className="h-10 w-10 mx-auto mb-2 text-green-400" />
        <p className="font-medium">No {showAcked ? '' : 'unacknowledged '}alerts</p>
      </div>
    )
    return (
      <div className="space-y-2">
        {shown.map(alert => (
          <div key={alert.id} className={`border rounded-xl p-4 flex items-start gap-3 ${alert.acknowledged ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-gray-200'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-brand-slate text-sm">
                  {alert.vehicle_name || alert.vehicle_no}
                </span>
                <span className="text-xs text-gray-400 font-mono">({alert.vehicle_no})</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[alert.severity]}`}>
                  {alert.severity}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                </span>
                {alert.acknowledged && (
                  <span className="text-xs text-green-600 flex items-center gap-0.5">
                    <CheckIcon className="h-3 w-3" /> Acknowledged
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
              <p className="text-xs text-gray-400 mt-0.5">{timeAgo(alert.occurred_at)}</p>
            </div>
            {!alert.acknowledged && (
              <button
                onClick={() => ackMut.mutate(alert.id)}
                disabled={ackMut.isPending}
                className="shrink-0 text-xs px-2.5 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Acknowledge
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-slate">Alerts & Actions</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fleet compliance, fuel, safety alerts and scheduled action tracking</p>
      </div>

      {/* Summary banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Expired Docs',    count: expiredCount,       style: 'bg-red-50 border-red-200 text-red-700' },
          { label: 'Critical Expiry', count: criticalCount,      style: 'bg-orange-50 border-orange-200 text-orange-700' },
          { label: 'Due Soon',        count: warningCount,       style: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: 'Fuel Alerts',     count: unAckedFuel,        style: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Safety Alerts',   count: unAckedSafety,      style: 'bg-slate-50 border-slate-200 text-slate-700' },
        ].map(({ label, count, style }) => (
          <div key={label} className={`border rounded-xl p-3 ${style}`}>
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Main tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'compliance', label: 'Compliance' },
          { key: 'fuel',       label: 'Fuel' },
          { key: 'safety',     label: 'Safety & Ops' },
          { key: 'actions',    label: 'Scheduled Actions' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${tab === t.key ? 'bg-brand-slate text-white border-brand-slate' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {t.label}
            {t.key === 'fuel'   && unAckedFuel   > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full">{unAckedFuel}</span>}
            {t.key === 'safety' && unAckedSafety > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] rounded-full">{unAckedSafety}</span>}
          </button>
        ))}
      </div>

      {/* ── Compliance tab ─────────────────────────────────────────────── */}
      {tab === 'compliance' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {['', 'expired', 'critical', 'warning', 'ok'].map(level => (
              <button key={level} onClick={() => setFilterAlert(level)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                  ${filterAlert === level ? 'bg-brand-slate text-white border-brand-slate' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                {level === '' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>

          {compLoading ? (
            <p className="text-center text-gray-400 py-10">Loading…</p>
          ) : (
            (() => {
              const shown = filterAlert
                ? complianceAlerts.filter(a => a.alert_level === filterAlert)
                : complianceAlerts.filter(a => a.alert_level !== 'ok')
              return shown.length === 0 ? (
                <div className="text-center py-14 text-gray-400">
                  <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-400" />
                  <p className="font-medium">All compliance documents are valid</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shown.map(alert => {
                    const s = COMPLIANCE_LEVEL_STYLES[alert.alert_level] || COMPLIANCE_LEVEL_STYLES.ok
                    return (
                      <div key={alert.id} className={`border ${s.border} ${s.bg} rounded-xl p-4 flex items-center gap-4`}>
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-brand-slate">{alert.vehicle_name}</span>
                            <span className="text-xs text-gray-500 font-mono">({alert.vehicle_no})</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.badge}`}>{s.label}</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-0.5">
                            {COMPLIANCE_TYPE_LABELS[alert.compliance_type] || alert.compliance_type}
                            {' · '}Expires: <span className="font-medium">{alert.expiry_date}</span>
                            {' · '}
                            <span className={alert.days_left < 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                              {alert.days_left < 0 ? `${Math.abs(alert.days_left)} days overdue` : `${alert.days_left} days remaining`}
                            </span>
                          </p>
                          {alert.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{alert.notes}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
          )}
        </div>
      )}

      {/* ── Fuel tab ───────────────────────────────────────────────────── */}
      {tab === 'fuel' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Fuel refills, drain/theft events and low-fuel warnings from the fleet tracking system.</p>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showAcked} onChange={e => setShowAcked(e.target.checked)} className="rounded" />
              Show acknowledged
            </label>
          </div>
          {fleetLoading ? <p className="text-center text-gray-400 py-10">Loading…</p> : renderFleetAlerts(fuelAlerts)}
        </div>
      )}

      {/* ── Safety tab ─────────────────────────────────────────────────── */}
      {tab === 'safety' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">SOS, speeding, long idle, ignition-off-moving and device offline alerts.</p>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showAcked} onChange={e => setShowAcked(e.target.checked)} className="rounded" />
              Show acknowledged
            </label>
          </div>
          {fleetLoading ? <p className="text-center text-gray-400 py-10">Loading…</p> : renderFleetAlerts(safetyAlerts)}
        </div>
      )}

      {/* ── Scheduled Actions tab ─────────────────────────────────────── */}
      {tab === 'actions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={() => { setShowForm(true); setForm(EMPTY_ACTION); setEditingId(null) }}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm hover:bg-rose-700">
              <PlusIcon className="h-4 w-4" /> Schedule Action
            </button>
          </div>

          {showForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-brand-slate">{editingId ? 'Edit Action' : 'New Scheduled Action'}</h3>
                <button onClick={() => { setShowForm(false); setEditingId(null) }}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
              </div>
              <form onSubmit={e => { e.preventDefault(); createMut.mutate(form) }} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Title *</label>
                  <input {...f('title')} required placeholder="Action title…" className={inputCls} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Due Date *</label>
                    <input type="date" {...f('due_date')} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Priority</label>
                    <select {...f('priority')} className={inputCls}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Assign To</label>
                    <select {...f('assigned_to')} className={inputCls}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                    </select>
                  </div>
                </div>
                {editingId && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Status</label>
                    <select {...f('status')} className={inputCls}>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <textarea {...f('description')} rows={3} placeholder="Details…" className={inputCls} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={createMut.isPending}
                    className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm hover:bg-rose-700 disabled:opacity-60">
                    {createMut.isPending ? 'Saving…' : editingId ? 'Update' : 'Create Action'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {actionsLoading ? (
            <p className="text-center text-gray-400 py-10">Loading…</p>
          ) : actions.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No scheduled actions.</p>
          ) : (
            <div className="space-y-2">
              {actions.map(action => (
                <div key={action.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm ${action.is_overdue ? 'border-red-200' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-brand-slate">{action.title}</p>
                        {action.is_overdue && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">OVERDUE</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[action.status]}`}>{action.status.replace('_', ' ')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[action.priority]}`}>{action.priority}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5" /> Due: {action.due_date}</span>
                        {action.assigned_to_name && <span className="flex items-center gap-1"><UserCircleIcon className="h-3.5 w-3.5" />{action.assigned_to_name}</span>}
                        {action.comments?.length > 0 && <span>{action.comments.length} comment{action.comments.length !== 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {action.status === 'pending'     && <button onClick={() => statusMut.mutate({ id: action.id, status: 'in_progress' })} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">Start</button>}
                      {action.status === 'in_progress' && <button onClick={() => statusMut.mutate({ id: action.id, status: 'completed' })}   className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">Complete</button>}
                      <button onClick={() => handleEdit(action)} className="text-xs px-2.5 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
                      <button onClick={() => setExpanded(expanded === action.id ? null : action.id)} className="p-1 text-gray-400 hover:text-gray-600">
                        {expanded === action.id ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {expanded === action.id && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                      {action.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{action.description}</p>}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Comments</p>
                        {!action.comments?.length && <p className="text-xs text-gray-400">No comments yet.</p>}
                        <div className="space-y-2">
                          {action.comments?.map(c => (
                            <div key={c.id} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                              <div className="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
                                <span className="font-medium text-brand-slate">{c.author_name}</span>
                                <span>{new Date(c.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-gray-700">{c.comment}</p>
                            </div>
                          ))}
                        </div>
                        {commentingId === action.id ? (
                          <div className="mt-2 flex gap-2">
                            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                              placeholder="Add a comment…" className={`${inputCls} flex-1`} />
                            <div className="flex flex-col gap-1">
                              <button onClick={() => commentMut.mutate({ action: action.id, comment })}
                                disabled={!comment.trim() || commentMut.isPending}
                                className="px-3 py-1.5 bg-brand-red text-white text-xs rounded-lg disabled:opacity-60">Post</button>
                              <button onClick={() => { setCommentingId(null); setComment('') }}
                                className="px-3 py-1.5 border border-gray-300 text-xs rounded-lg">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setCommentingId(action.id); setComment('') }}
                            className="mt-2 text-xs text-brand-red hover:underline">+ Add comment</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
