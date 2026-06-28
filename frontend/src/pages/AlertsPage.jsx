import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import {
  ExclamationTriangleIcon, CheckCircleIcon, XMarkIcon,
  PlusIcon, ChevronDownIcon, ChevronUpIcon, CalendarDaysIcon,
  UserCircleIcon, ShieldExclamationIcon, BeakerIcon, CheckIcon,
  BellSlashIcon, ClockIcon,
} from '@heroicons/react/24/outline'

const getComplianceAlerts = () => api.get('/notifications/compliance-alerts/')
const getFleetAlerts      = (params) => api.get('/fleet/alerts/', { params })
const acknowledgeAlert    = (id) => api.post(`/fleet/alerts/${id}/acknowledge/`)
const getActions          = (params) => api.get('/notifications/actions/', { params })
const createAction        = (d) => api.post('/notifications/actions/', d)
const updateAction        = (id, d) => api.patch(`/notifications/actions/${id}/`, d)
const addComment          = (d) => api.post('/notifications/actions/comments/', d)
const getUsers            = () => api.get('/auth/users/', { params: { page_size: 200 } })

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

const SEV_BADGE = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-blue-100 text-blue-700',
}
const SEV_BORDER = {
  critical: 'border-l-red-500',
  high:     'border-l-orange-400',
  medium:   'border-l-amber-400',
  low:      'border-l-blue-400',
}

const COMPLIANCE_STYLES = {
  expired:  { bg: 'bg-red-50',    border: 'border-l-red-500',    badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    label: 'EXPIRED' },
  critical: { bg: 'bg-orange-50', border: 'border-l-orange-500', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'CRITICAL' },
  warning:  { bg: 'bg-amber-50',  border: 'border-l-amber-500',  badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400',  label: 'DUE SOON' },
  ok:       { bg: 'bg-green-50',  border: 'border-l-green-500',  badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  label: 'VALID' },
}

const COMPLIANCE_TYPE_LABELS = {
  insurance:      'Insurance',
  inspection:     'Inspection Certificate',
  speed_governor: 'Speed Governor',
}

const STATUS_COLORS = {
  pending:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-gray-100 text-gray-400',
}
const PRIORITY_COLORS = {
  low:      'bg-gray-100 text-gray-500',
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

export default function AlertsPage() {
  const qc = useQueryClient()
  const [tab, setTab]             = useState('compliance')
  const [showAcked, setShowAcked] = useState(false)
  const [filterAlert, setFilterAlert] = useState('')

  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState(EMPTY_ACTION)
  const [editingId, setEditingId]       = useState(null)
  const [expanded, setExpanded]         = useState(null)
  const [comment, setComment]           = useState('')
  const [commentingId, setCommentingId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')

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

  const expiredCount  = complianceAlerts.filter(a => a.alert_level === 'expired').length
  const criticalCount = complianceAlerts.filter(a => a.alert_level === 'critical').length
  const warningCount  = complianceAlerts.filter(a => a.alert_level === 'warning').length
  const fuelAlerts    = fleetAlerts.filter(a => ['low_fuel','fuel_fill','fuel_drain'].includes(a.alert_type))
  const safetyAlerts  = fleetAlerts.filter(a => ['sos','speeding','ignition_off_moving','idle_long','device_offline'].includes(a.alert_type))
  const unAckedFuel   = fuelAlerts.filter(a => !a.acknowledged).length
  const unAckedSafety = safetyAlerts.filter(a => !a.acknowledged).length
  const overdueCount  = actions.filter(a => a.is_overdue).length

  const f = k => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })
  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red'

  const handleEdit = (action) => {
    setForm({ title: action.title, description: action.description || '', due_date: action.due_date, priority: action.priority, status: action.status, assigned_to: action.assigned_to || '' })
    setEditingId(action.id)
    setShowForm(true)
  }

  const renderFleetAlerts = (alerts) => {
    const shown = showAcked ? alerts : alerts.filter(a => !a.acknowledged)
    if (shown.length === 0) return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-14 text-center">
        <CheckCircleIcon className="h-12 w-12 mx-auto mb-3 text-green-400" />
        <p className="text-sm font-medium text-gray-500">No {showAcked ? '' : 'unacknowledged '}alerts</p>
      </div>
    )
    return (
      <div className="space-y-2">
        {shown.map(alert => (
          <div key={alert.id}
            className={`bg-white border border-gray-100 border-l-4 rounded-2xl shadow-sm px-5 py-4 flex items-start gap-4 transition-opacity
              ${alert.acknowledged ? 'opacity-50' : ''}
              ${SEV_BORDER[alert.severity] || 'border-l-gray-300'}`}>
            <ExclamationTriangleIcon className={`h-5 w-5 mt-0.5 shrink-0 ${alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'high' ? 'text-orange-500' : 'text-amber-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-bold text-brand-slate">{alert.vehicle_name || alert.vehicle_no}</span>
                {alert.vehicle_name && <span className="text-xs text-gray-400 font-mono">{alert.vehicle_no}</span>}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${SEV_BADGE[alert.severity] || 'bg-gray-100 text-gray-600'}`}>
                  {alert.severity?.toUpperCase()}
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                  {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                </span>
                {alert.acknowledged && (
                  <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                    <CheckIcon className="h-3 w-3" /> Acknowledged
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">{alert.message}</p>
              <p className="text-[10px] text-gray-400 mt-1">{timeAgo(alert.occurred_at)}</p>
            </div>
            {!alert.acknowledged && (
              <button onClick={() => ackMut.mutate(alert.id)} disabled={ackMut.isPending}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-500 text-xs font-medium rounded-lg transition-colors disabled:opacity-60">
                <BellSlashIcon className="h-3.5 w-3.5" /> Dismiss
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  const TABS = [
    { key: 'compliance', label: 'Compliance', icon: ShieldExclamationIcon, badge: expiredCount + criticalCount },
    { key: 'fuel',       label: 'Fuel',       icon: BeakerIcon,            badge: unAckedFuel },
    { key: 'safety',     label: 'Safety & Ops', icon: ExclamationTriangleIcon, badge: unAckedSafety },
    { key: 'actions',    label: 'Scheduled Actions', icon: CalendarDaysIcon, badge: overdueCount },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-brand-slate">Alerts & Actions</h1>
        <p className="text-xs text-gray-400 mt-0.5">Fleet compliance, fuel, safety alerts and scheduled action tracking</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Expired Docs',    value: expiredCount,  bg: 'bg-red-100',    color: 'text-red-600' },
          { label: 'Critical Expiry', value: criticalCount, bg: 'bg-orange-100', color: 'text-orange-600' },
          { label: 'Due Soon',        value: warningCount,  bg: 'bg-amber-100',  color: 'text-amber-600' },
          { label: 'Fuel Alerts',     value: unAckedFuel,   bg: 'bg-blue-100',   color: 'text-blue-600' },
          { label: 'Safety Alerts',   value: unAckedSafety, bg: 'bg-slate-100',  color: 'text-slate-600' },
        ].map(({ label, value, bg, color }) => (
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap border-b border-gray-100 pb-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px
              ${tab === t.key
                ? 'border-brand-red text-brand-red'
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.badge > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white
                ${tab === t.key ? 'bg-brand-red' : 'bg-gray-400'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Compliance ── */}
      {tab === 'compliance' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {['', 'expired', 'critical', 'warning', 'ok'].map(level => (
              <button key={level} onClick={() => setFilterAlert(level)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize
                  ${filterAlert === level
                    ? 'bg-brand-red text-white border-brand-red'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
                {level === '' ? 'All' : level}
              </button>
            ))}
          </div>

          {compLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse h-16" />)}
            </div>
          ) : (() => {
            const shown = filterAlert
              ? complianceAlerts.filter(a => a.alert_level === filterAlert)
              : complianceAlerts.filter(a => a.alert_level !== 'ok')
            return shown.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-16 text-center">
                <CheckCircleIcon className="h-12 w-12 mx-auto mb-3 text-green-400" />
                <p className="text-sm font-medium text-gray-500">All compliance documents are valid</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shown.map(alert => {
                  const s = COMPLIANCE_STYLES[alert.alert_level] || COMPLIANCE_STYLES.ok
                  return (
                    <div key={alert.id} className={`${s.bg} border border-l-4 ${s.border} border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4`}>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-brand-slate text-sm">{alert.vehicle_name}</span>
                          <span className="text-xs text-gray-400 font-mono">{alert.vehicle_no}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.badge}`}>{s.label}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-white/60 text-gray-600 rounded-full border border-gray-200">
                            {COMPLIANCE_TYPE_LABELS[alert.compliance_type] || alert.compliance_type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          Expires: <span className="font-semibold">{alert.expiry_date}</span>
                          {' · '}
                          <span className={alert.days_left < 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                            {alert.days_left < 0
                              ? `${Math.abs(alert.days_left)} days overdue`
                              : `${alert.days_left} days remaining`}
                          </span>
                        </p>
                        {alert.notes && <p className="text-[10px] text-gray-400 mt-0.5 italic">{alert.notes}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Fuel ── */}
      {tab === 'fuel' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Fuel refills, drain/theft events and low-fuel warnings.</p>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showAcked} onChange={e => setShowAcked(e.target.checked)} className="rounded border-gray-300 accent-brand-red" />
              Show acknowledged
            </label>
          </div>
          {fleetLoading
            ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse h-16" />)}</div>
            : renderFleetAlerts(fuelAlerts)}
        </div>
      )}

      {/* ── Safety ── */}
      {tab === 'safety' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">SOS, speeding, long idle, ignition-off-moving and device offline alerts.</p>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showAcked} onChange={e => setShowAcked(e.target.checked)} className="rounded border-gray-300 accent-brand-red" />
              Show acknowledged
            </label>
          </div>
          {fleetLoading
            ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse h-16" />)}</div>
            : renderFleetAlerts(safetyAlerts)}
        </div>
      )}

      {/* ── Scheduled Actions ── */}
      {tab === 'actions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {['', 'pending', 'in_progress', 'completed', 'cancelled'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize
                    ${filterStatus === s
                      ? 'bg-brand-red text-white border-brand-red'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
                  {s === '' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button onClick={() => { setShowForm(true); setForm(EMPTY_ACTION); setEditingId(null) }}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
              <PlusIcon className="h-3.5 w-3.5" /> Schedule Action
            </button>
          </div>

          {showForm && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-brand-slate text-sm">{editingId ? 'Edit Action' : 'New Scheduled Action'}</h3>
                <button onClick={() => { setShowForm(false); setEditingId(null) }}>
                  <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); createMut.mutate(form) }} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                  <input {...f('title')} required placeholder="Action title…" className={inputCls} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Due Date *</label>
                    <input type="date" {...f('due_date')} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                    <select {...f('priority')} className={inputCls}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Assign To</label>
                    <select {...f('assigned_to')} className={inputCls}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                    </select>
                  </div>
                </div>
                {editingId && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                    <select {...f('status')} className={inputCls}>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea {...f('description')} rows={3} placeholder="Details…" className={`${inputCls} resize-none`} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-xs">Cancel</button>
                  <button type="submit" disabled={createMut.isPending}
                    className="px-4 py-2 bg-brand-red text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-60">
                    {createMut.isPending ? 'Saving…' : editingId ? 'Update' : 'Create Action'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {actionsLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse h-16" />)}</div>
          ) : actions.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-14 text-center">
              <CalendarDaysIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">No scheduled actions.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {actions.map(action => (
                <div key={action.id}
                  className={`bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden
                    ${action.is_overdue ? 'border-l-4 border-l-red-500' : ''}`}>
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-brand-slate text-sm">{action.title}</p>
                        {action.is_overdue && (
                          <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">OVERDUE</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[action.status]}`}>
                          {action.status.replace('_', ' ')}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_COLORS[action.priority]}`}>
                          {action.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <CalendarDaysIcon className="h-3.5 w-3.5" /> Due: {action.due_date}
                        </span>
                        {action.assigned_to_name && (
                          <span className="flex items-center gap-1">
                            <UserCircleIcon className="h-3.5 w-3.5" /> {action.assigned_to_name}
                          </span>
                        )}
                        {action.comments?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <ClockIcon className="h-3.5 w-3.5" />
                            {action.comments.length} comment{action.comments.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {action.status === 'pending'     && (
                        <button onClick={() => statusMut.mutate({ id: action.id, status: 'in_progress' })}
                          className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium">
                          Start
                        </button>
                      )}
                      {action.status === 'in_progress' && (
                        <button onClick={() => statusMut.mutate({ id: action.id, status: 'completed' })}
                          className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 font-medium">
                          Complete
                        </button>
                      )}
                      <button onClick={() => handleEdit(action)}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                        Edit
                      </button>
                      <button onClick={() => setExpanded(expanded === action.id ? null : action.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
                        {expanded === action.id
                          ? <ChevronUpIcon className="h-4 w-4" />
                          : <ChevronDownIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {expanded === action.id && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-4">
                      {action.description && (
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{action.description}</p>
                      )}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Comments</p>
                        {!action.comments?.length && (
                          <p className="text-xs text-gray-400">No comments yet.</p>
                        )}
                        <div className="space-y-2">
                          {action.comments?.map(c => (
                            <div key={c.id} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-0.5">
                                <span className="font-semibold text-brand-slate">{c.author_name}</span>
                                <span>{new Date(c.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-xs text-gray-700">{c.comment}</p>
                            </div>
                          ))}
                        </div>
                        {commentingId === action.id ? (
                          <div className="mt-3 flex gap-2">
                            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                              placeholder="Add a comment…"
                              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red resize-none" />
                            <div className="flex flex-col gap-1">
                              <button onClick={() => commentMut.mutate({ action: action.id, comment })}
                                disabled={!comment.trim() || commentMut.isPending}
                                className="px-3 py-1.5 bg-brand-red text-white text-xs font-semibold rounded-lg disabled:opacity-60">
                                Post
                              </button>
                              <button onClick={() => { setCommentingId(null); setComment('') }}
                                className="px-3 py-1.5 border border-gray-200 text-xs rounded-lg">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setCommentingId(action.id); setComment('') }}
                            className="mt-2 text-xs text-brand-red hover:underline">
                            + Add comment
                          </button>
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
