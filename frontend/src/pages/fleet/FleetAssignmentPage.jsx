import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { PlusIcon, TruckIcon, MapPinIcon, FolderIcon } from '@heroicons/react/24/outline'
import { getVehicles } from '../../api/fleet'
import { assignVehicle } from '../../api/projects'

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'

const EMPTY = {
  assign_to: 'project',       // 'project' | 'location'
  vehicle: '',
  project_id: '',
  location_name: '',
  driver_operator: '',
  assigned_from: new Date().toISOString().slice(0, 10),
  assigned_to: '',
  daily_rate: '',
  notes: '',
  is_active: true,
}

const LOCATIONS = [
  'Head Office', 'Workshop', 'Yard / Holding', 'Nairobi Depot',
  'Mombasa Site', 'Kisumu Site', 'Nakuru Site',
]

function useProjects() {
  return useQuery({
    queryKey: ['projects-for-fleet-assign'],
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
    queryKey: ['employees-for-fleet-assign'],
    queryFn: () => api.get('/hr/employees/', { params: { status: 'active', page_size: 500 } }),
    staleTime: 60_000,
    select: r => r.data?.results ?? (Array.isArray(r.data) ? r.data : []),
  })
}

export default function FleetAssignmentPage() {
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

  // Fetch all assignments across projects
  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['all-fleet-assignments', projects.map(p => p.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        projects.map(p =>
          api.get(`/projects/${p.id}/vehicles/`)
            .then(r => (r.data?.results ?? r.data ?? []).map(a => ({
              ...a,
              project_name: p.name,
              project_id: p.id,
            })))
            .catch(() => [])
        )
      )
      return results.flat()
    },
    enabled: projects.length > 0,
    staleTime: 30_000,
  })

  // Also fetch all vehicles so we can show location-only assigned ones
  const { data: allVehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles-full'],
    queryFn: async () => {
      let results = [], page = 1, hasMore = true
      while (hasMore) {
        const r = await getVehicles({ page_size: 200, page })
        const data = r.data?.results ?? (Array.isArray(r.data) ? r.data : [])
        results = results.concat(data)
        hasMore = !!r.data?.next
        page++
      }
      return results
    },
    staleTime: 60_000,
  })

  // Assign to project mutation
  const assignProjectMut = useMutation({
    mutationFn: ({ project_id, payload }) => assignVehicle(project_id, payload),
    onSuccess: () => {
      toast.success('Fleet assigned to project.')
      qc.invalidateQueries({ queryKey: ['all-fleet-assignments'] })
      qc.invalidateQueries({ queryKey: ['project-vehicles'] })
      setShowForm(false)
      setForm(EMPTY)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to assign fleet.'),
  })

  // Assign to location: update vehicle's current_site
  const assignLocationMut = useMutation({
    mutationFn: ({ vehicle_id, current_site, notes }) =>
      api.patch(`/fleet/vehicles/${vehicle_id}/`, { current_site, notes: notes || undefined }),
    onSuccess: () => {
      toast.success('Fleet location updated.')
      qc.invalidateQueries({ queryKey: ['fleet-vehicles'] })
      qc.invalidateQueries({ queryKey: ['fleet-vehicles-full'] })
      setShowForm(false)
      setForm(EMPTY)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to update location.'),
  })

  const isPending = assignProjectMut.isPending || assignLocationMut.isPending

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.vehicle) { toast.error('Please select a vehicle.'); return }

    if (form.assign_to === 'project') {
      if (!form.project_id)    { toast.error('Please select a project.'); return }
      if (!form.assigned_from) { toast.error('Please set the start date.'); return }
      const payload = {
        vehicle: form.vehicle,
        assigned_from: form.assigned_from,
        is_active: form.is_active,
        ...(form.assigned_to   && { assigned_to: form.assigned_to }),
        ...(form.daily_rate    && { daily_rate: form.daily_rate }),
        ...(form.driver_operator && { notes: form.driver_operator + (form.notes ? ` — ${form.notes}` : '') }),
        ...(!form.driver_operator && form.notes && { notes: form.notes }),
      }
      assignProjectMut.mutate({ project_id: form.project_id, payload })
    } else {
      const loc = form.location_name || ''
      if (!loc) { toast.error('Please enter a location.'); return }
      assignLocationMut.mutate({ vehicle_id: form.vehicle, current_site: loc, notes: form.notes })
    }
  }

  const filtered = filterProject
    ? allAssignments.filter(a => String(a.project_id) === filterProject)
    : allAssignments

  const selectedVehicle = vehicles.find(v => String(v.id) === String(form.vehicle))
  const selectedProject = projects.find(p => String(p.id) === String(form.project_id))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Fleet Assignment</h2>
          <p className="text-xs text-gray-500 mt-0.5">Assign fleet to projects or locations</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Assign Fleet
        </button>
      </div>

      {/* Assignment form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Fleet Assignment</h3>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Assign to toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Assign to</label>
              <div className="flex gap-2">
                {[
                  { value: 'project',  label: 'Project',  Icon: FolderIcon },
                  { value: 'location', label: 'Location', Icon: MapPinIcon },
                ].map(({ value, label, Icon }) => (
                  <button key={value} type="button"
                    onClick={() => field('assign_to', value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border transition-colors
                      ${form.assign_to === value
                        ? 'bg-brand-red text-white border-brand-red'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vehicle */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle / Machine *</label>
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
                    {selectedVehicle.current_site ? ` · Currently: ${selectedVehicle.current_site}` : ''}
                  </p>
                )}
              </div>

              {/* Project or Location */}
              {form.assign_to === 'project' ? (
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
                      {[selectedProject.location, selectedProject.client].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location *</label>
                  <input list="location-list" className={inp} placeholder="e.g. Head Office"
                    value={form.location_name} onChange={e => field('location_name', e.target.value)} />
                  <datalist id="location-list">
                    {LOCATIONS.map(l => <option key={l} value={l} />)}
                  </datalist>
                </div>
              )}

              {/* Driver / Operator — only for project assignments */}
              {form.assign_to === 'project' && (
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
              )}

              {/* Daily Rate — project only */}
              {form.assign_to === 'project' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Daily Rate (KES)</label>
                  <input type="number" className={inp} placeholder="0"
                    value={form.daily_rate} onChange={e => field('daily_rate', e.target.value)} />
                </div>
              )}

              {/* Dates — project only */}
              {form.assign_to === 'project' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">From *</label>
                    <input required type="date" className={inp} value={form.assigned_from} onChange={e => field('assigned_from', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">To (optional)</label>
                    <input type="date" className={inp} value={form.assigned_to} onChange={e => field('assigned_to', e.target.value)} />
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input className={inp} value={form.notes} onChange={e => field('notes', e.target.value)} placeholder="Optional…" />
              </div>

              {/* Active — project only */}
              {form.assign_to === 'project' && (
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => field('is_active', e.target.checked)}
                      className="rounded border-gray-300 accent-brand-red" />
                    Currently active on this project
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1 border-t border-gray-100">
              <button type="submit" disabled={isPending}
                className="px-5 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
                {isPending ? 'Saving…' : 'Assign Fleet'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY) }}
                className="px-5 py-2 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Fleet', val: allVehicles.length, color: 'text-brand-slate', bg: 'bg-slate-50' },
          { label: 'Assigned to Projects', val: [...new Set(allAssignments.filter(a => a.is_active).map(a => a.vehicle_no || a.vehicle))].length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Active Assignments', val: allAssignments.filter(a => a.is_active).length, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-100 rounded-xl px-4 py-3`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Fleet overview — all vehicles with their assignment */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Fleet Register</h3>
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : allVehicles.length === 0 ? (
          <div className="p-14 text-center">
            <TruckIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No fleet registered yet.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['#', 'Reg / ID', 'Description', 'Make & Model', 'Location / Site', 'Project', 'Driver / Operator', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allVehicles
                .filter(v => {
                  if (!filterProject) return true
                  return allAssignments.some(a => String(a.project_id) === filterProject && (String(a.vehicle) === String(v.id) || a.vehicle_no === v.vehicle_no) && a.is_active)
                })
                .map(v => {
                  const activeAssign = allAssignments.find(a =>
                    a.is_active && (String(a.vehicle) === String(v.id) || a.vehicle_no === v.vehicle_no)
                  )
                  return (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">{v.asset_no || '—'}</td>
                      <td className="px-4 py-3 font-bold text-brand-slate">{v.vehicle_no}</td>
                      <td className="px-4 py-3 text-gray-700">{v.vehicle_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{[v.make, v.model_name].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-4 py-3">
                        {v.current_site
                          ? <span className="flex items-center gap-1 text-gray-600"><MapPinIcon className="h-3 w-3 text-gray-400 shrink-0" />{v.current_site}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {activeAssign
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">{activeAssign.project_name}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{activeAssign?.notes?.split(' — ')[0] || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          v.erp_status === 'OPER'     ? 'bg-green-100 text-green-700' :
                          v.erp_status === 'NON-OPER' ? 'bg-red-100 text-red-700' :
                          v.erp_status === 'IDLE'     ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'}`}>
                          {v.erp_status === 'OPER' ? 'Operational' : v.erp_status === 'NON-OPER' ? 'Non-Operational' : v.erp_status || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
