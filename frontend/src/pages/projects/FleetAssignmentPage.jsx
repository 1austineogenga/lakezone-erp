import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TruckIcon } from '@heroicons/react/24/outline'
import { getProjectVehicles } from '../../api/projects'

const STATUS_DOT = { MOVING: 'bg-green-500', IDLE: 'bg-yellow-400', STOP: 'bg-gray-400', INACTIVE: 'bg-red-400' }

export default function FleetAssignmentPage() {
  const { projectId } = useParams()

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['project-vehicles', projectId],
    queryFn: () => getProjectVehicles(projectId),
    select: r => r.data?.results ?? r.data ?? [],
  })

  if (isLoading) return <p className="text-center py-12 text-gray-400 text-sm">Loading…</p>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-brand-slate">Assigned Fleet</h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {assignments.length === 0 ? (
          <div className="p-10 text-center">
            <TruckIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No vehicles assigned yet.</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Vehicle', 'Make & Model', 'Category', 'GPS Status', 'Driver / Operator', 'Site', 'From', 'To', 'Active'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assignments.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-bold text-brand-slate whitespace-nowrap">
                    {a.vehicle_no || a.vehicle}
                    {a.vehicle_name && <p className="text-gray-400 font-normal text-[10px]">{a.vehicle_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {[a.make, a.model_name].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.asset_category || '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[a.last_status] || 'bg-gray-300'}`} />
                      {a.last_status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{a.driver_operator || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.current_site || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{a.assigned_from}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{a.assigned_to || '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
