import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getLeaveApplications, reviewLeave, getLeaveTypes } from '../../api/hr'
import api from '../../api/client'
import {
  CheckCircleIcon, XCircleIcon, DocumentTextIcon,
  PlusIcon, PencilSquareIcon, ArrowPathIcon, ChevronDownIcon,
  ClockIcon, FunnelIcon, MagnifyingGlassIcon, XMarkIcon,
  UserCircleIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import { printLeaveApplication } from '../../utils/print'

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-100 text-amber-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
}
const STATUS_LABELS = {
  draft:     'Draft',
  submitted: 'Pending Review',
  approved:  'Approved',
  rejected:  'Rejected',
  cancelled: 'Cancelled',
}

export default function LeavePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [tab, setTab]           = useState('applications')
  const [statusFilter, setStatus] = useState('')
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)   // app opened in slide-over
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectNotes, setRejectNotes] = useState('')

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['leave-applications', statusFilter],
    queryFn:  () => getLeaveApplications(statusFilter ? { status: statusFilter } : undefined),
    select:   r  => r.data?.results ?? r.data ?? [],
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, action, notes }) => reviewLeave(id, { action, review_notes: notes }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'approved' ? 'Leave approved.' : 'Leave rejected.')
      qc.invalidateQueries(['leave-applications'])
      setSelected(s => s?.id === vars.id ? { ...s, status: vars.action, review_notes: vars.notes } : s)
      setRejectModal(null)
      setRejectNotes('')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Action failed.'),
  })

  const approve = (app) => reviewMut.mutate({ id: app.id, action: 'approved', notes: '' })
  const openReject = (app) => { setRejectModal(app); setRejectNotes('') }
  const confirmReject = () => {
    if (!rejectModal) return
    reviewMut.mutate({ id: rejectModal.id, action: 'rejected', notes: rejectNotes })
  }

  const filtered = useMemo(() => {
    if (!search) return applications
    const q = search.toLowerCase()
    return applications.filter(a =>
      a.employee_name?.toLowerCase().includes(q) ||
      a.leave_type_name?.toLowerCase().includes(q) ||
      a.reference?.toLowerCase().includes(q)
    )
  }, [applications, search])

  const pending = applications.filter(a => a.status === 'submitted').length

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        {[
          { key: 'balances',     label: 'Leave Balances' },
          { key: 'applications', label: 'Applications', badge: pending },
          { key: 'types',        label: 'Leave Types'    },
        ].map(opt => (
          <button key={opt.key} onClick={() => setTab(opt.key)}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${tab === opt.key
                ? 'bg-brand-slate text-white border-brand-slate'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {opt.label}
            {opt.badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {opt.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Applications tab */}
      {tab === 'applications' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total',    value: applications.length,                                        color: 'text-brand-slate', bg: 'bg-gray-50' },
              { label: 'Pending',  value: applications.filter(a => a.status === 'submitted').length,  color: 'text-amber-600',   bg: 'bg-amber-50' },
              { label: 'Approved', value: applications.filter(a => a.status === 'approved').length,   color: 'text-green-600',   bg: 'bg-green-50' },
              { label: 'Rejected', value: applications.filter(a => a.status === 'rejected').length,   color: 'text-red-600',     bg: 'bg-red-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl px-4 py-3 border border-gray-100`}>
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search employee, leave type, ref…"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
            ) : !filtered.length ? (
              <div className="p-12 text-center text-gray-400">
                <CalendarDaysIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No leave applications found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Employee', 'Leave Type', 'Period', 'Days', 'Applied', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(app => (
                      <tr
                        key={app.id}
                        onClick={() => setSelected(app)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold text-brand-slate">{app.employee_name}</p>
                          <p className="text-[10px] text-gray-400">{app.employee_designation || app.employee_department || app.reference}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">{app.leave_type_name}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {app.start_date} → {app.end_date}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-brand-slate">{app.days}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{app.applied_at ? app.applied_at.slice(0, 10) : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[app.status]}`}>
                            {STATUS_LABELS[app.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {app.status === 'submitted' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => approve(app)}
                                disabled={reviewMut.isPending}
                                title="Approve"
                                className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg font-medium hover:bg-green-700 disabled:opacity-60"
                              >
                                <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => openReject(app)}
                                title="Reject"
                                className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 text-xs rounded-lg font-medium hover:bg-red-100"
                              >
                                <XCircleIcon className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => navigate(`/hr/leave/${app.id}/application`)}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-slate"
                            >
                              <DocumentTextIcon className="h-3.5 w-3.5" /> View Form
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Leave balances */}
      {tab === 'balances' && <LeaveBalancesTab />}

      {/* Leave types */}
      {tab === 'types' && <LeaveTypesTab />}

      {/* Slide-over detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-semibold text-brand-slate text-sm">{selected.employee_name}</h3>
                <p className="text-xs text-gray-400">{selected.reference}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 rounded-full hover:bg-gray-100">
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              {/* Status badge */}
              <div className="flex items-center justify-between">
                <span className={`text-sm px-3 py-1 rounded-full font-semibold ${STATUS_COLORS[selected.status]}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
                <button
                  onClick={() => navigate(`/hr/leave/${selected.id}/application`)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-slate border border-gray-200 px-2.5 py-1 rounded-lg"
                >
                  <DocumentTextIcon className="h-3.5 w-3.5" /> Print Form
                </button>
              </div>

              {/* Employee info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Applicant</p>
                <p className="text-sm font-semibold text-brand-slate">{selected.employee_name}</p>
                {selected.employee_designation && <p className="text-xs text-gray-600">{selected.employee_designation}</p>}
                {selected.employee_department  && <p className="text-xs text-gray-400">{selected.employee_department}</p>}
              </div>

              {/* Leave details */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Leave Type', selected.leave_type_name],
                  ['Days',       `${selected.days} day${selected.days !== 1 ? 's' : ''}`],
                  ['From',       selected.start_date],
                  ['To',         selected.end_date],
                  ['Applied On', selected.applied_at?.slice(0, 10) || '—'],
                  ['Ref',        selected.reference],
                ].map(([l, v]) => (
                  <div key={l} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">{l}</p>
                    <p className="text-xs font-semibold text-brand-slate">{v}</p>
                  </div>
                ))}
              </div>

              {/* Reason */}
              {selected.reason && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Reason</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3">{selected.reason}</p>
                </div>
              )}

              {/* Handover */}
              {selected.handover_to_name && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-gray-400 mb-0.5">Handover To</p>
                  <p className="text-sm font-semibold text-brand-slate">{selected.handover_to_name}</p>
                </div>
              )}

              {/* Review info (if already reviewed) */}
              {selected.reviewed_by_name && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-blue-700">Review Decision</p>
                  <p className="text-xs text-blue-700">By: <span className="font-semibold">{selected.reviewed_by_name}</span></p>
                  {selected.reviewed_at && <p className="text-xs text-blue-500">{selected.reviewed_at.slice(0, 10)}</p>}
                  {selected.review_notes && <p className="text-xs text-gray-600 italic mt-1">"{selected.review_notes}"</p>}
                </div>
              )}

              {/* Action buttons */}
              {selected.status === 'submitted' && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { approve(selected); setSelected(null) }}
                    disabled={reviewMut.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-60"
                  >
                    <CheckCircleIcon className="h-4 w-4" /> Approve
                  </button>
                  <button
                    onClick={() => { openReject(selected); setSelected(null) }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 border border-red-200 text-sm font-semibold rounded-xl hover:bg-red-100"
                  >
                    <XCircleIcon className="h-4 w-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-brand-slate mb-1">Reject Leave Application</h3>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">{rejectModal.employee_name}</span>
              {' — '}{rejectModal.leave_type_name}
              {' · '}{rejectModal.start_date} → {rejectModal.end_date}
              {' · '}{rejectModal.days} day{rejectModal.days !== 1 ? 's' : ''}
            </p>
            <label className="block text-xs text-gray-600 mb-1">Reason for rejection <span className="text-red-500">*</span></label>
            <textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Explain why this leave is being rejected…"
              className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={confirmReject}
                disabled={reviewMut.isPending || !rejectNotes.trim()}
                className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {reviewMut.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const PER_PAGE = 12

// ── Leave Balances Tab ─────────────────────────────────────────────────────────
function LeaveBalancesTab() {
  const qc = useQueryClient()
  const currentYear = new Date().getFullYear()
  const [year, setYear]           = useState(currentYear)
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [expanded, setExpanded]   = useState({}) // { [empId]: bool }
  const [editModal, setEditModal] = useState(null)

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ['leave-balances', year],
    queryFn:  () => api.get('/hr/leave-balances/', { params: { year } }),
    select:   r => r.data?.results ?? r.data ?? [],
  })

  const initMut = useMutation({
    mutationFn: () => api.post('/hr/leave-balances/initialize/', { year }),
    onSuccess: (r) => {
      toast.success(`Initialized ${r.data.created} new balance records for ${year}.`)
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Initialization failed.'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/hr/leave-balances/${id}/`, data),
    onSuccess: () => {
      toast.success('Balance updated.')
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
      setEditModal(null)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Update failed.'),
  })

  // Group and filter by employee
  const allEmployees = useMemo(() => {
    const map = {}
    balances.forEach(b => {
      if (!map[b.employee]) map[b.employee] = { id: b.employee, name: b.employee_name, balances: [] }
      map[b.employee].balances.push(b)
    })
    return Object.values(map).filter(e =>
      !search || e.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [balances, search])

  const totalPages  = Math.ceil(allEmployees.length / PER_PAGE)
  const safePage    = Math.min(page, totalPages || 1)
  const pageEmployees = allEmployees.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  // Reset page when search changes
  useMemo(() => setPage(1), [search])

  const toggle = (id) => setExpanded(s => ({ ...s, [id]: !s[id] }))

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Year:</label>
          <select
            value={year}
            onChange={e => { setYear(Number(e.target.value)); setPage(1) }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search employee…"
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red w-48" />

        <button
          onClick={() => initMut.mutate()}
          disabled={initMut.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-slate text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60 ml-auto">
          <ArrowPathIcon className="h-4 w-4" />
          {initMut.isPending ? 'Initializing…' : `Initialize ${year}`}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Click <strong>Initialize {year}</strong> to create default balances for all active employees.
        Existing balances will not be overwritten. Carry-forward is calculated automatically from the previous year.
      </p>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : allEmployees.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
          <p className="text-sm">No leave balances for {year}.</p>
          <p className="text-xs mt-1">Click <strong>Initialize {year}</strong> to create them.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {pageEmployees.map(emp => {
              const isOpen = !!expanded[emp.id]
              const totalBalance = emp.balances.reduce((s, b) => s + Number(b.balance), 0)
              const totalEntitled = emp.balances.reduce((s, b) => s + Number(b.entitled_days), 0)
              const totalTaken = emp.balances.reduce((s, b) => s + Number(b.taken_days), 0)
              return (
                <div key={emp.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Collapsed header row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
                    onClick={() => toggle(emp.id)}>
                    <ChevronDownIcon className={`h-4 w-4 text-gray-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-brand-slate text-sm">{emp.name}</span>
                    </div>
                    {/* Summary chips — hidden when open */}
                    {!isOpen && (
                      <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
                        <span>Entitled: <strong className="text-gray-700">{totalEntitled}</strong></span>
                        <span>Taken: <strong className="text-gray-700">{totalTaken}</strong></span>
                        <span className={`font-semibold ${totalBalance <= 0 ? 'text-red-600' : totalBalance <= 5 ? 'text-amber-600' : 'text-green-700'}`}>
                          Balance: {totalBalance}
                        </span>
                      </div>
                    )}
                    <span className="text-xs text-gray-400 shrink-0">{emp.balances.length} types</span>
                  </div>

                  {/* Expanded leave table */}
                  {isOpen && (
                    <div className="border-t border-gray-100 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            {['Leave Type', 'Entitled', 'Carry Fwd', 'Taken', 'Balance', ''].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {emp.balances.map(b => {
                            const bal = Number(b.balance)
                            const balColor = bal <= 0 ? 'text-red-600 font-bold' : bal <= 3 ? 'text-amber-600 font-semibold' : 'text-green-700 font-semibold'
                            return (
                              <tr key={b.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2.5">
                                  <span className="font-medium text-gray-800">{b.leave_type_name}</span>
                                  <span className="ml-1.5 text-gray-400 font-mono">{b.leave_type_code}</span>
                                </td>
                                <td className="px-4 py-2.5 text-gray-700">{Number(b.entitled_days)}</td>
                                <td className="px-4 py-2.5 text-gray-600">{Number(b.carried_forward)}</td>
                                <td className="px-4 py-2.5 text-gray-600">{Number(b.taken_days)}</td>
                                <td className={`px-4 py-2.5 ${balColor}`}>{bal}</td>
                                <td className="px-4 py-2.5">
                                  <button
                                    onClick={() => setEditModal({ ...b })}
                                    className="flex items-center gap-1 text-xs text-brand-slate hover:text-brand-red font-medium">
                                    <PencilSquareIcon className="h-3.5 w-3.5" /> Edit
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Showing {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, allEmployees.length)} of {allEmployees.length} employees
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-gray-50">
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      p === safePage ? 'bg-brand-slate text-white border-brand-slate' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-gray-50">
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {editModal && (
        <EditBalanceModal
          balance={editModal}
          onClose={() => setEditModal(null)}
          onSave={(data) => updateMut.mutate({ id: editModal.id, data })}
          saving={updateMut.isPending}
        />
      )}
    </div>
  )
}

function EditBalanceModal({ balance, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    entitled_days:   Number(balance.entitled_days),
    carried_forward: Number(balance.carried_forward),
    taken_days:      Number(balance.taken_days),
  })
  const f = k => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })
  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
  const bal = Number(form.entitled_days) + Number(form.carried_forward) - Number(form.taken_days)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="font-semibold text-brand-slate mb-0.5">{balance.employee_name}</h3>
        <p className="text-xs text-gray-500 mb-4">{balance.leave_type_name} · {balance.year}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Entitled Days</label>
            <input type="number" min="0" step="0.5" className={cls} {...f('entitled_days')} />
            <p className="text-[10px] text-gray-400 mt-0.5">Standard entitlement for this year</p>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Carry Forward</label>
            <input type="number" min="0" step="0.5" className={cls} {...f('carried_forward')} />
            <p className="text-[10px] text-gray-400 mt-0.5">Days carried over from previous year</p>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Days Taken</label>
            <input type="number" min="0" step="0.5" className={cls} {...f('taken_days')} />
            <p className="text-[10px] text-gray-400 mt-0.5">Leave already consumed (updated automatically on approval)</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Remaining Balance</span>
            <span className={`text-lg font-bold ${bal <= 0 ? 'text-red-600' : bal <= 3 ? 'text-amber-600' : 'text-green-700'}`}>
              {bal.toFixed(1)} days
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
          <button
            onClick={() => onSave({ entitled_days: form.entitled_days, carried_forward: form.carried_forward, taken_days: form.taken_days })}
            disabled={saving}
            className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Leave Types Tab ────────────────────────────────────────────────────────────
function LeaveTypesTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', code: '', days_entitled: 21, is_paid: true,
    applicable_to: 'all', carry_forward: false, max_carry_forward: 0,
  })

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn:  getLeaveTypes,
    select:   r => r.data?.results ?? r.data,
  })

  const createMut = useMutation({
    mutationFn: d => api.post('/hr/leave-types/', d),
    onSuccess:  () => { toast.success('Leave type added.'); qc.invalidateQueries(['leave-types']); setShowForm(false) },
  })

  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
  const f   = k => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm(s => !s)}
        className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-rose-700"
      >
        <PlusIcon className="h-4 w-4" /> Add Leave Type
      </button>

      {showForm && (
        <form
          onSubmit={e => { e.preventDefault(); createMut.mutate(form) }}
          className="bg-white border border-gray-200 rounded-xl p-5"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="block text-xs text-gray-600 mb-1">Name *</label><input required {...f('name')} className={cls} /></div>
            <div><label className="block text-xs text-gray-600 mb-1">Code *</label><input required {...f('code')} placeholder="AL, SL…" className={cls} /></div>
            <div><label className="block text-xs text-gray-600 mb-1">Days Entitled</label><input type="number" {...f('days_entitled')} className={cls} /></div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Applicable To</label>
              <select {...f('applicable_to')} className={cls}>
                <option value="all">All</option>
                <option value="staff_only">Staff Only</option>
                <option value="casual_only">Casual Only</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" checked={form.is_paid}
                onChange={e => setForm(p => ({ ...p, is_paid: e.target.checked }))} id="paid" />
              <label htmlFor="paid" className="text-xs text-gray-600">Paid Leave</label>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" checked={form.carry_forward}
                onChange={e => setForm(p => ({ ...p, carry_forward: e.target.checked }))} id="cf" />
              <label htmlFor="cf" className="text-xs text-gray-600">Allow Carry Forward</label>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-gray-300 text-xs rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {!leaveTypes?.length ? (
          <p className="text-sm text-gray-600 p-8 text-center">No leave types configured.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Code', 'Days/Year', 'Paid', 'Applicable To', 'Carry Fwd'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leaveTypes.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                  <td className="px-4 py-3">{t.days_entitled}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {t.is_paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">{t.applicable_to.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-xs">{t.carry_forward ? `Yes (max ${t.max_carry_forward})` : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
