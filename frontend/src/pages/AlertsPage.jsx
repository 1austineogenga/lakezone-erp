import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../api/client'
import {
  ExclamationTriangleIcon, CheckCircleIcon, XMarkIcon,
  PlusIcon, ChevronDownIcon, ChevronUpIcon, CalendarDaysIcon,
  UserCircleIcon, ShieldExclamationIcon, BeakerIcon, CheckIcon,
  BellSlashIcon, ClockIcon, TruckIcon, WrenchScrewdriverIcon,
  CubeIcon, BoltIcon, ArrowRightIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'

const getComplianceAlerts  = () => api.get('/notifications/compliance-alerts/')
const getFleetAlerts       = (params) => api.get('/fleet/alerts/', { params })
const acknowledgeAlert     = (id) => api.post(`/fleet/alerts/${id}/acknowledge/`)
const getActions           = (params) => api.get('/notifications/actions/', { params })
const createAction         = (d) => api.post('/notifications/actions/', d)
const updateAction         = (id, d) => api.patch(`/notifications/actions/${id}/`, d)
const addComment           = (d) => api.post('/notifications/actions/comments/', d)
const getUsers             = () => api.get('/auth/users/', { params: { page_size: 200 } })
const getLowStock          = () => api.get('/inventory/stock-levels/', { params: { page_size: 500 } })
const getComplianceCases   = () => api.get('/notifications/compliance-cases/')
const createComplianceCase = (d) => api.post('/notifications/compliance-cases/', d)
const advanceCase          = (id, d) => api.post(`/notifications/compliance-cases/${id}/advance/`, d)
const createCaseBill       = (id, d) => api.post(`/notifications/compliance-cases/${id}/bill/`, d)
const getSuppliers         = () => api.get('/procurement/suppliers/', { params: { page_size: 200 } })

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

const COMPLIANCE_TYPE_LABELS = {
  insurance:      'Insurance Certificate',
  inspection:     'Inspection Certificate',
  speed_governor: 'Speed Governor Certificate',
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

// ── Compliance Workflow Panel ──────────────────────────────────────────────────

const STEP_KEYS = ['open','acknowledged','contacted','invoice_received','payment_processed','certificate_updated','closed']
const STEP_LABELS_MAP = {
  open: 'Opened', acknowledged: 'Acknowledged', contacted: 'Provider Contacted',
  invoice_received: 'Invoice Received', payment_processed: 'Payment Processed',
  certificate_updated: 'Certificate Updated', closed: 'Closed',
}
const CONTACT_LABELS = { insurance: 'Contacted Insurer', inspection: 'Booked Inspection', speed_governor: 'Booked Calibration' }

const inp2 = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'

function StepperBar({ currentStatus }) {
  const idx = STEP_KEYS.indexOf(currentStatus)
  return (
    <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-1">
      {STEP_KEYS.map((key, i) => {
        const done = i < idx
        const active = i === idx
        return (
          <div key={key} className="flex items-center shrink-0">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done ? 'bg-green-500 border-green-500 text-white' : active ? 'bg-brand-red border-brand-red text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <p className={`text-[9px] mt-1 text-center w-14 leading-tight
                ${done ? 'text-green-600' : active ? 'text-brand-red font-semibold' : 'text-gray-400'}`}>
                {STEP_LABELS_MAP[key]}
              </p>
            </div>
            {i < STEP_KEYS.length - 1 && (
              <div className={`h-0.5 w-6 mx-0.5 mb-4 shrink-0 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ComplianceWorkflowPanel({ alert, cases, users, suppliers, onClose, qc }) {
  const existingCase = cases.find(c =>
    c.asset_ref === alert.asset_ref && c.compliance_type === alert.compliance_type && c.status !== 'closed'
  )
  const [mode, setMode] = useState(existingCase ? 'view' : 'start')
  const [activeCase, setActiveCase] = useState(existingCase || null)
  const [note, setNote] = useState('')
  const [fields, setFields] = useState({})
  const [showBillForm, setShowBillForm] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState('')

  const setF = (k, v) => setFields(f => ({ ...f, [k]: v }))

  const createMut = useMutation({
    mutationFn: createComplianceCase,
    onSuccess: (r) => {
      setActiveCase(r.data)
      setMode('view')
      qc.invalidateQueries(['compliance-cases'])
      toast.success('Renewal case opened')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to open case'),
  })

  const advanceMut = useMutation({
    mutationFn: ({ id, data }) => advanceCase(id, data),
    onSuccess: (r) => {
      setActiveCase(r.data)
      setNote('')
      setFields({})
      qc.invalidateQueries(['compliance-cases'])
      toast.success(`Advanced to: ${STEP_LABELS_MAP[r.data.status]}`)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to advance'),
  })

  const billMut = useMutation({
    mutationFn: ({ id, supplier_id }) => createCaseBill(id, { supplier_id }),
    onSuccess: (r) => {
      setActiveCase(r.data)
      setShowBillForm(false)
      qc.invalidateQueries(['compliance-cases'])
      toast.success(`Bill ${r.data.bill_number} created in Finance`)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to create bill'),
  })

  const handleStart = () => {
    createMut.mutate({
      asset_name: alert.asset_name,
      asset_ref: alert.asset_ref,
      compliance_type: alert.compliance_type,
      original_expiry: alert.expiry_date,
      vehicle_compliance_id: alert.source === 'fleet' ? alert.compliance_id : undefined,
      note: note,
    })
  }

  const handleAdvance = () => {
    const payload = { note, ...fields }
    advanceMut.mutate({ id: activeCase.id, data: payload })
  }

  const nextStep = activeCase ? STEP_KEYS[STEP_KEYS.indexOf(activeCase.status) + 1] : null
  const contactLabel = CONTACT_LABELS[alert.compliance_type] || 'Contact Provider'

  const renderNextStepForm = () => {
    if (!nextStep || activeCase.status === 'closed') return null

    return (
      <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
        <p className="text-xs font-bold text-brand-slate">
          Next: {nextStep === 'contacted' ? contactLabel : STEP_LABELS_MAP[nextStep]}
        </p>

        {nextStep === 'acknowledged' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Assign To</label>
            <select className={inp2} value={fields.assigned_to || ''} onChange={e => setF('assigned_to', e.target.value)}>
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role?.replace(/_/g,' ')})</option>)}
            </select>
          </div>
        )}

        {nextStep === 'contacted' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Provider / Company Name</label>
                <input className={inp2} placeholder={alert.compliance_type === 'insurance' ? 'e.g. APA Insurance' : alert.compliance_type === 'inspection' ? 'e.g. NTSA' : 'e.g. Stallion Systems'} value={fields.provider_name || ''} onChange={e => setF('provider_name', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contact Person / Phone</label>
                <input className={inp2} placeholder="Name or phone" value={fields.provider_contact || ''} onChange={e => setF('provider_contact', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date Contacted</label>
              <input type="date" className={inp2} value={fields.contacted_date || ''} onChange={e => setF('contacted_date', e.target.value)} />
            </div>
          </>
        )}

        {nextStep === 'invoice_received' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Invoice / Reference No.</label>
                <input className={inp2} placeholder="INV-001" value={fields.invoice_ref || ''} onChange={e => setF('invoice_ref', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount (KES) *</label>
                <input type="number" min="0" step="any" className={inp2} value={fields.invoice_amount || ''} onChange={e => setF('invoice_amount', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Due Date</label>
              <input type="date" className={inp2} value={fields.invoice_due_date || ''} onChange={e => setF('invoice_due_date', e.target.value)} />
            </div>
          </>
        )}

        {nextStep === 'payment_processed' && (
          <div className="space-y-2">
            {activeCase.bill ? (
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                <DocumentTextIcon className="h-5 w-5 text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-700">Bill {activeCase.bill_number}</p>
                  <p className={`text-[10px] capitalize ${activeCase.bill_status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                    Status: {activeCase.bill_status?.replace(/_/g, ' ')}
                  </p>
                </div>
                <a href="/finance/bills" target="_blank" className="ml-auto text-xs text-brand-red hover:underline">View in Finance →</a>
              </div>
            ) : (
              !showBillForm ? (
                <button onClick={() => setShowBillForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-xs font-semibold hover:bg-blue-50">
                  <DocumentTextIcon className="h-4 w-4" />
                  Generate Bill in Finance (AP)
                </button>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-600">Select Supplier for Bill</p>
                  <select className={inp2} value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                    <option value="">— Select supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                  </select>
                  <p className="text-[10px] text-gray-400">Amount: KES {Number(activeCase.invoice_amount || 0).toLocaleString()} · Ref: {activeCase.invoice_ref || 'N/A'}</p>
                  <div className="flex gap-2">
                    <button onClick={() => billMut.mutate({ id: activeCase.id, supplier_id: selectedSupplier })}
                      disabled={!selectedSupplier || billMut.isPending}
                      className="flex-1 bg-brand-red text-white text-xs font-semibold py-2 rounded-lg disabled:opacity-60">
                      {billMut.isPending ? 'Creating…' : 'Create Bill'}
                    </button>
                    <button onClick={() => setShowBillForm(false)} className="flex-1 border border-gray-200 text-xs py-2 rounded-lg">Cancel</button>
                  </div>
                </div>
              )
            )}
            <p className="text-[10px] text-gray-400 text-center">— or mark payment as done manually —</p>
          </div>
        )}

        {nextStep === 'certificate_updated' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">New Expiry Date *</label>
              <input type="date" className={inp2} value={fields.new_expiry || ''} onChange={e => setF('new_expiry', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">New Certificate No.</label>
              <input className={inp2} placeholder="Certificate number" value={fields.new_cert_number || ''} onChange={e => setF('new_cert_number', e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Note</label>
          <textarea rows={2} className={`${inp2} resize-none`} value={note} onChange={e => setNote(e.target.value)} placeholder="What was done, any details…" />
        </div>

        <button onClick={handleAdvance}
          disabled={advanceMut.isPending || (nextStep === 'certificate_updated' && !fields.new_expiry) || (nextStep === 'invoice_received' && !fields.invoice_amount)}
          className="w-full flex items-center justify-center gap-2 bg-brand-red text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-60">
          <ArrowRightIcon className="h-3.5 w-3.5" />
          {advanceMut.isPending ? 'Saving…' : `Advance → ${nextStep === 'contacted' ? contactLabel : STEP_LABELS_MAP[nextStep]}`}
        </button>
      </div>
    )
  }

  const s = COMPLIANCE_STYLES[alert.alert_level] || COMPLIANCE_STYLES.ok

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`${s.bg} border-b border-gray-100 px-5 py-4`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.badge}`}>{s.label}</span>
                <span className="text-[10px] px-2 py-0.5 bg-white/70 border border-gray-200 rounded-full text-gray-600">
                  {COMPLIANCE_TYPE_LABELS[alert.compliance_type] || alert.compliance_type}
                </span>
              </div>
              <h2 className="font-bold text-brand-slate text-base">{alert.asset_name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {alert.asset_ref} · Expires {alert.expiry_date} · {alert.days_left < 0 ? `${Math.abs(alert.days_left)}d overdue` : `${alert.days_left}d left`}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-black/10 rounded-lg">
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {mode === 'start' && !existingCase && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
                Opening a renewal case will track this certificate through to completion — from contacting the provider to updating the expiry date in the system.
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Initial Note (optional)</label>
                <textarea rows={2} className={`${inp2} resize-none`} value={note} onChange={e => setNote(e.target.value)} placeholder="Who is handling this, any context…" />
              </div>
              <button onClick={handleStart} disabled={createMut.isPending}
                className="w-full bg-brand-red text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-60">
                {createMut.isPending ? 'Opening…' : 'Open Renewal Case'}
              </button>
            </div>
          )}

          {activeCase && (
            <>
              {/* Stepper */}
              <StepperBar currentStatus={activeCase.status} />

              {/* Status badge */}
              {activeCase.status === 'closed' ? (
                <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Case Closed</p>
                    <p className="text-xs text-green-600">New expiry: {activeCase.new_expiry || 'N/A'} · Cert: {activeCase.new_cert_number || 'N/A'}</p>
                  </div>
                </div>
              ) : renderNextStepForm()}

              {/* Case details summary */}
              {(activeCase.provider_name || activeCase.invoice_amount || activeCase.new_expiry) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {activeCase.provider_name && (
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400 mb-0.5">Provider</p>
                      <p className="font-medium text-gray-700">{activeCase.provider_name}</p>
                      {activeCase.provider_contact && <p className="text-gray-500">{activeCase.provider_contact}</p>}
                    </div>
                  )}
                  {activeCase.invoice_amount && (
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400 mb-0.5">Invoice</p>
                      <p className="font-medium text-gray-700">KES {Number(activeCase.invoice_amount).toLocaleString()}</p>
                      {activeCase.invoice_ref && <p className="text-gray-500">{activeCase.invoice_ref}</p>}
                    </div>
                  )}
                  {activeCase.new_expiry && (
                    <div className="bg-green-50 rounded-lg p-2.5">
                      <p className="text-gray-400 mb-0.5">New Expiry</p>
                      <p className="font-semibold text-green-700">{activeCase.new_expiry}</p>
                    </div>
                  )}
                  {activeCase.assigned_to_name && (
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400 mb-0.5">Assigned To</p>
                      <p className="font-medium text-gray-700">{activeCase.assigned_to_name}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Audit trail */}
              {activeCase.steps?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Audit Trail</p>
                  <div className="space-y-2">
                    {activeCase.steps.map(step => (
                      <div key={step.id} className="flex gap-3 text-xs">
                        <div className="flex flex-col items-center">
                          <div className="w-5 h-5 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckIcon className="h-2.5 w-2.5 text-green-600" />
                          </div>
                          <div className="w-px flex-1 bg-gray-100 mt-1" />
                        </div>
                        <div className="pb-3">
                          <p className="font-semibold text-gray-700">{step.step_label}</p>
                          {step.note && <p className="text-gray-500 mt-0.5">{step.note}</p>}
                          <p className="text-gray-400 mt-0.5">{step.actioned_by_name} · {new Date(step.actioned_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, sub, bg, color, onClick, active }) {
  return (
    <button onClick={onClick}
      className={`${bg} rounded-2xl p-4 text-left w-full transition-all
        ${onClick ? 'hover:opacity-90 cursor-pointer' : 'cursor-default'}
        ${active ? 'ring-2 ring-offset-1 ring-current opacity-100' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <Icon className={`h-5 w-5 ${color} opacity-70`} />
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
      </div>
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </button>
  )
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
  const [caseAlert, setCaseAlert]       = useState(null)  // alert being worked on in workflow panel

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

  const { data: stockLevels = [] } = useQuery({
    queryKey: ['stock-levels-alerts'],
    queryFn:  () => getLowStock().then(r => r.data?.results ?? r.data ?? []),
    refetchInterval: 5 * 60 * 1000,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn:  () => getUsers().then(r => r.data?.results ?? r.data ?? []),
  })

  const { data: complianceCases = [] } = useQuery({
    queryKey: ['compliance-cases'],
    queryFn:  () => getComplianceCases().then(r => r.data?.results ?? r.data ?? []),
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn:  () => getSuppliers().then(r => r.data?.results ?? r.data ?? []),
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

  // Compliance stats — only expired / critical / warning (≤7 days) are actionable
  const expiredCount  = complianceAlerts.filter(a => a.alert_level === 'expired').length
  const criticalCount = complianceAlerts.filter(a => a.alert_level === 'critical').length
  const warningCount  = complianceAlerts.filter(a => a.alert_level === 'warning').length
  const compUrgent    = expiredCount + criticalCount + warningCount

  const fuelAlerts    = fleetAlerts.filter(a => ['low_fuel','fuel_fill','fuel_drain'].includes(a.alert_type))
  const safetyAlerts  = fleetAlerts.filter(a => ['sos','speeding','ignition_off_moving','idle_long','device_offline'].includes(a.alert_type))
  const unAckedFuel   = fuelAlerts.filter(a => !a.acknowledged).length
  const unAckedSafety = safetyAlerts.filter(a => !a.acknowledged).length
  const overdueCount  = actions.filter(a => a.is_overdue).length
  const lowStockCount = stockLevels.filter(s => s.is_below_reorder).length

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
    { key: 'compliance', label: 'Compliance',        icon: ShieldExclamationIcon,    badge: compUrgent },
    { key: 'fuel',       label: 'Fuel',               icon: BeakerIcon,               badge: unAckedFuel },
    { key: 'safety',     label: 'Safety & Ops',       icon: ExclamationTriangleIcon,  badge: unAckedSafety },
    { key: 'stock',      label: 'Low Stock',           icon: CubeIcon,                 badge: lowStockCount },
    { key: 'actions',    label: 'Scheduled Actions',  icon: CalendarDaysIcon,         badge: overdueCount },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-brand-slate">System Alerts</h1>
        <p className="text-xs text-gray-400 mt-0.5">Compliance, fuel, safety, inventory and scheduled action alerts</p>
      </div>

      {/* Dashboard summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard
          icon={ShieldExclamationIcon}
          label="Expired Documents"
          value={expiredCount}
          sub="Compliance"
          bg="bg-red-50"
          color="text-red-600"
          onClick={() => { setTab('compliance'); setFilterAlert('expired') }}
          active={tab === 'compliance' && filterAlert === 'expired'}
        />
        <SummaryCard
          icon={ExclamationTriangleIcon}
          label="Expiring ≤ 3 Days"
          value={criticalCount}
          sub="Compliance"
          bg="bg-orange-50"
          color="text-orange-600"
          onClick={() => { setTab('compliance'); setFilterAlert('critical') }}
          active={tab === 'compliance' && filterAlert === 'critical'}
        />
        <SummaryCard
          icon={ClockIcon}
          label="Due Within 7 Days"
          value={warningCount}
          sub="Compliance"
          bg="bg-amber-50"
          color="text-amber-600"
          onClick={() => { setTab('compliance'); setFilterAlert('warning') }}
          active={tab === 'compliance' && filterAlert === 'warning'}
        />
        <SummaryCard
          icon={BeakerIcon}
          label="Fuel Alerts"
          value={unAckedFuel}
          sub="Unacknowledged"
          bg="bg-blue-50"
          color="text-blue-600"
          onClick={() => setTab('fuel')}
          active={tab === 'fuel'}
        />
        <SummaryCard
          icon={BoltIcon}
          label="Safety Alerts"
          value={unAckedSafety}
          sub="Unacknowledged"
          bg="bg-slate-50"
          color="text-slate-600"
          onClick={() => setTab('safety')}
          active={tab === 'safety'}
        />
        <SummaryCard
          icon={CubeIcon}
          label="Low Stock Items"
          value={lowStockCount}
          sub="Below reorder level"
          bg="bg-purple-50"
          color="text-purple-600"
          onClick={() => setTab('stock')}
          active={tab === 'stock'}
        />
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
          {/* Compliance sub-cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'insurance',      label: 'Insurance',            icon: ShieldExclamationIcon },
              { key: 'inspection',     label: 'Inspection',           icon: WrenchScrewdriverIcon },
              { key: 'speed_governor', label: 'Speed Governor',       icon: TruckIcon },
            ].map(({ key, label, icon: Icon }) => {
              const count = complianceAlerts.filter(a => a.compliance_type === key && a.alert_level !== 'ok').length
              return (
                <div key={key} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-600">{label}</p>
                  </div>
                  <p className={`text-xl font-bold ${count > 0 ? 'text-red-600' : 'text-green-600'}`}>{count}</p>
                  <p className="text-[10px] text-gray-400">{count === 0 ? 'All valid' : 'Action required'}</p>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {['', 'expired', 'critical', 'warning', 'ok'].map(level => (
              <button key={level} onClick={() => setFilterAlert(level)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize
                  ${filterAlert === level
                    ? 'bg-brand-red text-white border-brand-red'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
                {level === '' ? 'All Alerts' : level === 'ok' ? 'Valid' : level}
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
                <p className="text-sm font-medium text-gray-500">
                  {filterAlert === 'ok' ? 'No valid certificates to show' : 'All compliance documents are up to date'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {shown.map(alert => {
                  const s = COMPLIANCE_STYLES[alert.alert_level] || COMPLIANCE_STYLES.ok
                  const typeLabel = alert.compliance_label || COMPLIANCE_TYPE_LABELS[alert.compliance_type] || alert.compliance_type
                  const activeCase = complianceCases.find(c =>
                    c.asset_ref === alert.asset_ref && c.compliance_type === alert.compliance_type && c.status !== 'closed'
                  )
                  const stepIdx = activeCase ? STEP_KEYS.indexOf(activeCase.status) : -1
                  return (
                    <div key={alert.id} className={`${s.bg} border border-l-4 ${s.border} border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4`}>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-brand-slate text-sm">{alert.asset_name}</span>
                          <span className="text-xs text-gray-400 font-mono">{alert.asset_ref}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.badge}`}>{s.label}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-white/60 text-gray-600 rounded-full border border-gray-200">
                            {typeLabel}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            alert.source === 'fleet'
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'bg-purple-50 text-purple-600 border-purple-200'
                          }`}>
                            {alert.source === 'fleet' ? 'Fleet' : 'Asset Register'}
                          </span>
                          {activeCase && (
                            <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-medium">
                              Case: Step {stepIdx + 1}/7 — {STEP_LABELS_MAP[activeCase.status]}
                            </span>
                          )}
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
                      {alert.alert_level !== 'ok' && (
                        <button onClick={() => setCaseAlert(alert)}
                          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors
                            ${activeCase
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                              : 'bg-brand-red text-white border-brand-red hover:opacity-90'}`}>
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                          {activeCase ? 'Manage Case' : 'Start Renewal'}
                        </button>
                      )}
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

      {/* ── Low Stock ── */}
      {tab === 'stock' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Stock items currently at or below their reorder level.</p>
          {stockLevels.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-16 text-center">
              <CheckCircleIcon className="h-12 w-12 mx-auto mb-3 text-green-400" />
              <p className="text-sm font-medium text-gray-500">All stock levels are adequate</p>
            </div>
          ) : (() => {
            const low = stockLevels.filter(s => s.is_below_reorder)
            if (low.length === 0) return (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-16 text-center">
                <CheckCircleIcon className="h-12 w-12 mx-auto mb-3 text-green-400" />
                <p className="text-sm font-medium text-gray-500">All stock levels are adequate</p>
              </div>
            )
            return (
              <div className="space-y-2">
                {low.map(s => (
                  <div key={s.id} className="bg-red-50 border border-l-4 border-l-red-500 border-red-100 rounded-2xl px-5 py-4 flex items-center gap-4">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-red-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-brand-slate text-sm">{s.item_name}</span>
                        <span className="text-xs text-gray-400 font-mono">{s.item_code}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">LOW STOCK</span>
                        {s.store_name && (
                          <span className="text-[10px] px-2 py-0.5 bg-white/60 text-gray-600 rounded-full border border-gray-200">
                            {s.store_name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        On hand: <span className="font-semibold text-red-600">{s.quantity_on_hand}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
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
                      {action.status === 'pending' && (
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

    {/* Compliance Renewal Workflow Panel */}
    {caseAlert && (
      <ComplianceWorkflowPanel
        alert={caseAlert}
        cases={complianceCases}
        users={users}
        suppliers={suppliers}
        onClose={() => setCaseAlert(null)}
        qc={qc}
      />
    )}
  </div>
  )
}
