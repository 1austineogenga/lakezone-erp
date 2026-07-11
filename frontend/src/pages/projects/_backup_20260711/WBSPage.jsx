import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  PlusIcon, ChevronDownIcon, ChevronRightIcon,
  PencilIcon, TrashIcon, ArrowUpIcon,
  CheckCircleIcon, ClockIcon, PauseCircleIcon, XCircleIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'

const api = (path, opts = {}) => axios({ url: `/api/v1/projects${path}`, ...opts })

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-600', Icon: XCircleIcon },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', Icon: ClockIcon },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700', Icon: CheckCircleIcon },
  on_hold:     { label: 'On Hold',     color: 'bg-yellow-100 text-yellow-700', Icon: PauseCircleIcon },
}

const PHASE_COLORS = ['blue', 'green', 'purple', 'orange', 'red', 'teal', 'indigo', 'pink']
const PHASE_COLOR_MAP = {
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  red:    'bg-red-500',
  teal:   'bg-teal-500',
  indigo: 'bg-indigo-500',
  pink:   'bg-pink-500',
}

function ProgressBar({ value, className = '' }) {
  const pct = Math.min(100, Math.max(0, parseFloat(value) || 0))
  return (
    <div className={`h-2 bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function PhaseModal({ projectId, phase, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!phase
  const [form, setForm] = useState({
    name: phase?.name || '',
    description: phase?.description || '',
    planned_start: phase?.planned_start || '',
    planned_end: phase?.planned_end || '',
    color: phase?.color || 'blue',
    order: phase?.order ?? 0,
  })

  const mut = useMutation({
    mutationFn: (data) => isEdit
      ? api(`/${projectId}/phases/${phase.id}/`, { method: 'PATCH', data })
      : api(`/${projectId}/phases/`, { method: 'POST', data }),
    onSuccess: () => { qc.invalidateQueries(['wbs', projectId]); onClose() },
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-brand-slate px-6 py-4">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Phase' : 'Add Phase'}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phase Name *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-red focus:border-transparent"
              value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mobilisation" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Planned Start</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.planned_start} onChange={e => set('planned_start', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Planned End</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.planned_end} onChange={e => set('planned_end', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PHASE_COLORS.map(c => (
                <button key={c} onClick={() => set('color', c)}
                  className={`w-7 h-7 rounded-full ${PHASE_COLOR_MAP[c]} border-2 transition-all ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Order</label>
            <input type="number" min="0" className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.order} onChange={e => set('order', parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => mut.mutate(form)} disabled={!form.name || mut.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-brand-red text-white font-medium disabled:opacity-50">
            {mut.isPending ? 'Saving…' : 'Save Phase'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActivityModal({ projectId, phaseId, activity, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!activity
  const [form, setForm] = useState({
    wbs_code: activity?.wbs_code || '',
    description: activity?.description || '',
    planned_start: activity?.planned_start || '',
    planned_end: activity?.planned_end || '',
    responsible: activity?.responsible || '',
    weight: activity?.weight || '1',
    status: activity?.status || 'not_started',
    notes: activity?.notes || '',
    order: activity?.order ?? 0,
  })

  const mut = useMutation({
    mutationFn: (data) => isEdit
      ? api(`/${projectId}/phases/${phaseId}/activities/${activity.id}/`, { method: 'PATCH', data })
      : api(`/${projectId}/phases/${phaseId}/activities/`, { method: 'POST', data }),
    onSuccess: () => { qc.invalidateQueries(['wbs', projectId]); onClose() },
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-brand-slate px-6 py-4">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Activity' : 'Add Activity'}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">WBS Code</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.wbs_code} onChange={e => set('wbs_code', e.target.value)} placeholder="1.1.1" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.description} onChange={e => set('description', e.target.value)} placeholder="Activity description" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Planned Start</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.planned_start} onChange={e => set('planned_start', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Planned End</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.planned_end} onChange={e => set('planned_end', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Responsible Person</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.responsible} onChange={e => set('responsible', e.target.value)} placeholder="Name or team" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Weight</label>
              <input type="number" min="0.1" step="0.1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.weight} onChange={e => set('weight', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.status} onChange={e => set('status', e.target.value)}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => mut.mutate(form)} disabled={!form.description || mut.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-brand-red text-white font-medium disabled:opacity-50">
            {mut.isPending ? 'Saving…' : 'Save Activity'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProgressModal({ projectId, phaseId, activity, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    percent_complete: activity.percent_complete || '0',
    notes: '',
  })

  const mut = useMutation({
    mutationFn: (data) => api(
      `/${projectId}/phases/${phaseId}/activities/${activity.id}/progress/`,
      { method: 'POST', data }
    ),
    onSuccess: () => { qc.invalidateQueries(['wbs', projectId]); onClose() },
  })

  const pct = parseFloat(form.percent_complete) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-brand-slate px-6 py-4">
          <h2 className="text-base font-semibold text-white">Update Progress</h2>
          <p className="text-xs text-white/70 mt-0.5 truncate">{activity.wbs_code && `${activity.wbs_code} — `}{activity.description}</p>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">% Complete</label>
              <span className="text-2xl font-bold text-brand-red">{pct}%</span>
            </div>
            <input type="range" min="0" max="100" step="1" className="w-full accent-red-600"
              value={pct} onChange={e => setForm(f => ({ ...f, percent_complete: e.target.value }))} />
            <ProgressBar value={pct} className="mt-2" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="What was done today?" />
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-brand-red text-white font-medium disabled:opacity-50">
            {mut.isPending ? 'Saving…' : 'Save Progress'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Phase Row ─────────────────────────────────────────────────────────────────

function PhaseRow({ projectId, phase, defaultOpen = false }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(defaultOpen)
  const [modal, setModal] = useState(null)

  const deletePhaseMut = useMutation({
    mutationFn: () => api(`/${projectId}/phases/${phase.id}/`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries(['wbs', projectId]),
  })

  const colorClass = PHASE_COLOR_MAP[phase.color] || 'bg-blue-500'
  const pct = parseFloat(phase.percent_complete) || 0

  return (
    <>
      {modal === 'edit-phase'    && <PhaseModal projectId={projectId} phase={phase} onClose={() => setModal(null)} />}
      {modal === 'add-activity'  && <ActivityModal projectId={projectId} phaseId={phase.id} onClose={() => setModal(null)} />}

      <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
        {/* Phase header */}
        <div className="bg-white px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setOpen(o => !o)}>
          <div className={`w-3 h-3 rounded-full shrink-0 ${colorClass}`} />
          <button className="text-gray-400 hover:text-gray-600 shrink-0">
            {open ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-brand-slate truncate">{phase.name}</span>
              <span className="text-xs text-gray-400">
                {phase.completed_count}/{phase.activity_count} activities
              </span>
            </div>
            {phase.planned_start && (
              <p className="text-xs text-gray-400 mt-0.5">
                {phase.planned_start} → {phase.planned_end || '—'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2 w-32">
              <ProgressBar value={pct} className="flex-1" />
              <span className="text-xs font-semibold text-brand-slate w-10 text-right">{pct}%</span>
            </div>
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={() => setModal('add-activity')}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Add activity">
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setModal('edit-phase')}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { if (window.confirm('Delete this phase and all its activities?')) deletePhaseMut.mutate() }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Activities list */}
        {open && (
          <div className="border-t border-gray-100 divide-y divide-gray-50">
            {phase.activities?.length === 0 && (
              <div className="px-6 py-4 text-xs text-gray-400 italic">
                No activities yet. Click + to add one.
              </div>
            )}
            {phase.activities?.map(act => (
              <ActivityRow key={act.id} projectId={projectId} phaseId={phase.id} activity={act} />
            ))}
            <div className="px-6 py-2">
              <button onClick={() => setModal('add-activity')}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium py-1">
                <PlusIcon className="h-3.5 w-3.5" /> Add Activity
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Activity Row ──────────────────────────────────────────────────────────────

function ActivityRow({ projectId, phaseId, activity }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)

  const deleteActMut = useMutation({
    mutationFn: () => api(`/${projectId}/phases/${phaseId}/activities/${activity.id}/`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries(['wbs', projectId]),
  })

  const cfg = STATUS_CONFIG[activity.status] || STATUS_CONFIG.not_started
  const pct = parseFloat(activity.percent_complete) || 0

  return (
    <>
      {modal === 'edit'     && <ActivityModal projectId={projectId} phaseId={phaseId} activity={activity} onClose={() => setModal(null)} />}
      {modal === 'progress' && <ProgressModal projectId={projectId} phaseId={phaseId} activity={activity} onClose={() => setModal(null)} />}

      <div className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors group">
        <div className="w-5 flex justify-center shrink-0">
          {pct >= 100
            ? <CheckCircleSolid className="h-4 w-4 text-green-500" />
            : <div className="w-3 h-3 rounded-full border-2 border-gray-300" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {activity.wbs_code && (
              <span className="text-xs font-mono font-medium text-gray-500 shrink-0">{activity.wbs_code}</span>
            )}
            <span className="text-sm text-brand-slate truncate">{activity.description}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1">
            {activity.planned_start && (
              <span className="text-xs text-gray-400">
                {activity.planned_start} → {activity.planned_end || '—'}
              </span>
            )}
            {activity.responsible && (
              <span className="text-xs text-gray-400">👤 {activity.responsible}</span>
            )}
            {activity.latest_progress?.notes && (
              <span className="text-xs text-gray-400 truncate max-w-xs italic">
                {activity.latest_progress.notes}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 w-28">
            <ProgressBar value={pct} className="flex-1" />
            <span className="text-xs font-semibold text-brand-slate w-8 text-right">{pct}%</span>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setModal('progress')}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Update progress">
              <ArrowUpIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setModal('edit')}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { if (window.confirm('Delete this activity?')) deleteActMut.mutate() }}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WBSPage() {
  const { projectId } = useParams()
  const [showPhaseModal, setShowPhaseModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['wbs', projectId],
    queryFn: () => api(`/${projectId}/wbs/`).then(r => r.data),
    enabled: !!projectId,
  })

  const overallPct = parseFloat(data?.overall_percent_complete) || 0

  return (
    <div className="space-y-6">
      {showPhaseModal && <PhaseModal projectId={projectId} onClose={() => setShowPhaseModal(false)} />}

      {/* Summary bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-brand-slate">Work Breakdown Structure</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {data?.phase_count || 0} phases · {data?.activity_count || 0} activities ·{' '}
              {data?.completed_activities || 0} completed · {data?.in_progress_activities || 0} in progress
            </p>
          </div>
          <button onClick={() => setShowPhaseModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
            <PlusIcon className="h-4 w-4" /> Add Phase
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Overall Progress</span>
              <span className="font-semibold text-brand-slate">{overallPct}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${overallPct >= 100 ? 'bg-green-500' : 'bg-brand-red'}`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Phases */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.phases?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">🏗️</div>
          <p className="font-semibold text-gray-700">No phases yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first phase to start building the WBS</p>
          <button onClick={() => setShowPhaseModal(true)}
            className="mt-4 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium">
            Add First Phase
          </button>
        </div>
      ) : (
        <div>
          {data?.phases?.map((phase, i) => (
            <PhaseRow key={phase.id} projectId={projectId} phase={phase} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  )
}
