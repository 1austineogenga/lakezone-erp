import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getLeaveApplications, createLeaveApplication, submitLeave, reviewLeave, getLeaveTypes } from '../../api/hr'
import api from '../../api/client'
import { PlusIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
}

const EMPTY = { employee: '', leave_type: '', start_date: '', end_date: '', reason: '', handover_to: '' }

export default function LeavePage() {
  const qc = useQueryClient()
  const [tab, setTab]         = useState('applications')
  const [statusFilter, setStatus] = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY)

  const { data: applications, isLoading } = useQuery({
    queryKey: ['leave-applications', statusFilter],
    queryFn: () => getLeaveApplications(statusFilter ? { status: statusFilter } : undefined),
    select: r => r.data?.results ?? r.data,
  })

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: getLeaveTypes,
    select: r => r.data?.results ?? r.data,
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-simple'],
    queryFn: () => api.get('/hr/employees/', { params: { is_active: true } }),
    select: r => r.data?.results ?? r.data,
  })

  const createMut = useMutation({
    mutationFn: createLeaveApplication,
    onSuccess: () => { toast.success('Application saved.'); qc.invalidateQueries(['leave-applications']); setShowForm(false); setForm(EMPTY) },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to submit.'),
  })

  const submitMut = useMutation({
    mutationFn: submitLeave,
    onSuccess: () => { toast.success('Submitted for approval.'); qc.invalidateQueries(['leave-applications']) },
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, action, notes }) => reviewLeave(id, { action, review_notes: notes }),
    onSuccess: () => { toast.success('Decision saved.'); qc.invalidateQueries(['leave-applications']) },
  })

  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })
  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.handover_to) delete payload.handover_to
    createMut.mutate(payload)
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        {[{ key: 'applications', label: 'Applications' }, { key: 'types', label: 'Leave Types' }].map(opt => (
          <button key={opt.key} onClick={() => setTab(opt.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${tab === opt.key ? 'bg-brand-slate text-white border-brand-slate' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {opt.label}
          </button>
        ))}
        {tab === 'applications' && (
          <>
            <select value={statusFilter} onChange={e => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
              <option value="">All Statuses</option>
              {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setShowForm(s => !s)}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
              <PlusIcon className="h-4 w-4" /> New Application
            </button>
          </>
        )}
      </div>

      {/* New application form */}
      {tab === 'applications' && showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Leave Application</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Employee *</label>
              <select required {...f('employee')} className={cls}>
                <option value="">Select employee…</option>
                {employees?.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_number})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Leave Type *</label>
              <select required {...f('leave_type')} className={cls}>
                <option value="">Select type…</option>
                {leaveTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date *</label>
              <input required type="date" {...f('start_date')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date *</label>
              <input required type="date" {...f('end_date')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Handover To</label>
              <select {...f('handover_to')} className={cls}>
                <option value="">No handover</option>
                {employees?.filter(e => e.id !== form.employee).map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Reason *</label>
              <textarea required {...f('reason')} rows={2}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg disabled:opacity-60">Save</button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-gray-300 text-xs rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {/* Applications table */}
      {tab === 'applications' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Leave Applications</h3>
          </div>
          {isLoading
            ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
            : !applications || applications.length === 0
              ? <p className="text-sm text-gray-400 p-8 text-center">No leave applications.</p>
              : <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>{['Ref', 'Employee', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {applications.map(app => (
                        <tr key={app.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs font-medium text-brand-slate">{app.reference}</td>
                          <td className="px-4 py-3 text-gray-700 text-xs">{app.employee_name}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{app.leave_type_name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{app.start_date}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{app.end_date}</td>
                          <td className="px-4 py-3 font-medium">{app.days}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[app.status]}`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {app.status === 'draft' && (
                                <button onClick={() => submitMut.mutate(app.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">Submit</button>
                              )}
                              {app.status === 'submitted' && (
                                <>
                                  <button onClick={() => reviewMut.mutate({ id: app.id, action: 'approved' })}
                                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                                    <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
                                  </button>
                                  <button onClick={() => reviewMut.mutate({ id: app.id, action: 'rejected' })}
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
                </div>
          }
        </div>
      )}

      {/* Leave types */}
      {tab === 'types' && <LeaveTypesTab />}
    </div>
  )
}

function LeaveTypesTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', days_entitled: 21, is_paid: true, applicable_to: 'all', carry_forward: false, max_carry_forward: 0 })

  const { data: leaveTypes } = useQuery({ queryKey: ['leave-types'], queryFn: getLeaveTypes, select: r => r.data?.results ?? r.data })

  const createMut = useMutation({
    mutationFn: (d) => api.post('/hr/leave-types/', d),
    onSuccess: () => { toast.success('Leave type added.'); qc.invalidateQueries(['leave-types']); setShowForm(false) },
  })

  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(s => !s)}
        className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
        <PlusIcon className="h-4 w-4" /> Add Leave Type
      </button>
      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate(form) }}
          className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Name *</label><input required {...f('name')} className={cls} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Code *</label><input required {...f('code')} placeholder="AL, SL…" className={cls} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Days Entitled</label><input type="number" {...f('days_entitled')} className={cls} /></div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Applicable To</label>
              <select {...f('applicable_to')} className={cls}>
                <option value="all">All</option>
                <option value="staff_only">Staff Only</option>
                <option value="casual_only">Casual Only</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" checked={form.is_paid} onChange={e => setForm(p => ({ ...p, is_paid: e.target.checked }))} id="paid" />
              <label htmlFor="paid" className="text-xs text-gray-600">Paid Leave</label>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" checked={form.carry_forward} onChange={e => setForm(p => ({ ...p, carry_forward: e.target.checked }))} id="cf" />
              <label htmlFor="cf" className="text-xs text-gray-600">Allow Carry Forward</label>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 border border-gray-300 text-xs rounded-lg">Cancel</button>
          </div>
        </form>
      )}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {!leaveTypes || leaveTypes.length === 0
          ? <p className="text-sm text-gray-400 p-8 text-center">No leave types configured.</p>
          : <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Name', 'Code', 'Days', 'Paid', 'Applicable To', 'Carry Fwd'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaveTypes.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                    <td className="px-4 py-3">{t.days_entitled}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${t.is_paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{t.is_paid ? 'Paid' : 'Unpaid'}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize">{t.applicable_to.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-xs">{t.carry_forward ? `Yes (max ${t.max_carry_forward})` : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  )
}
