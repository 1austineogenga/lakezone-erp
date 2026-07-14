import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { TruckIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getVehicles } from '../../api/fleet'
import { assignVehicle } from '../../api/projects'

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'

const LOCATIONS = ['Head Office', 'Magumu', 'Njambini']

const EMPTY_FORM = {
  project_id: '',
  location_name: '',
  assigned_from: new Date().toISOString().slice(0, 10),
  assigned_to: '',
  notes: '',
  is_active: true,
}

function useProjects() {
  return useQuery({
    queryKey: ['projects-for-fleet-assign'],
    queryFn: async () => {
      try {
        let results = [], page = 1
        while (true) {
          const r = await api.get('/projects/', { params: { page, page_size: 100 } })
          const data = r.data
          const items = data.results ?? (Array.isArray(data) ? data : [])
          results = [...results, ...items]
          if (!data.next || items.length === 0) break
          page++
        }
        console.log('Loaded projects:', results)
        return results
      } catch (err) {
        console.error('Failed to load projects:', err)
        throw err
      }
    },
    staleTime: 60_000,
  })
}

function AssignModal({ vehicle, projects, onClose, onSuccess }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)
  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const assignProjectMut = useMutation({
    mutationFn: ({ project_id, payload }) => assignVehicle(project_id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-fleet-assignments'] })
      qc.invalidateQueries({ queryKey: ['project-vehicles'] })
    },
  })

  const assignLocationMut = useMutation({
    mutationFn: ({ vehicle_id, current_site }) =>
      api.patch(`/fleet/vehicles/${vehicle_id}/`, { current_site }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fleet-vehicles'] })
      qc.invalidateQueries({ queryKey: ['fleet-vehicles-full'] })
    },
  })

  const isPending = assignProjectMut.isPending || assignLocationMut.isPending

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.assigned_from) { toast.error('Please set the start date.'); return }
    if (!form.project_id && !form.location_name) { toast.error('Please select a project or location.'); return }

    try {
      const ops = []; console.log('Form data:', form)
      if (form.project_id) {
        ops.push(assignProjectMut.mutateAsync({
          project_id: form.project_id,
          payload: {
            vehicle: vehicle.id,
            assigned_from: form.assigned_from,
            is_active: form.is_active,
            ...(form.assigned_to && { assigned_to: form.assigned_to }),
            ...(form.notes      && { notes: form.notes }),
          },
        }))
      }
      if (form.location_name) {
        ops.push(assignLocationMut.mutateAsync({ vehicle_id: vehicle.id, current_site: form.location_name }))
      }
      await Promise.all(ops)
      toast.success('Fleet assigned successfully.')
      onSuccess()
      onClose()
      console.error('Assignment error:', err)
      const data = err?.response?.data
      const msg = data?.detail || data?.vehicle?.[0] || data?.non_field_errors?.[0] || (typeof data === 'string' ? data : null) || 'Failed to assign fleet.'
      toast.error(msg)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-white font-bold text-base">Assign Fleet</h3>
            <p className="text-white/60 text-xs mt-0.5">{vehicle.vehicle_no}{vehicle.vehicle_name ? ` — ${vehicle.vehicle_name}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Project */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
            <select className={inp} value={form.project_id} onChange={e => field('project_id', e.target.value)}>
              <option value="">— None —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
            <select className={inp} value={form.location_name} onChange={e => field('location_name', e.target.value)}>
              <option value="">— None —</option>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From *</label>
              <input required type="date" className={inp} value={form.assigned_from} onChange={e => field('assigned_from', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To (optional)</label>
              <input type="date" className={inp} value={form.assigned_to} onChange={e => field('assigned_to', e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input className={inp} value={form.notes} onChange={e => field('notes', e.target.value)} placeholder="Optional…" />
          </div>

          {/* Active */}
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => field('is_active', e.target.checked)}
              className="rounded border-gray-300 accent-brand-red" />
            Currently active
          </label>

          <div className="flex gap-2 pt-1 border-t border-gray-100">
            <button type="submit" disabled={isPending}
              className="px-5 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
              {isPending ? 'Saving…' : 'Assign Fleet'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function FleetAssignmentPage() {
  const qc = useQueryClient()
  const [assigningVehicle, setAssigningVehicle] = useState(null)
  const [filterProject, setFilterProject] = useState('')

  const { data: allVehicles = [], isLoading: vehiclesLoading } = useQuery({
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

  const { data: projects = [] } = useProjects()

  const { data: allAssignments = [] } = useQuery({
    queryKey: ['all-fleet-assignments', projects.map(p => p.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        projects.map(p =>
          api.get(`/projects/${p.id}/vehicles/`)
            .then(r => (r.data?.results ?? r.data ?? []).map(a => ({
              ...a, project_name: p.name, project_id: p.id,
            })))
            .catch(() => [])
        )
      )
      return results.flat()
    },
    enabled: projects.length > 0,
    staleTime: 30_000,
  })

  const displayVehicles = filterProject
    ? allVehicles.filter(v =>
        allAssignments.some(a =>
          String(a.project_id) === filterProject &&
          (String(a.vehicle) === String(v.id) || a.vehicle_no === v.vehicle_no) &&
          a.is_active
        )
      )
    : allVehicles

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Fleet Assignment</h2>
          <p className="text-xs text-gray-500 mt-0.5">Assign fleet to projects or locations</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Fleet',            val: allVehicles.length,    color: 'text-brand-slate', bg: 'bg-slate-50' },
          { label: 'Assigned to Projects',   val: [...new Set(allAssignments.filter(a => a.is_active).map(a => a.vehicle_no || a.vehicle))].length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Active Assignments',     val: allAssignments.filter(a => a.is_active).length, color: 'text-blue-600',  bg: 'bg-blue-50'  },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-100 rounded-xl px-4 py-3`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Fleet table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Fleet Register</h3>
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {vehiclesLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : displayVehicles.length === 0 ? (
          <div className="p-14 text-center">
            <TruckIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No fleet registered yet.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Reg / ID', 'Description', 'Make & Model', 'Location / Site', 'Project', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayVehicles.map(v => {
                const activeAssign = allAssignments.find(a =>
                  a.is_active && (String(a.vehicle) === String(v.id) || a.vehicle_no === v.vehicle_no)
                )
                const isActive = !!activeAssign
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
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
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">{activeAssign.project_name}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setAssigningVehicle(v)}
                        className="px-3 py-1.5 bg-brand-red text-white text-[10px] font-semibold rounded-lg hover:opacity-90 whitespace-nowrap">
                        Assign
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {assigningVehicle && (
        <AssignModal
          vehicle={assigningVehicle}
          projects={projects}
          onClose={() => setAssigningVehicle(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['all-fleet-assignments'] })
            qc.invalidateQueries({ queryKey: ['fleet-vehicles-full'] })
          }}
        />
      )}
    </div>
  )
}
