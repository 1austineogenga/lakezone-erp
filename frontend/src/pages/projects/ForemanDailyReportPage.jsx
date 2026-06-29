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
  getForemanDailyReports,
  createForemanDailyReport,
  getForemanDailyReport,
  updateForemanDailyReport,
} from '../../api/reports'
import usePermissions from '../../hooks/usePermissions'
import useAuthStore from '../../store/authStore'

// ─── tiny shared primitives ────────────────────────────────────────────────

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

// ─── blank row factories ────────────────────────────────────────────────────

const blankPlant = () => ({ plant: '', id_unit: '', qty: '', status: '', remarks: '' })
const blankWork  = () => ({ no: '', location: '', description: '', unit_qty: '', remarks: '' })

const defaultFormState = (user) => ({
  header: {
    project_name: '', contract_no: '', location: '',
    date: new Date().toISOString().split('T')[0],
    day: '', weather: '',
  },
  labour: {
    skilled: '', semi_skilled: '', unskilled: '', operators: '',
    supervisors: '', visitors: '', total_workforce: '', shift_hours: '',
  },
  plants: Array.from({ length: 7 }, blankPlant),
  works:  Array.from({ length: 6 }, blankWork),
  notes: { instructions: '', delays: '', safety: '', next_day: '' },
  sigs: { prepared_by: user?.full_name || user?.username || '', checked_by: '' },
})

function formToPayload(form) {
  return {
    project_name:  form.header.project_name,
    contract_no:   form.header.contract_no,
    location:      form.header.location,
    date:          form.header.date,
    day:           form.header.day,
    weather:       form.header.weather,
    labour:        form.labour,
    plants:        form.plants,
    works:         form.works,
    instructions:  form.notes.instructions,
    delays:        form.notes.delays,
    safety_remarks: form.notes.safety,
    next_day_plan: form.notes.next_day,
    prepared_by:   form.sigs.prepared_by,
    checked_by:    form.sigs.checked_by,
  }
}

function reportToForm(r, user) {
  return {
    header: {
      project_name: r.project_name || '',
      contract_no:  r.contract_no  || '',
      location:     r.location     || '',
      date:         r.date         || '',
      day:          r.day          || '',
      weather:      r.weather      || '',
    },
    labour: r.labour || {
      skilled: '', semi_skilled: '', unskilled: '', operators: '',
      supervisors: '', visitors: '', total_workforce: '', shift_hours: '',
    },
    plants: r.plants?.length ? r.plants : Array.from({ length: 7 }, blankPlant),
    works:  r.works?.length  ? r.works  : Array.from({ length: 6 }, blankWork),
    notes: {
      instructions: r.instructions   || '',
      delays:       r.delays         || '',
      safety:       r.safety_remarks || '',
      next_day:     r.next_day_plan  || '',
    },
    sigs: {
      prepared_by: r.prepared_by || user?.full_name || user?.username || '',
      checked_by:  r.checked_by  || '',
    },
  }
}

// ─── main page ─────────────────────────────────────────────────────────────

export default function ForemanDailyReportPage() {
  const qc = useQueryClient()
  const { role } = usePermissions()
  const { user } = useAuthStore()

  const isForeman = role === 'site_foreman'

  // filters
  const [dateFilter,    setDateFilter]    = useState('')
  const [projectFilter, setProjectFilter] = useState('')

  // modal state
  const [modalOpen,     setModalOpen]     = useState(false)
  const [selectedId,    setSelectedId]    = useState(null) // null = new report
  const [form,          setForm]          = useState(() => defaultFormState(user))

  // ── fetch list ──────────────────────────────────────────────────────────
  const { data: listData, isLoading } = useQuery({
    queryKey: ['foreman-daily-reports', dateFilter, projectFilter],
    queryFn:  () => getForemanDailyReports({
      ...(dateFilter    ? { date: dateFilter }               : {}),
      ...(projectFilter ? { project_name: projectFilter }    : {}),
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const reports = listData?.results ?? listData ?? []

  // ── fetch single (when editing) ─────────────────────────────────────────
  const { isFetching: loadingReport } = useQuery({
    queryKey: ['foreman-daily-report', selectedId],
    queryFn:  () => getForemanDailyReport(selectedId).then(r => r.data),
    enabled:  !!selectedId,
    onSuccess: (data) => setForm(reportToForm(data, user)),
  })

  // ── create ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload) => createForemanDailyReport(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foreman-daily-reports'] })
      toast.success('Report submitted successfully.')
      closeModal()
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to submit report.'
      toast.error(msg)
    },
  })

  // ── update ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateForemanDailyReport(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foreman-daily-reports'] })
      qc.invalidateQueries({ queryKey: ['foreman-daily-report', selectedId] })
      toast.success('Report updated successfully.')
      closeModal()
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update report.'
      toast.error(msg)
    },
  })

  // ── helpers ─────────────────────────────────────────────────────────────
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

  // derive lock state
  const selectedReport = reports.find(r => r.id === selectedId)
  const isLocked = selectedId
    ? (selectedReport?.is_editable === false || !isForeman)
    : false

  // ── form field updaters ─────────────────────────────────────────────────
  const h = useCallback((key) => (val) => setForm(f => ({ ...f, header: { ...f.header, [key]: val } })), [])
  const l = useCallback((key) => (val) => setForm(f => ({ ...f, labour: { ...f.labour, [key]: val } })), [])
  const n = useCallback((key) => (val) => setForm(f => ({ ...f, notes:  { ...f.notes,  [key]: val } })), [])

  const setPlant = (i, key, val) => setForm(f => ({
    ...f,
    plants: f.plants.map((r, j) => j === i ? { ...r, [key]: val } : r),
  }))
  const setWork = (i, key, val) => setForm(f => ({
    ...f,
    works: f.works.map((r, j) => j === i ? { ...r, [key]: val } : r),
  }))
  const addPlantRow    = () => setForm(f => ({ ...f, plants: [...f.plants, blankPlant()] }))
  const removePlantRow = (i) => setForm(f => ({ ...f, plants: f.plants.filter((_, j) => j !== i) }))
  const addWorkRow     = () => setForm(f => ({ ...f, works:  [...f.works,  blankWork()] }))
  const removeWorkRow  = (i) => setForm(f => ({ ...f, works:  f.works.filter((_, j)  => j !== i) }))

  function handleSubmit() {
    const payload = formToPayload(form)
    if (selectedId) {
      updateMutation.mutate({ id: selectedId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handlePrint() {
    window.print()
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const inputCls = (disabled) =>
    `border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40${disabled ? ' bg-gray-50 text-gray-400' : ''}`

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-12">
      {/* ── top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <h1 className="text-sm font-bold text-brand-slate">Foreman Daily Report</h1>

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
          {/* new report — site_foreman only */}
          {isForeman && (
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

      {/* ── history list ── */}
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
                  {['Date', 'Project', 'Location', 'Submitted by', 'Submitted at', 'Status'].map(col => (
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
                    <td className="px-4 py-2.5 text-gray-500">{r.location || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.submitted_by_name || r.submitted_by || '—'}</td>
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

      {/* ── modal overlay ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-6 px-2 no-print">
          {/* modal panel */}
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl print:shadow-none print:rounded-none print:max-w-none print:w-full">

            {/* modal chrome — hidden when printing */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 no-print">
              <h2 className="text-sm font-bold text-brand-slate">
                {selectedId ? 'Foreman Daily Report' : 'New Foreman Daily Report'}
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

                {/* ── Report Header ── */}
                <Section title="Report Header">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Field label="Project Name"     value={form.header.project_name} onChange={h('project_name')} disabled={isLocked} />
                    <Field label="Contract No."     value={form.header.contract_no}  onChange={h('contract_no')}  disabled={isLocked} />
                    <Field label="Location/Section" value={form.header.location}     onChange={h('location')}     disabled={isLocked} />
                    <Field label="Date"             value={form.header.date}         onChange={h('date')}         disabled={isLocked} type="date" />
                    <Field label="Day"              value={form.header.day}          onChange={h('day')}          disabled={isLocked} />
                    <Field label="Weather"          value={form.header.weather}      onChange={h('weather')}      disabled={isLocked} />
                  </div>
                </Section>

                {/* ── Section A Labour ── */}
                <Section title="A. Labour on Site">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Field label="Skilled Labour"       value={form.labour.skilled}         onChange={l('skilled')}         disabled={isLocked} />
                    <Field label="Semi-skilled Labour"  value={form.labour.semi_skilled}    onChange={l('semi_skilled')}    disabled={isLocked} />
                    <Field label="Unskilled Labour"     value={form.labour.unskilled}       onChange={l('unskilled')}       disabled={isLocked} />
                    <Field label="Operators"            value={form.labour.operators}       onChange={l('operators')}       disabled={isLocked} />
                    <Field label="Supervisors"          value={form.labour.supervisors}     onChange={l('supervisors')}     disabled={isLocked} />
                    <Field label="Visitors"             value={form.labour.visitors}        onChange={l('visitors')}        disabled={isLocked} />
                    <Field label="Total Workforce"      value={form.labour.total_workforce} onChange={l('total_workforce')} disabled={isLocked} />
                    <Field label="Shift / Hours Worked" value={form.labour.shift_hours}     onChange={l('shift_hours')}     disabled={isLocked} />
                  </div>
                </Section>

                {/* ── Section B Plant/Equipment ── */}
                <Section title="B. Plant / Equipment and Materials">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Plant/Material', 'ID/Unit', 'Qty', 'Status', 'Remarks', ...(isLocked ? [] : [''])].map((col, ci) => (
                            <th key={ci} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.plants.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2 py-1"><input value={row.plant}   onChange={e => setPlant(i, 'plant',   e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1"><input value={row.id_unit} onChange={e => setPlant(i, 'id_unit', e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1"><input value={row.qty}     onChange={e => setPlant(i, 'qty',     e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1"><input value={row.status}  onChange={e => setPlant(i, 'status',  e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1"><input value={row.remarks} onChange={e => setPlant(i, 'remarks', e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            {!isLocked && (
                              <td className="px-2 py-1 w-6">
                                <button
                                  onClick={() => removePlantRow(i)}
                                  className="text-gray-300 hover:text-brand-red transition-colors"
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
                    <button onClick={addPlantRow} className="mt-2 text-xs text-brand-red hover:underline">
                      + Add row
                    </button>
                  )}
                </Section>

                {/* ── Section C Work Activities ── */}
                <Section title="C. Work Activities Executed">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {['No.', 'Location/Chainage', 'Description of Work', 'Unit/Qty', 'Remarks', ...(isLocked ? [] : [''])].map((col, ci) => (
                            <th key={ci} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.works.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2 py-1 w-10"><input value={row.no}          onChange={e => setWork(i, 'no',          e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1">    <input value={row.location}    onChange={e => setWork(i, 'location',    e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1">    <input value={row.description} onChange={e => setWork(i, 'description', e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1 w-20"><input value={row.unit_qty}   onChange={e => setWork(i, 'unit_qty',   e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            <td className="px-2 py-1">    <input value={row.remarks}     onChange={e => setWork(i, 'remarks',     e.target.value)} disabled={isLocked} className={inputCls(isLocked)} /></td>
                            {!isLocked && (
                              <td className="px-2 py-1 w-6">
                                <button
                                  onClick={() => removeWorkRow(i)}
                                  className="text-gray-300 hover:text-brand-red transition-colors"
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
                    <button onClick={addWorkRow} className="mt-2 text-xs text-brand-red hover:underline">
                      + Add row
                    </button>
                  )}
                </Section>

                {/* ── Section D Notes ── */}
                <Section title="D. Instructions, Issues and Next Plan">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Textarea label="Instructions received (Verbal or Written)" value={form.notes.instructions} onChange={n('instructions')} disabled={isLocked} />
                    <Textarea label="Delays / challenges"                        value={form.notes.delays}       onChange={n('delays')}       disabled={isLocked} />
                    <Textarea label="Safety / quality / environment remarks"     value={form.notes.safety}       onChange={n('safety')}       disabled={isLocked} />
                    <Textarea label="Planned activities for next day"            value={form.notes.next_day}     onChange={n('next_day')}     disabled={isLocked} />
                  </div>
                </Section>

                {/* ── Signatures ── */}
                <Section title="Signatures">
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Prepared by (Foreman)"
                      value={form.sigs.prepared_by}
                      onChange={v => setForm(f => ({ ...f, sigs: { ...f.sigs, prepared_by: v } }))}
                      disabled
                    />
                    <Field
                      label="Checked by (Site Agent / Engineer)"
                      value={form.sigs.checked_by}
                      onChange={v => setForm(f => ({ ...f, sigs: { ...f.sigs, checked_by: v } }))}
                      disabled={isLocked}
                    />
                  </div>
                </Section>

                {/* ── form footer ── */}
                <div className="flex items-center justify-between pt-1 no-print">
                  <button
                    onClick={handlePrint}
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

      {/* ── print-only full report (replaces modal chrome) ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  )
}
