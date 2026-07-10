import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { PlusIcon, XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import {
  getLabourDeployments, createLabourDeployment, updateLabourDeployment, deleteLabourDeployment,
} from '../../api/deployment'

const ROLES = [
  { value: 'engineer',       label: 'Engineer' },
  { value: 'foreman',        label: 'Foreman' },
  { value: 'supervisor',     label: 'Supervisor' },
  { value: 'artisan',        label: 'Artisan' },
  { value: 'operator',       label: 'Operator' },
  { value: 'driver',         label: 'Driver' },
  { value: 'labourer',       label: 'Labourer' },
  { value: 'surveyor',       label: 'Surveyor' },
  { value: 'safety_officer', label: 'Safety Officer' },
  { value: 'other',          label: 'Other' },
]

const SHIFTS   = [{ value: 'day', label: 'Day' }, { value: 'night', label: 'Night' }, { value: 'full', label: 'Full Day' }]
const STATUSES = [{ value: 'active', label: 'Active' }, { value: 'standby', label: 'Standby' }, { value: 'breakdown', label: 'Breakdown' }, { value: 'completed', label: 'Completed' }]

const STATUS_COLORS = {
  active:    'bg-green-100 text-green-700',
  standby:   'bg-yellow-100 text-yellow-700',
  breakdown: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-600',
}

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-red focus:border-transparent'
const lbl = 'block text-xs font-medium text-gray-700 mb-1'

function Badge({ text, colorMap }) {
  const cls = colorMap?.[text] ?? 'bg-gray-100 text-gray-600'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{text?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span>
}

function Field({ label, children }) {
  return <div><label className={lbl}>{label}</label>{children}</div>
}

function InfoCard({ children }) {
  return <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-brand-slate space-y-0.5">{children}</div>
}

function guessRole(positionTitle = '') {
  const t = positionTitle.toLowerCase()
  if (t.includes('engineer'))       return 'engineer'
  if (t.includes('foreman'))        return 'foreman'
  if (t.includes('supervisor'))     return 'supervisor'
  if (t.includes('artisan') || t.includes('technician') || t.includes('mechanic') || t.includes('welder') || t.includes('electrician') || t.includes('plumber')) return 'artisan'
  if (t.includes('operator'))       return 'operator'
  if (t.includes('driver'))         return 'driver'
  if (t.includes('survey'))         return 'surveyor'
  if (t.includes('safety') || t.includes('hse')) return 'safety_officer'
  return 'labourer'
}

function useProjects() {
  return useQuery({
    queryKey: ['projects-for-deployment'],
    queryFn: async () => {
      let results = [], page = 1
      while (true) {
        const r = await api.get('/projects/', { params: { page, page_size: 100 } })
        const data = r.data
        const items = data.results ?? (Array.isArray(data) ? data : [])
        results = [...results, ...items]
        if (!data.next || items.length === 0) break
        page++
      }
      return results
    },
    staleTime: 60_000,
  })
}

function useEmployees() {
  return useQuery({
    queryKey: ['employees-for-deployment'],
    queryFn: () => api.get('/hr/employees/', { params: { status: 'active', page_size: 500 } }),
    staleTime: 60_000,
    select: r => r.data?.results ?? (Array.isArray(r.data) ? r.data : []),
  })
}

function LabourModal({ initial, projects, employees, onClose, onSave }) {
  const [form, setForm] = useState({
    project_name: '', project_id: '', employee: '',
    activity: '', role: 'labourer', date: new Date().toISOString().slice(0,10),
    shift: 'day', hours_worked: 8, status: 'active', notes: '',
    ...(initial || {}),
  })
  const [selectedEmployee, setSelectedEmployee] = useState(
    initial ? employees.find(e => String(e.id) === String(initial.employee)) : null
  )
  const [selectedProject, setSelectedProject] = useState(
    initial ? projects.find(p => String(p.id) === String(initial.project_id)) : null
  )
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleProjectChange = (pid) => {
    const p = projects.find(x => String(x.id) === pid)
    setSelectedProject(p || null)
    setForm(f => ({ ...f, project_id: pid, project_name: p?.name || '' }))
  }

  const handleEmployeeChange = (eid) => {
    const emp = employees.find(x => String(x.id) === eid)
    setSelectedEmployee(emp || null)
    setForm(f => ({ ...f, employee: eid, role: emp ? guessRole(emp.position?.title || '') : f.role }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-brand-slate px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-white">{initial ? 'Edit Labour Deployment' : 'Deploy Labour'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><XMarkIcon className="h-5 w-5 text-white" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
            <Field label="Project *">
              <select required className={inp} value={form.project_id || ''} onChange={e => handleProjectChange(e.target.value)}>
                <option value="">— Select Project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>)}
              </select>
            </Field>
            {selectedProject && (
              <InfoCard>
                <p><span className="font-semibold">Project:</span> {selectedProject.name}</p>
                {selectedProject.client && <p><span className="font-semibold">Client:</span> {selectedProject.client}</p>}
                {selectedProject.location && <p><span className="font-semibold">Location:</span> {selectedProject.location}</p>}
              </InfoCard>
            )}
            <Field label="Employee *">
              <select required className={inp} value={form.employee || ''} onChange={e => handleEmployeeChange(e.target.value)}>
                <option value="">— Select Employee —</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.employee_number} — {e.first_name} {e.last_name}{e.position?.title ? ` (${e.position.title})` : ''}</option>
                ))}
              </select>
            </Field>
            {selectedEmployee && (
              <InfoCard>
                <p><span className="font-semibold">Name:</span> {selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                <p><span className="font-semibold">Staff No:</span> {selectedEmployee.employee_number}</p>
                {selectedEmployee.position?.title && <p><span className="font-semibold">Position:</span> {selectedEmployee.position.title}</p>}
              </InfoCard>
            )}
            <Field label="Activity / Task">
              <input className={inp} placeholder="e.g. Concrete pouring — Abutment A" value={form.activity} onChange={e => set('activity', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Role">
                <select className={inp} value={form.role} onChange={e => set('role', e.target.value)}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="Date *">
                <input required type="date" className={inp} value={form.date} onChange={e => set('date', e.target.value)} />
              </Field>
              <Field label="Shift">
                <select className={inp} value={form.shift} onChange={e => set('shift', e.target.value)}>
                  {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Hours Worked">
                <input type="number" step="0.5" min="0" max="24" className={inp} value={form.hours_worked} onChange={e => set('hours_worked', e.target.value)} />
              </Field>
              <Field label="Status">
                <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </Field>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium hover:bg-red-700">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LabourDeploymentPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0,10))
  const [dateTo, setDateTo] = useState('')
  const [filterRole, setFilterRole] = useState('')

  const { data: projects = [] } = useProjects()
  const { data: employees = [] } = useEmployees()
  const { data, isLoading } = useQuery({
    queryKey: ['labour-deployments', dateFrom, dateTo, filterRole],
    queryFn: () => getLabourDeployments({ date_from: dateFrom || undefined, date_to: dateTo || undefined, role: filterRole || undefined, page_size: 200 }),
  })
  const records = data?.data?.results ?? data?.data ?? []

  const saveMut = useMutation({
    mutationFn: d => editing ? updateLabourDeployment(editing.id, d) : createLabourDeployment(d),
    onSuccess: () => { qc.invalidateQueries(['labour-deployments']); qc.invalidateQueries(['deployment-dashboard']); setShowModal(false); setEditing(null); toast.success('Saved') },
    onError: () => toast.error('Failed to save'),
  })
  const delMut = useMutation({
    mutationFn: deleteLabourDeployment,
    onSuccess: () => { qc.invalidateQueries(['labour-deployments']); qc.invalidateQueries(['deployment-dashboard']); toast.success('Deleted') },
  })

  const totalHours = records.reduce((s, r) => s + parseFloat(r.hours_worked || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-3">
          {records.length > 0 && <span className="text-xs text-gray-500">{records.length} records · {totalHours.toFixed(1)} hrs total</span>}
          <button onClick={() => { setEditing(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-red-700">
            <PlusIcon className="h-4 w-4" /> Deploy Labour
          </button>
        </div>
      </div>

      {isLoading ? <p className="text-center py-12 text-gray-400">Loading…</p> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Employee', 'Project', 'Activity', 'Role', 'Shift', 'Hours', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No records found</td></tr>}
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.date}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-slate">{r.employee_name}</p>
                    <p className="text-xs text-gray-400">{r.employee_number}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[130px] truncate">{r.project_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{r.activity || '—'}</td>
                  <td className="px-4 py-3 capitalize text-gray-500 text-xs">{r.role?.replace(/_/g,' ')}</td>
                  <td className="px-4 py-3 capitalize text-gray-500 text-xs">{r.shift}</td>
                  <td className="px-4 py-3 text-gray-600">{r.hours_worked}h</td>
                  <td className="px-4 py-3"><Badge text={r.status} colorMap={STATUS_COLORS} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(r); setShowModal(true) }} className="p-1.5 text-gray-400 hover:text-brand-slate hover:bg-gray-100 rounded-lg"><PencilIcon className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm('Delete?')) delMut.mutate(r.id) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <LabourModal
          initial={editing}
          projects={projects}
          employees={employees}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={d => saveMut.mutate(d)}
        />
      )}
    </div>
  )
}
