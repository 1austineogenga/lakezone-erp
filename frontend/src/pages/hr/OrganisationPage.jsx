import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import {
  BuildingOfficeIcon, MapPinIcon, PlusIcon,
  PencilIcon, TrashIcon, CheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline'

// ── API helpers ────────────────────────────────────────────────────────────────

const fetchDepts  = () => api.get('/auth/departments/?all=true').then(r => r.data?.results ?? r.data ?? [])
const fetchBranches = () => api.get('/auth/branches/?all=true').then(r => r.data?.results ?? r.data ?? [])
const createDept  = (d) => api.post('/auth/departments/', d)
const updateDept  = (id, d) => api.patch(`/auth/departments/${id}/`, d)
const deleteDept  = (id) => api.delete(`/auth/departments/${id}/`)
const createBranch = (d) => api.post('/auth/branches/', d)
const updateBranch = (id, d) => api.patch(`/auth/branches/${id}/`, d)
const deleteBranch = (id) => api.delete(`/auth/branches/${id}/`)

// ── Shared helpers ─────────────────────────────────────────────────────────────

function SectionBadge({ icon: Icon, color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-lg ${color}`}><Icon className="h-3.5 w-3.5 text-white" /></div>
      <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</span>
    </div>
  )
}

// ── Departments tab ────────────────────────────────────────────────────────────

function DepartmentsTab() {
  const qc = useQueryClient()
  const [editId, setEditId]   = useState(null)
  const [editVal, setEditVal] = useState({ name: '', branch: '', is_active: true })
  const [adding, setAdding]   = useState(false)
  const [newVal, setNewVal]   = useState({ name: '', branch: '' })

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments-all'],
    queryFn: fetchDepts,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-all'],
    queryFn: fetchBranches,
  })

  const activeBranches = branches.filter(b => b.is_active)

  const saveMut = useMutation({
    mutationFn: ({ id, data }) => updateDept(id, data),
    onSuccess: () => {
      toast.success('Department updated')
      qc.invalidateQueries({ queryKey: ['departments-all'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
      setEditId(null)
    },
    onError: () => toast.error('Failed to update department'),
  })

  const createMut = useMutation({
    mutationFn: (data) => createDept(data),
    onSuccess: () => {
      toast.success('Department created')
      qc.invalidateQueries({ queryKey: ['departments-all'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
      setAdding(false)
      setNewVal({ name: '', branch: '' })
    },
    onError: () => toast.error('Failed to create department'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteDept(id),
    onSuccess: () => {
      toast.success('Department deactivated')
      qc.invalidateQueries({ queryKey: ['departments-all'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
    },
    onError: () => toast.error('Failed to deactivate department'),
  })

  const startEdit = (d) => {
    setEditId(d.id)
    setEditVal({ name: d.name, branch: d.branch || '', is_active: d.is_active })
  }

  const handleSave = () => {
    if (!editVal.name.trim()) return toast.error('Name is required')
    saveMut.mutate({ id: editId, data: editVal })
  }

  const handleCreate = () => {
    if (!newVal.name.trim()) return toast.error('Name is required')
    createMut.mutate(newVal)
  }

  const handleDelete = (d) => {
    if (window.confirm(`Deactivate "${d.name}"?`)) deleteMut.mutate(d.id)
  }

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionBadge icon={BuildingOfficeIcon} color="bg-indigo-500" label="Departments" />
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
          <PlusIcon className="h-3.5 w-3.5" /> Add Department
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Department Name', 'Work Location', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {adding && (
              <tr className="bg-indigo-50/40">
                <td className="px-5 py-3">
                  <input autoFocus value={newVal.name} onChange={e => setNewVal(p => ({ ...p, name: e.target.value }))}
                    placeholder="Department name"
                    className="w-full border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </td>
                <td className="px-5 py-3">
                  <select value={newVal.branch} onChange={e => setNewVal(p => ({ ...p, branch: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">— No branch —</option>
                    {activeBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3 text-xs text-green-600 font-semibold">Active</td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button onClick={handleCreate}
                      className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
                      <CheckIcon className="h-3.5 w-3.5" /> Save
                    </button>
                    <button onClick={() => { setAdding(false); setNewVal({ name: '', branch: '' }) }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">
                      <XMarkIcon className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {departments.length === 0 && !adding && (
              <tr><td colSpan={4} className="text-center text-sm text-gray-400 py-10">No departments yet.</td></tr>
            )}
            {departments.map((d, idx) => (
              <tr key={d.id} className={idx % 2 === 1 ? 'bg-gray-50/40' : ''}>
                {editId === d.id ? (
                  <>
                    <td className="px-5 py-3">
                      <input value={editVal.name} onChange={e => setEditVal(p => ({ ...p, name: e.target.value }))}
                        className="w-full border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </td>
                    <td className="px-5 py-3">
                      <select value={editVal.branch} onChange={e => setEditVal(p => ({ ...p, branch: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                        <option value="">— No branch —</option>
                        {activeBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select value={editVal.is_active ? 'true' : 'false'}
                        onChange={e => setEditVal(p => ({ ...p, is_active: e.target.value === 'true' }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={handleSave}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
                          <CheckIcon className="h-3.5 w-3.5" /> Save
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">
                          <XMarkIcon className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 text-sm font-semibold text-brand-slate">{d.name}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{d.branch_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold
                        ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(d)}
                          className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline">
                          <PencilIcon className="h-3.5 w-3.5" /> Edit
                        </button>
                        {d.is_active && (
                          <>
                            <span className="text-gray-300">|</span>
                            <button onClick={() => handleDelete(d)}
                              className="flex items-center gap-1 text-xs font-medium text-red-500 hover:underline">
                              <TrashIcon className="h-3.5 w-3.5" /> Deactivate
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Work Locations (Branches) tab ─────────────────────────────────────────────

function WorkLocationsTab() {
  const qc = useQueryClient()
  const [editId, setEditId]   = useState(null)
  const [editVal, setEditVal] = useState({ name: '', location: '', is_active: true })
  const [adding, setAdding]   = useState(false)
  const [newVal, setNewVal]   = useState({ name: '', location: '' })

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches-all'],
    queryFn: fetchBranches,
  })

  const saveMut = useMutation({
    mutationFn: ({ id, data }) => updateBranch(id, data),
    onSuccess: () => {
      toast.success('Work location updated')
      qc.invalidateQueries({ queryKey: ['branches-all'] })
      qc.invalidateQueries({ queryKey: ['branches'] })
      setEditId(null)
    },
    onError: () => toast.error('Failed to update work location'),
  })

  const createMut = useMutation({
    mutationFn: (data) => createBranch(data),
    onSuccess: () => {
      toast.success('Work location created')
      qc.invalidateQueries({ queryKey: ['branches-all'] })
      qc.invalidateQueries({ queryKey: ['branches'] })
      setAdding(false)
      setNewVal({ name: '', location: '' })
    },
    onError: () => toast.error('Failed to create work location'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteBranch(id),
    onSuccess: () => {
      toast.success('Work location deactivated')
      qc.invalidateQueries({ queryKey: ['branches-all'] })
      qc.invalidateQueries({ queryKey: ['branches'] })
    },
    onError: () => toast.error('Failed to deactivate work location'),
  })

  const startEdit = (b) => {
    setEditId(b.id)
    setEditVal({ name: b.name, location: b.location || '', is_active: b.is_active })
  }

  const handleSave = () => {
    if (!editVal.name.trim()) return toast.error('Name is required')
    saveMut.mutate({ id: editId, data: editVal })
  }

  const handleCreate = () => {
    if (!newVal.name.trim()) return toast.error('Name is required')
    createMut.mutate(newVal)
  }

  const handleDelete = (b) => {
    if (window.confirm(`Deactivate "${b.name}"?`)) deleteMut.mutate(b.id)
  }

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionBadge icon={MapPinIcon} color="bg-teal-500" label="Work Locations" />
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-colors">
          <PlusIcon className="h-3.5 w-3.5" /> Add Location
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Location Name', 'Address / Description', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {adding && (
              <tr className="bg-teal-50/40">
                <td className="px-5 py-3">
                  <input autoFocus value={newVal.name} onChange={e => setNewVal(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Head Office"
                    className="w-full border border-teal-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </td>
                <td className="px-5 py-3">
                  <input value={newVal.location} onChange={e => setNewVal(p => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Kisumu CBD"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </td>
                <td className="px-5 py-3 text-xs text-green-600 font-semibold">Active</td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button onClick={handleCreate}
                      className="flex items-center gap-1 px-2.5 py-1 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700">
                      <CheckIcon className="h-3.5 w-3.5" /> Save
                    </button>
                    <button onClick={() => { setAdding(false); setNewVal({ name: '', location: '' }) }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">
                      <XMarkIcon className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {branches.length === 0 && !adding && (
              <tr><td colSpan={4} className="text-center text-sm text-gray-400 py-10">No work locations yet.</td></tr>
            )}
            {branches.map((b, idx) => (
              <tr key={b.id} className={idx % 2 === 1 ? 'bg-gray-50/40' : ''}>
                {editId === b.id ? (
                  <>
                    <td className="px-5 py-3">
                      <input value={editVal.name} onChange={e => setEditVal(p => ({ ...p, name: e.target.value }))}
                        className="w-full border border-teal-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    </td>
                    <td className="px-5 py-3">
                      <input value={editVal.location} onChange={e => setEditVal(p => ({ ...p, location: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    </td>
                    <td className="px-5 py-3">
                      <select value={editVal.is_active ? 'true' : 'false'}
                        onChange={e => setEditVal(p => ({ ...p, is_active: e.target.value === 'true' }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={handleSave}
                          className="flex items-center gap-1 px-2.5 py-1 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700">
                          <CheckIcon className="h-3.5 w-3.5" /> Save
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">
                          <XMarkIcon className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 text-sm font-semibold text-brand-slate">{b.name}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{b.location || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold
                        ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(b)}
                          className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline">
                          <PencilIcon className="h-3.5 w-3.5" /> Edit
                        </button>
                        {b.is_active && (
                          <>
                            <span className="text-gray-300">|</span>
                            <button onClick={() => handleDelete(b)}
                              className="flex items-center gap-1 text-xs font-medium text-red-500 hover:underline">
                              <TrashIcon className="h-3.5 w-3.5" /> Deactivate
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'departments',     label: 'Departments',    icon: BuildingOfficeIcon },
  { key: 'work_locations',  label: 'Work Locations', icon: MapPinIcon },
]

export default function OrganisationPage() {
  const [tab, setTab] = useState('departments')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-brand-slate rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white opacity-[0.03] -translate-y-16 translate-x-16 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-0.5">HR Module</p>
          <h1 className="text-white text-xl font-extrabold">Organisation Setup</h1>
          <p className="text-white/50 text-xs mt-1">Manage departments and work locations used across the system</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${active ? 'bg-brand-slate text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {tab === 'departments'    && <DepartmentsTab />}
      {tab === 'work_locations' && <WorkLocationsTab />}
    </div>
  )
}
