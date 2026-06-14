import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { TruckIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getProjectVehicles, assignVehicle } from '../../api/projects'
import { getVehicles } from '../../api/fleet'

const STATUS_DOT = { MOVING: 'bg-green-500', IDLE: 'bg-yellow-400', STOP: 'bg-gray-400', INACTIVE: 'bg-red-400' }

const EMPTY = { vehicle: '', assigned_from: '', assigned_to: '', daily_rate: '', notes: '', is_active: true }

export default function FleetAssignmentPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const { data: assignments = [] } = useQuery({
    queryKey: ['project-vehicles', projectId],
    queryFn: () => getProjectVehicles(projectId),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: fleetVehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: getVehicles,
    select: r => r.data?.results ?? r.data ?? [],
  })

  const assignMut = useMutation({
    mutationFn: data => assignVehicle(projectId, data),
    onSuccess: () => {
      toast.success('Vehicle assigned to project.')
      qc.invalidateQueries({ queryKey: ['project-vehicles', projectId] })
      setModal(false)
      setForm(EMPTY)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to assign vehicle.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const activeCount = assignments.filter(a => a.is_active).length
  const totalDailyRate = assignments.filter(a => a.is_active).reduce((s, a) => s + Number(a.daily_rate || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Fleet Assignment</h2>
          <p className="text-xs text-gray-400 mt-0.5">Vehicles assigned to this project</p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Assign Vehicle
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Assigned', val: assignments.length, color: 'text-brand-slate', bg: 'bg-slate-50', border: 'border-l-4 border-l-slate-400' },
          { label: 'Active on Project', val: activeCount, color: 'text-green-600', bg: 'bg-green-50', border: 'border-l-4 border-l-green-500' },
          { label: 'Daily Fleet Cost', val: `KES ${totalDailyRate.toLocaleString()}`, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-l-4 border-l-blue-500' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border border-gray-200 rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Assigned Vehicles ({assignments.length})</h3>
        </div>
        {assignments.length === 0 ? (
          <div className="p-10 text-center">
            <TruckIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No vehicles assigned yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Vehicle', 'Status', 'From', 'To', 'Daily Rate', 'Active', 'Notes'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-brand-slate">{a.vehicle_no || a.vehicle}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[a.last_status] || 'bg-gray-300'}`} />
                        {a.last_status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{a.assigned_from}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{a.assigned_to || '—'}</td>
                    <td className="px-4 py-3 text-xs font-medium">KES {Number(a.daily_rate || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-brand-slate">Assign Vehicle</h3>
              <button onClick={() => setModal(false)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                <select value={form.vehicle} onChange={e => field('vehicle', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                  <option value="">Select vehicle...</option>
                  {fleetVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicle_no} — {v.last_status || 'Unknown'}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                  <input type="date" value={form.assigned_from} onChange={e => field('assigned_from', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To (optional)</label>
                  <input type="date" value={form.assigned_to} onChange={e => field('assigned_to', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Daily Rate (KES)</label>
                <input type="number" value={form.daily_rate} onChange={e => field('daily_rate', e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input value={form.notes} onChange={e => field('notes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => field('is_active', e.target.checked)}
                  className="rounded border-gray-300 accent-brand-red" />
                Currently active on this project
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => assignMut.mutate(form)} disabled={!form.vehicle || !form.assigned_from || assignMut.isPending}
                className="flex-1 px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                {assignMut.isPending ? 'Assigning…' : 'Assign Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
