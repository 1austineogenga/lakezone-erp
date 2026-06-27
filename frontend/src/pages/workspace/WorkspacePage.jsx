import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  UserCircleIcon, KeyIcon, CalendarDaysIcon, CurrencyDollarIcon,
  ClipboardDocumentListIcon, DocumentTextIcon, CameraIcon,
  CheckCircleIcon, ClockIcon, BanknotesIcon, PlusIcon,
  PrinterIcon, ChartBarIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline'
import api from '../../api/client'
import useAuthStore from '../../store/authStore'
import { printDoc } from '../../utils/print'

// ── API helpers ───────────────────────────────────────────────────────────────
const getMe            = ()     => api.get('/auth/me/')
const patchMe          = (data) => api.patch('/auth/me/', data)
const changePassword   = (d)    => api.post('/auth/change-password/', d)
const getEmployees     = ()     => api.get('/hr/employees/', { params: { page_size: 200 } })
const getLeaveTypes    = ()     => api.get('/hr/leave-types/', { params: { page_size: 50 } })
const getLeaveBalances = ()     => api.get('/hr/leave-balances/', { params: { page_size: 50 } })
const getMyLeaves      = ()     => api.get('/hr/leave-applications/', { params: { page_size: 50 } })
const createLeave      = (d)    => api.post('/hr/leave-applications/', d)
const submitLeave      = (id)   => api.post(`/hr/leave-applications/${id}/submit/`)
const getMyAdvances    = (emp)  => api.get('/hr/advances/', { params: { employee: emp, page_size: 50 } })
const createAdvance    = (d)    => api.post('/hr/advances/', d)
const getMyPayslips    = (emp)  => api.get('/hr/payroll/entries/', { params: { employee: emp, page_size: 50 } })
const getMyReqs        = ()     => api.get('/requisitions/', { params: { page_size: 50 } })

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

const TABS = [
  { id: 'overview',      label: 'Overview',        icon: ChartBarIcon },
  { id: 'profile',       label: 'My Profile',      icon: UserCircleIcon },
  { id: 'leave',         label: 'Leave',           icon: CalendarDaysIcon },
  { id: 'advance',       label: 'Salary Advance',  icon: CurrencyDollarIcon },
  { id: 'requisitions',  label: 'Requisitions',    icon: ClipboardDocumentListIcon },
  { id: 'payslips',      label: 'Payslips',        icon: DocumentTextIcon },
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

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ user, employee, leaveBalances, leaves, advances, reqs, setTab }) {
  const navigate = useNavigate()

  const photoUrl = user?.profile_photo
    ? (user.profile_photo.startsWith('http') ? user.profile_photo : `${API_BASE}${user.profile_photo}`)
    : null

  const pendingLeave    = leaves.filter(l => l.status === 'submitted').length
  const pendingAdvance  = advances.filter(a => a.status === 'pending').length
  const openReqs        = reqs.filter(r => !['approved', 'rejected', 'cancelled'].includes(r.status)).length
  const totalLeaveLeft  = leaveBalances.reduce((s, b) => s + Number(b.balance || 0), 0)

  const quickActions = [
    { label: 'Apply for Leave',    icon: CalendarDaysIcon,        color: 'text-green-600 bg-green-50',  tab: 'leave' },
    { label: 'Request Advance',    icon: CurrencyDollarIcon,      color: 'text-blue-600 bg-blue-50',    tab: 'advance' },
    { label: 'New Requisition',    icon: ClipboardDocumentListIcon, color: 'text-amber-600 bg-amber-50', action: () => navigate('/requisitions/new') },
    { label: 'View Payslips',      icon: DocumentTextIcon,        color: 'text-purple-600 bg-purple-50', tab: 'payslips' },
  ]

  const recentActivity = [
    ...leaves.slice(0, 3).map(l => ({ type: 'Leave', label: `${l.leave_type_name || 'Leave'} — ${l.start_date}`, status: l.status, date: l.created_at })),
    ...advances.slice(0, 3).map(a => ({ type: 'Advance', label: `${fmt(a.amount)} advance`, status: a.status, date: a.created_at })),
    ...reqs.slice(0, 3).map(r => ({ type: 'Requisition', label: r.reference_number || r.rq_number || 'Requisition', status: r.status, date: r.created_at })),
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
          { label: 'Open Reqs',       value: openReqs,       icon: ClipboardDocumentListIcon, color: 'text-purple-600 bg-purple-50', tab: 'requisitions' },
        ].map(({ label, value, icon: Icon, color, tab: t }) => (
          <button key={label} onClick={() => setTab(t)}
            className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left">
            <div className={`${color} p-2 rounded-lg shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-brand-slate">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
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
          <p className="text-sm text-gray-400 p-8 text-center">No recent activity.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded font-medium shrink-0">{item.type}</span>
                <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{item.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>
                  {item.status}
                </span>
                <span className="text-xs text-gray-400 shrink-0 hidden sm:block">
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
          <p className="text-xs text-gray-400 text-center">Click camera to change photo</p>
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
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
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

function LeaveTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ leave_type: '', start_date: '', end_date: '', handover_to: '', reason: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn:  () => getLeaveTypes().then(r => r.data?.results ?? r.data ?? []),
  })
  const { data: balances = [] } = useQuery({
    queryKey: ['leave-balances'],
    queryFn:  () => getLeaveBalances().then(r => r.data?.results ?? r.data ?? []),
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

  // Annual leave balance — 21 days/year as the primary display
  const annualBalance = balances.find(b =>
    b.leave_type_name?.toLowerCase().includes('annual') ||
    b.leave_type_code === 'AL'
  )
  const annualDaysLeft = annualBalance ? Number(annualBalance.balance ?? 0) : 21
  const annualUsed     = annualBalance ? Number(annualBalance.taken_days ?? annualBalance.used ?? 0) : 0

  const createMut = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data }
      if (!payload.handover_to) delete payload.handover_to
      const res = await createLeave(payload)
      await submitLeave(res.data.id)
      return res
    },
    onSuccess: () => {
      toast.success('Leave application submitted for approval.')
      qc.invalidateQueries({ queryKey: ['my-leaves'] })
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
      setShowForm(false)
      setForm({ leave_type: '', start_date: '', end_date: '', handover_to: '', reason: '' })
    },
    onError: e => {
      const d = e.response?.data
      toast.error(typeof d === 'object' ? Object.values(d).flat().join(', ') : 'Failed to submit leave')
    },
  })

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red'

  return (
    <div className="space-y-5">
      {/* Annual leave banner */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
        <div className="flex-shrink-0 w-14 h-14 bg-green-100 rounded-full flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-green-700 leading-none">{annualDaysLeft}</p>
          <p className="text-[9px] font-medium text-green-600 leading-none mt-0.5">DAYS</p>
        </div>
        <div>
          <p className="font-semibold text-green-800">Annual Leave Balance</p>
          <p className="text-xs text-green-600 mt-0.5">
            {annualUsed} days used · {annualDaysLeft} days remaining out of 21 days entitlement
          </p>
        </div>
        {balances.length > 1 && (
          <div className="ml-auto hidden sm:flex gap-3">
            {balances.filter(b => !b.leave_type_name?.toLowerCase().includes('annual')).map(b => (
              <div key={b.id} className="text-center">
                <p className="text-sm font-bold text-gray-700">{Number(b.balance ?? 0)}</p>
                <p className="text-[10px] text-gray-500">{b.leave_type_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply button + form */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-slate text-sm">My Leave Applications</h3>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Apply for Leave
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="font-medium text-brand-slate text-sm mb-4">New Leave Application</h4>
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
              onClick={() => createMut.mutate(form)}
              disabled={createMut.isPending || !form.leave_type || !form.start_date || !form.end_date || !form.reason}
              className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
            >
              {createMut.isPending ? 'Submitting…' : 'Submit Application'}
            </button>
            <button onClick={() => setShowForm(false)}
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
            ? <p className="text-sm text-gray-400 p-8 text-center">No leave applications yet.</p>
            : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Ref', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Comments'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leaves.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-500">{l.reference}</td>
                      <td className="px-4 py-3 font-medium text-brand-slate">{l.leave_type_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{l.start_date}</td>
                      <td className="px-4 py-3 text-gray-600">{l.end_date}</td>
                      <td className="px-4 py-3 text-gray-600">{l.days ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEAVE_STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
                          {LEAVE_STATUS_LABELS[l.status] || l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate italic">
                        {l.review_notes || '—'}
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
            <p className="text-xs text-gray-500 mb-1">{label}</p>
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
        : advances.length === 0 ? <p className="text-sm text-gray-400 p-8 text-center">No advance requests yet.</p>
        : (
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Amount','Repayment','Reason','Requested','Status'].map(h=><th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {advances.map(a=>(
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate">{fmt(a.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">{a.repayment_months} mo.</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{a.reason}</td>
                  <td className="px-4 py-3 text-gray-500">{a.created_at?new Date(a.created_at).toLocaleDateString():'—'}</td>
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
            <p className="text-xs text-gray-500 capitalize">{k}</p>
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
        : reqs.length === 0 ? <p className="text-sm text-gray-400 p-8 text-center">No requisitions yet.</p>
        : (
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Reference','Description','Date','Status',''].map(h=><th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {reqs.map(r=>(
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate">{r.reference_number||r.rq_number||'—'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{r.description||r.title||'—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.created_at?new Date(r.created_at).toLocaleDateString():'—'}</td>
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
          <p className="text-xs text-gray-500 mb-1">Payslips Available</p>
          <p className="text-2xl font-bold text-brand-slate">{payslips.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">YTD Net Pay</p>
          <p className="text-xl font-bold text-green-600">{fmt(totalNet)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">YTD PAYE Deducted</p>
          <p className="text-xl font-bold text-red-600">{fmt(totalPAYE)}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Payslip History</h3>
        </div>
        {isLoading ? <div className="p-6 space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="h-8 bg-gray-100 rounded animate-pulse"/>)}</div>
        : !employeeId ? <p className="text-sm text-gray-400 p-8 text-center">No employee record linked to your account.</p>
        : payslips.length === 0 ? <p className="text-sm text-gray-400 p-8 text-center">No payslips available yet.</p>
        : (
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {['Period','Gross Pay','PAYE','NSSF','NHIF','Deductions','Net Pay','Status',''].map(h=>(
                <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WorkspacePage() {
  const { user: authUser } = useAuthStore()
  const [tab, setTab] = useState('overview')

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
    queryKey: ['leave-balances'],
    queryFn: () => getLeaveBalances().then(r => r.data?.results ?? r.data ?? []),
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
  const { data: reqs = [] } = useQuery({
    queryKey: ['my-reqs'],
    queryFn: () => getMyReqs().then(r => r.data?.results ?? r.data ?? []),
  })

  const currentUser = user || authUser

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-bold text-brand-slate text-lg">My Workspace</h2>
        <p className="text-xs text-gray-400 mt-0.5">Manage your profile, leave, advances, requisitions and payslips</p>
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
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview'      && <OverviewTab user={currentUser} employee={employee} leaveBalances={leaveBalances} leaves={leaves} advances={advances} reqs={reqs} setTab={setTab} />}
      {tab === 'profile'       && currentUser && <ProfileTab user={currentUser} refetch={refetchUser} />}
      {tab === 'leave'         && <LeaveTab />}
      {tab === 'advance'       && <AdvanceTab employeeId={employeeId} />}
      {tab === 'requisitions'  && <RequisitionsTab />}
      {tab === 'payslips'      && <PayslipsTab employeeId={employeeId} user={currentUser} />}
    </div>
  )
}
