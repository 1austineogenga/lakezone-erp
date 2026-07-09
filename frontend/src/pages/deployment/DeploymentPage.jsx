import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import {
  PlusIcon, XMarkIcon, PencilIcon, TrashIcon,
  ChartBarIcon, UsersIcon, TruckIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import {
  getDeploymentDashboard,
  getLabourDeployments, createLabourDeployment, updateLabourDeployment, deleteLabourDeployment,
  getEquipmentDeployments, createEquipmentDeployment, updateEquipmentDeployment, deleteEquipmentDeployment,
} from '../../api/deployment'

const TABS = [
  { id: 'dashboard', label: 'Dashboard',  Icon: ChartBarIcon },
  { id: 'labour',    label: 'Labour',     Icon: UsersIcon },
  { id: 'equipment', label: 'Equipment',  Icon: TruckIcon },
]

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

const EQUIPMENT_TYPES = [
  { value: 'excavator',      label: 'Excavator' },
  { value: 'grader',         label: 'Grader' },
  { value: 'roller',         label: 'Roller / Compactor' },
  { value: 'tipper',         label: 'Tipper Truck' },
  { value: 'concrete_mixer', label: 'Concrete Mixer' },
  { value: 'crane',          label: 'Crane' },
  { value: 'bulldozer',      label: 'Bulldozer' },
  { value: 'water_bowser',   label: 'Water Bowser' },
  { value: 'generator',      label: 'Generator' },
  { value: 'vehicle',        label: 'Vehicle / Pickup' },
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

function StatCard({ label, value, color = 'text-brand-slate' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-brand-slate px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><XMarkIcon className="h-5 w-5 text-white" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label className={lbl}>{label}</label>{children}</div>
}

// ── Data hooks (use authenticated api client) ─────────────────────────────────
function useProjects() {
  return useQuery({
    queryKey: ['projects-for-deployment'],
    queryFn: async () => {
      // Fetch all pages
      let results = []
      let page = 1
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

function useVehicles() {
  return useQuery({
    queryKey: ['vehicles-for-deployment'],
    queryFn: () => api.get('/fleet/vehicles/', { params: { is_active: true, page_size: 200 } }),
    staleTime: 60_000,
    select: r => r.data?.results ?? (Array.isArray(r.data) ? r.data : []),
  })
}

// ── Info card shown after a selection ────────────────────────────────────────
function InfoCard({ children }) {
  return <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 space-y-0.5">{children}</div>
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

function guessEquipmentType(vehicleType = '') {
  const t = vehicleType.toLowerCase()
  if (t.includes('excavat'))        return 'excavator'
  if (t.includes('grad'))           return 'grader'
  if (t.includes('roller') || t.includes('compact')) return 'roller'
  if (t.includes('tipper') || t.includes('dump'))    return 'tipper'
  if (t.includes('mixer') || t.includes('concrete')) return 'concrete_mixer'
  if (t.includes('crane'))          return 'crane'
  if (t.includes('bull') || t.includes('dozer'))     return 'bulldozer'
  if (t.includes('water') || t.includes('bowser'))   return 'water_bowser'
  if (t.includes('gen'))            return 'generator'
  if (t.includes('vehicle') || t.includes('pickup') || t.includes('truck') || t.includes('van')) return 'vehicle'
  return 'other'
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data, isLoading } = useQuery({ queryKey: ['deployment-dashboard'], queryFn: () => getDeploymentDashboard() })
  const d = data?.data ?? {}

  if (isLoading) return <p className="text-center py-12 text-gray-400">Loading…</p>

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">Today — {today}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Labour on Site Today"    value={d.labour_today ?? 0}    color="text-blue-600" />
        <StatCard label="Equipment on Site Today" value={d.equipment_today ?? 0} color="text-green-600" />
        <StatCard label="Breakdowns Today"        value={d.breakdowns_today ?? 0} color="text-red-600" />
        <StatCard label="Total Labour Records"    value={d.total_labour_records ?? 0} color="text-brand-slate" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-brand-slate mb-3">Labour by Role (Today)</h3>
          {Object.keys(d.by_role ?? {}).length === 0
            ? <p className="text-xs text-gray-400">No labour deployed today</p>
            : Object.entries(d.by_role ?? {}).map(([role, count]) => (
              <div key={role} className="flex items-center gap-2 mb-2">
                <span className="w-28 text-xs text-gray-600 capitalize">{role.replace(/_/g,' ')}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, (count/(d.labour_today||1))*100)}%` }} />
                </div>
                <span className="text-xs font-semibold text-brand-slate w-5 text-right">{count}</span>
              </div>
            ))
          }
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-brand-slate mb-3">Equipment by Type (Today)</h3>
          {Object.keys(d.by_equipment_type ?? {}).length === 0
            ? <p className="text-xs text-gray-400">No equipment deployed today</p>
            : Object.entries(d.by_equipment_type ?? {}).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 mb-2">
                <span className="w-28 text-xs text-gray-600 capitalize">{type.replace(/_/g,' ')}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, (count/(d.equipment_today||1))*100)}%` }} />
                </div>
                <span className="text-xs font-semibold text-brand-slate w-5 text-right">{count}</span>
              </div>
            ))
          }
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-brand-slate mb-3">Labour by Project (Today)</h3>
          {Object.keys(d.by_project ?? {}).length === 0
            ? <p className="text-xs text-gray-400">No deployments today</p>
            : Object.entries(d.by_project ?? {}).map(([proj, count]) => (
              <div key={proj} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <p className="text-xs text-brand-slate truncate max-w-[160px]">{proj}</p>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{count}</span>
              </div>
            ))
          }
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-brand-slate mb-3">Recent Labour Deployments</h3>
          {(d.recent_labour ?? []).length === 0
            ? <p className="text-xs text-gray-400">No records yet</p>
            : (d.recent_labour ?? []).map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-xs font-medium text-brand-slate">{r.employee_name}</p>
                  <p className="text-xs text-gray-400">{r.project_name} · {r.date} · {r.role?.replace(/_/g,' ')}</p>
                </div>
                <Badge text={r.status} colorMap={STATUS_COLORS} />
              </div>
            ))
          }
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-brand-slate mb-3">Recent Equipment Deployments</h3>
          {(d.recent_equipment ?? []).length === 0
            ? <p className="text-xs text-gray-400">No records yet</p>
            : (d.recent_equipment ?? []).map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-xs font-medium text-brand-slate">{r.vehicle_no || r.equipment_id_ref} {r.vehicle_name ? `— ${r.vehicle_name}` : ''}</p>
                  <p className="text-xs text-gray-400">{r.project_name} · {r.date} · {r.equipment_type?.replace(/_/g,' ')}</p>
                </div>
                <div className="flex items-center gap-1">
                  {r.status === 'breakdown' && <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500" />}
                  <Badge text={r.status} colorMap={STATUS_COLORS} />
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ── Labour Modal ──────────────────────────────────────────────────────────────
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
    setForm(f => ({
      ...f,
      employee: eid,
      role: emp ? guessRole(emp.position?.title || '') : f.role,
    }))
  }

  return (
    <Modal title={initial ? 'Edit Labour Deployment' : 'Deploy Labour'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">

        {/* Project */}
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
            {selectedProject.status && <p><span className="font-semibold">Status:</span> {selectedProject.status}</p>}
          </InfoCard>
        )}

        {/* Employee */}
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
            {selectedEmployee.department?.name && <p><span className="font-semibold">Department:</span> {selectedEmployee.department.name}</p>}
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
    </Modal>
  )
}

// ── Labour Tab ────────────────────────────────────────────────────────────────
function LabourTab() {
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

// ── Equipment Modal ───────────────────────────────────────────────────────────
function EquipmentModal({ initial, projects, vehicles, onClose, onSave }) {
  const [form, setForm] = useState({
    project_name: '', project_id: '', vehicle: '', equipment_type: 'other',
    equipment_id_ref: '', activity: '', date: new Date().toISOString().slice(0,10),
    shift: 'day', hours_worked: 8, operator_name: '', status: 'active',
    breakdown_notes: '', notes: '',
    ...(initial || {}),
  })
  const [selectedProject, setSelectedProject] = useState(
    initial ? projects.find(p => String(p.id) === String(initial.project_id)) : null
  )
  const [selectedVehicle, setSelectedVehicle] = useState(
    initial ? vehicles.find(v => String(v.id) === String(initial.vehicle)) : null
  )
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleProjectChange = (pid) => {
    const p = projects.find(x => String(x.id) === pid)
    setSelectedProject(p || null)
    setForm(f => ({ ...f, project_id: pid, project_name: p?.name || '' }))
  }

  const handleVehicleChange = (vid) => {
    if (!vid) {
      setSelectedVehicle(null)
      setForm(f => ({ ...f, vehicle: '', equipment_id_ref: '', equipment_type: 'other' }))
      return
    }
    const v = vehicles.find(x => String(x.id) === vid)
    setSelectedVehicle(v || null)
    setForm(f => ({
      ...f,
      vehicle: vid,
      equipment_id_ref: v?.vehicle_no || f.equipment_id_ref,
      equipment_type: guessEquipmentType(v?.vehicle_type || ''),
    }))
  }

  return (
    <Modal title={initial ? 'Edit Equipment Deployment' : 'Deploy Equipment'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">

        {/* Project */}
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
            {selectedProject.status && <p><span className="font-semibold">Status:</span> {selectedProject.status}</p>}
          </InfoCard>
        )}

        {/* Fleet Vehicle */}
        <Field label="Fleet Vehicle">
          <select className={inp} value={form.vehicle || ''} onChange={e => handleVehicleChange(e.target.value)}>
            <option value="">— Select Vehicle (optional) —</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.vehicle_no}{v.vehicle_name ? ` — ${v.vehicle_name}` : ''}{v.vehicle_type ? ` [${v.vehicle_type}]` : ''}
              </option>
            ))}
          </select>
        </Field>
        {selectedVehicle && (
          <InfoCard>
            <p><span className="font-semibold">Reg No:</span> {selectedVehicle.vehicle_no}</p>
            {selectedVehicle.vehicle_name && <p><span className="font-semibold">Name:</span> {selectedVehicle.vehicle_name}</p>}
            {selectedVehicle.vehicle_type && <p><span className="font-semibold">Type:</span> {selectedVehicle.vehicle_type}</p>}
            {selectedVehicle.make && <p><span className="font-semibold">Make / Model:</span> {selectedVehicle.make}{selectedVehicle.model_name ? ` ${selectedVehicle.model_name}` : ''}</p>}
            {selectedVehicle.year && <p><span className="font-semibold">Year:</span> {selectedVehicle.year}</p>}
            {selectedVehicle.fuel_type && <p><span className="font-semibold">Fuel:</span> {selectedVehicle.fuel_type}</p>}
          </InfoCard>
        )}

        {/* Show Equipment Type + Reg No only when no fleet vehicle is selected */}
        {!selectedVehicle && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Equipment Type">
              <select className={inp} value={form.equipment_type} onChange={e => set('equipment_type', e.target.value)}>
                {EQUIPMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Equipment ID / Reg No">
              <input className={inp} placeholder="e.g. KCA 123A" value={form.equipment_id_ref} onChange={e => set('equipment_id_ref', e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Activity / Task">
          <input className={inp} placeholder="e.g. Excavation — Section B" value={form.activity} onChange={e => set('activity', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date *">
            <input required type="date" className={inp} value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Operator Name">
            <input className={inp} value={form.operator_name} onChange={e => set('operator_name', e.target.value)} />
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

        {form.status === 'breakdown' && (
          <Field label="Breakdown Notes">
            <textarea className={inp} rows={2} value={form.breakdown_notes} onChange={e => set('breakdown_notes', e.target.value)} />
          </Field>
        )}

        <Field label="Notes">
          <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium hover:bg-red-700">Save</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Equipment Tab ─────────────────────────────────────────────────────────────
function EquipmentTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0,10))
  const [dateTo, setDateTo] = useState('')
  const [filterType, setFilterType] = useState('')

  const { data: projects = [] } = useProjects()
  const { data: vehicles = [] } = useVehicles()
  const { data, isLoading } = useQuery({
    queryKey: ['equipment-deployments', dateFrom, dateTo, filterType],
    queryFn: () => getEquipmentDeployments({ date_from: dateFrom || undefined, date_to: dateTo || undefined, equipment_type: filterType || undefined, page_size: 200 }),
  })
  const records = data?.data?.results ?? data?.data ?? []

  const saveMut = useMutation({
    mutationFn: d => editing ? updateEquipmentDeployment(editing.id, d) : createEquipmentDeployment(d),
    onSuccess: () => { qc.invalidateQueries(['equipment-deployments']); qc.invalidateQueries(['deployment-dashboard']); setShowModal(false); setEditing(null); toast.success('Saved') },
    onError: () => toast.error('Failed to save'),
  })
  const delMut = useMutation({
    mutationFn: deleteEquipmentDeployment,
    onSuccess: () => { qc.invalidateQueries(['equipment-deployments']); qc.invalidateQueries(['deployment-dashboard']); toast.success('Deleted') },
  })

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
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Types</option>
          {EQUIPMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-red-700">
          <PlusIcon className="h-4 w-4" /> Deploy Equipment
        </button>
      </div>

      {isLoading ? <p className="text-center py-12 text-gray-400">Loading…</p> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Vehicle / Equipment', 'Type', 'Project', 'Activity', 'Operator', 'Shift', 'Hours', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">No records found</td></tr>}
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.date}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-slate">{r.vehicle_no || r.equipment_id_ref || '—'}</p>
                    {r.vehicle_name && <p className="text-xs text-gray-400">{r.vehicle_name}</p>}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-500 text-xs">{r.equipment_type?.replace(/_/g,' ')}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">{r.project_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">{r.activity || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.operator_name || '—'}</td>
                  <td className="px-4 py-3 capitalize text-gray-500 text-xs">{r.shift}</td>
                  <td className="px-4 py-3 text-gray-600">{r.hours_worked}h</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {r.status === 'breakdown' && <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500" />}
                      <Badge text={r.status} colorMap={STATUS_COLORS} />
                    </div>
                  </td>
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
        <EquipmentModal
          initial={editing}
          projects={projects}
          vehicles={vehicles}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={d => saveMut.mutate(d)}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DeploymentPage() {
  const [tab, setTab] = useState('dashboard')
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-slate">Labour & Equipment Deployment</h1>
        <p className="text-sm text-gray-500 mt-1">Daily deployment records — who and what is on site, and where</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === id ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'labour'    && <LabourTab />}
      {tab === 'equipment' && <EquipmentTab />}
    </div>
  )
}
