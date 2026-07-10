import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  UserCircleIcon, KeyIcon, CalendarDaysIcon, CurrencyDollarIcon,
  ClipboardDocumentListIcon, DocumentTextIcon, CameraIcon,
  CheckCircleIcon, ClockIcon, BanknotesIcon, PlusIcon,
  PrinterIcon, ChartBarIcon, ArrowRightIcon, ArchiveBoxArrowDownIcon,
  FingerPrintIcon, MapPinIcon,
} from '@heroicons/react/24/outline'
import api from '../../api/client'
import useAuthStore from '../../store/authStore'
import { printDoc } from '../../utils/print'
import { getStores, getStoreItems, createStoreRequest, getStoreRequests, cancelStoreRequest } from '../../api/inventory'

// ── API helpers ───────────────────────────────────────────────────────────────
const getMe            = ()     => api.get('/auth/me/')
const patchMe          = (data) => api.patch('/auth/me/', data)
const changePassword   = (d)    => api.post('/auth/change-password/', d)
const getEmployees     = ()     => api.get('/hr/employees/', { params: { page_size: 200 } })
const getLeaveTypes    = ()     => api.get('/hr/leave-types/', { params: { page_size: 50 } })
const getLeaveBalances = ()     => api.get('/hr/leave-balances/', { params: { page_size: 50, year: new Date().getFullYear() } })
const getMyLeaves      = ()     => api.get('/hr/leave-applications/', { params: { page_size: 50 } })
const createLeave      = (d)    => api.post('/hr/leave-applications/', d)
const updateLeave      = (id, d)=> api.patch(`/hr/leave-applications/${id}/`, d)
const submitLeave      = (id)   => api.post(`/hr/leave-applications/${id}/submit/`)
const cancelLeave      = (id)   => api.post(`/hr/leave-applications/${id}/cancel/`)
const getMyAdvances    = (emp)  => api.get('/hr/advances/', { params: { employee: emp, page_size: 50 } })
const createAdvance    = (d)    => api.post('/hr/advances/', d)
const getMyPayslips    = (emp)  => api.get('/hr/payroll/entries/', { params: { employee: emp, page_size: 50 } })
const getMyReqs        = ()     => api.get('/requisitions/', { params: { mine: 'true', page_size: 200 } })

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-100 text-amber-700',
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  deducted:  'bg-blue-100 text-blue-700',
  paid:      'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  processing:'bg-purple-100 text-purple-700',
}

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

const SR_STATUS_COLORS = {
  submitted:  'bg-yellow-100 text-yellow-700',
  approved:   'bg-blue-100 text-blue-700',
  rejected:   'bg-red-100 text-red-700',
  dispatched: 'bg-purple-100 text-purple-700',
  received:   'bg-green-100 text-green-700',
  returned:   'bg-amber-100 text-amber-700',
  cancelled:  'bg-gray-100 text-gray-500',
}

const SR_STATUS_LABELS = {
  submitted:  'Submitted',
  approved:   'Approved',
  rejected:   'Rejected',
  dispatched: 'Dispatched',
  received:   'Received',
  returned:   'Returned',
  cancelled:  'Cancelled',
}

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'

const TABS = [
  { id: 'overview',      label: 'Overview',        icon: ChartBarIcon },
  { id: 'attendance',    label: 'Attendance',      icon: FingerPrintIcon },
  { id: 'profile',       label: 'My Profile',      icon: UserCircleIcon },
  { id: 'leave',         label: 'Leave',           icon: CalendarDaysIcon },
  { id: 'advance',       label: 'Salary Advance',  icon: CurrencyDollarIcon },
  { id: 'payslips',      label: 'Payslips',        icon: DocumentTextIcon },
  { id: 'storerequests', label: 'Store Requests',  icon: ArchiveBoxArrowDownIcon },
  { id: 'requisitions',  label: 'Requisitions',    icon: ClipboardDocumentListIcon },
]

// ── Print payslip ─────────────────────────────────────────────────────────────
function printPayslip(entry, user) {
  const deductions = (Number(entry.paye || 0) + Number(entry.nssf_employee || 0) + Number(entry.nhif_employee || 0)).toLocaleString()
  printDoc({
    title: `Payslip — ${entry.period_name || `${entry.month}/${entry.year}`}`,
    html: `
    <div class="info-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:20px;">
      <div class="info-box"><label>Employee</label><span>${entry.employee_name || user?.first_name + ' ' + user?.last_name}</span></div>
      <div class="info-box"><label>Period</label><span>${entry.period_name || `${entry.month} ${entry.year}`}</span></div>
      <div class="info-box"><label>Department</label><span>${user?.department_name || '—'}</span></div>
      <div class="info-box"><label>Status</label><span>${entry.status || '—'}</span></div>
    </div>

    <p class="section-title">Earnings</p>
    <table>
      <thead><tr><th>Description</th><th class="amount">Amount (KES)</th></tr></thead>
      <tbody>
        <tr><td>Basic / Gross Pay</td><td class="amount">${Number(entry.gross_pay || 0).toLocaleString()}</td></tr>
      </tbody>
      <tfoot><tr><td>Total Gross Pay</td><td class="amount">${Number(entry.gross_pay || 0).toLocaleString()}</td></tr></tfoot>
    </table>

    <p class="section-title">Deductions</p>
    <table>
      <thead><tr><th>Description</th><th class="amount">Amount (KES)</th></tr></thead>
      <tbody>
        <tr><td>PAYE (Income Tax)</td><td class="amount">${Number(entry.paye || 0).toLocaleString()}</td></tr>
        <tr><td>NSSF (Employee)</td><td class="amount">${Number(entry.nssf_employee || 0).toLocaleString()}</td></tr>
        <tr><td>NHIF / SHA</td><td class="amount">${Number(entry.nhif_employee || 0).toLocaleString()}</td></tr>
      </tbody>
      <tfoot><tr><td>Total Deductions</td><td class="amount">${Number(entry.total_deductions || deductions).toLocaleString()}</td></tr></tfoot>
    </table>

    <div class="totals-block" style="margin-top:16px;">
      <div class="totals-row" style="background:#f0fdf4;">
        <span class="totals-label" style="color:#15803d;font-weight:700;font-size:13px;">NET PAY</span>
        <span class="totals-value" style="color:#15803d;font-size:15px;font-weight:800;">${fmt(entry.net_pay)}</span>
      </div>
    </div>

    <div class="sig-row" style="margin-top:40px;">
      <div class="sig-box"><label>Employee Signature</label><span>&nbsp;</span></div>
      <div class="sig-box"><label>HR Manager</label><span>&nbsp;</span></div>
      <div class="sig-box"><label>Finance Officer</label><span>&nbsp;</span></div>
    </div>`,
  })
}

// ── Request Items Modal ───────────────────────────────────────────────────────
function RequestItemsModal({ onClose }) {
  const qc = useQueryClient()
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [form, setForm] = useState({ item: '', quantity: '', justification: '', date_required: '' })

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: storeItems = [], isFetching: fetchingItems } = useQuery({
    queryKey: ['store-browse-items', selectedStoreId],
    queryFn: () => getStoreItems(selectedStoreId),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!selectedStoreId,
  })

  const createMut = useMutation({
    mutationFn: (d) => createStoreRequest(d),
    onSuccess: () => {
      toast.success('Store request submitted')
      qc.invalidateQueries({ queryKey: ['my-store-requests'] })
      onClose()
    },
    onError: e => {
      const d = e.response?.data
      toast.error(d?.detail || d?.item?.[0] || d?.quantity_requested?.[0] || 'Failed to submit request')
    },
  })

  const today = new Date().toISOString().slice(0, 10)
  const canSubmit = selectedStoreId && form.item && form.quantity && form.justification.trim()
  const selectedItem = storeItems.find(i => String(i.id) === String(form.item))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">

        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Request Items from Store</h2>
            <p className="text-white/50 text-xs mt-0.5">Select a store and the item you need</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Store <span className="text-red-500">*</span></label>
            <select className={inp} value={selectedStoreId}
              onChange={e => { setSelectedStoreId(e.target.value); setForm(f => ({ ...f, item: '' })) }}>
              <option value="">— Select a store —</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {selectedStoreId && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Item <span className="text-red-500">*</span></label>
              {fetchingItems ? (
                <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
              ) : storeItems.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No items found in this store.</p>
              ) : (
                <>
                  <select className={inp} value={form.item}
                    onChange={e => setForm(f => ({ ...f, item: e.target.value }))}>
                    <option value="">— Select an item —</option>
                    {storeItems.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.item_code}) — {Number(i.stock_in_store).toLocaleString()} {i.unit} in stock
                      </option>
                    ))}
                  </select>
                  {selectedItem && (
                    <div className="mt-1.5 flex items-center gap-3 text-xs">
                      <span className="text-gray-500">In stock:</span>
                      <span className={`font-semibold ${Number(selectedItem.stock_in_store) === 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {Number(selectedItem.stock_in_store).toLocaleString()} {selectedItem.unit}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity Requested <span className="text-red-500">*</span></label>
            <input type="number" min="0.01" step="any" className={inp}
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="0" />
            {selectedItem && form.quantity && Number(form.quantity) > Number(selectedItem.stock_in_store) && (
              <p className="text-[11px] text-amber-600 mt-1">⚠ Requested qty exceeds current stock — storekeeper may approve a partial quantity.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Justification <span className="text-red-500">*</span></label>
            <textarea rows={3} className={`${inp} resize-none`}
              value={form.justification}
              onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
              placeholder="Explain why you need this item (e.g. Site works — Thika Road, replacing damaged equipment…)" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Date Required <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="date" className={inp} min={today}
              value={form.date_required}
              onChange={e => setForm(f => ({ ...f, date_required: e.target.value }))} />
            <p className="text-[10px] text-gray-400 mt-1">When do you need this by? Used to flag overdue requests.</p>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => createMut.mutate({ item: form.item, quantity_requested: Number(form.quantity), source_store: selectedStoreId, justification: form.justification, date_required: form.date_required || undefined })}
            disabled={createMut.isPending || !canSubmit}
            className="flex-1 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90">
            {createMut.isPending ? 'Submitting…' : 'Submit Request'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ user, employee, leaveBalances, leaves, advances, reqs, setTab, onRequestItems }) {
  const navigate = useNavigate()

  const photoUrl = user?.profile_photo
    ? (user.profile_photo.startsWith('http') ? user.profile_photo : `${API_BASE}${user.profile_photo}`)
    : null

  const pendingLeave    = leaves.filter(l => l.status === 'submitted').length
  const pendingAdvance  = advances.filter(a => a.status === 'pending').length
  const totalLeaveLeft  = leaveBalances.reduce((s, b) => s + Number(b.balance || 0), 0)

  const quickActions = [
    { label: 'Apply for Leave',    icon: CalendarDaysIcon,         color: 'text-green-600 bg-green-50',   tab: 'leave' },
    { label: 'Request Advance',    icon: CurrencyDollarIcon,       color: 'text-blue-600 bg-blue-50',     tab: 'advance' },
    { label: 'Request Items',      icon: ArchiveBoxArrowDownIcon,  color: 'text-orange-600 bg-orange-50', action: onRequestItems },
    { label: 'View Payslips',      icon: DocumentTextIcon,         color: 'text-purple-600 bg-purple-50', tab: 'payslips' },
  ]

  const recentActivity = [
    ...leaves.slice(0, 3).map(l => ({ type: 'Leave', label: `${l.leave_type_name || 'Leave'} — ${l.start_date}`, status: l.status, date: l.created_at })),
    ...advances.slice(0, 3).map(a => ({ type: 'Advance', label: `${fmt(a.amount)} advance`, status: a.status, date: a.created_at })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="bg-gradient-to-r from-[#1a2332] to-[#243347] rounded-xl p-6 flex items-center gap-5 text-white">
        <div className="shrink-0">
          {photoUrl
            ? <img src={photoUrl} alt="" className="h-16 w-16 rounded-full object-cover border-2 border-white/30" />
            : <div className="h-16 w-16 rounded-full bg-brand-red flex items-center justify-center text-2xl font-bold border-2 border-white/30">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">{user?.first_name} {user?.last_name}</h2>
          <p className="text-white/70 text-sm capitalize">{user?.role_display || user?.role?.replace(/_/g, ' ')}</p>
          <p className="text-white/50 text-xs mt-0.5">{user?.department_name || 'No department'} · {user?.email}</p>
        </div>
        <button onClick={() => setTab('profile')}
          className="shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors">
          Edit Profile
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Leave Days Left', value: totalLeaveLeft, icon: CalendarDaysIcon, color: 'text-green-600 bg-green-50', tab: 'leave' },
          { label: 'Pending Leaves',  value: pendingLeave,   icon: ClockIcon,        color: 'text-amber-600 bg-amber-50', tab: 'leave' },
          { label: 'Pending Advances',value: pendingAdvance, icon: CurrencyDollarIcon,color:'text-blue-600 bg-blue-50',   tab: 'advance' },
        ].map(({ label, value, icon: Icon, color, tab: t }) => (
          <button key={label} onClick={() => setTab(t)}
            className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left">
            <div className={`${color} p-2 rounded-lg shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-brand-slate">{value}</p>
              <p className="text-xs text-gray-600">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="font-semibold text-brand-slate text-sm mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map(({ label, icon: Icon, color, tab: t, action }) => (
            <button key={label}
              onClick={() => t ? setTab(t) : action?.()}
              className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow">
              <div className={`${color} p-3 rounded-xl`}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Recent Activity</h3>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-gray-600 p-8 text-center">No recent activity.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded font-medium shrink-0">{item.type}</span>
                <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{item.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>
                  {item.status}
                </span>
                <span className="text-xs text-gray-600 shrink-0 hidden sm:block">
                  {item.date ? new Date(item.date).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ user, refetch }) {
  const photoRef = useRef()
  const [form, setForm] = useState({ first_name: user?.first_name || '', last_name: user?.last_name || '', phone: user?.phone || '' })
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setPw = (k, v) => setPwForm(f => ({ ...f, [k]: v }))

  const photoUrl = user?.profile_photo
    ? (user.profile_photo.startsWith('http') ? user.profile_photo : `${API_BASE}${user.profile_photo}`)
    : null

  const updateMut = useMutation({
    mutationFn: (data) => patchMe(data),
    onSuccess: () => { toast.success('Profile updated'); refetch() },
    onError: () => toast.error('Failed to update profile'),
  })

  const photoMut = useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('profile_photo', file)
      return api.patch('/auth/me/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { toast.success('Photo updated'); refetch() },
    onError: () => toast.error('Failed to upload photo'),
  })

  const pwMut = useMutation({
    mutationFn: () => changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password }),
    onSuccess: () => { toast.success('Password changed'); setPwForm({ old_password: '', new_password: '', confirm: '' }) },
    onError: e => {
      const d = e.response?.data
      const msg = d?.old_password || d?.new_password || d?.detail || 'Failed to change password'
      toast.error(Array.isArray(msg) ? msg[0] : msg)
    },
  })

  const mismatch = pwForm.new_password && pwForm.confirm && pwForm.new_password !== pwForm.confirm

  return (
    <div className="space-y-6">
      {/* Avatar + read-only info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row gap-6">
        <div className="flex flex-col items-center gap-3 shrink-0">
          <div className="relative">
            {photoUrl
              ? <img src={photoUrl} alt="Profile" className="h-24 w-24 rounded-full object-cover border-2 border-gray-200" />
              : <div className="h-24 w-24 rounded-full bg-brand-red flex items-center justify-center text-white text-3xl font-bold">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
            }
            <button onClick={() => photoRef.current?.click()}
              className="absolute bottom-0 right-0 h-7 w-7 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow hover:bg-gray-50">
              <CameraIcon className="h-4 w-4 text-gray-500" />
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files[0] && photoMut.mutate(e.target.files[0])} />
          </div>
          {photoMut.isPending && <p className="text-xs text-amber-600">Uploading…</p>}
          <p className="text-xs text-gray-600 text-center">Click camera to change photo</p>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          {[
            { label: 'Email',       value: user?.email },
            { label: 'Role',        value: user?.role_display || user?.role?.replace(/_/g, ' ') },
            { label: 'Department',  value: user?.department_name || '—' },
            { label: 'Branch',      value: user?.branch_name || '—' },
            { label: 'Date Joined', value: user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-sm font-medium text-brand-slate capitalize">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-4">Edit Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[['first_name','First Name'],['last_name','Last Name'],['phone','Phone']].map(([k, label]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input value={form[k]} onChange={e => set(k, e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
          ))}
        </div>
        <button onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending}
          className="mt-4 px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
          {updateMut.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Change password */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-4">Change Password</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[['old_password','Current Password'],['new_password','New Password'],['confirm','Confirm New Password']].map(([k, label]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input type="password" value={pwForm[k]} onChange={e => setPw(k, e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-brand-red ${k === 'confirm' && mismatch ? 'border-red-400' : 'border-gray-200'}`} />
            </div>
          ))}
        </div>
        {mismatch && <p className="text-xs text-red-500 mt-2">Passwords do not match</p>}
        <button onClick={() => pwMut.mutate()}
          disabled={pwMut.isPending || !pwForm.old_password || !pwForm.new_password || mismatch}
          className="mt-4 px-5 py-2 bg-brand-slate text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
          {pwMut.isPending ? 'Changing…' : 'Change Password'}
        </button>
      </div>
    </div>
  )
}

// ── Leave Tab ─────────────────────────────────────────────────────────────────
const LEAVE_STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
}
const LEAVE_STATUS_LABELS = {
  draft: 'Draft', submitted: 'Pending Approval',
  approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
}

function LeaveTab({ employeeId }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null) // id of leave being edited
  const BLANK_FORM = { leave_type: '', start_date: '', end_date: '', handover_to: '', reason: '' }
  const [form, setForm] = useState(BLANK_FORM)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn:  () => getLeaveTypes().then(r => r.data?.results ?? r.data ?? []),
  })
  const { data: balances = [] } = useQuery({
    queryKey: ['leave-balances', employeeId],
    queryFn:  () => api.get('/hr/leave-balances/', { params: { employee: employeeId, year: new Date().getFullYear(), page_size: 50 } }).then(r => r.data?.results ?? r.data ?? []),
    enabled:  !!employeeId,
  })
  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['my-leaves'],
    queryFn:  () => getMyLeaves().then(r => r.data?.results ?? r.data ?? []),
  })
  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees-simple'],
    queryFn:  () => api.get('/hr/employees/', { params: { is_active: true, page_size: 200 } })
                       .then(r => r.data?.results ?? r.data ?? []),
  })


  const saveMut = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, employee: employeeId }
      if (!payload.handover_to) delete payload.handover_to
      if (editingId) {
        await updateLeave(editingId, payload)
      } else {
        const res = await createLeave(payload)
        await submitLeave(res.data.id)
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Leave application updated.' : 'Leave application submitted for approval.')
      qc.invalidateQueries({ queryKey: ['my-leaves'] })
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
      setShowForm(false)
      setEditingId(null)
      setForm(BLANK_FORM)
    },
    onError: e => {
      const d = e.response?.data
      toast.error(typeof d === 'object' ? Object.values(d).flat().join(', ') : 'Failed to save leave application')
    },
  })

  const cancelMut = useMutation({
    mutationFn: (id) => cancelLeave(id),
    onSuccess: () => {
      toast.success('Leave application retracted.')
      qc.invalidateQueries({ queryKey: ['my-leaves'] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to retract.'),
  })

  const openEdit = (leave) => {
    setForm({
      leave_type:   String(leave.leave_type),
      start_date:   leave.start_date,
      end_date:     leave.end_date,
      handover_to:  leave.handover_to ? String(leave.handover_to) : '',
      reason:       leave.reason || '',
    })
    setEditingId(leave.id)
    setShowForm(true)
  }

  const openNew = () => {
    setForm(BLANK_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red'

  return (
    <div className="space-y-5">
      {/* Leave balances grid */}
      {balances.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {balances.map(b => {
            const entitled = Number(b.entitled_days ?? 0) + Number(b.carried_forward ?? 0)
            const taken    = Number(b.taken_days ?? 0)
            const balance  = Number(b.balance ?? 0)
            const pct      = entitled > 0 ? Math.min(100, (taken / entitled) * 100) : 0
            return (
              <div key={b.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-3 min-w-0">
                <div>
                  <p className="text-[10px] font-medium text-gray-500 whitespace-nowrap">{b.leave_type_name}</p>
                  <p className="text-lg font-bold text-brand-slate leading-none">{balance} <span className="text-[10px] font-normal text-gray-400">days</span></p>
                  <p className="text-[10px] text-gray-400">{taken} used · {entitled} entitled</p>
                </div>
                <div className="w-1 self-stretch rounded-full bg-gray-100 overflow-hidden">
                  <div className="w-full bg-green-500 rounded-full" style={{ height: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-500">No leave balances found for this year.</p>
          <p className="text-xs text-gray-400 mt-1">Contact HR to initialize your leave balances.</p>
        </div>
      )}

      {/* Apply button + form */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-slate text-sm">My Leave Applications</h3>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Apply for Leave
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="font-medium text-brand-slate text-sm mb-4">
            {editingId ? 'Edit Leave Application' : 'New Leave Application'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type *</label>
              <select value={form.leave_type} onChange={e => set('leave_type', e.target.value)} className={inputCls}>
                <option value="">Select type…</option>
                {leaveTypes.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.days_entitled > 0 ? ` (${t.days_entitled} days/yr)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date *</label>
              <input type="date" value={form.end_date} min={form.start_date} onChange={e => set('end_date', e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Handover To</label>
              <select value={form.handover_to} onChange={e => set('handover_to', e.target.value)} className={inputCls}>
                <option value="">No handover</option>
                {allEmployees.map(e => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label>
              <textarea
                value={form.reason}
                onChange={e => set('reason', e.target.value)}
                rows={3}
                required
                placeholder="Briefly describe the reason for your leave…"
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => saveMut.mutate(form)}
              disabled={saveMut.isPending || !form.leave_type || !form.start_date || !form.end_date || !form.reason}
              className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
            >
              {saveMut.isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Submit Application'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(BLANK_FORM) }}
              className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="font-semibold text-brand-slate text-sm">My Applications</p>
        </div>
        {isLoading
          ? <div className="p-6 space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse"/>)}</div>
          : leaves.length === 0
            ? <p className="text-sm text-gray-600 p-8 text-center">No leave applications yet.</p>
            : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Ref', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Comments', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leaves.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{l.reference}</td>
                      <td className="px-4 py-3 font-medium text-brand-slate">{l.leave_type_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{l.start_date}</td>
                      <td className="px-4 py-3 text-gray-600">{l.end_date}</td>
                      <td className="px-4 py-3 text-gray-600">{l.days ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEAVE_STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
                          {LEAVE_STATUS_LABELS[l.status] || l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate italic">
                        {l.review_notes || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {l.status === 'draft' && (
                            <button
                              onClick={() => openEdit(l)}
                              className="text-xs text-brand-slate hover:text-brand-red font-medium"
                            >
                              Edit
                            </button>
                          )}
                          {['draft', 'submitted'].includes(l.status) && (
                            <button
                              onClick={() => { if (window.confirm('Retract this leave application?')) cancelMut.mutate(l.id) }}
                              disabled={cancelMut.isPending}
                              className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                            >
                              Retract
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
      </div>
    </div>
  )
}

// ── Advance Tab ───────────────────────────────────────────────────────────────
function AdvanceTab({ employeeId }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', reason: '', repayment_months: 3 })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ['my-advances', employeeId],
    queryFn: () => getMyAdvances(employeeId).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!employeeId,
  })

  const totalApproved = advances.filter(a=>a.status==='approved').reduce((s,a)=>s+Number(a.amount||0),0)
  const totalPending  = advances.filter(a=>a.status==='pending').reduce((s,a)=>s+Number(a.amount||0),0)
  const totalDeducted = advances.filter(a=>a.status==='deducted').reduce((s,a)=>s+Number(a.amount||0),0)

  const createMut = useMutation({
    mutationFn: (data) => createAdvance({ ...data, employee: employeeId }),
    onSuccess: () => {
      toast.success('Salary advance request submitted')
      qc.invalidateQueries({ queryKey: ['my-advances'] })
      setShowForm(false)
      setForm({ amount: '', reason: '', repayment_months: 3 })
    },
    onError: e => {
      const d = e.response?.data
      toast.error(typeof d === 'object' ? Object.values(d).flat().join(', ') : 'Failed to submit')
    },
  })

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Approved', value: fmt(totalApproved), color: 'text-green-600 bg-green-50' },
          { label: 'Pending',  value: fmt(totalPending),  color: 'text-amber-600 bg-amber-50' },
          { label: 'Deducted', value: fmt(totalDeducted), color: 'text-blue-600 bg-blue-50' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-600 mb-1">{label}</p>
            <p className={`text-lg font-bold ${color.split(' ')[0]}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-slate text-sm">Advance Requests</h3>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Request Advance
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="font-medium text-brand-slate text-sm mb-4">New Advance Request</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (KES) *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Repayment Period</label>
              <select value={form.repayment_months} onChange={e => set('repayment_months', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                {[1,2,3,4,5,6,9,12].map(m=><option key={m} value={m}>{m} month{m>1?'s':''}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label>
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMut.mutate(form)}
              disabled={createMut.isPending || !form.amount || !form.reason}
              className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
              {createMut.isPending ? 'Submitting…' : 'Submit Request'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {isLoading ? <div className="p-6 space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-8 bg-gray-100 rounded animate-pulse"/>)}</div>
        : advances.length === 0 ? <p className="text-sm text-gray-600 p-8 text-center">No advance requests yet.</p>
        : (
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Amount','Repayment','Reason','Requested','Status'].map(h=><th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {advances.map(a=>(
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate">{fmt(a.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">{a.repayment_months} mo.</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{a.reason}</td>
                  <td className="px-4 py-3 text-gray-600">{a.created_at?new Date(a.created_at).toLocaleDateString():'—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status]||'bg-gray-100 text-gray-600'}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Requisitions Tab ──────────────────────────────────────────────────────────
function RequisitionsTab() {
  const navigate = useNavigate()
  const { data: reqs = [], isLoading } = useQuery({
    queryKey: ['my-reqs'],
    queryFn: () => getMyReqs().then(r => r.data?.results ?? r.data ?? []),
  })

  const stats = {
    draft:    reqs.filter(r=>r.status==='draft').length,
    pending:  reqs.filter(r=>['pending','submitted'].includes(r.status)).length,
    approved: reqs.filter(r=>r.status==='approved').length,
    rejected: reqs.filter(r=>r.status==='rejected').length,
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(stats).map(([k,v])=>(
          <div key={k} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-brand-slate">{v}</p>
            <p className="text-xs text-gray-600 capitalize">{k}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-slate text-sm">My Requisitions ({reqs.length})</h3>
        <button onClick={() => navigate('/requisitions/new')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> New Requisition
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {isLoading ? <div className="p-6 space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="h-8 bg-gray-100 rounded animate-pulse"/>)}</div>
        : reqs.length === 0 ? <p className="text-sm text-gray-600 p-8 text-center">No requisitions yet.</p>
        : (
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Reference','Description','Date','Status',''].map(h=><th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {reqs.map(r=>(
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate">{r.reference_number||r.rq_number||'—'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{r.description||r.title||'—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.created_at?new Date(r.created_at).toLocaleDateString():'—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]||'bg-gray-100 text-gray-600'}`}>{r.status}</span></td>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/requisitions/${r.id}`)}
                      className="flex items-center gap-1 text-xs text-brand-red hover:underline">
                      View <ArrowRightIcon className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Payslips Tab ──────────────────────────────────────────────────────────────
function PayslipsTab({ employeeId, user }) {
  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['my-payslips', employeeId],
    queryFn: () => getMyPayslips(employeeId).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!employeeId,
  })

  const totalNet  = payslips.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.net_pay||0),0)
  const totalPAYE = payslips.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.paye||0),0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 mb-1">Payslips Available</p>
          <p className="text-2xl font-bold text-brand-slate">{payslips.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 mb-1">YTD Net Pay</p>
          <p className="text-xl font-bold text-green-600">{fmt(totalNet)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 mb-1">YTD PAYE Deducted</p>
          <p className="text-xl font-bold text-red-600">{fmt(totalPAYE)}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Payslip History</h3>
        </div>
        {isLoading ? <div className="p-6 space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="h-8 bg-gray-100 rounded animate-pulse"/>)}</div>
        : !employeeId ? <p className="text-sm text-gray-600 p-8 text-center">No employee record linked to your account.</p>
        : payslips.length === 0 ? <p className="text-sm text-gray-600 p-8 text-center">No payslips available yet.</p>
        : (
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Period','Gross Pay','PAYE','NSSF','NHIF','Deductions','Net Pay','Status',''].map(h=>(
                <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {payslips.map(p=>(
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate whitespace-nowrap">{p.period_name||`${p.month}/${p.year}`}</td>
                  <td className="px-4 py-3">{fmt(p.gross_pay)}</td>
                  <td className="px-4 py-3 text-red-600">{fmt(p.paye)}</td>
                  <td className="px-4 py-3 text-red-600">{fmt(p.nssf_employee)}</td>
                  <td className="px-4 py-3 text-red-600">{fmt(p.nhif_employee)}</td>
                  <td className="px-4 py-3 text-red-600 font-medium">{fmt(p.total_deductions)}</td>
                  <td className="px-4 py-3 font-bold text-green-700">{fmt(p.net_pay)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status]||'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => printPayslip(p, user)}
                      className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50 whitespace-nowrap">
                      <PrinterIcon className="h-3 w-3" /> Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Store Requests Tab ────────────────────────────────────────────────────────
function MyStoreRequestsTab({ onNewRequest }) {
  const qc = useQueryClient()

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['my-store-requests'],
    queryFn: () => getStoreRequests({ view: 'outgoing', page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const cancelMut = useMutation({
    mutationFn: (id) => cancelStoreRequest(id),
    onSuccess: () => { toast.success('Request cancelled'); refetch() },
    onError: e => toast.error(e.response?.data?.detail || 'Cancel failed'),
  })

  const pending   = requests.filter(r => ['submitted', 'approved'].includes(r.status)).length
  const dispatched = requests.filter(r => r.status === 'dispatched').length
  const received  = requests.filter(r => r.status === 'received').length

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending',    value: pending,    color: 'text-amber-600' },
          { label: 'Dispatched', value: dispatched, color: 'text-purple-600' },
          { label: 'Received',   value: received,   color: 'text-green-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-slate text-sm">My Requests ({requests.length})</h3>
        <button onClick={onNewRequest}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> New Request
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : requests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <ArchiveBoxArrowDownIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">No store requests yet.</p>
          <p className="text-xs text-gray-400 mt-1">Use "New Request" to request items from any store.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => {
            const today = new Date().toISOString().slice(0, 10)
            const isOverdue = req.date_required && req.date_required < today &&
              ['submitted', 'approved', 'dispatched'].includes(req.status)
            return (
            <div key={req.id} className={`border rounded-xl p-4 ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs font-bold text-brand-red">{req.reference}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SR_STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-500'}`}>
                      {SR_STATUS_LABELS[req.status] || req.status}
                    </span>
                    {isOverdue && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Overdue</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{req.item_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {req.quantity_requested} {req.item_unit} requested
                    {req.quantity_approved ? ` · ${req.quantity_approved} approved` : ''}
                    {' · '}{req.source_store_name}
                  </p>
                  {req.date_required && (
                    <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      Needed by: {new Date(req.date_required + 'T00:00:00').toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  {req.justification && (
                    <p className="text-xs text-gray-400 mt-0.5 italic truncate max-w-sm">{req.justification}</p>
                  )}
                  {req.rejection_reason && (
                    <p className="mt-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1">Rejected: {req.rejection_reason}</p>
                  )}
                  {req.storekeeper_notes && (
                    <p className="mt-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1">Note: {req.storekeeper_notes}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {['submitted', 'approved'].includes(req.status) && (
                    <button
                      onClick={() => cancelMut.mutate(req.id)}
                      disabled={cancelMut.isPending}
                      className="px-2.5 py-1 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-50">
                      Cancel
                    </button>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {new Date(req.requested_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Attendance (Self Punch) Tab ───────────────────────────────────────────────
const ATT_STATUS_COLORS = {
  present:        'bg-green-100 text-green-700',
  late:           'bg-yellow-100 text-yellow-700',
  absent:         'bg-red-100 text-red-700',
  half_day:       'bg-orange-100 text-orange-700',
  on_leave:       'bg-slate-100 text-brand-slate',
  public_holiday: 'bg-gray-100 text-gray-500',
  off:            'bg-gray-50 text-gray-400',
}

function AttendanceTab() {
  const qc = useQueryClient()
  const [locError, setLocError] = useState('')
  const [punching, setPunching]  = useState(false)

  const { data: record, isLoading, refetch } = useQuery({
    queryKey: ['self-attendance-today'],
    queryFn: () => api.get('/hr/attendance/self-punch/').then(r => r.data),
    refetchInterval: 60_000,
  })

  const punch = async (event_type) => {
    setLocError('')
    setPunching(true)
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      )
      const { latitude, longitude } = pos.coords
      await api.post('/hr/attendance/self-punch/', { event_type, latitude, longitude })
      toast.success(event_type === 'in' ? 'Clocked in successfully.' : 'Clocked out successfully.')
      qc.invalidateQueries(['self-attendance-today'])
      refetch()
    } catch (err) {
      if (err?.code === 1) {
        setLocError('Location access denied. Please allow location in your browser to mark attendance.')
      } else if (err?.response?.data?.error) {
        setLocError(err.response.data.error)
      } else {
        setLocError('Failed to record attendance. Please try again.')
      }
    } finally {
      setPunching(false)
    }
  }

  const todayStr   = new Date().toISOString().slice(0, 10)
  const timeStr    = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  const hasClockedIn  = !!record?.time_in
  const hasClockedOut = !!record?.time_out

  return (
    <div className="space-y-5 max-w-xl">
      {/* Today status card */}
      <div className="bg-gradient-to-br from-brand-slate to-[#243347] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/60 text-xs uppercase tracking-widest">Today</p>
            <p className="text-xl font-bold mt-0.5">{todayStr}</p>
          </div>
          {record?.status && (
            <span className={`text-xs px-3 py-1.5 rounded-full font-semibold capitalize ${ATT_STATUS_COLORS[record.status]}`}>
              {record.status.replace('_', ' ')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl px-4 py-3">
            <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1">Time In</p>
            <p className="text-2xl font-bold font-mono">
              {record?.time_in ? record.time_in.slice(0, 5) : '—'}
            </p>
            {record?.late_minutes > 0 && (
              <p className="text-yellow-300 text-[10px] mt-1">{record.late_minutes} min late</p>
            )}
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-3">
            <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1">Time Out</p>
            <p className="text-2xl font-bold font-mono">
              {record?.time_out ? record.time_out.slice(0, 5) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Location notice */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        <MapPinIcon className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Your location will be recorded when you clock in or out. Please allow location access when prompted.</span>
      </div>

      {locError && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-700">
          {locError}
        </div>
      )}

      {/* Action buttons */}
      {isLoading ? (
        <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => punch('in')}
            disabled={punching || hasClockedIn}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl py-5 font-semibold transition-all
              ${hasClockedIn
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:opacity-90 shadow-lg shadow-green-200'}`}>
            <FingerPrintIcon className="h-8 w-8" />
            <span className="text-sm">{hasClockedIn ? `In at ${record.time_in.slice(0,5)}` : 'Clock In'}</span>
          </button>

          <button
            onClick={() => punch('out')}
            disabled={punching || !hasClockedIn || hasClockedOut}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl py-5 font-semibold transition-all
              ${!hasClockedIn || hasClockedOut
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-brand-red text-white hover:opacity-90 shadow-lg shadow-red-200'}`}>
            <ClockIcon className="h-8 w-8" />
            <span className="text-sm">{hasClockedOut ? `Out at ${record.time_out.slice(0,5)}` : 'Clock Out'}</span>
          </button>
        </div>
      )}

      {punching && (
        <p className="text-center text-xs text-gray-500 animate-pulse">Getting your location…</p>
      )}

      <p className="text-center text-[10px] text-gray-400">Current time: {timeStr}</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WorkspacePage() {
  const { user: authUser } = useAuthStore()
  const [tab, setTab] = useState('overview')
  const [showRequestModal, setShowRequestModal] = useState(false)

  const { data: user, refetch: refetchUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then(r => r.data),
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => getEmployees().then(r => r.data?.results ?? r.data ?? []),
  })

  // Find employee record linked to current user
  const employee = employees.find(e => e.user === (authUser?.id || user?.id))
  const employeeId = employee?.id

  const { data: leaveBalances = [] } = useQuery({
    queryKey: ['leave-balances', employeeId],
    queryFn: () => api.get('/hr/leave-balances/', { params: { employee: employeeId, year: new Date().getFullYear(), page_size: 50 } }).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!employeeId,
  })
  const { data: leaves = [] } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => getMyLeaves().then(r => r.data?.results ?? r.data ?? []),
  })
  const { data: advances = [] } = useQuery({
    queryKey: ['my-advances', employeeId],
    queryFn: () => getMyAdvances(employeeId).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!employeeId,
  })
  const { data: myStoreRequests = [] } = useQuery({
    queryKey: ['my-store-requests'],
    queryFn: () => getStoreRequests({ view: 'outgoing', page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })
  const pendingSRCount = myStoreRequests.filter(r => ['submitted', 'approved', 'dispatched'].includes(r.status)).length

  const currentUser = user || authUser

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-bold text-brand-slate text-lg">My Workspace</h2>
        <p className="text-xs text-gray-600 mt-0.5">Manage your profile, leave, advances and payslips</p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
              ${tab === id ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(' ')[0]}</span>
            {id === 'storerequests' && pendingSRCount > 0 && (
              <span className="ml-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingSRCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview'      && <OverviewTab user={currentUser} employee={employee} leaveBalances={leaveBalances} leaves={leaves} advances={advances} reqs={[]} setTab={setTab} onRequestItems={() => setShowRequestModal(true)} />}
      {tab === 'attendance'    && <AttendanceTab />}
      {tab === 'profile'       && currentUser && <ProfileTab user={currentUser} refetch={refetchUser} />}
      {tab === 'leave'         && <LeaveTab employeeId={employeeId} />}
      {tab === 'advance'       && <AdvanceTab employeeId={employeeId} />}
      {tab === 'payslips'      && <PayslipsTab employeeId={employeeId} user={currentUser} />}
      {tab === 'storerequests' && <MyStoreRequestsTab onNewRequest={() => setShowRequestModal(true)} />}
      {tab === 'requisitions'  && <RequisitionsTab />}

      {showRequestModal && <RequestItemsModal onClose={() => setShowRequestModal(false)} />}
    </div>
  )
}
