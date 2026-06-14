import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { getAlerts, acknowledgeAlert, getVehicles } from '../../api/fleet'

const SEV_STYLE = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-blue-100 text-blue-700 border-blue-200',
}
const SEV_ICON_COLOR = { critical: 'text-red-500', high: 'text-orange-500', medium: 'text-yellow-500', low: 'text-blue-500' }

export default function AlertsPage() {
  const qc = useQueryClient()
  const [vehicleId, setVehicleId] = useState('')
  const [showAck, setShowAck]     = useState(false)

  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: getVehicles,
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['fleet-alerts-all', vehicleId, showAck],
    queryFn: () => getAlerts({
      ...(vehicleId && { vehicle: vehicleId }),
      ...(!showAck && { acknowledged: false }),
    }),
    select: r => r.data?.results ?? r.data ?? [],
    refetchInterval: 60_000,
  })

  const ackMut = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      toast.success('Alert acknowledged.')
      qc.invalidateQueries({ queryKey: ['fleet-alerts-all'] })
      qc.invalidateQueries({ queryKey: ['fleet-dashboard'] })
    },
  })

  const ackAllMut = useMutation({
    mutationFn: async () => {
      await Promise.all(alerts.filter(a => !a.acknowledged).map(a => acknowledgeAlert(a.id)))
    },
    onSuccess: () => {
      toast.success('All alerts acknowledged.')
      qc.invalidateQueries({ queryKey: ['fleet-alerts-all'] })
      qc.invalidateQueries({ queryKey: ['fleet-dashboard'] })
    },
  })

  const unackedCount = alerts.filter(a => !a.acknowledged).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Fleet Alerts</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {unackedCount > 0 ? `${unackedCount} unacknowledged` : 'All clear'}
          </p>
        </div>
        {unackedCount > 1 && (
          <button onClick={() => ackAllMut.mutate()} disabled={ackAllMut.isPending}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {ackAllMut.isPending ? 'Working…' : 'Acknowledge All'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mt-4">
          <input type="checkbox" checked={showAck} onChange={e => setShowAck(e.target.checked)}
            className="rounded border-gray-300 accent-brand-red" />
          Show acknowledged
        </label>
      </div>

      {/* Alerts List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircleIcon className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No alerts to show.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {alerts.map(a => (
              <div key={a.id} className={`px-5 py-4 flex items-start gap-4 ${a.acknowledged ? 'opacity-50 bg-gray-50' : ''}`}>
                <ExclamationTriangleIcon className={`h-5 w-5 mt-0.5 shrink-0 ${SEV_ICON_COLOR[a.severity] || 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-brand-slate">{a.vehicle_no || a.vehicle}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${SEV_STYLE[a.severity] || SEV_STYLE.low}`}>
                      {a.severity?.toUpperCase()}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                      {a.alert_type?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{a.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(a.occurred_at).toLocaleString()}</p>
                  {a.acknowledged && a.acknowledged_at && (
                    <p className="text-[10px] text-green-600 mt-0.5">
                      Acknowledged {new Date(a.acknowledged_at).toLocaleString()}
                      {a.acknowledged_by_username ? ` by ${a.acknowledged_by_username}` : ''}
                    </p>
                  )}
                </div>
                {!a.acknowledged && (
                  <button onClick={() => ackMut.mutate(a.id)} disabled={ackMut.isPending}
                    className="shrink-0 text-xs text-blue-600 hover:underline disabled:opacity-60">
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
