import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, KeyIcon, ClipboardDocumentIcon, XMarkIcon } from '@heroicons/react/24/outline'
import api from '../../api/client'
import usePermissions from '../../hooks/usePermissions'
import { ROLE_GROUPS, ALL_ROLES, getPermissions } from '../../utils/permissions'

const getUsers      = (p) => api.get('/auth/users/', { params: p })
const createUser    = (d) => api.post('/auth/users/', d)
const updateUser    = (id, d) => api.patch(`/auth/users/${id}/`, d)
const resetPassword = (id) => api.post(`/auth/users/${id}/reset-password/`)

const ROLE_COLORS = {
  system_admin: 'bg-red-100 text-red-700',
  managing_director: 'bg-purple-100 text-purple-700',
  general_manager: 'bg-purple-100 text-purple-700',
  finance_officer: 'bg-blue-100 text-blue-700',
  finance_manager: 'bg-blue-100 text-blue-700',
  hr_manager: 'bg-teal-100 text-teal-700',
  procurement_officer: 'bg-amber-100 text-amber-700',
  facility_manager: 'bg-green-100 text-green-700',
  admin_officer: 'bg-slate-100 text-slate-700',
  site_manager: 'bg-orange-100 text-orange-700',
  site_engineer: 'bg-orange-100 text-orange-700',
  site_foreman: 'bg-orange-100 text-orange-700',
  site_surveyor: 'bg-orange-100 text-orange-700',
}

const getDepartments = () => api.get('/core/departments/', { params: { page_size: 50 } })
const getBranches    = () => api.get('/core/branches/',    { params: { page_size: 50 } })

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '', phone: '',
  role: 'site_engineer', department: '', branch: '', is_active: true,
}

function ResetPasswordModal({ user, onClose }) {
  const [generatedPassword, setGeneratedPassword] = useState(null)
  const [copied, setCopied] = useState(false)

  const resetMut = useMutation({
    mutationFn: () => resetPassword(user.id),
    onSuccess: (res) => setGeneratedPassword(res.data.new_password),
    onError: () => toast.error('Failed to reset password.'),
  })

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-brand-slate">Reset Password</h3>
          <button onClick={onClose}><XMarkIcon className="w-4 h-4 text-gray-400 hover:text-brand-slate" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!generatedPassword ? (
            <>
              <p className="text-xs text-gray-600">
                Generate a new system password for <strong>{user.full_name || user.email}</strong>.
                Share it securely with the user — they should change it after logging in.
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={onClose}
                  className="px-4 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => resetMut.mutate()} disabled={resetMut.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                  <KeyIcon className="w-3.5 h-3.5" />
                  {resetMut.isPending ? 'Generating…' : 'Generate Password'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-700 font-medium mb-2">Password reset successfully</p>
                <p className="text-[10px] text-green-600 mb-3">
                  Copy this password and share it securely with the user. It will not be shown again.
                </p>
                <div className="flex items-center gap-2 bg-white border border-green-200 rounded px-3 py-2">
                  <code className="flex-1 text-sm font-mono font-bold text-brand-slate tracking-widest">
                    {generatedPassword}
                  </code>
                  <button onClick={copyToClipboard} className="text-green-600 hover:text-green-800 transition-colors">
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  </button>
                </div>
                {copied && <p className="text-[10px] text-green-600 mt-1 text-right">Copied!</p>}
              </div>
              <div className="flex justify-end">
                <button onClick={onClose}
                  className="px-4 py-1.5 bg-brand-slate text-white text-xs font-medium rounded-lg hover:opacity-90">
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function UserModal({ open, onClose, initial, onSave, saving, isEdit, departments, branches }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate">{isEdit ? 'Edit User' : 'Add New User'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
              <input value={form.first_name} onChange={e => set('first_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
              <input value={form.last_name} onChange={e => set('last_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email Address *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                {ROLE_GROUPS.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.roles.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select value={form.department || ''} onChange={e => set('department', e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
              <select value={form.branch || ''} onChange={e => set('branch', e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                <option value="">— None —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.location})</option>)}
              </select>
            </div>
            {!isEdit && (
              <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                <p className="text-xs text-blue-700">A secure password will be auto-generated. Copy it from the confirmation and share it with the user.</p>
              </div>
            )}
            {isEdit && (
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
                    className="rounded border-gray-300" />
                  <span className="text-xs font-medium text-gray-600">Account Active</span>
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.first_name || !form.last_name || !form.email}
            className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PermissionMatrix({ role }) {
  const modules = [
    ['dashboard', 'Dashboard'], ['projects', 'Projects'], ['procurement', 'Procurement'],
    ['requisitions', 'Requisitions'], ['inventory', 'Inventory'], ['assets', 'Assets'],
    ['finance', 'Finance'], ['hr', 'HR'], ['fleet', 'Fleet'], ['crm', 'CRM'],
  ]
  const LEVEL_COLORS = {
    full:   'bg-green-100 text-green-700',
    write:  'bg-blue-100 text-blue-700',
    read:   'bg-gray-100 text-gray-600',
    create: 'bg-amber-100 text-amber-700',
    false:  'bg-red-50 text-red-300',
  }

  const perms = getPermissions(role)

  return (
    <div className="grid grid-cols-5 gap-1 mt-3">
      {modules.map(([key, label]) => {
        const level = perms[key] || false
        return (
          <div key={key} className={`text-center px-1 py-1 rounded text-[10px] font-medium ${LEVEL_COLORS[String(level)]}`}>
            <div className="text-[9px] text-gray-600 leading-none mb-0.5">{label}</div>
            {level === false ? '—' : level}
          </div>
        )
      })}
    </div>
  )
}

export default function UsersPage() {
  const qc = useQueryClient()
  const { isAdmin, canWrite } = usePermissions()
  const canEdit = isAdmin || canWrite('users')

  const [search, setSearch]           = useState('')
  const [filterRole, setFilterRole]   = useState('')
  const [modal, setModal]             = useState(null)
  const [newUserPassword, setNewUserPassword] = useState(null)
  const [resetUser, setResetUser]     = useState(null)
  const [previewRole, setPreviewRole] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', filterRole],
    queryFn: () => getUsers({ role: filterRole || undefined, page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn:  () => getDepartments(),
    select:   r => r.data?.results ?? r.data ?? [],
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn:  () => getBranches(),
    select:   r => r.data?.results ?? r.data ?? [],
  })

  const saveMut = useMutation({
    mutationFn: (form) => {
      if (modal?.user?.id) {
        return updateUser(modal.user.id, form)
      }
      return createUser(form)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      if (modal?.user?.id) {
        toast.success('User updated')
        setModal(null)
      } else {
        setModal(null)
        setNewUserPassword(res.data?.generated_password || null)
      }
    },
    onError: e => {
      const data = e.response?.data
      const msg = typeof data === 'object'
        ? Object.values(data).flat().join(', ')
        : data?.detail || 'Failed to save user'
      toast.error(msg)
    },
  })

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const roleLabel = (role) => ALL_ROLES.find(r => r.value === role)?.label || role

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">User Management</h2>
          <p className="text-xs text-gray-600 mt-0.5">Manage system users and their role-based access</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal({ mode: 'add' })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
            <PlusIcon className="h-3.5 w-3.5" /> Add User
          </button>
        )}
      </div>

      {/* Role Permission Preview */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="font-semibold text-brand-slate text-sm">Role Permission Preview</h3>
          <select value={previewRole} onChange={e => setPreviewRole(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="">Select a role to preview…</option>
            {ROLE_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {previewRole && (
          <div>
            <p className="text-xs text-gray-600 mb-1">Access levels: <span className="text-green-700 font-medium">full</span> · <span className="text-blue-700 font-medium">write</span> · <span className="text-gray-600 font-medium">read</span> · <span className="text-amber-700 font-medium">create</span> · <span className="text-red-300 font-medium">—</span> none</p>
            <PermissionMatrix role={previewRole} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red w-52" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="">All Roles</option>
            {ROLE_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate text-sm">Users ({filtered.length})</h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-600 p-10 text-center">No users found.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Name', 'Email', 'Phone', 'Role', 'Status', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-slate">{u.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role_display || roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setModal({ mode: 'edit', user: u })}
                          className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50">
                          <PencilIcon className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => setResetUser(u)}
                          className="flex items-center gap-1 px-2 py-1 border border-amber-200 text-amber-700 rounded text-xs hover:bg-amber-50">
                          <KeyIcon className="h-3 w-3" /> Reset PW
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <UserModal
        key={modal?.user?.id || 'new'}
        open={!!modal}
        onClose={() => setModal(null)}
        initial={modal?.user ? { ...modal.user, password: '', password_confirm: '' } : EMPTY_FORM}
        onSave={form => saveMut.mutate(form)}
        saving={saveMut.isPending}
        isEdit={!!modal?.user?.id}
        departments={departments}
        branches={branches}
      />

      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}

      {newUserPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-brand-slate">User Created</h3>
              <button onClick={() => setNewUserPassword(null)}><XMarkIcon className="w-4 h-4 text-gray-400 hover:text-brand-slate" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-700 font-medium mb-2">Account created successfully</p>
                <p className="text-[10px] text-green-600 mb-3">Copy this password and share it with the user. It will not be shown again.</p>
                <div className="flex items-center gap-2 bg-white border border-green-200 rounded px-3 py-2">
                  <code className="flex-1 text-sm font-mono font-bold text-brand-slate tracking-widest">{newUserPassword}</code>
                  <button onClick={() => { navigator.clipboard.writeText(newUserPassword); toast.success('Copied!') }}
                    className="text-green-600 hover:text-green-800">
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setNewUserPassword(null)}
                  className="px-4 py-1.5 bg-brand-slate text-white text-xs font-medium rounded-lg hover:opacity-90">Done</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
