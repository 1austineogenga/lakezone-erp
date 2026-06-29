import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { ArrowLeftIcon, PrinterIcon, PlusIcon } from '@heroicons/react/24/outline'
import {
  getSurveyorWeeklyReports,
  createSurveyorWeeklyReport,
  getSurveyorWeeklyReport,
  updateSurveyorWeeklyReport,
} from '../../api/reports'
import useAuthStore from '../../store/authStore'
import { printDoc } from '../../utils/print'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const BENCHMARK_ITEMS = [
  'Benchmarks / control points',
  'Support to earthworks / drainage',
  'As-built / quantity pick-up',
]

const blankActivity = () => ({ activity: '', location: '', output: '', remarks: '' })
const initDailyActivities = () =>
  DAYS.reduce((acc, day) => ({ ...acc, [day]: blankActivity() }), {})
const initBenchmarks = () =>
  BENCHMARK_ITEMS.reduce((acc, item) => ({ ...acc, [item]: { status: '', action: '', remarks: '' } }), {})

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

export default function SurveyorWeeklyReportPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  const isSiteSurveyor = user?.role === 'site_surveyor' || user?.role === 'system_admin'

  // ── view state ─────────────────────────────────────────────────────────────
  const [view, setView] = useState('list') // 'list' | 'new' | 'edit'
  const [editingId, setEditingId] = useState(null)

  // ── filters ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({ date_from: '', date_to: '', project_name: '' })
  const f = (key) => (val) => setFilters(p => ({ ...p, [key]: val }))

  // ── form state ─────────────────────────────────────────────────────────────
  const [header, setHeader] = useState({
    project_name: '', contract_no: '', week_no: '', period: '', from_date: '', to_date: '',
  })
  const h = (key) => (val) => setHeader(p => ({ ...p, [key]: val }))

  const [dailyActivities, setDailyActivities] = useState(initDailyActivities)
  const setDay = (day, key, val) =>
    setDailyActivities(p => ({ ...p, [day]: { ...p[day], [key]: val } }))

  const [benchmarks, setBenchmarks] = useState(initBenchmarks)
  const setBench = (item, key, val) =>
    setBenchmarks(p => ({ ...p, [item]: { ...p[item], [key]: val } }))

  const [notes, setNotes] = useState({ equipment: '', challenges: '', next_week: '' })
  const n = (key) => (val) => setNotes(p => ({ ...p, [key]: val }))

  const [reviewedBy, setReviewedBy] = useState('')

  // ── queries ────────────────────────────────────────────────────────────────
  const listParams = {
    ...(filters.date_from && { date_from: filters.date_from }),
    ...(filters.date_to && { date_to: filters.date_to }),
    ...(filters.project_name && { project_name: filters.project_name }),
  }

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['surveyor-weekly-reports', listParams],
    queryFn: () => getSurveyorWeeklyReports(listParams),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const editingReport = useQuery({
    queryKey: ['surveyor-weekly-report', editingId],
    queryFn: () => getSurveyorWeeklyReport(editingId),
    enabled: !!editingId,
  })

  // populate form when editing report loads
  useEffect(() => {
    if (!editingReport.data) return
    const d = editingReport.data.data
    if (!d) return
    setHeader({
      project_name: d.project_name ?? '',
      contract_no: d.contract_no ?? '',
      week_no: d.week_no ?? '',
      period: d.period ?? '',
      from_date: d.from_date ?? '',
      to_date: d.to_date ?? '',
    })
    if (d.daily_activities) setDailyActivities(d.daily_activities)
    if (d.benchmarks) setBenchmarks(d.benchmarks)
    setNotes({
      equipment: d.equipment ?? '',
      challenges: d.challenges ?? '',
      next_week: d.next_week ?? '',
    })
    setReviewedBy(d.reviewed_by ?? '')
  }, [editingReport.data])

  // ── mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data) => createSurveyorWeeklyReport(data),
    onSuccess: () => {
      toast.success('Weekly report submitted.')
      qc.invalidateQueries({ queryKey: ['surveyor-weekly-reports'] })
      setView('list')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to submit report.'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateSurveyorWeeklyReport(id, data),
    onSuccess: () => {
      toast.success('Report updated.')
      qc.invalidateQueries({ queryKey: ['surveyor-weekly-reports'] })
      qc.invalidateQueries({ queryKey: ['surveyor-weekly-report', editingId] })
      setView('list')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to update report.'),
  })

  // ── form actions ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setHeader({ project_name: '', contract_no: '', week_no: '', period: '', from_date: '', to_date: '' })
    setDailyActivities(initDailyActivities())
    setBenchmarks(initBenchmarks())
    setNotes({ equipment: '', challenges: '', next_week: '' })
    setReviewedBy('')
  }

  const openNew = () => {
    resetForm()
    setEditingId(null)
    setView('new')
  }

  const openEdit = (id) => {
    setEditingId(id)
    setView('edit')
  }

  const preparedBy = user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username
    : ''

  const buildPayload = () => ({
    ...header,
    daily_activities: dailyActivities,
    benchmarks,
    equipment: notes.equipment,
    challenges: notes.challenges,
    next_week: notes.next_week,
    reviewed_by: reviewedBy,
    prepared_by: preparedBy,
  })

  const handleSubmit = () => {
    if (!header.project_name) { toast.warn('Project name is required.'); return }
    if (!header.week_no) { toast.warn('Week number is required.'); return }
    const payload = buildPayload()
    if (view === 'new') {
      createMut.mutate(payload)
    } else {
      updateMut.mutate({ id: editingId, data: payload })
    }
  }

  // ── print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const dayRows = DAYS.map(day => {
      const r = dailyActivities[day] ?? blankActivity()
      return `<tr><td>${day}</td><td>${r.activity}</td><td>${r.location}</td><td>${r.output}</td><td>${r.remarks}</td></tr>`
    }).join('')

    const benchRows = BENCHMARK_ITEMS.map(item => {
      const b = benchmarks[item] ?? { status: '', action: '', remarks: '' }
      return `<tr><td>${item}</td><td>${b.status}</td><td>${b.action}</td><td>${b.remarks}</td></tr>`
    }).join('')

    printDoc({
      title: 'Surveyor Weekly Report',
      html: `
        <table style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
          <tr>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:160px"><b>Project Name</b></td>
            <td style="padding:8px 12px">${header.project_name}</td>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:80px"><b>Week No.</b></td>
            <td style="padding:8px 12px">${header.week_no}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Contract No./Location</b></td>
            <td style="padding:8px 12px">${header.contract_no}</td>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Period</b></td>
            <td style="padding:8px 12px">${header.from_date ? header.from_date + ' – ' + header.to_date : header.period}</td>
          </tr>
        </table>

        <div class="section-title">A. Weekly Summary of Survey Activities</div>
        <table style="margin-bottom:16px">
          <thead><tr style="background:#e11d4815"><th>Day</th><th>Activity</th><th>Location/Chainage</th><th>Output</th><th>Remarks</th></tr></thead>
          <tbody>${dayRows}</tbody>
        </table>

        <div class="section-title">B. Benchmark / Control Summary and Support to Teams</div>
        <table style="margin-bottom:16px">
          <thead><tr style="background:#e11d4815"><th>Item</th><th>Status this week</th><th>Action required</th><th>Remarks</th></tr></thead>
          <tbody>${benchRows}</tbody>
        </table>

        <div class="section-title">C. Equipment Status, Constraints and Next Week Plan</div>
        <table style="margin-bottom:24px;border:1px solid #e2e8f0">
          <tr><td style="padding:10px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:220px;vertical-align:top"><b>Equipment condition / calibration</b></td><td style="padding:10px 12px">${notes.equipment}</td></tr>
          <tr><td style="padding:10px 12px;background:#f8fafc;font-size:10px;color:#64748b;vertical-align:top"><b>Challenges / constraints</b></td><td style="padding:10px 12px">${notes.challenges}</td></tr>
          <tr><td style="padding:10px 12px;background:#f8fafc;font-size:10px;color:#64748b;vertical-align:top"><b>Planned activities for next week</b></td><td style="padding:10px 12px">${notes.next_week}</td></tr>
        </table>

        <div class="sig-row" style="grid-template-columns:repeat(2,1fr)">
          <div class="sig-box"><label>Prepared by (Surveyor)</label><span>${preparedBy || '&nbsp;'}</span></div>
          <div class="sig-box"><label>Reviewed by (Site Agent / Engineer)</label><span>${reviewedBy || '&nbsp;'}</span></div>
        </div>
      `,
    })
  }

  const inputCls =
    'border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40 disabled:bg-gray-50 disabled:text-gray-400'

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
            <h1 className="text-sm font-bold text-brand-slate">Surveyor Weekly Reports</h1>
          </div>
          {isSiteSurveyor && (
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
            <Field label="From Date"    value={filters.date_from}    onChange={f('date_from')}    type="date" />
            <Field label="To Date"      value={filters.date_to}      onChange={f('date_to')}      type="date" />
            <Field label="Project Name" value={filters.project_name} onChange={f('project_name')} className="col-span-2 md:col-span-2" />
          </div>
        </div>

        {/* History table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h3 className="text-xs font-bold text-brand-slate">Submitted Reports</h3>
          </div>
          {listLoading ? (
            <div className="p-8 text-center text-xs text-gray-400">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">No reports found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Week No.', 'Project', 'Period', 'Submitted By', 'Status', ''].map(col => (
                      <th key={col} className="text-left text-[10px] font-semibold text-gray-500 px-3 py-2">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 font-medium text-brand-slate">{r.week_no ?? '—'}</td>
                      <td className="px-3 py-2">{r.project_name ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-500">
                        {r.from_date && r.to_date ? `${r.from_date} – ${r.to_date}` : r.period ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{r.prepared_by ?? r.submitted_by ?? '—'}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => openEdit(r.id)}
                          className="text-brand-red text-[10px] font-semibold hover:underline">
                          {isSiteSurveyor && !isLocked(r) ? 'Edit' : 'View'}
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
            {view === 'new' ? 'New Surveyor Weekly Report' : 'Surveyor Weekly Report'}
          </h1>
          {formLocked && (
            <span className="ml-1 px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-500 text-[10px] rounded font-semibold">
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
          {isSiteSurveyor && !formLocked && (
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
          <Field label="Contract No./Location" value={header.contract_no}  onChange={h('contract_no')}  disabled={formLocked} />
          <Field label="Week No."              value={header.week_no}      onChange={h('week_no')}       disabled={formLocked} />
          <Field label="Period"                value={header.period}       onChange={h('period')}        disabled={formLocked} />
          <Field label="Period From"           value={header.from_date}    onChange={h('from_date')}     disabled={formLocked} type="date" />
          <Field label="Period To"             value={header.to_date}      onChange={h('to_date')}       disabled={formLocked} type="date" />
        </div>
      </Section>

      {/* Section A – Weekly Summary of Survey Activities */}
      <Section title="A. Weekly Summary of Survey Activities">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Day', 'Activity', 'Location/Chainage', 'Output', 'Remarks'].map(col => (
                  <th key={col} className="border border-gray-200 text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day}>
                  <td className="border border-gray-200 px-2 py-1 text-[10px] font-medium text-brand-slate w-24">{day}</td>
                  <td className="border border-gray-200 p-1">
                    <input value={dailyActivities[day].activity} onChange={e => setDay(day, 'activity', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={dailyActivities[day].location} onChange={e => setDay(day, 'location', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={dailyActivities[day].output}   onChange={e => setDay(day, 'output',   e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={dailyActivities[day].remarks}  onChange={e => setDay(day, 'remarks',  e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section B – Benchmark / Control Summary */}
      <Section title="B. Benchmark / Control Summary and Support to Teams">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Item', 'Status this week', 'Action required', 'Remarks'].map(col => (
                  <th key={col} className="border border-gray-200 text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BENCHMARK_ITEMS.map(item => (
                <tr key={item}>
                  <td className="border border-gray-200 px-2 py-1 text-[10px] font-medium text-brand-slate w-52">{item}</td>
                  <td className="border border-gray-200 p-1">
                    <input value={benchmarks[item].status}  onChange={e => setBench(item, 'status',  e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={benchmarks[item].action}  onChange={e => setBench(item, 'action',  e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={benchmarks[item].remarks} onChange={e => setBench(item, 'remarks', e.target.value)} disabled={formLocked} className={inputCls} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section C – Equipment Status, Constraints and Next Week Plan */}
      <Section title="C. Equipment Status, Constraints and Next Week Plan">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Textarea label="Equipment condition / calibration" value={notes.equipment}  onChange={n('equipment')}  disabled={formLocked} />
          <Textarea label="Challenges / constraints"          value={notes.challenges} onChange={n('challenges')} disabled={formLocked} />
          <Textarea label="Planned activities for next week"  value={notes.next_week}  onChange={n('next_week')}  disabled={formLocked} />
        </div>
      </Section>

      {/* Footer / Signatures */}
      <Section title="Signatures">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prepared by (Surveyor)" value={preparedBy} disabled />
          <Field
            label="Reviewed by (Site Agent / Engineer)"
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
        {isSiteSurveyor && !formLocked && (
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
