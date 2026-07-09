import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  ShieldExclamationIcon, ClipboardDocumentListIcon,
  UserGroupIcon, ShieldCheckIcon, Squares2X2Icon,
  PlusIcon, PencilIcon, TrashIcon, XMarkIcon,
  ExclamationTriangleIcon, CheckCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline'
import {
  getHSEDashboard, getIncidents, createIncident, updateIncident, deleteIncident,
  getToolboxTalks, createToolboxTalk, deleteToolboxTalk,
  getInductions, createInduction, deleteInduction,
  getPPEIssuances, createPPEIssuance, deletePPEIssuance,
} from '../../api/hse'

// ── Constants ─────────────────────────────────────────────────────────────────

const INCIDENT_TYPES = [
  { value: 'near_miss',     label: 'Near Miss' },
  { value: 'first_aid',     label: 'First Aid' },
  { value: 'medical',       label: 'Medical Treatment' },
  { value: 'lost_time',     label: 'Lost Time Injury' },
  { value: 'fatality',      label: 'Fatality' },
  { value: 'property',      label: 'Property Damage' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'other',         label: 'Other' },
]

const SEVERITY_CONFIG = {
  low:      { label: 'Low',      color: 'bg-green-100 text-green-700' },
  medium:   { label: 'Medium',   color: 'bg-yellow-100 text-yellow-700' },
  high:     { label: 'High',     color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 font-bold' },
}

const STATUS_CONFIG = {
  open:          { label: 'Open',          color: 'bg-red-100 text-red-700' },
  investigating: { label: 'Investigating', color: 'bg-yellow-100 text-yellow-700' },
  closed:        { label: 'Closed',        color: 'bg-green-100 text-green-700' },
}

const PPE_ITEMS = [
  { value: 'helmet',     label: 'Safety Helmet' },
  { value: 'vest',       label: 'High-Vis Vest' },
  { value: 'boots',      label: 'Safety Boots' },
  { value: 'gloves',     label: 'Gloves' },
  { value: 'goggles',    label: 'Safety Goggles' },
  { value: 'earplugs',   label: 'Ear Plugs / Muffs' },
  { value: 'harness',    label: 'Safety Harness' },
  { value: 'respirator', label: 'Respirator / Mask' },
  { value: 'coverall',   label: 'Coverall' },
  { value: 'other',      label: 'Other' },
]

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-red focus:border-transparent'
const lbl = 'block text-xs font-medium text-gray-700 mb-1'

function StatCard({ label, value, sub, color = 'text-brand-slate', icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      {Icon && <div className="p-2 bg-gray-50 rounded-lg"><Icon className="h-5 w-5 text-gray-500" /></div>}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function Badge({ cfg }) {
  if (!cfg) return null
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ModalShell({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-brand-slate px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-white/60 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-white/70 hover:text-white" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">{children}</div>
        {footer && <div className="px-6 pb-5 flex justify-end gap-2 shrink-0 border-t border-gray-100 pt-4">{footer}</div>}
      </div>
    </div>
  )
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['hse-dashboard'],
    queryFn: () => getHSEDashboard().then(r => r.data),
  })

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open Incidents" value={data?.open_incidents ?? 0} color={data?.open_incidents > 0 ? 'text-red-600' : 'text-green-600'} icon={ExclamationTriangleIcon} />
        <StatCard label="Overdue Actions" value={data?.overdue_actions ?? 0} color={data?.overdue_actions > 0 ? 'text-red-600' : 'text-green-600'} icon={ClockIcon} />
        <StatCard label="Toolbox Talks This Month" value={data?.talks_this_month ?? 0} icon={ClipboardDocumentListIcon} />
        <StatCard label="Total Inducted" value={data?.total_inducted ?? 0} sub={data?.expired_inductions > 0 ? `${data.expired_inductions} expired` : undefined} icon={UserGroupIcon} />
        <StatCard label="Total Incidents" value={data?.total_incidents ?? 0} />
        <StatCard label="Closed Incidents" value={data?.closed_incidents ?? 0} color="text-green-600" icon={CheckCircleIcon} />
        <StatCard label="PPE Issued This Month" value={data?.ppe_issued_this_month ?? 0} icon={ShieldCheckIcon} />
        <StatCard label="LTI Free" value={`${data?.total_incidents === 0 ? '✓' : data?.closed_incidents ?? 0}`} sub="incidents closed" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent incidents */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-brand-slate">Recent Incidents</h3>
          </div>
          {data?.recent_incidents?.length === 0
            ? <p className="p-4 text-xs text-gray-400 italic">No incidents recorded</p>
            : <div className="divide-y divide-gray-50">
                {data?.recent_incidents?.map(inc => (
                  <div key={inc.id} className="px-4 py-3 flex items-start gap-3">
                    <ExclamationTriangleIcon className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_CONFIG[inc.severity]?.color.includes('red') ? 'text-red-500' : 'text-yellow-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-slate truncate">{inc.location}</p>
                      <p className="text-xs text-gray-400">{fmtDate(inc.date)} · {INCIDENT_TYPES.find(t => t.value === inc.incident_type)?.label}</p>
                    </div>
                    <Badge cfg={STATUS_CONFIG[inc.status]} />
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Recent toolbox talks */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-brand-slate">Recent Toolbox Talks</h3>
          </div>
          {data?.recent_talks?.length === 0
            ? <p className="p-4 text-xs text-gray-400 italic">No toolbox talks recorded</p>
            : <div className="divide-y divide-gray-50">
                {data?.recent_talks?.map(t => (
                  <div key={t.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-brand-slate truncate">{t.topic}</p>
                    <p className="text-xs text-gray-400">{fmtDate(t.date)} · {t.conducted_by} · {t.attendee_count} attendees</p>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* By type / severity */}
      {data?.by_type?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-brand-slate mb-3">Incidents by Type</h3>
            <div className="space-y-2">
              {data.by_type.map(row => {
                const max = Math.max(...data.by_type.map(r => r.count))
                return (
                  <div key={row.incident_type} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-36 shrink-0">{INCIDENT_TYPES.find(t => t.value === row.incident_type)?.label || row.incident_type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-brand-red h-2 rounded-full" style={{ width: `${(row.count / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-brand-slate w-5 text-right">{row.count}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-brand-slate mb-3">Incidents by Severity</h3>
            <div className="space-y-2">
              {data.by_severity.map(row => (
                <div key={row.severity} className="flex items-center justify-between">
                  <Badge cfg={SEVERITY_CONFIG[row.severity]} />
                  <span className="text-sm font-semibold text-brand-slate">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Incidents Tab ─────────────────────────────────────────────────────────────

function IncidentModal({ incident, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!incident
  const [form, setForm] = useState({
    project_name: incident?.project_name || '',
    date: incident?.date || new Date().toISOString().split('T')[0],
    time: incident?.time || '',
    location: incident?.location || '',
    incident_type: incident?.incident_type || 'near_miss',
    severity: incident?.severity || 'low',
    description: incident?.description || '',
    persons_involved: incident?.persons_involved || '',
    immediate_action: incident?.immediate_action || '',
    root_cause: incident?.root_cause || '',
    corrective_action: incident?.corrective_action || '',
    corrective_action_due: incident?.corrective_action_due || '',
    status: incident?.status || 'open',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const mut = useMutation({
    mutationFn: (data) => isEdit ? updateIncident(incident.id, data) : createIncident(data),
    onSuccess: () => { qc.invalidateQueries(['hse-incidents']); qc.invalidateQueries(['hse-dashboard']); toast.success(isEdit ? 'Incident updated' : 'Incident recorded'); onClose() },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <ModalShell title={isEdit ? 'Edit Incident' : 'Record Incident'} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={() => mut.mutate(form)} disabled={!form.location || !form.description || mut.isPending}
          className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium disabled:opacity-50">
          {mut.isPending ? 'Saving…' : 'Save Incident'}
        </button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={lbl}>Project / Site</label><input className={inp} value={form.project_name} onChange={e => set('project_name', e.target.value)} placeholder="Project name" /></div>
        <div><label className={lbl}>Date *</label><input type="date" className={inp} value={form.date} onChange={e => set('date', e.target.value)} /></div>
        <div><label className={lbl}>Time</label><input type="time" className={inp} value={form.time} onChange={e => set('time', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Location *</label><input className={inp} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Where did it happen?" /></div>
        <div><label className={lbl}>Type *</label>
          <select className={inp} value={form.incident_type} onChange={e => set('incident_type', e.target.value)}>
            {INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Severity</label>
          <select className={inp} value={form.severity} onChange={e => set('severity', e.target.value)}>
            {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={lbl}>Description *</label><textarea rows={3} className={inp} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Persons Involved</label><textarea rows={2} className={inp} value={form.persons_involved} onChange={e => set('persons_involved', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Immediate Action Taken</label><textarea rows={2} className={inp} value={form.immediate_action} onChange={e => set('immediate_action', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Root Cause</label><textarea rows={2} className={inp} value={form.root_cause} onChange={e => set('root_cause', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Corrective Action</label><textarea rows={2} className={inp} value={form.corrective_action} onChange={e => set('corrective_action', e.target.value)} /></div>
        <div><label className={lbl}>Action Due Date</label><input type="date" className={inp} value={form.corrective_action_due} onChange={e => set('corrective_action_due', e.target.value)} /></div>
        <div><label className={lbl}>Status</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
    </ModalShell>
  )
}

function IncidentsTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['hse-incidents', search],
    queryFn: () => getIncidents({ search: search || undefined }).then(r => {
      const d = r.data?.results ?? r.data ?? []
      return Array.isArray(d) ? d : []
    }),
  })

  const delMut = useMutation({
    mutationFn: deleteIncident,
    onSuccess: () => { qc.invalidateQueries(['hse-incidents']); qc.invalidateQueries(['hse-dashboard']); toast.success('Deleted') },
  })

  return (
    <div className="space-y-4">
      {modal === 'add' && <IncidentModal onClose={() => setModal(null)} />}
      {modal === 'edit' && <IncidentModal incident={editing} onClose={() => { setModal(null); setEditing(null) }} />}

      <div className="flex items-center justify-between gap-3">
        <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72" placeholder="Search incidents…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium">
          <PlusIcon className="h-4 w-4" /> Record Incident
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          : incidents.length === 0 ? <div className="p-12 text-center text-sm text-gray-400">No incidents recorded</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Location / Project', 'Type', 'Severity', 'Status', 'Action Due', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {incidents.map(inc => (
                  <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(inc.date)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-brand-slate">{inc.location}</p>
                      {inc.project_name && <p className="text-xs text-gray-400">{inc.project_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{INCIDENT_TYPES.find(t => t.value === inc.incident_type)?.label}</td>
                    <td className="px-4 py-3"><Badge cfg={SEVERITY_CONFIG[inc.severity]} /></td>
                    <td className="px-4 py-3"><Badge cfg={STATUS_CONFIG[inc.status]} /></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {inc.corrective_action_due
                        ? <span className={inc.is_overdue && inc.status !== 'closed' ? 'text-red-600 font-medium' : ''}>{fmtDate(inc.corrective_action_due)}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setEditing(inc); setModal('edit') }} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><PencilIcon className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (window.confirm('Delete incident?')) delMut.mutate(inc.id) }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

// ── Toolbox Talks Tab ─────────────────────────────────────────────────────────

function ToolboxModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    project_name: '', date: new Date().toISOString().split('T')[0],
    topic: '', conducted_by: '', location: '', duration_minutes: 15,
    attendee_count: 0, summary: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const mut = useMutation({
    mutationFn: createToolboxTalk,
    onSuccess: () => { qc.invalidateQueries(['hse-talks']); qc.invalidateQueries(['hse-dashboard']); toast.success('Toolbox talk recorded'); onClose() },
  })

  return (
    <ModalShell title="Record Toolbox Talk" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
        <button onClick={() => mut.mutate(form)} disabled={!form.topic || mut.isPending}
          className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium disabled:opacity-50">
          {mut.isPending ? 'Saving…' : 'Save'}
        </button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={lbl}>Topic *</label><input className={inp} value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="Safety topic discussed" /></div>
        <div><label className={lbl}>Date *</label><input type="date" className={inp} value={form.date} onChange={e => set('date', e.target.value)} /></div>
        <div><label className={lbl}>Duration (min)</label><input type="number" className={inp} value={form.duration_minutes} onChange={e => set('duration_minutes', parseInt(e.target.value) || 15)} /></div>
        <div><label className={lbl}>Conducted By *</label><input className={inp} value={form.conducted_by} onChange={e => set('conducted_by', e.target.value)} /></div>
        <div><label className={lbl}>Location</label><input className={inp} value={form.location} onChange={e => set('location', e.target.value)} /></div>
        <div><label className={lbl}>Project / Site</label><input className={inp} value={form.project_name} onChange={e => set('project_name', e.target.value)} /></div>
        <div><label className={lbl}>Attendee Count</label><input type="number" min="0" className={inp} value={form.attendee_count} onChange={e => set('attendee_count', parseInt(e.target.value) || 0)} /></div>
        <div className="col-span-2"><label className={lbl}>Summary</label><textarea rows={3} className={inp} value={form.summary} onChange={e => set('summary', e.target.value)} /></div>
      </div>
    </ModalShell>
  )
}

function ToolboxTalksTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const { data: talks = [], isLoading } = useQuery({
    queryKey: ['hse-talks'],
    queryFn: () => getToolboxTalks().then(r => { const d = r.data?.results ?? r.data ?? []; return Array.isArray(d) ? d : [] }),
  })
  const delMut = useMutation({ mutationFn: deleteToolboxTalk, onSuccess: () => { qc.invalidateQueries(['hse-talks']); qc.invalidateQueries(['hse-dashboard']) } })

  return (
    <div className="space-y-4">
      {showModal && <ToolboxModal onClose={() => setShowModal(false)} />}
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium">
          <PlusIcon className="h-4 w-4" /> Record Talk
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          : talks.length === 0 ? <div className="p-12 text-center text-sm text-gray-400">No toolbox talks recorded</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Date', 'Topic', 'Conducted By', 'Location', 'Duration', 'Attendees', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {talks.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(t.date)}</td>
                    <td className="px-4 py-3 font-medium text-brand-slate">{t.topic}</td>
                    <td className="px-4 py-3 text-gray-600">{t.conducted_by}</td>
                    <td className="px-4 py-3 text-gray-600">{t.location || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{t.duration_minutes} min</td>
                    <td className="px-4 py-3 text-gray-600">{t.attendee_count}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(t.id) }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

// ── Inductions Tab ────────────────────────────────────────────────────────────

function InductionModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    project_name: '', person_name: '', company: '', role: '',
    induction_date: new Date().toISOString().split('T')[0],
    inducted_by: '', topics_covered: '', expiry_date: '', notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const mut = useMutation({
    mutationFn: createInduction,
    onSuccess: () => { qc.invalidateQueries(['hse-inductions']); qc.invalidateQueries(['hse-dashboard']); toast.success('Induction recorded'); onClose() },
  })

  return (
    <ModalShell title="Record Site Induction" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
        <button onClick={() => mut.mutate(form)} disabled={!form.person_name || mut.isPending}
          className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium disabled:opacity-50">{mut.isPending ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Person Name *</label><input className={inp} value={form.person_name} onChange={e => set('person_name', e.target.value)} /></div>
        <div><label className={lbl}>Company</label><input className={inp} value={form.company} onChange={e => set('company', e.target.value)} /></div>
        <div><label className={lbl}>Role</label><input className={inp} value={form.role} onChange={e => set('role', e.target.value)} /></div>
        <div><label className={lbl}>Project / Site</label><input className={inp} value={form.project_name} onChange={e => set('project_name', e.target.value)} /></div>
        <div><label className={lbl}>Induction Date *</label><input type="date" className={inp} value={form.induction_date} onChange={e => set('induction_date', e.target.value)} /></div>
        <div><label className={lbl}>Inducted By</label><input className={inp} value={form.inducted_by} onChange={e => set('inducted_by', e.target.value)} /></div>
        <div><label className={lbl}>Expiry Date</label><input type="date" className={inp} value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Topics Covered</label><textarea rows={2} className={inp} value={form.topics_covered} onChange={e => set('topics_covered', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Notes</label><textarea rows={2} className={inp} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      </div>
    </ModalShell>
  )
}

function InductionsTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const { data: inductions = [], isLoading } = useQuery({
    queryKey: ['hse-inductions'],
    queryFn: () => getInductions().then(r => { const d = r.data?.results ?? r.data ?? []; return Array.isArray(d) ? d : [] }),
  })
  const delMut = useMutation({ mutationFn: deleteInduction, onSuccess: () => qc.invalidateQueries(['hse-inductions']) })

  return (
    <div className="space-y-4">
      {showModal && <InductionModal onClose={() => setShowModal(false)} />}
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium">
          <PlusIcon className="h-4 w-4" /> Record Induction
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          : inductions.length === 0 ? <div className="p-12 text-center text-sm text-gray-400">No inductions recorded</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Person', 'Company / Role', 'Project', 'Date', 'Inducted By', 'Expiry', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inductions.map(ind => (
                  <tr key={ind.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-brand-slate">{ind.person_name}</td>
                    <td className="px-4 py-3 text-gray-600"><p>{ind.company || '—'}</p><p className="text-xs text-gray-400">{ind.role}</p></td>
                    <td className="px-4 py-3 text-gray-600">{ind.project_name || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(ind.induction_date)}</td>
                    <td className="px-4 py-3 text-gray-600">{ind.inducted_by || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ind.expiry_date
                        ? <span className={ind.is_expired ? 'text-red-600 font-medium' : 'text-gray-700'}>{fmtDate(ind.expiry_date)}{ind.is_expired ? ' ⚠' : ''}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(ind.id) }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

// ── PPE Tab ───────────────────────────────────────────────────────────────────

function PPEModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    project_name: '', person_name: '', employee_id: '',
    ppe_item: 'helmet', ppe_description: '', quantity: 1,
    size: '', issue_date: new Date().toISOString().split('T')[0],
    condition: 'new', notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const mut = useMutation({
    mutationFn: createPPEIssuance,
    onSuccess: () => { qc.invalidateQueries(['hse-ppe']); qc.invalidateQueries(['hse-dashboard']); toast.success('PPE issuance recorded'); onClose() },
  })

  return (
    <ModalShell title="Record PPE Issuance" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
        <button onClick={() => mut.mutate(form)} disabled={!form.person_name || mut.isPending}
          className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium disabled:opacity-50">{mut.isPending ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Person Name *</label><input className={inp} value={form.person_name} onChange={e => set('person_name', e.target.value)} /></div>
        <div><label className={lbl}>Employee ID</label><input className={inp} value={form.employee_id} onChange={e => set('employee_id', e.target.value)} /></div>
        <div><label className={lbl}>PPE Item *</label>
          <select className={inp} value={form.ppe_item} onChange={e => set('ppe_item', e.target.value)}>
            {PPE_ITEMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Description</label><input className={inp} value={form.ppe_description} onChange={e => set('ppe_description', e.target.value)} placeholder="Brand, spec, etc." /></div>
        <div><label className={lbl}>Quantity</label><input type="number" min="1" className={inp} value={form.quantity} onChange={e => set('quantity', parseInt(e.target.value) || 1)} /></div>
        <div><label className={lbl}>Size</label><input className={inp} value={form.size} onChange={e => set('size', e.target.value)} placeholder="S / M / L / XL" /></div>
        <div><label className={lbl}>Issue Date</label><input type="date" className={inp} value={form.issue_date} onChange={e => set('issue_date', e.target.value)} /></div>
        <div><label className={lbl}>Condition</label>
          <select className={inp} value={form.condition} onChange={e => set('condition', e.target.value)}>
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="worn">Worn</option>
          </select>
        </div>
        <div><label className={lbl}>Project / Site</label><input className={inp} value={form.project_name} onChange={e => set('project_name', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Notes</label><textarea rows={2} className={inp} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      </div>
    </ModalShell>
  )
}

function PPETab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['hse-ppe'],
    queryFn: () => getPPEIssuances().then(r => { const d = r.data?.results ?? r.data ?? []; return Array.isArray(d) ? d : [] }),
  })
  const delMut = useMutation({ mutationFn: deletePPEIssuance, onSuccess: () => qc.invalidateQueries(['hse-ppe']) })

  return (
    <div className="space-y-4">
      {showModal && <PPEModal onClose={() => setShowModal(false)} />}
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium">
          <PlusIcon className="h-4 w-4" /> Issue PPE
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          : items.length === 0 ? <div className="p-12 text-center text-sm text-gray-400">No PPE issuances recorded</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Date', 'Person', 'PPE Item', 'Qty', 'Size', 'Condition', 'Project', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(p.issue_date)}</td>
                    <td className="px-4 py-3 font-medium text-brand-slate">{p.person_name}{p.employee_id ? <span className="text-xs text-gray-400 ml-1">#{p.employee_id}</span> : ''}</td>
                    <td className="px-4 py-3 text-gray-600">{PPE_ITEMS.find(i => i.value === p.ppe_item)?.label}</td>
                    <td className="px-4 py-3 text-gray-700">{p.quantity}</td>
                    <td className="px-4 py-3 text-gray-600">{p.size || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${p.condition === 'new' ? 'bg-green-100 text-green-700' : p.condition === 'good' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.condition}</span></td>
                    <td className="px-4 py-3 text-gray-600">{p.project_name || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(p.id) }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

// ── Main HSE Page ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Dashboard',      Icon: Squares2X2Icon },
  { id: 'incidents', label: 'Incidents',       Icon: ShieldExclamationIcon },
  { id: 'talks',     label: 'Toolbox Talks',   Icon: ClipboardDocumentListIcon },
  { id: 'inductions',label: 'Site Inductions', Icon: UserGroupIcon },
  { id: 'ppe',       label: 'PPE Issuance',    Icon: ShieldCheckIcon },
]

export default function HSEPage() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-brand-slate">HSE Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Health, Safety &amp; Environment</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors
              ${tab === id ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-brand-slate hover:border-gray-300'}`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'dashboard'  && <DashboardTab />}
      {tab === 'incidents'  && <IncidentsTab />}
      {tab === 'talks'      && <ToolboxTalksTab />}
      {tab === 'inductions' && <InductionsTab />}
      {tab === 'ppe'        && <PPETab />}
    </div>
  )
}
