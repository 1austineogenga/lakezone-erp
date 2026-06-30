import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  PlusIcon,
  PrinterIcon,
  XMarkIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import {
  getSurveyorDailyReports,
  createSurveyorDailyReport,
  getSurveyorDailyReport,
  updateSurveyorDailyReport,
} from '../../api/reports'
import usePermissions from '../../hooks/usePermissions'
import useAuthStore from '../../store/authStore'

// ─── shared primitives ────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = 'text', disabled = false, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange && onChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30 disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  )
}

function Textarea({ label, value, onChange, rows = 3, disabled = false }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange && onChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h3 className="text-xs font-bold text-brand-slate">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function StatusBadge({ isEditable }) {
  return isEditable ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
      Editable
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
      <LockClosedIcon className="w-2.5 h-2.5" />
      Locked
    </span>
  )
}

// ─── blank row factories ───────────────────────────────────────────────────────

const blankActivity     = () => ({ no: '', location: '', activity: '', output: '', remarks: '' })
const blankControlPoint = () => ({ point_id: '', easting: '', northing: '', level: '', status: '' })

// ─── default / serialise / deserialise ────────────────────────────────────────

const defaultFormState = (user) => ({
  header: {
    project_name: '',
    contract_no: '',
    date: new Date().toISOString().split('T')[0],
    day: '',
    location: '',
    weather: '',
  },
  team: {
    surveyor: user?.full_name || user?.username || '',
    rtk_gps: '',
    auto_dumpy_level: '',
    vehicle_access: '',
    assistant: '',
    total_station: '',
    staff_prism: '',
    battery_calibration: '',
  },
  activities:     Array.from({ length: 8 }, blankActivity),
  control_points: Array.from({ length: 4 }, blankControlPoint),
  notes: {
    issues: '',
    instructions: '',
    next_day: '',
  },
  sigs: {
    prepared_by: user?.full_name || user?.username || '',
    checked_by: '',
  },
})

function formToPayload(form) {
  return {
    project_name:        form.header.project_name,
    contract_no:         form.header.contract_no,
    date:                form.header.date,
    day:                 form.header.day,
    location:            form.header.location,
    weather:             form.header.weather,
    team:                form.team,
    activities:          form.activities,
    control_points:      form.control_points,
    issues_encountered:  form.notes.issues,
    instructions_received_issued: form.notes.instructions,
    planned_activities_for_next_day: form.notes.next_day,
    prepared_by:         form.sigs.prepared_by,
    checked_by:          form.sigs.checked_by,
  }
}

function reportToForm(r, user) {
  return {
    header: {
      project_name: r.project_name || '',
      contract_no:  r.contract_no  || '',
      date:         r.date         || '',
      day:          r.day          || '',
      location:     r.location     || '',
      weather:      r.weather      || '',
    },
    team: r.team || {
      surveyor: user?.full_name || user?.username || '',
      rtk_gps: '',
      auto_dumpy_level: '',
      vehicle_access: '',
      assistant: '',
      total_station: '',
      staff_prism: '',
      battery_calibration: '',
    },
    activities:     r.activities?.length     ? r.activities     : Array.from({ length: 8 }, blankActivity),
    control_points: r.control_points?.length ? r.control_points : Array.from({ length: 4 }, blankControlPoint),
    notes: {
      issues:       r.issues_encountered                  || '',
      instructions: r.instructions_received_issued         || '',
      next_day:     r.planned_activities_for_next_day      || '',
    },
    sigs: {
      prepared_by: r.prepared_by || user?.full_name || user?.username || '',
      checked_by:  r.checked_by  || '',
    },
  }
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SurveyorDailyReportPage() {
  const qc = useQueryClient()
  const { role } = usePermissions()
  const { user } = useAuthStore()

  const isSurveyor = role === 'site_surveyor' || role === 'system_admin'

  // filters
  const [dateFilter,    setDateFilter]    = useState('')
  const [projectFilter, setProjectFilter] = useState('')

  // modal state
  const [modalOpen,  setModalOpen]  = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [form,       setForm]       = useState(() => defaultFormState(user))

  // ── fetch list ──────────────────────────────────────────────────────────────
  const { data: listData, isLoading } = useQuery({
    queryKey: ['surveyor-daily-reports', dateFilter, projectFilter],
    queryFn: () => getSurveyorDailyReports({
      ...(dateFilter    ? { date: dateFilter }            : {}),
      ...(projectFilter ? { project_name: projectFilter } : {}),
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const reports = listData?.results ?? listData ?? []

  // ── fetch single (when editing) ─────────────────────────────────────────────
  const { isFetching: loadingReport } = useQuery({
    queryKey: ['surveyor-daily-report', selectedId],
    queryFn:  () => getSurveyorDailyReport(selectedId).then(r => r.data),
    enabled:  !!selectedId,
    onSuccess: (data) => setForm(reportToForm(data, user)),
  })

  // ── create ──────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload) => createSurveyorDailyReport(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveyor-daily-reports'] })
      toast.success('Report submitted successfully.')
      closeModal()
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to submit report.'
      toast.error(msg)
    },
  })

  // ── update ──────────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateSurveyorDailyReport(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveyor-daily-reports'] })
      qc.invalidateQueries({ queryKey: ['surveyor-daily-report', selectedId] })
      toast.success('Report updated successfully.')
      closeModal()
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update report.'
      toast.error(msg)
    },
  })

  // ── helpers ──────────────────────────────────────────────────────────────────
  function openNew() {
    setSelectedId(null)
    setForm(defaultFormState(user))
    setModalOpen(true)
  }

  function openExisting(report) {
    setSelectedId(report.id)
    setForm(reportToForm(report, user))
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setSelectedId(null)
  }

  // lock logic
  const selectedReport = reports.find(r => r.id === selectedId)
  const isLocked = selectedId
    ? (selectedReport?.is_editable === false || !isSurveyor)
    : false

  // ── form field updaters ──────────────────────────────────────────────────────
  const h = useCallback((key) => (val) => setForm(f => ({ ...f, header: { ...f.header, [key]: val } })), [])
  const t = useCallback((key) => (val) => setForm(f => ({ ...f, team:   { ...f.team,   [key]: val } })), [])
  const n = useCallback((key) => (val) => setForm(f => ({ ...f, notes:  { ...f.notes,  [key]: val } })), [])

  const setActivity = (i, key, val) => setForm(f => ({
    ...f,
    activities: f.activities.map((r, j) => j === i ? { ...r, [key]: val } : r),
  }))
  const setControl = (i, key, val) => setForm(f => ({
    ...f,
    control_points: f.control_points.map((r, j) => j === i ? { ...r, [key]: val } : r),
  }))

  const addActivityRow    = () => setForm(f => ({ ...f, activities:     [...f.activities,     blankActivity()] }))
  const removeActivityRow = (i) => setForm(f => ({ ...f, activities:     f.activities.filter((_, j) => j !== i) }))
  const addControlRow     = () => setForm(f => ({ ...f, control_points: [...f.control_points, blankControlPoint()] }))
  const removeControlRow  = (i) => setForm(f => ({ ...f, control_points: f.control_points.filter((_, j) => j !== i) }))

  function handleSubmit() {
    const payload = formToPayload(form)
    if (selectedId) {
      updateMutation.mutate({ id: selectedId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const inputCls = (disabled) =>
    `border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40${disabled ? ' bg-gray-50 text-gray-400' : ''}`

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-12">
      {/* top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <h1 className="text-sm font-bold text-brand-slate">Surveyor Daily Report</h1>

        <div className="flex items-center gap-2 flex-wrap">
          {/* date filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30"
          />
          {/* project name search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search project…"
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="border border-gray-200 rounded-lg pl-7 pr-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </div>
          {/* new report — site_surveyor only */}
          {isSurveyor && (
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-semibold rounded-lg hover:bg-brand-red/90 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              New Report
            </button>
          )}
        </div>
      </div>

      {/* history table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden no-print">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-gray-400">Loading reports…</div>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">No reports found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Date', 'Project', 'Surveyor', 'Location', 'Submitted at', 'Status'].map(col => (
                    <th key={col} className="text-left text-[10px] font-semibold text-gray-500 px-4 py-2.5">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => openExisting(r)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5">{r.date || '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-brand-slate">{r.project_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.submitted_by_name || r.submitted_by || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.location || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge isEditable={r.is_editable} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* modal overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-6 px-2 no-print">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl print:shadow-none print:rounded-none print:max-w-none print:w-full">

            {/* modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 no-print">
              <h2 className="text-sm font-bold text-brand-slate">
                {selectedId ? 'Surveyor Daily Report' : 'New Surveyor Daily Report'}
              </h2>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* locked banner */}
            {isLocked && (
              <div className="flex items-center gap-2 mx-5 mt-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 no-print">
                <LockClosedIcon className="w-3.5 h-3.5 shrink-0" />
                Locked — read only. This report can no longer be edited.
              </div>
            )}

            {loadingReport ? (
              <div className="py-16 text-center text-xs text-gray-400">Loading…</div>
            ) : (
              <div className="p-5 space-y-5">

                {/* Report Header */}
                <Section title="Report Header">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Field label="Project Name"       value={form.header.project_name} onChange={h('project_name')} disabled={isLocked} />
                    <Field label="Date"               value={form.header.date}         onChange={h('date')}         disabled={isLocked} type="date" />
                    <Field label="Contract No."       value={form.header.contract_no}  onChange={h('contract_no')}  disabled={isLocked} />
                    <Field label="Day"                value={form.header.day}          onChange={h('day')}          disabled={isLocked} />
                    <Field label="Location / Section" value={form.header.location}     onChange={h('location')}     disabled={isLocked} />
                    <Field label="Weather"            value={form.header.weather}      onChange={h('weather')}      disabled={isLocked} />
                  </div>
                </Section>

                {/* Section A: Team attendance and equipment */}
                <Section title="A. Team Attendance and Equipment">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {/* left column */}
                    <div className="space-y-3">
                      <Field label="Surveyor"           value={form.team.surveyor}        onChange={t('surveyor')}        disabled />
                      <Field label="RTK / GPS"          value={form.team.rtk_gps}         onChange={t('rtk_gps')}         disabled={isLocked} />
                      <Field label="Auto / Dumpy Level" value={form.team.auto_dumpy_level} onChange={t('auto_dumpy_level')} disabled={isLocked} />
                      <Field label="Vehicle / Access"   value={form.team.vehicle_access}  onChange={t('vehicle_access')}  disabled={isLocked} />
                    </div>
                    {/* right column */}
                    <div className="space-y-3">
                      <Field label="Assistant"              value={form.team.assistant}           onChange={t('assistant')}           disabled={isLocked} />
                      <Field label="Total Station"          value={form.team.total_station}       onChange={t('total_station')}       disabled={isLocked} />
                      <Field label="Staff / Prism"          value={form.team.staff_prism}         onChange={t('staff_prism')}         disabled={isLocked} />
                      <Field label="Battery / Calibration"  value={form.team.battery_calibration} onChange={t('battery_calibration')} disabled={isLocked} />
                    </div>
                  </div>
                </Section>

                {/* Section B: Survey activities completed */}
                <Section title="B. Survey Activities Completed">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {['No.', 'Location / Chainage', 'Activity', 'Output / Reference', 'Remarks', ...(isLocked ? [] : [''])].map((col, ci) => (
                            <th key={ci} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.activities.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2 py-1 w-10"><input value={row.no}       onChange={e => setActivity(i, 'no',       e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1">     <input value={row.location} onChange={e => setActivity(i, 'location', e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1">     <input value={row.activity} onChange={e => setActivity(i, 'activity', e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1">     <input value={row.output}   onChange={e => setActivity(i, 'output',   e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1">     <input value={row.remarks}  onChange={e => setActivity(i, 'remarks',  e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            {!isLocked && (
                              <td className="px-2 py-1 w-6">
                                <button
                                  onClick={() => removeActivityRow(i)}
                                  className="text-gray-500 hover:text-brand-red transition-colors"
                                  title="Remove row"
                                >
                                  <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!isLocked && (
                    <button onClick={addActivityRow} className="mt-2 text-xs text-brand-red hover:underline">
                      + Add row
                    </button>
                  )}
                </Section>

                {/* Section C: Control points / levels checked */}
                <Section title="C. Control Points / Levels Checked">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Point ID', 'Easting', 'Northing', 'Level', 'Status / Observation', ...(isLocked ? [] : [''])].map((col, ci) => (
                            <th key={ci} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.control_points.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2 py-1"><input value={row.point_id} onChange={e => setControl(i, 'point_id', e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1"><input value={row.easting}  onChange={e => setControl(i, 'easting',  e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1"><input value={row.northing} onChange={e => setControl(i, 'northing', e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1"><input value={row.level}    onChange={e => setControl(i, 'level',    e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1"><input value={row.status}   onChange={e => setControl(i, 'status',   e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            {!isLocked && (
                              <td className="px-2 py-1 w-6">
                                <button
                                  onClick={() => removeControlRow(i)}
                                  className="text-gray-500 hover:text-brand-red transition-colors"
                                  title="Remove row"
                                >
                                  <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!isLocked && (
                    <button onClick={addControlRow} className="mt-2 text-xs text-brand-red hover:underline">
                      + Add row
                    </button>
                  )}
                </Section>

                {/* Section D: Issues, Instructions, Next Plan */}
                <Section title="D. Issues, Instructions and Next Plan">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Textarea label="Issues Encountered"              value={form.notes.issues}        onChange={n('issues')}        disabled={isLocked} rows={4} />
                    <Textarea label="Instructions Received / Issued"  value={form.notes.instructions}  onChange={n('instructions')}  disabled={isLocked} rows={4} />
                    <Textarea label="Planned Activities for Next Day" value={form.notes.next_day}       onChange={n('next_day')}       disabled={isLocked} rows={4} />
                  </div>
                </Section>

                {/* Signatures / Footer */}
                <Section title="Signatures">
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Prepared by (Surveyor)"
                      value={form.sigs.prepared_by}
                      onChange={v => setForm(f => ({ ...f, sigs: { ...f.sigs, prepared_by: v } }))}
                      disabled
                    />
                    <Field
                      label="Checked by"
                      value={form.sigs.checked_by}
                      onChange={v => setForm(f => ({ ...f, sigs: { ...f.sigs, checked_by: v } }))}
                      disabled={isLocked}
                    />
                  </div>
                </Section>

                {/* form footer */}
                <div className="flex items-center justify-between pt-1 no-print">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <PrinterIcon className="w-3.5 h-3.5" />
                    Print
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {isLocked ? 'Close' : 'Cancel'}
                    </button>
                    {!isLocked && (
                      <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-1.5 bg-brand-red text-white text-xs font-semibold rounded-lg hover:bg-brand-red/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isSaving ? 'Saving…' : selectedId ? 'Save changes' : 'Submit report'}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  )
}
