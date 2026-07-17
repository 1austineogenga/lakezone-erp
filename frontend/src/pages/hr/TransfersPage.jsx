import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getTransfers, createTransfer, updateTransfer, submitTransfer, recallTransfer, reviewTransfer } from '../../api/transfers'
import { getEmployees } from '../../api/hr'
import api from '../../api/client'
import {
  PlusIcon, ArrowRightIcon, CheckCircleIcon, XCircleIcon,
  BanknotesIcon, TruckIcon, HomeIcon, InformationCircleIcon,
  PencilSquareIcon, ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline'

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
}

const LUNCH_RATE    = 500
const OVERNIGHT_RATE = 1500
const RELOCATION_SUBORDINATE = 10000
const RELOCATION_MANAGEMENT  = 15000

const emptyForm = {
  employee: '',
  record_type: 'movement',
  destination_type: 'site',
  from_location: '',
  to_location: '',
  project: '',
  start_date: '',
  end_date: '',
  reason: '',
  allowance_eligible: true,
  staff_category: 'subordinate',
  lunch_days: 0,
  overnight_nights: 0,
  transport_to: '',
  transport_from: '',
}

function computeAllowances(form) {
  const transportTo   = parseFloat(form.transport_to)   || 0
  const transportFrom = parseFloat(form.transport_from) || 0
  if (form.record_type === 'relocation') {
    const fee = form.staff_category === 'management' ? RELOCATION_MANAGEMENT : RELOCATION_SUBORDINATE
    return { relocation_allowance: fee, daily_allowance: 0, daily_allowance_days: 0, transport_to: transportTo, transport_from: transportFrom }
  }
  if (form.destination_type === 'head_office' || !form.allowance_eligible) {
    return { relocation_allowance: 0, daily_allowance: 0, daily_allowance_days: 0, transport_to: transportTo, transport_from: transportFrom }
  }
  const total = (parseInt(form.lunch_days) || 0) * LUNCH_RATE
              + (parseInt(form.overnight_nights) || 0) * OVERNIGHT_RATE
  return { relocation_allowance: 0, daily_allowance: total || 0, daily_allowance_days: total > 0 ? 1 : 0, transport_to: transportTo, transport_from: transportFrom }
}

export default function TransfersPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm]         = useState(false)
  const [editingId, setEditingId]       = useState(null)  // null = create, uuid = edit
  const [form, setForm]                 = useState(emptyForm)
  const [reviewModal, setReviewModal]   = useState(null)
  const [reviewNotes, setReviewNotes]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const openEdit = (t) => {
    setEditingId(t.id)
    setForm({
      employee:           t.employee,
      record_type:        t.transfer_type === 'permanent' ? 'relocation' : 'movement',
      destination_type:   t.destination_type,
      from_location:      t.from_location || '',
      to_location:        t.to_location || '',
      project:            t.project || '',
      start_date:         t.start_date || '',
      end_date:           t.end_date || '',
      reason:             t.reason || '',
      allowance_eligible: t.allowance_eligible ?? true,
      staff_category:     t.staff_category || 'subordinate',
      lunch_days:         t.lunch_days ?? 0,
      overnight_nights:   t.overnight_nights ?? 0,
      transport_to:       t.transport_to ?? '',
      transport_from:     t.transport_from ?? '',
    })
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm) }

  useEffect(() => {
    if (form.record_type === 'relocation') set('end_date', '')
  }, [form.record_type])

  const totalMovementAllowance = (parseInt(form.lunch_days) || 0) * LUNCH_RATE
                               + (parseInt(form.overnight_nights) || 0) * OVERNIGHT_RATE
                               + (parseFloat(form.transport_to) || 0)
                               + (parseFloat(form.transport_from) || 0)
  const relocationAmount = form.staff_category === 'management' ? RELOCATION_MANAGEMENT : RELOCATION_SUBORDINATE
  const relocationTotal  = relocationAmount + (parseFloat(form.transport_to) || 0) + (parseFloat(form.transport_from) || 0)
  const isMovementToHQ  = form.record_type === 'movement' && form.destination_type === 'head_office'

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['transfers', statusFilter],
    queryFn: () => getTransfers({ status: statusFilter || undefined }),
    select: r => r.data?.results ?? r.data ?? [],
  })
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-simple'],
    queryFn: () => getEmployees({ is_active: 'true', page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-active'],
    queryFn: () => api.get('/projects/', { params: { page_size: 100 } }),
    select: r => r.data?.results ?? r.data ?? [],
  })
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/auth/branches/'),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const handleEmployeeSelect = (empId) => {
    set('employee', empId)
    const emp = employees.find(e => String(e.id) === String(empId))
    if (emp) set('from_location', emp.branch_name || '')
  }

  const handleDestinationSelect = (val) => {
    if (val.startsWith('__project__:')) {
      set('project', val.replace('__project__:', ''))
      set('to_location', projects.find(p => String(p.id) === val.replace('__project__:', ''))?.name || val)
    } else {
      set('project', '')
      set('to_location', val)
    }
  }

  const createMut = useMutation({
    mutationFn: (payload) => createTransfer(payload),
    onSuccess: () => {
      toast.success('Request saved as draft.')
      qc.invalidateQueries(['transfers'])
      closeForm()
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to save.'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => updateTransfer(id, payload),
    onSuccess: () => {
      toast.success('Record updated.')
      qc.invalidateQueries(['transfers'])
      closeForm()
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to update.'),
  })

  const recallMut = useMutation({
    mutationFn: (id) => recallTransfer(id),
    onSuccess: () => { toast.success('Recalled to draft.'); qc.invalidateQueries(['transfers']) },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to recall.'),
  })

  const submitMut = useMutation({
    mutationFn: (id) => submitTransfer(id),
    onSuccess: () => { toast.success('Submitted for approval.'); qc.invalidateQueries(['transfers']) },
    onError: e => toast.error(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Failed to submit.'),
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, data }) => reviewTransfer(id, data),
    onSuccess: (_, { data }) => {
      toast.success(data.action === 'approved' ? 'Approved. Expense claim raised.' : 'Rejected.')
      qc.invalidateQueries(['transfers'])
      setReviewModal(null)
      setReviewNotes('')
    },
    onError: () => toast.error('Failed to process review.'),
  })

  const handleSubmitForm = (e) => {
    e.preventDefault()
    if (!form.employee) return toast.error('Select an employee.')
    if (!form.to_location) return toast.error('Destination is required.')
    if (!form.start_date) return toast.error('Start date is required.')
    if (!form.reason.trim()) return toast.error('Reason is required.')

    const allowances = computeAllowances(form)
    const payload = {
      employee:           form.employee,
      transfer_type:      form.record_type === 'relocation' ? 'permanent' : 'temporary',
      destination_type:   form.destination_type,
      from_location:      form.from_location,
      to_location:        form.to_location,
      start_date:         form.start_date,
      end_date:           form.end_date || null,
      reason:             form.reason,
      allowance_eligible: form.allowance_eligible,
      staff_category:     form.staff_category,
      lunch_days:         parseInt(form.lunch_days) || 0,
      overnight_nights:   parseInt(form.overnight_nights) || 0,
      transport_to:       parseFloat(form.transport_to) || 0,
      transport_from:     parseFloat(form.transport_from) || 0,
      ...allowances,
    }
    if (form.project) payload.project = form.project
    if (editingId) {
      updateMut.mutate({ id: editingId, payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const cls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

  return (
    <div className="space-y-5">

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {['', 'draft', 'submitted', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${statusFilter === s
                  ? 'bg-brand-slate text-white border-brand-slate'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => { if (showForm && !editingId) { closeForm() } else { closeForm(); setShowForm(true) } }}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-sm font-semibold rounded-lg hover:opacity-90">
          <PlusIcon className="h-4 w-4" /> New Request
        </button>
      </div>

      {/* ── Create form ── */}
      {showForm && (
        <form onSubmit={handleSubmitForm} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
          <h3 className="font-bold text-brand-slate text-base">{editingId ? 'Edit Movement / Relocation Request' : 'New Movement / Relocation Request'}</h3>

          {/* Type toggle */}
          <div className="flex gap-3">
            {[
              { key: 'movement',   label: 'Movement',   icon: TruckIcon,  desc: 'Temporary — employee returns' },
              { key: 'relocation', label: 'Relocation', icon: HomeIcon,   desc: 'Permanent — change of station' },
            ].map(({ key, label, icon: Icon, desc }) => (
              <button type="button" key={key} onClick={() => set('record_type', key)}
                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
                  ${form.record_type === key ? 'border-brand-red bg-red-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                <Icon className={`h-5 w-5 flex-shrink-0 ${form.record_type === key ? 'text-brand-red' : 'text-gray-400'}`} />
                <div>
                  <p className={`text-sm font-semibold ${form.record_type === key ? 'text-brand-red' : 'text-gray-700'}`}>{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Employee *</label>
              <select value={form.employee} onChange={e => handleEmployeeSelect(e.target.value)} className={cls} required>
                <option value="">— Select employee —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.employee_number} — {e.full_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Destination Type *</label>
              <select value={form.destination_type} onChange={e => { set('destination_type', e.target.value); set('to_location', '') }} className={cls}>
                <option value="site">Site / Field</option>
                <option value="head_office">Head Office</option>
                <option value="branch">Branch Office</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">From Location *</label>
              <input value={form.from_location} onChange={e => set('from_location', e.target.value)}
                placeholder="Auto-filled from employee record" className={cls} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">To Location *</label>
              <select onChange={e => handleDestinationSelect(e.target.value)} className={cls} required
                value={form.project ? `__project__:${form.project}` : form.to_location}>
                <option value="">— Select destination —</option>
                {form.destination_type === 'head_office' && <option value="Head Office">Head Office</option>}
                {form.destination_type === 'branch' && branches.map(b => (
                  <option key={b.id} value={b.name}>{b.name}{b.location ? ` (${b.location})` : ''}</option>
                ))}
                {form.destination_type === 'site' && projects.map(p => (
                  <option key={p.id} value={`__project__:${p.id}`}>{p.name}{p.location ? ` — ${p.location}` : ''}</option>
                ))}
                <option value="Isuzu East Africa">Isuzu East Africa</option>
                <option value="Other">Other (specify in reason)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {form.record_type === 'relocation' ? 'Effective Date' : 'Departure Date'} *
              </label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={cls} required />
            </div>

            {form.record_type === 'movement' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Return Date</label>
                <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={cls} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason / Purpose *</label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={3} className={cls} required />
          </div>

          {/* Allowances */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-xs font-bold text-brand-slate uppercase tracking-wider flex items-center gap-1.5">
              <BanknotesIcon className="h-4 w-4" /> Allowances
            </p>

            {form.record_type === 'movement' && (
              <>
                {isMovementToHQ ? (
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <InformationCircleIcon className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">No lunch allowance — lunch is provided at Head Office.</p>
                  </div>
                ) : (
                  <>
                    {/* Eligibility toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Employee eligible for allowances?</span>
                      <button type="button"
                        onClick={() => set('allowance_eligible', !form.allowance_eligible)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${form.allowance_eligible ? 'bg-brand-red' : 'bg-gray-300'}`}>
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.allowance_eligible ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    {!form.allowance_eligible && (
                      <p className="text-xs text-gray-500 italic">No allowances will be claimed for this movement.</p>
                    )}

                    {form.allowance_eligible && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Lunch Days <span className="font-normal text-gray-400">(KES {LUNCH_RATE.toLocaleString()}/day)</span>
                          </label>
                          <input type="number" min="0" value={form.lunch_days}
                            onChange={e => set('lunch_days', e.target.value)} className={cls} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Overnight Nights <span className="font-normal text-gray-400">(KES {OVERNIGHT_RATE.toLocaleString()}/night)</span>
                          </label>
                          <input type="number" min="0" value={form.overnight_nights}
                            onChange={e => set('overnight_nights', e.target.value)} className={cls} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Transport To <span className="font-normal text-gray-400">(KES — actual cost)</span>
                          </label>
                          <input type="number" min="0" step="any" value={form.transport_to}
                            onChange={e => set('transport_to', e.target.value)}
                            placeholder="0" className={cls} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Transport From <span className="font-normal text-gray-400">(KES — actual cost)</span>
                          </label>
                          <input type="number" min="0" step="any" value={form.transport_from}
                            onChange={e => set('transport_from', e.target.value)}
                            placeholder="0" className={cls} />
                        </div>
                        {totalMovementAllowance > 0 && (
                          <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 space-y-1">
                            {(parseInt(form.lunch_days) || 0) > 0 && (
                              <div className="flex justify-between text-xs text-green-700">
                                <span>Lunch ({form.lunch_days} day{form.lunch_days != 1 ? 's' : ''})</span>
                                <span>KES {((parseInt(form.lunch_days) || 0) * LUNCH_RATE).toLocaleString()}</span>
                              </div>
                            )}
                            {(parseInt(form.overnight_nights) || 0) > 0 && (
                              <div className="flex justify-between text-xs text-green-700">
                                <span>Overnight ({form.overnight_nights} night{form.overnight_nights != 1 ? 's' : ''})</span>
                                <span>KES {((parseInt(form.overnight_nights) || 0) * OVERNIGHT_RATE).toLocaleString()}</span>
                              </div>
                            )}
                            {(parseFloat(form.transport_to) || 0) > 0 && (
                              <div className="flex justify-between text-xs text-green-700">
                                <span>Transport To</span>
                                <span>KES {(parseFloat(form.transport_to) || 0).toLocaleString()}</span>
                              </div>
                            )}
                            {(parseFloat(form.transport_from) || 0) > 0 && (
                              <div className="flex justify-between text-xs text-green-700">
                                <span>Transport From</span>
                                <span>KES {(parseFloat(form.transport_from) || 0).toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between border-t border-green-200 pt-1.5">
                              <span className="text-xs text-green-700 font-semibold">Total Movement Allowance</span>
                              <span className="text-sm font-bold text-green-700">KES {totalMovementAllowance.toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {form.record_type === 'relocation' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Select staff category to determine the one-time relocation fee.</p>
                <div className="flex gap-3">
                  {[
                    { key: 'subordinate', label: 'Subordinate Staff', amount: RELOCATION_SUBORDINATE },
                    { key: 'management',  label: 'Management Staff',  amount: RELOCATION_MANAGEMENT },
                  ].map(({ key, label, amount }) => (
                    <button type="button" key={key} onClick={() => set('staff_category', key)}
                      className={`flex-1 px-4 py-3 rounded-xl border-2 text-left transition-all
                        ${form.staff_category === key ? 'border-brand-red bg-red-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <p className={`text-sm font-semibold ${form.staff_category === key ? 'text-brand-red' : 'text-gray-700'}`}>{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">KES {amount.toLocaleString()} one-time</p>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Transport To <span className="font-normal text-gray-400">(KES — actual cost)</span>
                    </label>
                    <input type="number" min="0" step="any" value={form.transport_to}
                      onChange={e => set('transport_to', e.target.value)}
                      placeholder="0" className={cls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Transport From <span className="font-normal text-gray-400">(KES — actual cost)</span>
                    </label>
                    <input type="number" min="0" step="any" value={form.transport_from}
                      onChange={e => set('transport_from', e.target.value)}
                      placeholder="0" className={cls} />
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-1">
                  <div className="flex justify-between text-xs text-green-700">
                    <span>Relocation Fee</span>
                    <span>KES {relocationAmount.toLocaleString()}</span>
                  </div>
                  {(parseFloat(form.transport_to) || 0) > 0 && (
                    <div className="flex justify-between text-xs text-green-700">
                      <span>Transport To</span>
                      <span>KES {(parseFloat(form.transport_to) || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {(parseFloat(form.transport_from) || 0) > 0 && (
                    <div className="flex justify-between text-xs text-green-700">
                      <span>Transport From</span>
                      <span>KES {(parseFloat(form.transport_from) || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-green-200 pt-1.5">
                    <span className="text-xs text-green-700 font-medium">Total Relocation Allowance</span>
                    <span className="text-base font-bold text-green-700">KES {relocationTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={createMut.isPending || updateMut.isPending}
              className="px-5 py-2 bg-brand-red text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
              {(createMut.isPending || updateMut.isPending) ? 'Saving…' : editingId ? 'Save Changes' : 'Save as Draft'}
            </button>
            <button type="button" onClick={closeForm}
              className="px-5 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Table ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate text-sm">Movement & Relocation Records</h3>
          <span className="text-xs text-gray-500">{transfers.length} records</span>
        </div>
        {isLoading
          ? <p className="text-sm text-gray-500 p-8 text-center">Loading…</p>
          : transfers.length === 0
            ? <p className="text-sm text-gray-500 p-8 text-center">No records found.</p>
            : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Employee', 'Type', 'Route', 'Dates', 'Allowance', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transfers.map(t => {
                      const totalAllow = parseFloat(t.total_allowance || 0)
                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-brand-slate text-xs">{t.employee_number}</p>
                            <p className="text-xs text-gray-600">{t.employee_name}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                              ${t.transfer_type === 'permanent' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                              {t.transfer_type === 'permanent' ? 'Relocation' : 'Movement'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-600 flex items-center gap-1 flex-wrap">
                              <span className="font-medium">{t.from_location}</span>
                              <ArrowRightIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className="font-medium">{t.to_location}</span>
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <p>{t.start_date}</p>
                            {t.end_date && <p className="text-gray-400">↩ {t.end_date}</p>}
                          </td>
                          <td className="px-4 py-3">
                            {totalAllow > 0
                              ? <p className="text-xs font-semibold text-green-700">KES {totalAllow.toLocaleString()}</p>
                              : <p className="text-xs text-gray-400">—</p>}
                            {t.status === 'approved' && totalAllow > 0 && (
                              <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                                <BanknotesIcon className="h-3 w-3" /> Expense raised
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || ''}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 items-center flex-wrap">
                              {t.status === 'draft' && (<>
                                <button onClick={() => openEdit(t)} title="Edit"
                                  className="flex items-center gap-1 text-xs font-medium text-brand-slate hover:text-brand-red">
                                  <PencilSquareIcon className="h-3.5 w-3.5" /> Edit
                                </button>
                                <button onClick={() => submitMut.mutate(t.id)}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-800">Submit</button>
                              </>)}
                              {t.status === 'submitted' && (<>
                                <button onClick={() => recallMut.mutate(t.id)} disabled={recallMut.isPending} title="Recall to draft"
                                  className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 disabled:opacity-50">
                                  <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> Recall
                                </button>
                                <button onClick={() => { setReviewModal({ transfer: t, action: 'approved' }); setReviewNotes('') }}
                                  title="Approve" className="text-green-600 hover:text-green-800">
                                  <CheckCircleIcon className="h-4 w-4" />
                                </button>
                                <button onClick={() => { setReviewModal({ transfer: t, action: 'rejected' }); setReviewNotes('') }}
                                  title="Reject" className="text-red-500 hover:text-red-700">
                                  <XCircleIcon className="h-4 w-4" />
                                </button>
                              </>)}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {/* Review modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-brand-slate">
                {reviewModal.action === 'approved' ? 'Approve Request' : 'Reject Request'}
              </h3>
              <button onClick={() => setReviewModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{reviewModal.transfer.employee_name}</span>
              {' → '}{reviewModal.transfer.to_location}
            </p>
            {reviewModal.action === 'approved' && parseFloat(reviewModal.transfer.total_allowance || 0) > 0 && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <InformationCircleIcon className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  An expense claim of <strong>KES {parseFloat(reviewModal.transfer.total_allowance).toLocaleString()}</strong> will be
                  automatically raised in Finance.
                </p>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => reviewMut.mutate({ id: reviewModal.transfer.id, data: { action: reviewModal.action, review_notes: reviewNotes } })}
                disabled={reviewMut.isPending}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50
                  ${reviewModal.action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {reviewMut.isPending ? 'Processing…' : reviewModal.action === 'approved' ? 'Approve' : 'Reject'}
              </button>
              <button onClick={() => setReviewModal(null)}
                className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
