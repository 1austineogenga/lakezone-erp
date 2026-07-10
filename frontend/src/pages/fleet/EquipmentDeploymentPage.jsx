import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { PlusIcon, XMarkIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import {
  getEquipmentDeployments, createEquipmentDeployment, updateEquipmentDeployment, deleteEquipmentDeployment,
} from '../../api/deployment'

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

function Field({ label, children }) {
  return <div><label className={lbl}>{label}</label>{children}</div>
}

function InfoCard({ children }) {
  return <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 space-y-0.5">{children}</div>
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

function useVehicles() {
  return useQuery({
    queryKey: ['vehicles-for-deployment'],
    queryFn: () => api.get('/fleet/vehicles/', { params: { is_active: true, page_size: 200 } }),
    staleTime: 60_000,
    select: r => r.data?.results ?? (Array.isArray(r.data) ? r.data : []),
  })
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-brand-slate px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-white">{initial ? 'Edit Equipment Deployment' : 'Deploy Equipment'}</h2>
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
              </InfoCard>
            )}
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
        </div>
      </div>
    </div>
  )
}

export default function EquipmentDeploymentPage() {
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
