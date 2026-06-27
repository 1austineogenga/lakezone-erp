import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import {
  PlusIcon, MagnifyingGlassIcon, ArrowUpTrayIcon,
  CheckCircleIcon, XMarkIcon, ClockIcon, CalendarDaysIcon,
  ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline'

const STATUS_COLORS = {
  pending:          'bg-yellow-100 text-yellow-800',
  foreman_approved: 'bg-blue-100 text-blue-800',
  hr_approved:      'bg-green-100 text-green-800',
  paid:             'bg-gray-100 text-gray-700',
  cancelled:        'bg-red-100 text-red-800',
}
const STATUS_LABELS = {
  pending:          'Pending',
  foreman_approved: 'Foreman Approved',
  hr_approved:      'HR Approved',
  paid:             'Paid',
  cancelled:        'Cancelled',
}

const EMPTY = {
  id_number: '', full_name: '', phone: '', placement: '',
  assignment: '', daily_rate: '', notes: '',
}

export default function CasualsRegistryPage() {
  const qc = useQueryClient()
  const fileRef = useRef()

  const [search, setSearch]         = useState('')
  const [statusFilter, setFilter]   = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(EMPTY)
  const [lookupMsg, setLookupMsg]   = useState('')
  const [existingId, setExistingId] = useState(null)
  const [expanded, setExpanded]     = useState(null)
  const [logForm, setLogForm]       = useState({ casual: null, work_date: '', days_worked: '1', notes: '' })
  const [showLogForm, setShowLogForm] = useState(false)
  const [importErr, setImportErr]   = useState('')

  // Fetch branches (e.g. Head Office) for placement dropdown
  const { data: branchNames = [] } = useQuery({
    queryKey: ['branches-names'],
    queryFn:  () => api.get('/auth/branches/', { params: { page_size: 50 } }),
    select:   r => (r.data?.results ?? r.data ?? []).map(b => b.name),
  })

  // Fetch project locations for placement dropdown
  const { data: projectLocations = [] } = useQuery({
    queryKey: ['project-locations'],
    queryFn:  () => api.get('/projects/', { params: { page_size: 100 } }),
    select:   r => {
      const projects = r.data?.results ?? r.data ?? []
      return [...new Set(projects.map(p => p.location).filter(Boolean))]
    },
  })

  const placementOptions = [...branchNames, ...projectLocations]

  const { data: casuals = [], isLoading } = useQuery({
    queryKey: ['casuals', search, statusFilter],
    queryFn:  () => api.get('/hr/casuals/', { params: { search: search || undefined, status: statusFilter || undefined } }),
    select:   r => r.data?.results ?? r.data ?? [],
  })

  const f = key => ({
    value:    form[key],
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value })),
  })

  // Lookup casual by ID number (returning casual)
  const handleIdLookup = async () => {
    if (!form.id_number.trim()) return
    setLookupMsg('')
    setExistingId(null)
    try {
      const res = await api.get('/hr/casuals/lookup/', { params: { id_number: form.id_number.trim() } })
      const c   = res.data
      if (c) {
        setForm({
          id_number:  c.id_number,
          full_name:  c.full_name,
          phone:      c.phone,
          placement:  c.placement,
          assignment: c.assignment,
          daily_rate: c.daily_rate,
          notes:      c.notes || '',
        })
        setExistingId(c.id)
        setLookupMsg('Returning casual — details pre-filled. You can update and save.')
      }
    } catch {
      setLookupMsg('')
    }
  }

  const createMutation = useMutation({
    mutationFn: data => existingId
      ? api.patch(`/hr/casuals/${existingId}/`, data)
      : api.post('/hr/casuals/', data),
    onSuccess: () => {
      qc.invalidateQueries(['casuals'])
      setShowForm(false)
      setForm(EMPTY)
      setExistingId(null)
      setLookupMsg('')
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, action }) => api.post(`/hr/casuals/${id}/approve/`, { action }),
    onSuccess:  () => qc.invalidateQueries(['casuals']),
  })

  const logMutation = useMutation({
    mutationFn: data => api.post('/hr/casuals/daily-logs/', data),
    onSuccess:  () => {
      qc.invalidateQueries(['casuals'])
      setShowLogForm(false)
      setLogForm({ casual: null, work_date: '', days_worked: '1', notes: '' })
    },
  })

  const handleImport = async e => {
    const file = e.target.files[0]
    if (!file) return
    setImportErr('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/hr/casuals/import/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      qc.invalidateQueries(['casuals'])
      alert(`Import complete: ${res.data.created} created, ${res.data.updated} updated, ${res.data.errors?.length ?? 0} errors.`)
    } catch (err) {
      setImportErr(err.response?.data?.error || 'Import failed')
    }
    e.target.value = ''
  }

  const handleSubmit = e => {
    e.preventDefault()
    createMutation.mutate(form)
  }

  const inputCls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
  const labelCls = 'block text-xs text-gray-500 mb-1'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-slate">Casuals Register</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track casual workers, approvals, and daily attendance</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current.click()}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            Import Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <button
            onClick={() => { setShowForm(true); setForm(EMPTY); setExistingId(null); setLookupMsg('') }}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm hover:bg-rose-700"
          >
            <PlusIcon className="h-4 w-4" />
            Add Casual
          </button>
        </div>
      </div>

      {importErr && <p className="mb-4 text-sm text-red-600">{importErr}</p>}

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, ID, phone…"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-slate">
              {existingId ? 'Update Casual Record' : 'Add Casual'}
            </h2>
            <button onClick={() => setShowForm(false)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ID Number lookup row */}
            <div>
              <label className={labelCls}>ID Number *</label>
              <div className="flex gap-2">
                <input {...f('id_number')} required placeholder="National ID number" className={inputCls} />
                <button
                  type="button"
                  onClick={handleIdLookup}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm whitespace-nowrap hover:bg-gray-50"
                >
                  Check Returning
                </button>
              </div>
              {lookupMsg && <p className="text-xs text-blue-600 mt-1">{lookupMsg}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Full Name (as on ID) *</label>
                <input {...f('full_name')} required placeholder="Full legal name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone Number *</label>
                <input {...f('phone')} required placeholder="07XXXXXXXX" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Daily Rate (KES)</label>
                <input {...f('daily_rate')} type="number" min="0" step="0.01" placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Placement *</label>
                <select {...f('placement')} required className={inputCls}>
                  <option value="">Select placement…</option>
                  {placementOptions.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Assignment *</label>
              <textarea
                {...f('assignment')}
                required
                rows={3}
                placeholder="Describe the work assigned to this casual…"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea {...f('notes')} rows={2} placeholder="Any additional notes…" className={inputCls} />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm hover:bg-rose-700 disabled:opacity-60"
              >
                {createMutation.isPending ? 'Saving…' : existingId ? 'Update' : 'Add Casual'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Daily Log Form */}
      {showLogForm && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-brand-slate text-sm">Log Work Day</h3>
            <button onClick={() => setShowLogForm(false)}><XMarkIcon className="h-4 w-4 text-gray-400" /></button>
          </div>
          <form
            onSubmit={e => {
              e.preventDefault()
              logMutation.mutate(logForm)
            }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className={labelCls}>Date *</label>
              <input
                type="date"
                value={logForm.work_date}
                onChange={e => setLogForm(p => ({ ...p, work_date: e.target.value }))}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Days Worked</label>
              <select
                value={logForm.days_worked}
                onChange={e => setLogForm(p => ({ ...p, days_worked: e.target.value }))}
                className={inputCls}
              >
                <option value="1">Full Day (1)</option>
                <option value="0.5">Half Day (0.5)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input
                value={logForm.notes}
                onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional"
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={logMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {logMutation.isPending ? 'Saving…' : 'Log'}
            </button>
          </form>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-center text-gray-400 py-12">Loading…</p>
      ) : casuals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No casuals found</p>
          <p className="text-sm mt-1">Add one or import from Excel</p>
        </div>
      ) : (
        <div className="space-y-3">
          {casuals.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Main row */}
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-brand-slate">{c.full_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ID: {c.id_number} · {c.phone} · {c.placement}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.assignment}</p>
                </div>

                {/* Stats */}
                <div className="hidden md:flex gap-6 text-center text-xs text-gray-500">
                  <div>
                    <p className="font-semibold text-gray-800">{parseFloat(c.total_days || 0).toFixed(1)}</p>
                    <p>Days</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {parseFloat(c.total_amount || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}
                    </p>
                    <p>Amount</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {c.status === 'pending' && (
                    <button
                      onClick={() => approveMutation.mutate({ id: c.id, action: 'foreman_approve' })}
                      className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
                    >
                      Foreman Approve
                    </button>
                  )}
                  {c.status === 'foreman_approved' && (
                    <button
                      onClick={() => approveMutation.mutate({ id: c.id, action: 'hr_approve' })}
                      className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
                    >
                      HR Approve
                    </button>
                  )}
                  {c.status === 'hr_approved' && (
                    <button
                      onClick={() => approveMutation.mutate({ id: c.id, action: 'mark_paid' })}
                      className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200"
                    >
                      Mark Paid
                    </button>
                  )}
                  {['pending', 'foreman_approved'].includes(c.status) && (
                    <button
                      onClick={() => {
                        setLogForm({ casual: c.id, work_date: '', days_worked: '1', notes: '' })
                        setShowLogForm(true)
                        setExpanded(c.id)
                      }}
                      title="Log work day"
                      className="text-xs px-2.5 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                    >
                      <CalendarDaysIcon className="h-3.5 w-3.5" />
                      Log Day
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    {expanded === c.id
                      ? <ChevronUpIcon className="h-4 w-4" />
                      : <ChevronDownIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === c.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Assignment</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{c.assignment}</p>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p><span className="font-medium">Daily Rate:</span> KES {parseFloat(c.daily_rate || 0).toLocaleString()}</p>
                      {c.foreman_approved_by_name && (
                        <p><span className="font-medium">Foreman Approved By:</span> {c.foreman_approved_by_name}</p>
                      )}
                      {c.hr_approved_by_name && (
                        <p><span className="font-medium">HR Approved By:</span> {c.hr_approved_by_name}</p>
                      )}
                      {c.notes && <p><span className="font-medium">Notes:</span> {c.notes}</p>}
                    </div>
                  </div>

                  {/* Daily logs */}
                  {c.daily_logs?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Daily Log</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-200">
                            <th className="text-left pb-1">Date</th>
                            <th className="text-left pb-1">Days</th>
                            <th className="text-left pb-1">Amount</th>
                            <th className="text-left pb-1">Logged By</th>
                            <th className="text-left pb-1">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.daily_logs.map(log => (
                            <tr key={log.id} className="border-b border-gray-100 last:border-0">
                              <td className="py-0.5">{log.work_date}</td>
                              <td className="py-0.5">{log.days_worked}</td>
                              <td className="py-0.5">
                                KES {(parseFloat(c.daily_rate) * parseFloat(log.days_worked)).toLocaleString()}
                              </td>
                              <td className="py-0.5">{log.logged_by_name}</td>
                              <td className="py-0.5 text-gray-500">{log.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
