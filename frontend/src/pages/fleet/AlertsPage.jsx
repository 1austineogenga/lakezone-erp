import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  ExclamationTriangleIcon, CheckCircleIcon, CheckIcon,
  FunnelIcon, BellSlashIcon,
} from '@heroicons/react/24/outline'
import { getAlerts, acknowledgeAlert, getVehicles } from '../../api/fleet'

const ALLOWED_TYPES = ['fuel_fill', 'fuel_drain', 'geofence']

const TYPE_LABEL = {
  fuel_fill:  'Fuel Refill',
  fuel_drain: 'Fuel Drain / Theft',
  geofence:   'Geofence Alert',
}

const TYPE_GROUP = {
  fuel_fill: 'Fuel', fuel_drain: 'Fuel', geofence: 'Geofence',
}

const SEV_BORDER = {
  critical: 'border-l-red-500',
  high:     'border-l-orange-400',
  medium:   'border-l-amber-400',
  low:      'border-l-blue-400',
}
const SEV_BADGE = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-blue-100 text-blue-700',
}
const SEV_ICON = {
  critical: 'text-red-500',
  high:     'text-orange-500',
  medium:   'text-amber-500',
  low:      'text-blue-400',
}

export default function AlertsPage() {
  const qc = useQueryClient()
  const [vehicleId, setVehicleId]   = useState('')
  const [showAck, setShowAck]       = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [sevFilter, setSevFilter]   = useState('')

  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles-alerts'],
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
  })

  const activeTypes = typeFilter ? [typeFilter] : ALLOWED_TYPES

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['fleet-alerts-all', vehicleId, showAck, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (vehicleId) params.append('vehicle', vehicleId)
      if (!showAck) params.append('acknowledged', 'false')
      activeTypes.forEach(t => params.append('alert_type', t))
      return getAlerts(params)
    },
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

  const displayed    = sevFilter ? alerts.filter(a => a.severity === sevFilter) : alerts
  const unackedCount = alerts.filter(a => !a.acknowledged).length
  const sevCounts    = alerts.reduce((acc, a) => { acc[a.severity] = (acc[a.severity] || 0) + 1; return acc }, {})

  const groups = Object.entries(
    ALLOWED_TYPES.reduce((g, t) => {
      const grp = TYPE_GROUP[t] || 'Other'
      if (!g[grp]) g[grp] = []
      g[grp].push(t)
      return g
    }, {})
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Fleet Alerts</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            {unackedCount > 0
              ? <span className="text-red-500 font-medium">{unackedCount} unacknowledged</span>
              : 'All clear'}
          </p>
        </div>
        {unackedCount > 1 && (
          <button onClick={() => ackAllMut.mutate()} disabled={ackAllMut.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-60">
            <CheckIcon className="h-3.5 w-3.5" />
            {ackAllMut.isPending ? 'Working…' : 'Acknowledge All'}
          </button>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setSevFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${!sevFilter ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
            All ({alerts.length})
          </button>
          {['critical','high','medium','low'].map(s => sevCounts[s] ? (
            <button key={s} onClick={() => setSevFilter(sv => sv === s ? '' : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize
                ${sevFilter === s ? 'bg-brand-red text-white border-brand-red' : `${SEV_BADGE[s]} border-transparent hover:opacity-80`}`}>
              {s} ({sevCounts[s]})
            </button>
          ) : null)}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <FunnelIcon className="h-4 w-4 text-gray-400 self-center" />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="">All Types</option>
            {groups.map(([group, types]) => (
              <optgroup key={group} label={group}>
                {types.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer self-end pb-2">
          <input type="checkbox" checked={showAck} onChange={e => setShowAck(e.target.checked)}
            className="rounded border-gray-300 accent-brand-red" />
          Show acknowledged
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-16 text-center">
          <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No alerts to show</p>
          <p className="text-xs text-gray-600 mt-1">
            {showAck ? 'Nothing matches your filters.' : 'All alerts are acknowledged.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(a => (
            <div key={a.id}
              className={`bg-white border border-gray-100 border-l-4 rounded-2xl shadow-sm px-5 py-4 flex items-start gap-4 transition-opacity
                ${a.acknowledged ? 'opacity-50' : ''}
                ${SEV_BORDER[a.severity] || 'border-l-gray-300'}`}>
              <ExclamationTriangleIcon className={`h-5 w-5 mt-0.5 shrink-0 ${SEV_ICON[a.severity] || 'text-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-bold text-brand-slate">{a.vehicle_no || a.vehicle}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${SEV_BADGE[a.severity] || 'bg-gray-100 text-gray-600'}`}>
                    {a.severity?.toUpperCase()}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                    {TYPE_LABEL[a.alert_type] || a.alert_type?.replace(/_/g, ' ')}
                  </span>
                  {TYPE_GROUP[a.alert_type] && (
                    <span className="text-[10px] text-gray-600">{TYPE_GROUP[a.alert_type]}</span>
                  )}
                </div>
                <p className="text-xs text-gray-600">{a.message}</p>
                <p className="text-[10px] text-gray-600 mt-1.5">{new Date(a.occurred_at).toLocaleString()}</p>
                {a.acknowledged && a.acknowledged_at && (
                  <p className="text-[10px] text-green-600 mt-0.5 flex items-center gap-1">
                    <CheckCircleIcon className="h-3 w-3" />
                    Acknowledged {new Date(a.acknowledged_at).toLocaleString()}
                    {a.acknowledged_by_username ? ` · ${a.acknowledged_by_username}` : ''}
                  </p>
                )}
              </div>
              {!a.acknowledged && (
                <button onClick={() => ackMut.mutate(a.id)} disabled={ackMut.isPending}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-500 text-xs font-medium rounded-lg transition-colors disabled:opacity-60">
                  <BellSlashIcon className="h-3.5 w-3.5" /> Dismiss
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
