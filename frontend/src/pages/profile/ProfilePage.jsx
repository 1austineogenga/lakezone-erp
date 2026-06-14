import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import {
  UserCircleIcon, KeyIcon, CameraIcon,
  ClipboardDocumentListIcon, CalendarDaysIcon, CurrencyDollarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import api from '../../api/client'
import useAuthStore from '../../store/authStore'

const getMe = () => api.get('/auth/me/')
const patchMe = (data) => api.patch('/auth/me/', data)
const changePassword = (data) => api.post('/auth/change-password/', data)
const getLeaveTypes = () => api.get('/hr/leave-types/', { params: { page_size: 50 } })
const getMyLeaves = () => api.get('/hr/leave-applications/', { params: { page_size: 20 } })
const createLeave = (d) => api.post('/hr/leave-applications/', d)
const submitLeave = (id) => api.post(`/hr/leave-applications/${id}/submit/`)
const getMyAdvances = () => api.get('/hr/advances/', { params: { page_size: 20 } })
const createAdvance = (d) => api.post('/hr/advances/', d)
const getMyReqs = () => api.get('/requisitions/', { params: { page_size: 20 } })

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'

const TABS = [
  { id: 'profile',      label: 'My Profile',      icon: UserCircleIcon },
  { id: 'password',     label: 'Change Password',  icon: KeyIcon },
  { id: 'leave',        label: 'Leave',            icon: CalendarDaysIcon },
  { id: 'advance',      label: 'Salary Advance',   icon: CurrencyDollarIcon },
  { id: 'requisitions', label: 'My Requisitions',  icon: ClipboardDocumentListIcon },
]

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600', pending: 'bg-amber-100 text-amber-700',
  submitted: 'bg-amber-100 text-amber-700', approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700', deducted: 'bg-blue-100 text-blue-700',
  paid: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-700',
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ user, refetch }) {
  const photoRef = useRef()
  const [form, setForm] = useState({ first_name: user.first_name, last_name: user.last_name, phone: user.phone || '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

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

  const photoUrl = user.profile_photo
    ? (user.profile_photo.startsWith('http') ? user.profile_photo : `${API_BASE}${user.profile_photo}`)
    : null

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative">
          {photoUrl
            ? <img src={photoUrl} alt="Profile" className="h-20 w-20 rounded-full object-cover border-2 border-gray-200" />
            : <div className="h-20 w-20 rounded-full bg-brand-red flex items-center justify-center text-white text-2xl font-bold border-2 border-gray-200">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </div>
          }
          <button
            onClick={() => photoRef.current?.click()}
            className="absolute bottom-0 right-0 h-6 w-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow hover:bg-gray-50"
          >
            <CameraIcon className="h-3.5 w-3.5 text-gray-500" />
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files[0] && photoMut.mutate(e.target.files[0])} />
        </div>
        <div>
          <p className="font-bold text-brand-slate text-lg">{user.first_name} {user.last_name}</p>
          <p className="text-sm text-gray-500 capitalize">{user.role_display || user.role?.replace(/_/g, ' ')}</p>
          <p className="text-xs text-gray-400">{user.email}</p>
          {photoMut.isPending && <p className="text-xs text-amber-600 mt-1">Uploading…</p>}
        </div>
      </div>

      {/* Read-only info */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Department', value: user.department_name || '—' },
          { label: 'Branch', value: user.branch_name || '—' },
          { label: 'Role', value: user.role_display || '—' },
          { label: 'Date Joined', value: user.date_joined ? new Date(user.date_joined).toLocaleDateString() : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-brand-slate">{value}</p>
          </div>
        ))}
      </div>

      {/* Editable fields */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-4">Edit Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
            <input value={form.first_name} onChange={e => set('first_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
            <input value={form.last_name} onChange={e => set('last_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
          </div>
        </div>
        <button
          onClick={() => updateMut.mutate(form)}
          disabled={updateMut.isPending}
          className="mt-4 px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
        >
          {updateMut.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ── Password Tab ──────────────────────────────────────────────────────────────
function PasswordTab() {
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const mut = useMutation({
    mutationFn: () => changePassword({ old_password: form.old_password, new_password: form.new_password }),
    onSuccess: () => { toast.success('Password changed successfully'); setForm({ old_password: '', new_password: '', confirm: '' }) },
    onError: e => {
      const d = e.response?.data
      const msg = d?.old_password || d?.new_password || d?.detail || 'Failed to change password'
      toast.error(Array.isArray(msg) ? msg[0] : msg)
    },
  })

  const mismatch = form.new_password && form.confirm && form.new_password !== form.confirm

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-md">
      <h3 className="font-semibold text-brand-slate text-sm mb-4">Change Password</h3>
      <div className="space-y-4">
        {[
          { key: 'old_password', label: 'Current Password' },
          { key: 'new_password', label: 'New Password' },
          { key: 'confirm',      label: 'Confirm New Password' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input type="password" value={form[key]} onChange={e => set(key, e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-brand-red ${key === 'confirm' && mismatch ? 'border-red-400' : 'border-gray-200'}`} />
          </div>
        ))}
        {mismatch && <p className="text-xs text-red-500">Passwords do not match</p>}
      </div>
      <button
        onClick={() => mut.mutate()}
        disabled={mut.isPending || !form.old_password || !form.new_password || mismatch}
        className="mt-5 px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
      >
        {mut.isPending ? 'Changing…' : 'Change Password'}
      </button>
    </div>
  )
}

// ── Leave Tab ─────────────────────────────────────────────────────────────────
function LeaveTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ leave_type: '', start_date: '', end_date: '', reason: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => getLeaveTypes().then(r => r.data?.results ?? r.data ?? []),
  })
  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => getMyLeaves().then(r => r.data?.results ?? r.data ?? []),
  })

  const createMut = useMutation({
    mutationFn: (data) => createLeave(data),
    onSuccess: async (res) => {
      await submitLeave(res.data.id)
      toast.success('Leave application submitted')
      qc.invalidateQueries({ queryKey: ['my-leaves'] })
      setShowForm(false)
      setForm({ leave_type: '', start_date: '', end_date: '', reason: '' })
    },
    onError: e => {
      const d = e.response?.data
      toast.error(typeof d === 'object' ? Object.values(d).flat().join(', ') : 'Failed to apply')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-slate text-sm">My Leave Applications</h3>
        <button onClick={() => setShowForm(s => !s)}
          className="px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          + Apply for Leave
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="font-medium text-brand-slate text-sm mb-4">New Leave Application</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type *</label>
              <select value={form.leave_type} onChange={e => set('leave_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                <option value="">Select type…</option>
                {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date *</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMut.mutate(form)}
              disabled={createMut.isPending || !form.leave_type || !form.start_date || !form.end_date}
              className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
              {createMut.isPending ? 'Submitting…' : 'Submit Application'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : leaves.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">No leave applications yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Type', 'From', 'To', 'Days', 'Reason', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leaves.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate">{l.leave_type_name || l.leave_type}</td>
                  <td className="px-4 py-3 text-gray-600">{l.start_date}</td>
                  <td className="px-4 py-3 text-gray-600">{l.end_date}</td>
                  <td className="px-4 py-3 text-gray-600">{l.days_requested ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{l.reason || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
                      {l.status}
                    </span>
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

// ── Advance Tab ───────────────────────────────────────────────────────────────
function AdvanceTab({ userId }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', reason: '', repayment_months: 1 })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ['my-advances'],
    queryFn: () => getMyAdvances().then(r => r.data?.results ?? r.data ?? []),
  })

  const createMut = useMutation({
    mutationFn: (data) => createAdvance({ ...data, employee: userId }),
    onSuccess: () => {
      toast.success('Salary advance request submitted')
      qc.invalidateQueries({ queryKey: ['my-advances'] })
      setShowForm(false)
      setForm({ amount: '', reason: '', repayment_months: 1 })
    },
    onError: e => {
      const d = e.response?.data
      toast.error(typeof d === 'object' ? Object.values(d).flat().join(', ') : 'Failed to submit')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-slate text-sm">My Salary Advances</h3>
        <button onClick={() => setShowForm(s => !s)}
          className="px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          + Request Advance
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="font-medium text-brand-slate text-sm mb-4">New Advance Request</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (KES) *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Repayment (months)</label>
              <input type="number" min={1} max={12} value={form.repayment_months} onChange={e => set('repayment_months', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div className="col-span-2">
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
              className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : advances.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">No advance requests yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Amount', 'Repayment', 'Reason', 'Requested On', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {advances.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate">KES {Number(a.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{a.repayment_months} mo.</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{a.reason}</td>
                  <td className="px-4 py-3 text-gray-500">{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {a.status}
                    </span>
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

// ── Requisitions Tab ──────────────────────────────────────────────────────────
function RequisitionsTab() {
  const navigate = useNavigate()
  const { data: reqs = [], isLoading } = useQuery({
    queryKey: ['my-reqs'],
    queryFn: () => getMyReqs().then(r => r.data?.results ?? r.data ?? []),
  })

  const STATUS_COLORS_REQ = {
    draft: 'bg-gray-100 text-gray-600', pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-slate text-sm">My Requisitions</h3>
        <button onClick={() => navigate('/requisitions/new')}
          className="px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          + New Requisition
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : reqs.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">No requisitions yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Reference', 'Description', 'Date', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reqs.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate">{r.reference_number || r.rq_number || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{r.description || r.title || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS_REQ[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/requisitions/${r.id}`)}
                      className="text-xs text-brand-red hover:underline">View</button>
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
export default function ProfilePage() {
  const [tab, setTab] = useState('profile')
  const qc = useQueryClient()

  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then(r => r.data),
  })

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="font-bold text-brand-slate text-lg">My Profile</h2>
        <p className="text-xs text-gray-400 mt-0.5">Manage your account, apply for leave, advances and requisitions</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
              ${tab === id ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'profile'      && <ProfileTab user={user} refetch={refetch} />}
      {tab === 'password'     && <PasswordTab />}
      {tab === 'leave'        && <LeaveTab />}
      {tab === 'advance'      && <AdvanceTab userId={user?.id} />}
      {tab === 'requisitions' && <RequisitionsTab />}
    </div>
  )
}
