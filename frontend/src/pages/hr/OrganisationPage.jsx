import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { getPositions, getJobGrades } from '../../api/hr'
import {
  BuildingOfficeIcon, MapPinIcon, PlusIcon,
  PencilIcon, TrashIcon, CheckIcon, XMarkIcon, BriefcaseIcon,
} from '@heroicons/react/24/outline'

// ── API helpers ────────────────────────────────────────────────────────────────

const fetchDepts    = () => api.get('/auth/departments/?all=true').then(r => r.data?.results ?? r.data ?? [])
const fetchBranches = () => api.get('/auth/branches/?all=true').then(r => r.data?.results ?? r.data ?? [])
const createDept    = (d)      => api.post('/auth/departments/', d)
const updateDept    = (id, d)  => api.patch(`/auth/departments/${id}/`, d)
const deleteDept    = (id)     => api.delete(`/auth/departments/${id}/`)
const createBranch  = (d)      => api.post('/auth/branches/', d)
const updateBranch  = (id, d)  => api.patch(`/auth/branches/${id}/`, d)
const deleteBranch  = (id)     => api.delete(`/auth/branches/${id}/`)
const updatePosition = (id, d) => api.patch(`/hr/positions/${id}/`, d)
const deletePosition = (id)    => api.delete(`/hr/positions/${id}/`)

// ── Shared inputs ──────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
const selectCls = 'border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

function SaveBtn({ onClick })   { return <button onClick={onClick} className="flex items-center gap-1 px-2.5 py-1 bg-brand-red text-white text-xs rounded-lg hover:opacity-90"><CheckIcon className="h-3.5 w-3.5" /> Save</button> }
function CancelBtn({ onClick }) { return <button onClick={onClick} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200"><XMarkIcon className="h-3.5 w-3.5" /> Cancel</button> }

function StatusBadge({ active }) {
  return (
    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── Departments tab ────────────────────────────────────────────────────────────

function DepartmentsTab() {
  const qc = useQueryClient()
  const [editId, setEditId]   = useState(null)
  const [editVal, setEditVal] = useState({ name: '', branch: '', is_active: true })
  const [adding, setAdding]   = useState(false)
  const [newVal, setNewVal]   = useState({ name: '', branch: '' })

  const { data: departments = [], isLoading } = useQuery({ queryKey: ['departments-all'], queryFn: fetchDepts })
  const { data: branches = [] } = useQuery({ queryKey: ['branches-all'], queryFn: fetchBranches })
  const activeBranches = branches.filter(b => b.is_active)

  const saveMut = useMutation({
    mutationFn: ({ id, data }) => updateDept(id, data),
    onSuccess: () => { toast.success('Department updated'); qc.invalidateQueries({ queryKey: ['departments-all'] }); qc.invalidateQueries({ queryKey: ['departments'] }); setEditId(null) },
    onError: () => toast.error('Failed to update department'),
  })
  const createMut = useMutation({
    mutationFn: (data) => createDept(data),
    onSuccess: () => { toast.success('Department created'); qc.invalidateQueries({ queryKey: ['departments-all'] }); qc.invalidateQueries({ queryKey: ['departments'] }); setAdding(false); setNewVal({ name: '', branch: '' }) },
    onError: () => toast.error('Failed to create department'),
  })
  const deleteMut = useMutation({
    mutationFn: (id) => deleteDept(id),
    onSuccess: () => { toast.success('Department deactivated'); qc.invalidateQueries({ queryKey: ['departments-all'] }); qc.invalidateQueries({ queryKey: ['departments'] }) },
    onError: () => toast.error('Failed to deactivate department'),
  })

  const startEdit = (d) => { setEditId(d.id); setEditVal({ name: d.name, branch: d.branch || '', is_active: d.is_active }) }
  const handleSave = () => { if (!editVal.name.trim()) return toast.error('Name required'); saveMut.mutate({ id: editId, data: editVal }) }
  const handleCreate = () => { if (!newVal.name.trim()) return toast.error('Name required'); createMut.mutate(newVal) }
  const handleDelete = (d) => { if (window.confirm(`Deactivate "${d.name}"?`)) deleteMut.mutate(d.id) }

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-slate uppercase tracking-wider">Departments</h3>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity">
          <PlusIcon className="h-3.5 w-3.5" /> Add Department
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Department Name', 'Work Location', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {adding && (
              <tr className="bg-red-50/30">
                <td className="px-5 py-3"><input autoFocus value={newVal.name} onChange={e => setNewVal(p => ({ ...p, name: e.target.value }))} placeholder="Department name" className={inputCls} /></td>
                <td className="px-5 py-3">
                  <select value={newVal.branch} onChange={e => setNewVal(p => ({ ...p, branch: e.target.value }))} className={selectCls}>
                    <option value="">— No branch —</option>
                    {activeBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3 text-xs text-green-600 font-semibold">Active</td>
                <td className="px-5 py-3"><div className="flex gap-2"><SaveBtn onClick={handleCreate} /><CancelBtn onClick={() => { setAdding(false); setNewVal({ name: '', branch: '' }) }} /></div></td>
              </tr>
            )}
            {departments.length === 0 && !adding && (
              <tr><td colSpan={4} className="text-center text-sm text-gray-400 py-10">No departments yet.</td></tr>
            )}
            {departments.map(d => (
              <tr key={d.id} className="hover:bg-gray-50">
                {editId === d.id ? (
                  <>
                    <td className="px-5 py-3"><input value={editVal.name} onChange={e => setEditVal(p => ({ ...p, name: e.target.value }))} className={inputCls} /></td>
                    <td className="px-5 py-3">
                      <select value={editVal.branch} onChange={e => setEditVal(p => ({ ...p, branch: e.target.value }))} className={selectCls}>
                        <option value="">— No branch —</option>
                        {activeBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select value={editVal.is_active ? 'true' : 'false'} onChange={e => setEditVal(p => ({ ...p, is_active: e.target.value === 'true' }))} className={selectCls}>
                        <option value="true">Active</option><option value="false">Inactive</option>
                      </select>
                    </td>
                    <td className="px-5 py-3"><div className="flex gap-2"><SaveBtn onClick={handleSave} /><CancelBtn onClick={() => setEditId(null)} /></div></td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 font-medium text-brand-slate">{d.name}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{d.branch_name || '—'}</td>
                    <td className="px-5 py-3"><StatusBadge active={d.is_active} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => startEdit(d)} className="flex items-center gap-1 text-xs font-medium text-brand-slate hover:text-brand-red"><PencilIcon className="h-3.5 w-3.5" /> Edit</button>
                        {d.is_active && <button onClick={() => handleDelete(d)} className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700"><TrashIcon className="h-3.5 w-3.5" /> Deactivate</button>}
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

// ── Work Locations tab ─────────────────────────────────────────────────────────

function WorkLocationsTab() {
  const qc = useQueryClient()
  const [editId, setEditId]   = useState(null)
  const [editVal, setEditVal] = useState({ name: '', location: '', is_active: true })
  const [adding, setAdding]   = useState(false)
  const [newVal, setNewVal]   = useState({ name: '', location: '' })

  const { data: branches = [], isLoading } = useQuery({ queryKey: ['branches-all'], queryFn: fetchBranches })

  const saveMut = useMutation({
    mutationFn: ({ id, data }) => updateBranch(id, data),
    onSuccess: () => { toast.success('Work location updated'); qc.invalidateQueries({ queryKey: ['branches-all'] }); qc.invalidateQueries({ queryKey: ['branches'] }); setEditId(null) },
    onError: () => toast.error('Failed to update work location'),
  })
  const createMut = useMutation({
    mutationFn: (data) => createBranch(data),
    onSuccess: () => { toast.success('Work location created'); qc.invalidateQueries({ queryKey: ['branches-all'] }); qc.invalidateQueries({ queryKey: ['branches'] }); setAdding(false); setNewVal({ name: '', location: '' }) },
    onError: () => toast.error('Failed to create work location'),
  })
  const deleteMut = useMutation({
    mutationFn: (id) => deleteBranch(id),
    onSuccess: () => { toast.success('Work location deactivated'); qc.invalidateQueries({ queryKey: ['branches-all'] }); qc.invalidateQueries({ queryKey: ['branches'] }) },
    onError: () => toast.error('Failed to deactivate work location'),
  })

  const startEdit = (b) => { setEditId(b.id); setEditVal({ name: b.name, location: b.location || '', is_active: b.is_active }) }
  const handleSave = () => { if (!editVal.name.trim()) return toast.error('Name required'); saveMut.mutate({ id: editId, data: editVal }) }
  const handleCreate = () => { if (!newVal.name.trim()) return toast.error('Name required'); createMut.mutate(newVal) }
  const handleDelete = (b) => { if (window.confirm(`Deactivate "${b.name}"?`)) deleteMut.mutate(b.id) }

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-slate uppercase tracking-wider">Work Locations</h3>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity">
          <PlusIcon className="h-3.5 w-3.5" /> Add Location
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Location Name', 'Address / Description', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {adding && (
              <tr className="bg-red-50/30">
                <td className="px-5 py-3"><input autoFocus value={newVal.name} onChange={e => setNewVal(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Head Office" className={inputCls} /></td>
                <td className="px-5 py-3"><input value={newVal.location} onChange={e => setNewVal(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Kisumu CBD" className={inputCls} /></td>
                <td className="px-5 py-3 text-xs text-green-600 font-semibold">Active</td>
                <td className="px-5 py-3"><div className="flex gap-2"><SaveBtn onClick={handleCreate} /><CancelBtn onClick={() => { setAdding(false); setNewVal({ name: '', location: '' }) }} /></div></td>
              </tr>
            )}
            {branches.length === 0 && !adding && (
              <tr><td colSpan={4} className="text-center text-sm text-gray-400 py-10">No work locations yet.</td></tr>
            )}
            {branches.map(b => (
              <tr key={b.id} className="hover:bg-gray-50">
                {editId === b.id ? (
                  <>
                    <td className="px-5 py-3"><input value={editVal.name} onChange={e => setEditVal(p => ({ ...p, name: e.target.value }))} className={inputCls} /></td>
                    <td className="px-5 py-3"><input value={editVal.location} onChange={e => setEditVal(p => ({ ...p, location: e.target.value }))} className={inputCls} /></td>
                    <td className="px-5 py-3">
                      <select value={editVal.is_active ? 'true' : 'false'} onChange={e => setEditVal(p => ({ ...p, is_active: e.target.value === 'true' }))} className={selectCls}>
                        <option value="true">Active</option><option value="false">Inactive</option>
                      </select>
                    </td>
                    <td className="px-5 py-3"><div className="flex gap-2"><SaveBtn onClick={handleSave} /><CancelBtn onClick={() => setEditId(null)} /></div></td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 font-medium text-brand-slate">{b.name}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{b.location || '—'}</td>
                    <td className="px-5 py-3"><StatusBadge active={b.is_active} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => startEdit(b)} className="flex items-center gap-1 text-xs font-medium text-brand-slate hover:text-brand-red"><PencilIcon className="h-3.5 w-3.5" /> Edit</button>
                        {b.is_active && <button onClick={() => handleDelete(b)} className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700"><TrashIcon className="h-3.5 w-3.5" /> Deactivate</button>}
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

// ── Positions tab ──────────────────────────────────────────────────────────────

function PositionsTab() {
  const qc = useQueryClient()
  const [editId, setEditId]   = useState(null)
  const [editVal, setEditVal] = useState({ title: '', department: '', job_grade: '', is_active: true })
  const [adding, setAdding]   = useState(false)
  const [newVal, setNewVal]   = useState({ title: '', department: '', job_grade: '' })

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['positions-all'],
    queryFn: () => getPositions({ all: true }).then(r => r.data?.results ?? r.data ?? []),
  })
  const { data: departments = [] } = useQuery({ queryKey: ['departments-all'], queryFn: fetchDepts })
  const { data: jobGrades = [] } = useQuery({
    queryKey: ['job-grades'],
    queryFn: () => api.get('/hr/job-grades/').then(r => r.data?.results ?? r.data ?? []),
  })

  const activeDepts = departments.filter(d => d.is_active)

  const saveMut = useMutation({
    mutationFn: ({ id, data }) => updatePosition(id, data),
    onSuccess: () => { toast.success('Position updated'); qc.invalidateQueries({ queryKey: ['positions-all'] }); qc.invalidateQueries({ queryKey: ['positions'] }); setEditId(null) },
    onError: () => toast.error('Failed to update position'),
  })
  const createMut = useMutation({
    mutationFn: (data) => api.post('/hr/positions/', data),
    onSuccess: () => { toast.success('Position created'); qc.invalidateQueries({ queryKey: ['positions-all'] }); qc.invalidateQueries({ queryKey: ['positions'] }); setAdding(false); setNewVal({ title: '', department: '', job_grade: '' }) },
    onError: () => toast.error('Failed to create position'),
  })
  const deactivateMut = useMutation({
    mutationFn: (id) => updatePosition(id, { is_active: false }),
    onSuccess: () => { toast.success('Position deactivated'); qc.invalidateQueries({ queryKey: ['positions-all'] }); qc.invalidateQueries({ queryKey: ['positions'] }) },
    onError: () => toast.error('Failed to deactivate position'),
  })

  const startEdit = (p) => { setEditId(p.id); setEditVal({ title: p.title, department: p.department || '', job_grade: p.job_grade || '', is_active: p.is_active }) }
  const handleSave = () => { if (!editVal.title.trim()) return toast.error('Title required'); saveMut.mutate({ id: editId, data: editVal }) }
  const handleCreate = () => { if (!newVal.title.trim()) return toast.error('Title required'); createMut.mutate(newVal) }
  const handleDeactivate = (p) => { if (window.confirm(`Deactivate "${p.title}"?`)) deactivateMut.mutate(p.id) }

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-slate uppercase tracking-wider">Positions / Roles</h3>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity">
          <PlusIcon className="h-3.5 w-3.5" /> Add Position
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Position / Role Title', 'Department', 'Job Grade', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {adding && (
              <tr className="bg-red-50/30">
                <td className="px-5 py-3"><input autoFocus value={newVal.title} onChange={e => setNewVal(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Site Engineer" className={inputCls} /></td>
                <td className="px-5 py-3">
                  <select value={newVal.department} onChange={e => setNewVal(p => ({ ...p, department: e.target.value }))} className={selectCls}>
                    <option value="">— Any department —</option>
                    {activeDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3">
                  <select value={newVal.job_grade} onChange={e => setNewVal(p => ({ ...p, job_grade: e.target.value }))} className={selectCls}>
                    <option value="">— No grade —</option>
                    {jobGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3 text-xs text-green-600 font-semibold">Active</td>
                <td className="px-5 py-3"><div className="flex gap-2"><SaveBtn onClick={handleCreate} /><CancelBtn onClick={() => { setAdding(false); setNewVal({ title: '', department: '', job_grade: '' }) }} /></div></td>
              </tr>
            )}
            {positions.length === 0 && !adding && (
              <tr><td colSpan={5} className="text-center text-sm text-gray-400 py-10">No positions yet. Add your first role above.</td></tr>
            )}
            {positions.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                {editId === p.id ? (
                  <>
                    <td className="px-5 py-3"><input value={editVal.title} onChange={e => setEditVal(v => ({ ...v, title: e.target.value }))} className={inputCls} /></td>
                    <td className="px-5 py-3">
                      <select value={editVal.department} onChange={e => setEditVal(v => ({ ...v, department: e.target.value }))} className={selectCls}>
                        <option value="">— Any department —</option>
                        {activeDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select value={editVal.job_grade} onChange={e => setEditVal(v => ({ ...v, job_grade: e.target.value }))} className={selectCls}>
                        <option value="">— No grade —</option>
                        {jobGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select value={editVal.is_active ? 'true' : 'false'} onChange={e => setEditVal(v => ({ ...v, is_active: e.target.value === 'true' }))} className={selectCls}>
                        <option value="true">Active</option><option value="false">Inactive</option>
                      </select>
                    </td>
                    <td className="px-5 py-3"><div className="flex gap-2"><SaveBtn onClick={handleSave} /><CancelBtn onClick={() => setEditId(null)} /></div></td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 font-medium text-brand-slate">{p.title}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{p.department_name || '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{p.job_grade_name || '—'}</td>
                    <td className="px-5 py-3"><StatusBadge active={p.is_active} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => startEdit(p)} className="flex items-center gap-1 text-xs font-medium text-brand-slate hover:text-brand-red"><PencilIcon className="h-3.5 w-3.5" /> Edit</button>
                        {p.is_active && <button onClick={() => handleDeactivate(p)} className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700"><TrashIcon className="h-3.5 w-3.5" /> Deactivate</button>}
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
  { key: 'departments',    label: 'Departments',    icon: BuildingOfficeIcon },
  { key: 'work_locations', label: 'Work Locations', icon: MapPinIcon },
  { key: 'positions',      label: 'Positions',      icon: BriefcaseIcon },
]

export default function OrganisationPage() {
  const [tab, setTab] = useState('departments')

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${active ? 'border-brand-red text-brand-red bg-red-50/40' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {tab === 'departments'    && <DepartmentsTab />}
      {tab === 'work_locations' && <WorkLocationsTab />}
      {tab === 'positions'      && <PositionsTab />}
    </div>
  )
}
