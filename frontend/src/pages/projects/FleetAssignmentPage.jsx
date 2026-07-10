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
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      {assignments.length === 0 ? (
        <div className="p-10 text-center">
          <TruckIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No vehicles assigned yet.</p>
          <p className="text-xs text-gray-400 mt-1">Go to Fleet → Vehicles → Fleet Assignment to assign fleet to this project.</p>
        </div>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Vehicle', 'GPS Status', 'Driver / Operator', 'From', 'To', 'Daily Rate', 'Active', 'Notes'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {assignments.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs font-bold text-brand-slate">
                  {a.vehicle_no || a.vehicle}
                  {a.vehicle_name && <p className="text-gray-400 font-normal text-[10px]">{a.vehicle_name}</p>}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[a.last_status] || 'bg-gray-300'}`} />
                    {a.last_status || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{a.notes?.split(' — ')[0] || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{a.assigned_from}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{a.assigned_to || '—'}</td>
                <td className="px-4 py-3 text-xs font-medium">KES {Number(a.daily_rate || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {a.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{a.notes?.includes(' — ') ? a.notes.split(' — ').slice(1).join(' — ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
