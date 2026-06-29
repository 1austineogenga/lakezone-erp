import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
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
  getMachineDailyReports,
  createMachineDailyReport,
  getMachineDailyReport,
  updateMachineDailyReport,
} from '../../api/reports'
import { getVehicle } from '../../api/fleet'
import usePermissions from '../../hooks/usePermissions'
import useAuthStore from '../../store/authStore'

// ─── constants ─────────────────────────────────────────────────────────────

const MAINT_ITEMS = [
  'Engine oil level',
  'Coolant level',
  'Tyre/track condition',
  'Lights & indicators',
  'Brakes',
  'Hydraulic system',
]

const MAINT_STATUSES = ['OK', 'Low', 'Faulty']

// ─── tiny shared primitives ─────────────────────────────────────────────────

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

const blankWork = () => ({ no: '', location: '', description: '', unit_qty: '', remarks: '' })
const blankBreak = () => ({ description: '', time_down: '', action_taken: '', resumed: '' })

const initMaint = () =>
  MAINT_ITEMS.map(item => ({ item, status: '', remarks: '' }))

const defaultFormState = (user, vehicle) => ({
  header: {
    project_name: '',
    date: new Date().toISOString().split('T')[0],
    contract_no: '',
    day: '',
    location: '',
    weather: '',
  },
  machine: {
    machine_name: vehicle?.vehicle_name || '',
    machine_id: vehicle?.vehicle_no || '',
    machine_type: vehicle?.vehicle_type || '',
    operator_name: user?.full_name || user?.username || '',
    fuel_type: '',
    operator_licence_no: user?.licence_no || '',
  },
  hours: {
    start_time: '',
    end_time: '',
    hrs_worked: '',
    hrs_idle_breakdown: '',
    total_hrs_on_site: '',
  },
  fuel: {
    opening_meter: '',
    closing_meter: '',
    fuel_added: '',
    oil_fluids_added: '',
    fuel_balance: '',
  },
  works: Array.from({ length: 5 }, blankWork),
  maintenance: initMaint(),
  breakdowns: Array.from({ length: 3 }, blankBreak),
  notes: {
    instructions: '',
    delays: '',
    safety: '',
    next_day: '',
  },
  sigs: {
    prepared_by: user?.full_name || user?.username || '',
    checked_by: '',
  },
})

function formToPayload(form) {
  return {
    project_name: form.header.project_name,
    date: form.header.date,
    contract_no: form.header.contract_no,
    day: form.header.day,
    location: form.header.location,
    weather: form.header.weather,
    machine_name: form.machine.machine_name,
    machine_id: form.machine.machine_id,
    machine_type: form.machine.machine_type,
    operator_name: form.machine.operator_name,
    fuel_type: form.machine.fuel_type,
    operator_licence_no: form.machine.operator_licence_no,
    hours: form.hours,
    fuel: form.fuel,
    works: form.works,
    maintenance: form.maintenance,
    breakdowns: form.breakdowns,
    instructions: form.notes.instructions,
    delays: form.notes.delays,
    safety_remarks: form.notes.safety,
    next_day_plan: form.notes.next_day,
    prepared_by: form.sigs.prepared_by,
    checked_by: form.sigs.checked_by,
  }
}

function reportToForm(r, user) {
  return {
    header: {
      project_name: r.project_name || '',
      date: r.date || '',
      contract_no: r.contract_no || '',
      day: r.day || '',
      location: r.location || '',
      weather: r.weather || '',
    },
    machine: {
      machine_name: r.machine_name || '',
      machine_id: r.machine_id || '',
      machine_type: r.machine_type || '',
      operator_name: r.operator_name || '',
      fuel_type: r.fuel_type || '',
      operator_licence_no: r.operator_licence_no || '',
    },
    hours: r.hours || {
      start_time: '',
      end_time: '',
      hrs_worked: '',
      hrs_idle_breakdown: '',
      total_hrs_on_site: '',
    },
    fuel: r.fuel || {
      opening_meter: '',
      closing_meter: '',
      fuel_added: '',
      oil_fluids_added: '',
      fuel_balance: '',
    },
    works: r.works?.length ? r.works : Array.from({ length: 5 }, blankWork),
    maintenance: r.maintenance?.length ? r.maintenance : initMaint(),
    breakdowns: r.breakdowns?.length ? r.breakdowns : Array.from({ length: 3 }, blankBreak),
    notes: {
      instructions: r.instructions || '',
      delays: r.delays || '',
      safety: r.safety_remarks || '',
      next_day: r.next_day_plan || '',
    },
    sigs: {
      prepared_by: r.prepared_by || user?.full_name || user?.username || '',
      checked_by: r.checked_by || '',
    },
  }
}

// ─── main page ─────────────────────────────────────────────────────────────

export default function MachineDailyReportPage() {
  // vehicleId is present when navigated from a vehicle detail page
  const { id: vehicleId } = useParams()
  const qc = useQueryClient()
  const { role } = usePermissions()
  const { user } = useAuthStore()

  const canWrite = ['equipment_operator', 'driver'].includes(role)

  // ── pre-fill vehicle if opened from vehicle detail ──────────────────────
  const { data: vehicle } = useQuery({
    queryKey: ['fleet-vehicle', vehicleId],
    queryFn: () => getVehicle(vehicleId).then(r => r.data),
    enabled: !!vehicleId,
  })

  // ── filters ─────────────────────────────────────────────────────────────
  const [dateFilter,    setDateFilter]    = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [machineFilter, setMachineFilter] = useState('')

  // ── modal state ──────────────────────────────────────────────────────────
  const [modalOpen,  setModalOpen]  = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [form,       setForm]       = useState(() => defaultFormState(user, null))

  // ── fetch list ───────────────────────────────────────────────────────────
  const { data: listData, isLoading } = useQuery({
    queryKey: ['machine-daily-reports', dateFilter, projectFilter, machineFilter, vehicleId],
    queryFn: () => getMachineDailyReports({
      ...(dateFilter    ? { date: dateFilter }               : {}),
      ...(projectFilter ? { project_name: projectFilter }    : {}),
      ...(machineFilter ? { machine_id: machineFilter }      : {}),
      ...(vehicleId     ? { machine_id: vehicle?.vehicle_no } : {}),
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const reports = listData?.results ?? listData ?? []

  // ── fetch single (editing) ───────────────────────────────────────────────
  const { isFetching: loadingReport } = useQuery({
    queryKey: ['machine-daily-report', selectedId],
    queryFn: () => getMachineDailyReport(selectedId).then(r => r.data),
    enabled: !!selectedId,
    onSuccess: (data) => setForm(reportToForm(data, user)),
  })

  // ── create ───────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload) => createMachineDailyReport(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machine-daily-reports'] })
      toast.success('Report submitted successfully.')
      closeModal()
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to submit report.'
      toast.error(msg)
    },
  })

  // ── update ───────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateMachineDailyReport(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machine-daily-reports'] })
      qc.invalidateQueries({ queryKey: ['machine-daily-report', selectedId] })
      toast.success('Report updated successfully.')
      closeModal()
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update report.'
      toast.error(msg)
    },
  })

  // ── helpers ──────────────────────────────────────────────────────────────
  function openNew() {
    setSelectedId(null)
    setForm(defaultFormState(user, vehicle ?? null))
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

  // derive lock state — locked if report exists and is not editable, or if user cannot write
  const selectedReport = reports.find(r => r.id === selectedId)
  const isLocked = selectedId
    ? (selectedReport?.is_editable === false || !canWrite)
    : false

  // ── form field updaters ──────────────────────────────────────────────────
  const h = useCallback((key) => (val) => setForm(f => ({ ...f, header: { ...f.header, [key]: val } })), [])
  const m = useCallback((key) => (val) => setForm(f => ({ ...f, machine: { ...f.machine, [key]: val } })), [])
  const n = useCallback((key) => (val) => setForm(f => ({ ...f, notes: { ...f.notes, [key]: val } })), [])

  // hours with auto-calc total
  function setHours(key, val) {
    setForm(f => {
      const updated = { ...f.hours, [key]: val }
      // auto-calc total hrs on site = hrs_worked + hrs_idle_breakdown
      const worked = parseFloat(updated.hrs_worked) || 0
      const idle = parseFloat(updated.hrs_idle_breakdown) || 0
      if (key === 'hrs_worked' || key === 'hrs_idle_breakdown') {
        updated.total_hrs_on_site = (worked + idle) > 0 ? String(worked + idle) : ''
      }
      return { ...f, hours: updated }
    })
  }

  // fuel with auto-calc balance
  function setFuel(key, val) {
    setForm(f => {
      const updated = { ...f.fuel, [key]: val }
      // fuel balance = opening_meter + fuel_added - closing_meter (volume-based approximation)
      const opening = parseFloat(updated.opening_meter) || 0
      const added = parseFloat(updated.fuel_added) || 0
      const closing = parseFloat(updated.closing_meter) || 0
      if (['opening_meter', 'fuel_added', 'closing_meter'].includes(key)) {
        updated.fuel_balance = (opening + added - closing) > 0 ? String((opening + added - closing).toFixed(2)) : ''
      }
      return { ...f, fuel: updated }
    })
  }

  // work rows
  const setWork = (i, key, val) => setForm(f => ({
    ...f,
    works: f.works.map((r, j) => j === i ? { ...r, [key]: val } : r),
  }))
  const addWorkRow    = () => setForm(f => ({ ...f, works: [...f.works, blankWork()] }))
  const removeWorkRow = (i) => setForm(f => ({ ...f, works: f.works.filter((_, j) => j !== i) }))

  // maintenance rows
  const setMaint = (i, key, val) => setForm(f => ({
    ...f,
    maintenance: f.maintenance.map((r, j) => j === i ? { ...r, [key]: val } : r),
  }))

  // breakdown rows
  const setBreak    = (i, key, val) => setForm(f => ({
    ...f,
    breakdowns: f.breakdowns.map((r, j) => j === i ? { ...r, [key]: val } : r),
  }))
  const addBreakRow    = () => setForm(f => ({ ...f, breakdowns: [...f.breakdowns, blankBreak()] }))
  const removeBreakRow = (i) => setForm(f => ({ ...f, breakdowns: f.breakdowns.filter((_, j) => j !== i) }))

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

  const selectCls = (disabled) =>
    `border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40${disabled ? ' bg-gray-50 text-gray-400' : ''}`

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-12">

      {/* ── top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-sm font-bold text-brand-slate">Machine Daily Report</h1>
          {vehicle && (
            <p className="text-xs text-gray-400 mt-0.5">{vehicle.vehicle_no} · {vehicle.vehicle_name}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* date filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30"
          />
          {/* project filter */}
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
          {/* machine ID filter */}
          {!vehicleId && (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Machine ID…"
                value={machineFilter}
                onChange={e => setMachineFilter(e.target.value)}
                className="border border-gray-200 rounded-lg pl-7 pr-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              />
            </div>
          )}
          {/* new report */}
          {canWrite && (
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

      {/* ── history table ── */}
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
                  {['Date', 'Machine', 'Project', 'Operator', 'Hrs Worked', 'Submitted at', 'Status'].map(col => (
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
                    <td className="px-4 py-2.5 font-medium text-brand-slate">{r.machine_id || r.machine_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.project_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.operator_name || r.submitted_by_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.hours?.hrs_worked || '—'}</td>
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
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl print:shadow-none print:rounded-none print:max-w-none print:w-full">

            {/* modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 no-print">
              <h2 className="text-sm font-bold text-brand-slate">
                {selectedId ? 'Machine Daily Report' : 'New Machine Daily Report'}
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
                    <Field label="Project Name"       value={form.header.project_name} onChange={h('project_name')} disabled={isLocked} />
                    <Field label="Date"               value={form.header.date}         onChange={h('date')}         disabled={isLocked} type="date" />
                    <Field label="Contract No."       value={form.header.contract_no}  onChange={h('contract_no')}  disabled={isLocked} />
                    <Field label="Day"                value={form.header.day}          onChange={h('day')}          disabled={isLocked} />
                    <Field label="Location / Section" value={form.header.location}     onChange={h('location')}     disabled={isLocked} />
                    <Field label="Weather"            value={form.header.weather}      onChange={h('weather')}      disabled={isLocked} />
                  </div>
                </Section>

                {/* ── Section A: Machine / Equipment Details ── */}
                <Section title="A. Machine / Equipment Details">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Field label="Machine Name"          value={form.machine.machine_name}        onChange={m('machine_name')}        disabled={isLocked || !!vehicleId} />
                    <Field label="Machine ID / Reg. No." value={form.machine.machine_id}          onChange={m('machine_id')}          disabled={isLocked || !!vehicleId} />
                    <Field label="Machine Type"          value={form.machine.machine_type}        onChange={m('machine_type')}        disabled={isLocked} />
                    <Field label="Operator Name"         value={form.machine.operator_name}       onChange={m('operator_name')}       disabled={isLocked} />
                    <Field label="Fuel Type"             value={form.machine.fuel_type}           onChange={m('fuel_type')}           disabled={isLocked} />
                    <Field label="Operator Licence No."  value={form.machine.operator_licence_no} onChange={m('operator_licence_no')} disabled={isLocked} />
                  </div>
                </Section>

                {/* ── Section B: Hours Worked ── */}
                <Section title="B. Hours Worked">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Field
                      label="Start Time"
                      value={form.hours.start_time}
                      onChange={val => setHours('start_time', val)}
                      disabled={isLocked}
                      type="time"
                    />
                    <Field
                      label="End Time"
                      value={form.hours.end_time}
                      onChange={val => setHours('end_time', val)}
                      disabled={isLocked}
                      type="time"
                    />
                    <Field
                      label="Hrs Worked"
                      value={form.hours.hrs_worked}
                      onChange={val => setHours('hrs_worked', val)}
                      disabled={isLocked}
                    />
                    <Field
                      label="Hrs Idle / Breakdown"
                      value={form.hours.hrs_idle_breakdown}
                      onChange={val => setHours('hrs_idle_breakdown', val)}
                      disabled={isLocked}
                    />
                    <Field
                      label="Total Hrs On Site"
                      value={form.hours.total_hrs_on_site}
                      onChange={val => setHours('total_hrs_on_site', val)}
                      disabled
                      className="opacity-80"
                    />
                  </div>
                </Section>

                {/* ── Section C: Fuel & Fluids ── */}
                <Section title="C. Fuel &amp; Fluids">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Field
                      label="Opening Meter"
                      value={form.fuel.opening_meter}
                      onChange={val => setFuel('opening_meter', val)}
                      disabled={isLocked}
                    />
                    <Field
                      label="Closing Meter"
                      value={form.fuel.closing_meter}
                      onChange={val => setFuel('closing_meter', val)}
                      disabled={isLocked}
                    />
                    <Field
                      label="Fuel Added (Ltrs)"
                      value={form.fuel.fuel_added}
                      onChange={val => setFuel('fuel_added', val)}
                      disabled={isLocked}
                    />
                    <Field
                      label="Oil / Fluids Added"
                      value={form.fuel.oil_fluids_added}
                      onChange={val => setFuel('oil_fluids_added', val)}
                      disabled={isLocked}
                    />
                    <Field
                      label="Fuel Balance (Ltrs)"
                      value={form.fuel.fuel_balance}
                      onChange={val => setFuel('fuel_balance', val)}
                      disabled
                      className="opacity-80"
                    />
                  </div>
                </Section>

                {/* ── Section D: Work Activities ── */}
                <Section title="D. Work Activities">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {['No.', 'Location / Chainage', 'Description of Work', 'Unit / Qty', 'Remarks', ...(isLocked ? [] : [''])].map((col, ci) => (
                            <th key={ci} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.works.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2 py-1 w-10">
                              <input value={row.no}          onChange={e => setWork(i, 'no',          e.target.value)} disabled={isLocked} className={inputCls(isLocked)} />
                            </td>
                            <td className="px-2 py-1">
                              <input value={row.location}    onChange={e => setWork(i, 'location',    e.target.value)} disabled={isLocked} className={inputCls(isLocked)} />
                            </td>
                            <td className="px-2 py-1">
                              <input value={row.description} onChange={e => setWork(i, 'description', e.target.value)} disabled={isLocked} className={inputCls(isLocked)} />
                            </td>
                            <td className="px-2 py-1 w-24">
                              <input value={row.unit_qty}    onChange={e => setWork(i, 'unit_qty',    e.target.value)} disabled={isLocked} className={inputCls(isLocked)} />
                            </td>
                            <td className="px-2 py-1">
                              <input value={row.remarks}     onChange={e => setWork(i, 'remarks',     e.target.value)} disabled={isLocked} className={inputCls(isLocked)} />
                            </td>
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

                {/* ── Section E: Maintenance & Inspections ── */}
                <Section title="E. Maintenance &amp; Inspections">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Inspection Item', 'Status', 'Remarks'].map(col => (
                            <th key={col} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.maintenance.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2 py-1.5 font-medium text-brand-slate whitespace-nowrap">{row.item}</td>
                            <td className="px-2 py-1 w-28">
                              <select
                                value={row.status}
                                onChange={e => setMaint(i, 'status', e.target.value)}
                                disabled={isLocked}
                                className={selectCls(isLocked)}
                              >
                                <option value="">—</option>
                                {MAINT_STATUSES.map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              <input
                                value={row.remarks}
                                onChange={e => setMaint(i, 'remarks', e.target.value)}
                                disabled={isLocked}
                                className={inputCls(isLocked)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>

                {/* ── Section F: Breakdown / Downtime ── */}
                <Section title="F. Breakdown / Downtime">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Breakdown Desc.', 'Time Down', 'Action Taken', 'Resumed', ...(isLocked ? [] : [''])].map((col, ci) => (
                            <th key={ci} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.breakdowns.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-2 py-1">
                              <input value={row.description}  onChange={e => setBreak(i, 'description',  e.target.value)} disabled={isLocked} className={inputCls(isLocked)} />
                            </td>
                            <td className="px-2 py-1 w-24">
                              <input value={row.time_down}    onChange={e => setBreak(i, 'time_down',    e.target.value)} disabled={isLocked} className={inputCls(isLocked)} />
                            </td>
                            <td className="px-2 py-1">
                              <input value={row.action_taken} onChange={e => setBreak(i, 'action_taken', e.target.value)} disabled={isLocked} className={inputCls(isLocked)} />
                            </td>
                            <td className="px-2 py-1 w-24">
                              <input value={row.resumed}      onChange={e => setBreak(i, 'resumed',      e.target.value)} disabled={isLocked} className={inputCls(isLocked)} />
                            </td>
                            {!isLocked && (
                              <td className="px-2 py-1 w-6">
                                <button
                                  onClick={() => removeBreakRow(i)}
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
                    <button onClick={addBreakRow} className="mt-2 text-xs text-brand-red hover:underline">
                      + Add row
                    </button>
                  )}
                </Section>

                {/* ── Section G: Instructions, Issues, Next Day Plan ── */}
                <Section title="G. Instructions, Issues and Next Day Plan">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Textarea
                      label="Instructions received (Verbal or Written)"
                      value={form.notes.instructions}
                      onChange={n('instructions')}
                      disabled={isLocked}
                    />
                    <Textarea
                      label="Delays / challenges"
                      value={form.notes.delays}
                      onChange={n('delays')}
                      disabled={isLocked}
                    />
                    <Textarea
                      label="Safety / quality / environment remarks"
                      value={form.notes.safety}
                      onChange={n('safety')}
                      disabled={isLocked}
                    />
                    <Textarea
                      label="Planned activities for next day"
                      value={form.notes.next_day}
                      onChange={n('next_day')}
                      disabled={isLocked}
                    />
                  </div>
                </Section>

                {/* ── Signatures ── */}
                <Section title="Signatures">
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Prepared by (Operator / Driver)"
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
