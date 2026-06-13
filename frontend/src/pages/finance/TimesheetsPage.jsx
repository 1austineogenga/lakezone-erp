import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { PlusIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
}

const COST_CODES = [
  { value: 'labour',        label: 'Labour' },
  { value: 'materials',     label: 'Materials' },
  { value: 'plant',         label: 'Plant & Equipment' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'preliminaries', label: 'Preliminaries' },
  { value: 'overhead',      label: 'Overhead' },
  { value: 'other',         label: 'Other' },
]

const EMPTY_LINE = { work_date: '', project: '', cost_code: 'labour', description: '', hours: '', hourly_rate: '' }

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export default function TimesheetsPage() {
  const qc = useQueryClient()
  const [view, setView] = useState('list')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedTs, setSelectedTs] = useState(null)
  const [form, setForm] = useState({
    week_start: getMonday(new Date()),
    notes: '',
    lines: [{ ...EMPTY_LINE }],
  })

  const { data: timesheets, isLoading } = useQuery({
    queryKey: ['timesheets', statusFilter],
    queryFn: () => api.get('/finance/timesheets/', { params: statusFilter ? { status: statusFilter } : undefined }),
    select: r => r.data?.results ?? r.data,
  })

  const { data: payrollSummary } = useQuery({
    queryKey: ['payroll-summary'],
    queryFn: () => api.get('/finance/payroll-summary/'),
    select: r => r.data?.results ?? r.data,
  })

  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/projects/'),
    select: r => r.data?.results ?? r.data,
  })

  const createMut = useMutation({
    mutationFn: (data) => api.post('/finance/timesheets/', data),
    onSuccess: () => {
      toast.success('Timesheet saved.')
      qc.invalidateQueries(['timesheets'])
      qc.invalidateQueries(['payroll-summary'])
      setView('list')
      setForm({ week_start: getMonday(new Date()), notes: '', lines: [{ ...EMPTY_LINE }] })
    },
    onError: () => toast.error('Failed to save timesheet.'),
  })

  const submitMut = useMutation({
    mutationFn: (id) => api.post(`/finance/timesheets/${id}/submit/`),
    onSuccess: () => { toast.success('Submitted for approval.'); qc.invalidateQueries(['timesheets']) },
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, action }) => api.post(`/finance/timesheets/${id}/review/`, { action }),
    onSuccess: () => { toast.success('Updated.'); qc.invalidateQueries(['timesheets']); qc.invalidateQueries(['payroll-summary']) },
  })

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))
  const removeLine = (i) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))
  const updateLine = (i, key, val) => setForm(f => {
    const lines = [...f.lines]
    lines[i] = { ...lines[i], [key]: val }
    return { ...f, lines }
  })

  const handleSubmitForm = (e) => {
    e.preventDefault()
    const payload = {
      week_start: form.week_start,
      notes: form.notes,
      lines: form.lines.map(l => ({
        ...l,
        hours: parseFloat(l.hours),
        hourly_rate: parseFloat(l.hourly_rate),
        project: l.project || null,
      })),
    }
    createMut.mutate(payload)
  }

  const cls = 'px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

  return (
    <div className="space-y-5">
      {/* Payroll summary cards */}
      {payrollSummary && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Labour Cost (Approved)</p>
            <p className="text-xl font-bold text-brand-slate">{fmt(payrollSummary.grand_total)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Hours (Approved)</p>
            <p className="text-xl font-bold text-brand-slate">{Number(payrollSummary.total_hours || 0).toLocaleString()} hrs</p>
          </div>
        </div>
      )}

      {/* Toggle + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { key: 'list', label: 'My Timesheets' },
          { key: 'summary', label: 'Payroll Summary' },
        ].map(opt => (
          <button key={opt.key} onClick={() => setView(opt.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${view === opt.key
                ? 'bg-brand-slate text-white border-brand-slate'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {opt.label}
          </button>
        ))}
        {view === 'list' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
            <option value="">All Statuses</option>
            {Object.keys(STATUS_COLORS).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        )}
        <button onClick={() => setView('new')}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
          <PlusIcon className="h-4 w-4" /> New Timesheet
        </button>
      </div>

      {/* New timesheet form */}
      {view === 'new' && (
        <form onSubmit={handleSubmitForm} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-brand-slate text-sm">New Timesheet</h3>
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Week Starting (Monday) *</label>
              <input required type="date" value={form.week_start}
                onChange={e => setForm(f => ({ ...f, week_start: e.target.value }))}
                className={cls} />
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className={`w-full ${cls}`} />
            </div>
          </div>

          {/* Lines */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  <th className="pb-2 text-left font-medium">Date *</th>
                  <th className="pb-2 text-left font-medium pl-2">Project</th>
                  <th className="pb-2 text-left font-medium pl-2">Cost Code</th>
                  <th className="pb-2 text-left font-medium pl-2">Description *</th>
                  <th className="pb-2 text-left font-medium pl-2">Hours *</th>
                  <th className="pb-2 text-left font-medium pl-2">Rate (KES/hr) *</th>
                  <th className="pb-2 text-right font-medium pl-2">Amount</th>
                  <th className="pb-2 pl-2" />
                </tr>
              </thead>
              <tbody className="space-y-1">
                {form.lines.map((line, i) => {
                  const amt = (parseFloat(line.hours) || 0) * (parseFloat(line.hourly_rate) || 0)
                  return (
                    <tr key={i}>
                      <td className="pt-2">
                        <input required type="date" value={line.work_date}
                          onChange={e => updateLine(i, 'work_date', e.target.value)}
                          className={cls} />
                      </td>
                      <td className="pt-2 pl-2">
                        <select value={line.project} onChange={e => updateLine(i, 'project', e.target.value)}
                          className={cls}>
                          <option value="">None</option>
                          {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="pt-2 pl-2">
                        <select value={line.cost_code} onChange={e => updateLine(i, 'cost_code', e.target.value)}
                          className={cls}>
                          {COST_CODES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </td>
                      <td className="pt-2 pl-2">
                        <input required value={line.description}
                          onChange={e => updateLine(i, 'description', e.target.value)}
                          placeholder="Task description" className={`w-40 ${cls}`} />
                      </td>
                      <td className="pt-2 pl-2">
                        <input required type="number" min="0.5" step="0.5" value={line.hours}
                          onChange={e => updateLine(i, 'hours', e.target.value)}
                          className={`w-20 ${cls}`} />
                      </td>
                      <td className="pt-2 pl-2">
                        <input required type="number" min="0" step="0.01" value={line.hourly_rate}
                          onChange={e => updateLine(i, 'hourly_rate', e.target.value)}
                          className={`w-28 ${cls}`} />
                      </td>
                      <td className="pt-2 pl-2 text-right font-medium text-brand-slate whitespace-nowrap">
                        {fmt(amt)}
                      </td>
                      <td className="pt-2 pl-2">
                        {form.lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(i)}
                            className="text-gray-300 hover:text-red-500">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={addLine}
              className="flex items-center gap-1.5 text-xs text-brand-red font-medium">
              <PlusIcon className="h-4 w-4" /> Add Line
            </button>
            <div className="text-sm font-semibold text-brand-slate">
              Total: {fmt(form.lines.reduce((s, l) => s + (parseFloat(l.hours) || 0) * (parseFloat(l.hourly_rate) || 0), 0))}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-brand-red-dark disabled:opacity-60">
              Save Timesheet
            </button>
            <button type="button" onClick={() => setView('list')}
              className="px-4 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Timesheet list */}
      {view === 'list' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Timesheets</h3>
          </div>
          {isLoading
            ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
            : !timesheets || timesheets.length === 0
              ? <p className="text-sm text-gray-400 p-8 text-center">No timesheets yet.</p>
              : <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Reference', 'Employee', 'Week Starting', 'Total', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {timesheets.map(ts => (
                      <tr key={ts.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-slate">{ts.reference}</td>
                        <td className="px-4 py-3 text-gray-700">{ts.employee_name}</td>
                        <td className="px-4 py-3 text-gray-500">{ts.week_start}</td>
                        <td className="px-4 py-3 font-medium">{fmt(ts.total_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ts.status]}`}>
                            {ts.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {ts.status === 'draft' && (
                              <button onClick={() => submitMut.mutate(ts.id)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium">Submit</button>
                            )}
                            {ts.status === 'submitted' && (
                              <>
                                <button onClick={() => reviewMut.mutate({ id: ts.id, action: 'approved' })}
                                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                                  <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
                                </button>
                                <button onClick={() => reviewMut.mutate({ id: ts.id, action: 'rejected' })}
                                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium">
                                  <XCircleIcon className="h-3.5 w-3.5" /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          }
        </div>
      )}

      {/* Payroll summary by project */}
      {view === 'summary' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Payroll Cost Allocation by Project &amp; Cost Code</h3>
            <p className="text-xs text-gray-400 mt-0.5">From approved timesheets only</p>
          </div>
          {!payrollSummary || payrollSummary.rows?.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No approved timesheets yet.</p>
            : <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Project', 'Cost Code', 'Total Hours', 'Total Amount'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payrollSummary.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{r.project_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{r.cost_code}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.total_hours.toLocaleString()} hrs</td>
                      <td className="px-4 py-3 font-semibold text-brand-slate">{fmt(r.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 font-semibold text-gray-600">Totals</td>
                    <td className="px-4 py-3 font-bold">{Number(payrollSummary.total_hours || 0).toLocaleString()} hrs</td>
                    <td className="px-4 py-3 font-bold text-brand-slate">{fmt(payrollSummary.grand_total)}</td>
                  </tr>
                </tfoot>
              </table>
          }
        </div>
      )}
    </div>
  )
}
