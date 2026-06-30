import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { ArrowLeftIcon, PrinterIcon, PlusIcon } from '@heroicons/react/24/outline'
import {
  getMachineWeeklyReports,
  createMachineWeeklyReport,
  getMachineWeeklyReport,
  updateMachineWeeklyReport,
} from '../../api/reports'
import useAuthStore from '../../store/authStore'
import { printMachineWeekly } from '../../utils/print'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_ROWS = ['Hours Worked', 'Hours Idle', 'Hrs Breakdown', 'Hrs Standby', 'Fuel Used (L)']
const MAINT_ITEMS = [
  'Engine oil change',
  'Filter replacement',
  'Greasing/lubrication',
  'Tyre/track inspection',
  'Hydraulic check',
  'General servicing',
]

const WRITE_ROLES = ['equipment_operator', 'driver', 'system_admin']

// ── helpers ───────────────────────────────────────────────────────────────────
const initHours = () => {
  const g = {}
  HOUR_ROWS.forEach(row => {
    g[row] = {}
    DAYS.forEach(d => { g[row][d] = '' })
    g[row].total = ''
  })
  return g
}

const autoRowTotal = (row) => {
  const sum = DAYS.reduce((acc, d) => acc + (parseFloat(row[d]) || 0), 0)
  return sum > 0 ? String(sum) : ''
}

const initMaint = () => {
  const m = {}
  MAINT_ITEMS.forEach(item => { m[item] = { scheduled: '', completed: '', remarks: '' } })
  return m
}

const blankWork = () => ({ no: '', location: '', description: '', unit: '', weekly_target: '', weekly_achieved: '' })
const blankBreak = () => ({ day: '', description: '', hrs_lost: '', action: '' })

const isLocked = (report) => {
  if (!report) return false
  if (report.status === 'locked') return true
  if (!report.created_at) return false
  const submitted = new Date(report.created_at)
  const midnight = new Date(submitted)
  midnight.setHours(23, 59, 59, 999)
  return new Date() > midnight
}

// ── sub-components ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', className = '', disabled = false }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-medium text-gray-600 mb-1">{label}</label>
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
      <label className="block text-[10px] font-medium text-gray-600 mb-1">{label}</label>
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

function StatusBadge({ status }) {
  const cls =
    status === 'submitted'
      ? 'bg-green-50 text-green-700 border border-green-200'
      : status === 'locked'
      ? 'bg-gray-100 text-gray-500 border border-gray-200'
      : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {status ?? 'draft'}
    </span>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function MachineWeeklyReportPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  const canWrite = WRITE_ROLES.includes(user?.role)

  // ── view state ─────────────────────────────────────────────────────────────
  const [view, setView] = useState('list') // 'list' | 'new' | 'edit'
  const [editingId, setEditingId] = useState(null)

  // ── filters ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({ date_from: '', date_to: '', project: '', machine_id: '' })
  const fSet = (key) => (val) => setFilters(p => ({ ...p, [key]: val }))

  // ── form state ─────────────────────────────────────────────────────────────
  const [header, setHeader] = useState({
    project_name: '', week_no: '', contract_no: '', from_date: '', to_date: '',
  })
  const h = (key) => (val) => setHeader(p => ({ ...p, [key]: val }))

  // Section A
  const [machineInfo, setMachineInfo] = useState({
    machine_name: '', machine_id: '', machine_type: '', primary_operator: '',
  })
  const mi = (key) => (val) => setMachineInfo(p => ({ ...p, [key]: val }))

  // Section B
  const [hours, setHours] = useState(initHours)
  const setHourDay = (row, day, val) => {
    setHours(p => {
      const updated = { ...p[row], [day]: val }
      updated.total = autoRowTotal(updated)
      return { ...p, [row]: updated }
    })
  }

  // Section C
  const [fluids, setFluids] = useState({
    opening_meter: '', closing_meter: '', total_fuel_added: '', total_oil_fluids_added: '',
  })
  const fl = (key) => (val) => setFluids(p => ({ ...p, [key]: val }))

  // Section D
  const [works, setWorks] = useState(() => Array.from({ length: 5 }, blankWork))
  const setWork = (i, key, val) => setWorks(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))

  // Section E
  const [maint, setMaint] = useState(initMaint)
  const setMaintField = (item, key, val) =>
    setMaint(p => ({ ...p, [item]: { ...p[item], [key]: val } }))

  // Section F
  const [breakdowns, setBreakdowns] = useState(() => Array.from({ length: 3 }, blankBreak))
  const setBreak = (i, key, val) => setBreakdowns(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))

  // Section G
  const [notes, setNotes] = useState({ materials: '', issues: '', safety: '', next_week: '' })
  const n = (key) => (val) => setNotes(p => ({ ...p, [key]: val }))

  // Footer
  const [reviewedBy, setReviewedBy] = useState('')

  // ── queries ────────────────────────────────────────────────────────────────
  const listParams = {
    ...(filters.date_from && { date_from: filters.date_from }),
    ...(filters.date_to && { date_to: filters.date_to }),
    ...(filters.project && { project: filters.project }),
    ...(filters.machine_id && { machine_id: filters.machine_id }),
  }

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['machine-weekly-reports', listParams],
    queryFn: () => getMachineWeeklyReports(listParams),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const editingReport = useQuery({
    queryKey: ['machine-weekly-report', editingId],
    queryFn: () => getMachineWeeklyReport(editingId),
    enabled: !!editingId,
  })

  // populate form when editing report loads
  useEffect(() => {
    if (!editingReport.data) return
    const d = editingReport.data.data
    if (!d) return
    setHeader({
      project_name: d.project_name ?? '',
      week_no: d.week_no ?? '',
      contract_no: d.contract_no ?? '',
      from_date: d.from_date ?? '',
      to_date: d.to_date ?? '',
    })
    setMachineInfo({
      machine_name: d.machine_name ?? '',
      machine_id: d.machine_id ?? '',
      machine_type: d.machine_type ?? '',
      primary_operator: d.primary_operator ?? '',
    })
    if (d.hours) setHours(d.hours)
    setFluids({
      opening_meter: d.opening_meter ?? '',
      closing_meter: d.closing_meter ?? '',
      total_fuel_added: d.total_fuel_added ?? '',
      total_oil_fluids_added: d.total_oil_fluids_added ?? '',
    })
    if (d.works && d.works.length) setWorks(d.works)
    if (d.maintenance) setMaint(d.maintenance)
    if (d.breakdowns && d.breakdowns.length) setBreakdowns(d.breakdowns)
    setNotes({
      materials: d.materials ?? '',
      issues: d.issues ?? '',
      safety: d.safety ?? '',
      next_week: d.next_week ?? '',
    })
    setReviewedBy(d.reviewed_by ?? '')
  }, [editingReport.data])

  // ── mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data) => createMachineWeeklyReport(data),
    onSuccess: () => {
      toast.success('Weekly report submitted.')
      qc.invalidateQueries({ queryKey: ['machine-weekly-reports'] })
      setView('list')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to submit report.'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateMachineWeeklyReport(id, data),
    onSuccess: () => {
      toast.success('Report updated.')
      qc.invalidateQueries({ queryKey: ['machine-weekly-reports'] })
      qc.invalidateQueries({ queryKey: ['machine-weekly-report', editingId] })
      setView('list')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to update report.'),
  })

  // ── form helpers ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setHeader({ project_name: '', week_no: '', contract_no: '', from_date: '', to_date: '' })
    setMachineInfo({ machine_name: '', machine_id: '', machine_type: '', primary_operator: '' })
    setHours(initHours())
    setFluids({ opening_meter: '', closing_meter: '', total_fuel_added: '', total_oil_fluids_added: '' })
    setWorks(Array.from({ length: 5 }, blankWork))
    setMaint(initMaint())
    setBreakdowns(Array.from({ length: 3 }, blankBreak))
    setNotes({ materials: '', issues: '', safety: '', next_week: '' })
    setReviewedBy('')
  }

  const openNew = () => { resetForm(); setEditingId(null); setView('new') }
  const openEdit = (id) => { setEditingId(id); setView('edit') }

  const preparedBy = user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username
    : ''

  const buildPayload = () => ({
    ...header,
    ...machineInfo,
    hours,
    ...fluids,
    works,
    maintenance: maint,
    breakdowns,
    materials: notes.materials,
    issues: notes.issues,
    safety: notes.safety,
    next_week: notes.next_week,
    reviewed_by: reviewedBy,
    prepared_by: preparedBy,
  })

  const handleSubmit = () => {
    if (!header.project_name) { toast.warn('Project name is required.'); return }
    if (!header.week_no) { toast.warn('Week number is required.'); return }
    if (!machineInfo.machine_name) { toast.warn('Machine name is required.'); return }
    const payload = buildPayload()
    if (view === 'new') {
      createMut.mutate(payload)
    } else {
      updateMut.mutate({ id: editingId, data: payload })
    }
  }

  const handlePrint = () => {
    printMachineWeekly({
      ...header,
      ...machineInfo,
      hours,
      ...fluids,
      works,
      maintenance: maint,
      breakdowns,
      materials: notes.materials,
      issues: notes.issues,
      safety: notes.safety,
      next_week: notes.next_week,
      prepared_by: preparedBy,
      reviewed_by: reviewedBy,
    })
  }

  const inputCls = 'border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40 disabled:bg-gray-50 disabled:text-gray-400'

  // ── list view ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    const reports = listData ?? []
    return (
      <div className="space-y-5 pb-12">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)}>
              <ArrowLeftIcon className="w-4 h-4 text-gray-400 hover:text-brand-slate" />
            </button>
            <h1 className="text-sm font-bold text-brand-slate">Machine Weekly Reports</h1>
          </div>
          {canWrite && (
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:bg-brand-red/90 transition-colors">
              <PlusIcon className="h-3.5 w-3.5" /> New Report
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="From Date"  value={filters.date_from}  onChange={fSet('date_from')}  type="date" />
            <Field label="To Date"    value={filters.date_to}    onChange={fSet('date_to')}    type="date" />
            <Field label="Project"    value={filters.project}    onChange={fSet('project')} />
            <Field label="Machine ID" value={filters.machine_id} onChange={fSet('machine_id')} />
          </div>
        </div>

        {/* History table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h3 className="text-xs font-bold text-brand-slate">Submitted Reports</h3>
          </div>
          {listLoading ? (
            <div className="p-8 text-center text-xs text-gray-600">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-600">No reports found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Week No.', 'Machine', 'Project', 'Period', 'Submitted By', 'Status', ''].map(col => (
                      <th key={col} className="text-left text-[10px] font-semibold text-gray-600 px-3 py-2">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 font-medium text-brand-slate">{r.week_no ?? '—'}</td>
                      <td className="px-3 py-2">{r.machine_name ?? r.machine_id ?? '—'}</td>
                      <td className="px-3 py-2">{r.project_name ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {r.from_date && r.to_date ? `${r.from_date} – ${r.to_date}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.prepared_by ?? r.submitted_by ?? '—'}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => openEdit(r.id)}
                          className="text-brand-red text-[10px] font-semibold hover:underline">
                          {canWrite && !isLocked(r) ? 'Edit' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── form view (new / edit) ─────────────────────────────────────────────────
  const isSubmitting = createMut.isPending || updateMut.isPending
  const formLocked = view === 'edit' && isLocked(editingReport.data?.data)

  return (
    <div className="space-y-5 pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setView('list')}>
            <ArrowLeftIcon className="w-4 h-4 text-gray-400 hover:text-brand-slate" />
          </button>
          <h1 className="text-sm font-bold text-brand-slate">
            {view === 'new' ? 'New Machine Weekly Report' : 'Machine Weekly Report'}
          </h1>
          {formLocked && (
            <span className="ml-1 px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-600 text-[10px] rounded font-semibold">
              Locked
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors">
            <PrinterIcon className="h-3.5 w-3.5" /> Print
          </button>
          {canWrite && !formLocked && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:bg-brand-red/90 transition-colors disabled:opacity-60">
              {isSubmitting ? 'Saving...' : view === 'new' ? 'Submit Report' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {/* Report Header */}
      <Section title="Report Header">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Project Name"          value={header.project_name} onChange={h('project_name')} disabled={formLocked} />
          <Field label="Week No."              value={header.week_no}      onChange={h('week_no')}       disabled={formLocked} />
          <Field label="Contract No./Location" value={header.contract_no}  onChange={h('contract_no')}  disabled={formLocked} />
          <Field label="Period From"           value={header.from_date}    onChange={h('from_date')}    disabled={formLocked} type="date" />
          <Field label="Period To"             value={header.to_date}      onChange={h('to_date')}      disabled={formLocked} type="date" />
        </div>
      </Section>

      {/* Section A – Machine / Equipment Identification */}
      <Section title="A. Machine / Equipment Identification">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Machine Name"       value={machineInfo.machine_name}     onChange={mi('machine_name')}     disabled={formLocked} />
          <Field label="Machine ID / Reg. No." value={machineInfo.machine_id}   onChange={mi('machine_id')}       disabled={formLocked} />
          <Field label="Machine Type"       value={machineInfo.machine_type}     onChange={mi('machine_type')}     disabled={formLocked} />
          <Field label="Primary Operator"   value={machineInfo.primary_operator} onChange={mi('primary_operator')} disabled={formLocked} />
        </div>
      </Section>

      {/* Section B – Weekly Hours Summary */}
      <Section title="B. Weekly Hours Summary">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 w-36">Category</th>
                {DAYS.map(d => (
                  <th key={d} className="border border-gray-200 px-2 py-2 font-semibold text-gray-600 text-center w-16">{d}</th>
                ))}
                <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-600 text-center w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {HOUR_ROWS.map(row => (
                <tr key={row}>
                  <td className="border border-gray-200 px-3 py-1.5 font-medium text-brand-slate">{row}</td>
                  {DAYS.map(d => (
                    <td key={d} className="border border-gray-200 p-1">
                      <input
                        type="number"
                        min="0"
                        value={hours[row][d]}
                        onChange={e => setHourDay(row, d, e.target.value)}
                        disabled={formLocked}
                        className={inputCls + ' text-center'}
                      />
                    </td>
                  ))}
                  <td className="border border-gray-200 p-1">
                    <input
                      value={hours[row].total}
                      readOnly
                      className={inputCls + ' text-center font-bold bg-gray-50'}
                    />
                  </td>
                </tr>
              ))}
              {/* Column totals */}
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 text-xs">Daily Total</td>
                {DAYS.map(d => {
                  const sum = HOUR_ROWS.slice(0, 4).reduce((acc, row) => acc + (parseFloat(hours[row][d]) || 0), 0)
                  return (
                    <td key={d} className="border border-gray-200 px-2 py-1.5 text-center font-bold text-brand-slate text-xs">
                      {sum > 0 ? sum : '—'}
                    </td>
                  )
                })}
                <td className="border border-gray-200 px-2 py-1.5 text-center font-bold text-brand-red text-xs">
                  {HOUR_ROWS.slice(0, 4).reduce((acc, row) => acc + (parseFloat(hours[row].total) || 0), 0) || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section C – Weekly Fuel & Fluids Summary */}
      <Section title="C. Weekly Fuel &amp; Fluids Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Opening Meter (Mon)"      value={fluids.opening_meter}        onChange={fl('opening_meter')}        disabled={formLocked} />
          <Field label="Closing Meter (Sat)"      value={fluids.closing_meter}        onChange={fl('closing_meter')}        disabled={formLocked} />
          <Field label="Total Fuel Added (Ltrs)"  value={fluids.total_fuel_added}     onChange={fl('total_fuel_added')}     disabled={formLocked} />
          <Field label="Total Oil/Fluids Added"   value={fluids.total_oil_fluids_added} onChange={fl('total_oil_fluids_added')} disabled={formLocked} />
        </div>
      </Section>

      {/* Section D – Works Executed During the Week */}
      <Section title="D. Works Executed During the Week">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['No.', 'Location / Section', 'Description', 'Unit', 'Weekly Target', 'Weekly Achieved'].map(col => (
                  <th key={col} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {works.map((w, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 p-1 w-10">
                    <input value={w.no} onChange={e => setWork(i, 'no', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={w.location} onChange={e => setWork(i, 'location', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={w.description} onChange={e => setWork(i, 'description', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1 w-16">
                    <input value={w.unit} onChange={e => setWork(i, 'unit', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1 w-24">
                    <input value={w.weekly_target} onChange={e => setWork(i, 'weekly_target', e.target.value)} disabled={formLocked} className={inputCls + ' text-right'} />
                  </td>
                  <td className="border border-gray-200 p-1 w-24">
                    <input value={w.weekly_achieved} onChange={e => setWork(i, 'weekly_achieved', e.target.value)} disabled={formLocked} className={inputCls + ' text-right'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!formLocked && (
          <button
            onClick={() => setWorks(p => [...p, blankWork()])}
            className="mt-2 text-xs text-brand-red hover:underline">
            + Add row
          </button>
        )}
      </Section>

      {/* Section E – Weekly Maintenance Summary */}
      <Section title="E. Weekly Maintenance Summary">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Maintenance Item', 'Scheduled? (Y/N)', 'Completed? (Y/N)', 'Remarks'].map(col => (
                  <th key={col} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MAINT_ITEMS.map(item => (
                <tr key={item}>
                  <td className="border border-gray-200 px-3 py-1.5 font-medium text-brand-slate">{item}</td>
                  {['scheduled', 'completed', 'remarks'].map(key => (
                    <td key={key} className="border border-gray-200 p-1">
                      <input
                        value={maint[item][key]}
                        onChange={e => setMaintField(item, key, e.target.value)}
                        disabled={formLocked}
                        className={inputCls}
                        placeholder={key !== 'remarks' ? 'Y / N' : ''}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section F – Breakdowns / Downtime */}
      <Section title="F. Breakdowns / Downtime">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Day', 'Breakdown Description', 'Hrs Lost', 'Action Taken'].map(col => (
                  <th key={col} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breakdowns.map((b, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 p-1 w-20">
                    <input value={b.day} onChange={e => setBreak(i, 'day', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={b.description} onChange={e => setBreak(i, 'description', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1 w-20">
                    <input value={b.hrs_lost} onChange={e => setBreak(i, 'hrs_lost', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={b.action} onChange={e => setBreak(i, 'action', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!formLocked && (
          <button
            onClick={() => setBreakdowns(p => [...p, blankBreak()])}
            className="mt-2 text-xs text-brand-red hover:underline">
            + Add row
          </button>
        )}
      </Section>

      {/* Section G – Narrative */}
      <Section title="G. Materials, Issues and Next Week Plan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Materials / consumables received or used"   value={notes.materials} onChange={n('materials')} disabled={formLocked} />
          <Textarea label="Major issues / constraints"                  value={notes.issues}    onChange={n('issues')}    disabled={formLocked} />
          <Textarea label="Safety / quality / environment summary"      value={notes.safety}    onChange={n('safety')}    disabled={formLocked} />
          <Textarea label="Planned activities for next week"            value={notes.next_week} onChange={n('next_week')} disabled={formLocked} />
        </div>
      </Section>

      {/* Footer / Signatures */}
      <Section title="Signatures">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prepared by (Operator / Driver)" value={preparedBy} disabled />
          <Field
            label="Reviewed by (Site Manager / Engineer)"
            value={reviewedBy}
            onChange={setReviewedBy}
            disabled={formLocked}
          />
        </div>
      </Section>

      {/* Bottom action bar */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
          <PrinterIcon className="h-4 w-4" /> Download / Print PDF
        </button>
        {canWrite && !formLocked && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-red text-white text-sm font-semibold rounded-lg hover:bg-brand-red/90 transition-colors disabled:opacity-60">
            {isSubmitting ? 'Saving...' : view === 'new' ? 'Submit Report' : 'Save Changes'}
          </button>
        )}
      </div>
    </div>
  )
}
