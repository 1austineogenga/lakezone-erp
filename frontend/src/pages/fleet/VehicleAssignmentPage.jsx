import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { PlusIcon, TruckIcon } from '@heroicons/react/24/outline'
import { getVehicles } from '../../api/fleet'
import { assignVehicle } from '../../api/projects'

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'

const EMPTY = {
  vehicle: '', project_id: '', driver_operator: '',
  assigned_from: '', assigned_to: '', daily_rate: '', notes: '', is_active: true,
}

function useProjects() {
  return useQuery({
    queryKey: ['projects-for-assignment'],
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
    queryKey: ['employees-for-assignment'],
    queryFn: () => api.get('/hr/employees/', { params: { status: 'active', page_size: 500 } }),
    staleTime: 60_000,
    select: r => r.data?.results ?? (Array.isArray(r.data) ? r.data : []),
  })
}

const STATUS_DOT = { MOVING: 'bg-green-500', IDLE: 'bg-yellow-400', STOP: 'bg-gray-400', INACTIVE: 'bg-red-400' }

export default function VehicleAssignmentPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [filterProject, setFilterProject] = useState('')

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: getVehicles,
    select: r => r.data?.results ?? (Array.isArray(r.data) ? r.data : []),
  })

  const { data: projects = [] } = useProjects()
  const { data: employees = [] } = useEmployees()

  // Fetch all project vehicle assignments
  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['all-vehicle-assignments'],
    queryFn: async () => {
      const r = await api.get('/projects/vehicles/', { params: { page_size: 500 } }).catch(() => null)
      if (r) return r.data?.results ?? r.data ?? []
      // Fallback: fetch per project
      const res = await Promise.all(
        projects.map(p => api.get(`/projects/${p.id}/vehicles/`).then(r => (r.data?.results ?? r.data ?? []).map(a => ({ ...a, project_name: p.name, project_id: p.id }))).catch(() => []))
      )
      return res.flat()
    },
    enabled: projects.length > 0,
    staleTime: 30_000,
  })

  const assignMut = useMutation({
    mutationFn: ({ project_id, ...data }) => assignVehicle(project_id, data),
    onSuccess: () => {
      toast.success('Vehicle assigned to project.')
      qc.invalidateQueries({ queryKey: ['all-vehicle-assignments'] })
      qc.invalidateQueries({ queryKey: ['project-vehicles'] })
      setShowForm(false)
      setForm(EMPTY)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to assign vehicle.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.vehicle)       { toast.error('Please select a vehicle.'); return }
    if (!form.project_id)    { toast.error('Please select a project.'); return }
    if (!form.assigned_from) { toast.error('Please set the start date.'); return }
    const { project_id, ...payload } = form
    if (!payload.daily_rate) delete payload.daily_rate
    if (!payload.assigned_to) delete payload.assigned_to
    assignMut.mutate({ project_id, ...payload })
  }

  const filtered = filterProject
    ? allAssignments.filter(a => String(a.project_id) === filterProject || a.project_name === projects.find(p => String(p.id) === filterProject)?.name)
    : allAssignments

  const selectedVehicle = vehicles.find(v => String(v.id) === String(form.vehicle))
  const selectedProject = projects.find(p => String(p.id) === String(form.project_id))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Vehicle Assignment</h2>
          <p className="text-xs text-gray-500 mt-0.5">Assign vehicles to projects and track their deployment</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Assign Vehicle
        </button>
      </div>

      {/* Assignment form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Vehicle Assignment</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vehicle */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle *</label>
                <select required className={inp} value={form.vehicle} onChange={e => field('vehicle', e.target.value)}>
                  <option value="">— Select vehicle —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_no}{v.vehicle_name ? ` — ${v.vehicle_name}` : ''}{v.make ? ` (${v.make})` : ''}
                    </option>
                  ))}
                </select>
                {selectedVehicle && (
                  <p className="mt-1 text-[10px] text-blue-600">
                    {[selectedVehicle.make, selectedVehicle.model_name].filter(Boolean).join(' ')}
                    {selectedVehicle.asset_category ? ` · ${selectedVehicle.asset_category}` : ''}
                    {selectedVehicle.current_site ? ` · ${selectedVehicle.current_site}` : ''}
                  </p>
                )}
              </div>

              {/* Project */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Project *</label>
                <select required className={inp} value={form.project_id} onChange={e => field('project_id', e.target.value)}>
                  <option value="">— Select project —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
                  ))}
                </select>
                {selectedProject && (
                  <p className="mt-1 text-[10px] text-blue-600">
                    {selectedProject.location || selectedProject.client || ''}
                  </p>
                )}
              </div>

              {/* Driver / Operator */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Driver / Operator</label>
                <select className={inp} value={form.driver_operator} onChange={e => field('driver_operator', e.target.value)}>
                  <option value="">— Select employee (optional) —</option>
                  {employees.map(e => (
                    <option key={e.id} value={`${e.first_name} ${e.last_name}`.trim()}>
                      {e.employee_number} — {e.first_name} {e.last_name}{e.position?.title ? ` (${e.position.title})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Daily Rate */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Daily Rate (KES)</label>
                <input type="number" className={inp} placeholder="0" value={form.daily_rate} onChange={e => field('daily_rate', e.target.value)} />
              </div>

              {/* Dates */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From *</label>
                <input required type="date" className={inp} value={form.assigned_from} onChange={e => field('assigned_from', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To (optional)</label>
                <input type="date" className={inp} value={form.assigned_to} onChange={e => field('assigned_to', e.target.value)} />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input className={inp} value={form.notes} onChange={e => field('notes', e.target.value)} placeholder="Optional notes…" />
              </div>

              {/* Active */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => field('is_active', e.target.checked)}
                    className="rounded border-gray-300 accent-brand-red" />
                  Currently active on this project
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={assignMut.isPending}
                className="px-5 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
                {assignMut.isPending ? 'Saving…' : 'Assign Vehicle'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY) }}
                className="px-5 py-2 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter by project */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-500">Filter by project:</label>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {filtered.length > 0 && <span className="text-xs text-gray-400">{filtered.length} assignment{filtered.length !== 1 ? 's' : ''}</span>}
      </div>

      {/* Assignments table */}
      {isLoading ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-10 text-center text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-14 text-center">
          <TruckIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No vehicle assignments yet.</p>
          <p className="text-xs text-gray-400 mt-1">Use the button above to assign a vehicle to a project.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Vehicle', 'Project', 'Driver / Operator', 'From', 'To', 'Daily Rate', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-brand-slate">{a.vehicle_no || a.vehicle}</p>
                    {a.vehicle_name && <p className="text-gray-400 text-[10px]">{a.vehicle_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{a.project_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.driver_operator || a.notes || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{a.assigned_from}</td>
                  <td className="px-4 py-3 text-gray-500">{a.assigned_to || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {a.daily_rate ? `KES ${Number(a.daily_rate).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
