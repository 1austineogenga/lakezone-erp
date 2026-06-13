import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getBiometricDevices, createBiometricDevice, updateBiometricDevice, syncBiometricDevice } from '../../api/hr'
import { PlusIcon, ArrowPathIcon, SignalIcon, SignalSlashIcon } from '@heroicons/react/24/outline'

const EMPTY = {
  device_id: '', name: '', location: '', device_type: 'fingerprint',
  ip_address: '', api_key: '', notes: '',
}

const TYPE_LABELS = {
  fingerprint: 'Fingerprint', face: 'Face Recognition',
  card: 'Card / RFID', hybrid: 'Hybrid',
}

export default function BiometricDevicesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const { data: devices, isLoading } = useQuery({
    queryKey: ['biometric-devices'],
    queryFn: getBiometricDevices,
    select: r => r.data?.results ?? r.data,
  })

  const createMut = useMutation({
    mutationFn: createBiometricDevice,
    onSuccess: () => { toast.success('Device registered.'); qc.invalidateQueries(['biometric-devices']); setShowForm(false); setForm(EMPTY) },
    onError: () => toast.error('Failed to register device.'),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => updateBiometricDevice(id, { is_active }),
    onSuccess: () => { toast.success('Updated.'); qc.invalidateQueries(['biometric-devices']) },
  })

  const syncMut = useMutation({
    mutationFn: syncBiometricDevice,
    onSuccess: () => { toast.success('Sync triggered.'); qc.invalidateQueries(['biometric-devices']) },
    onError: () => toast.error('Sync failed.'),
  })

  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  return (
    <div className="space-y-5">
      {/* Info banner about push API */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800 font-semibold mb-1">Biometric Device Integration</p>
        <p className="text-xs text-blue-700">
          Devices can push attendance records automatically via the REST API endpoint:
          <code className="ml-1 bg-blue-100 px-1.5 py-0.5 rounded font-mono text-xs">POST /api/v1/hr/biometric/push/</code>
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Use the <strong>API Key</strong> from each device below as the <code className="bg-blue-100 px-1 rounded font-mono">X-Device-Key</code> header. The device sends: <code className="bg-blue-100 px-1 rounded font-mono">device_id, employee_number, timestamp, event_type (in/out)</code>.
        </p>
      </div>

      <button onClick={() => setShowForm(s => !s)}
        className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
        <PlusIcon className="h-4 w-4" /> Register Device
      </button>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate(form) }}
          className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Biometric Device</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Device Serial / ID *</label>
              <input required {...f('device_id')} placeholder="e.g. ZK-001" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input required {...f('name')} placeholder="e.g. Main Gate" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Location *</label>
              <input required {...f('location')} placeholder="e.g. Head Office Entrance" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Device Type</label>
              <select {...f('device_type')} className={cls}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">IP Address</label>
              <input {...f('ip_address')} placeholder="192.168.1.x" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API Key (for push auth)</label>
              <input {...f('api_key')} placeholder="Leave blank to auto-generate" className={cls} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <input {...f('notes')} className={cls} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg disabled:opacity-60">
              Register
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-gray-300 text-xs font-medium rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading
          ? <p className="text-sm text-gray-400 col-span-2 text-center py-8">Loading…</p>
          : !devices || devices.length === 0
            ? <p className="text-sm text-gray-400 col-span-2 text-center py-8">No biometric devices registered.</p>
            : devices.map(dev => (
                <div key={dev.id} className={`bg-white border rounded-xl p-5 ${dev.is_active ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {dev.is_active
                          ? <SignalIcon className="h-4 w-4 text-green-500" />
                          : <SignalSlashIcon className="h-4 w-4 text-gray-400" />}
                        <p className="font-semibold text-brand-slate">{dev.name}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{dev.location}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dev.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {dev.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Serial / ID</span>
                      <span className="font-mono font-medium">{dev.device_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Type</span>
                      <span>{TYPE_LABELS[dev.device_type] || dev.device_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">IP Address</span>
                      <span className="font-mono">{dev.ip_address || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Sync</span>
                      <span>{dev.last_sync ? new Date(dev.last_sync).toLocaleString() : 'Never'}</span>
                    </div>
                    {dev.api_key && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">API Key</span>
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{dev.api_key}</code>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => syncMut.mutate(dev.id)} disabled={syncMut.isPending}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                      <ArrowPathIcon className="h-3.5 w-3.5" /> Sync
                    </button>
                    <button onClick={() => toggleMut.mutate({ id: dev.id, is_active: !dev.is_active })}
                      className={`text-xs font-medium ${dev.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}>
                      {dev.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))
        }
      </div>

      {/* Push API reference */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-brand-slate mb-3">Push API Payload Reference</p>
        <pre className="text-xs bg-white border border-gray-200 rounded-lg p-4 overflow-x-auto text-gray-700">{`POST /api/v1/hr/biometric/push/
Headers:
  X-Device-Key: <api_key>
  Content-Type: application/json

Body:
{
  "device_id": "ZK-001",
  "employee_number": "EMP-0042",
  "timestamp": "2026-06-12T08:07:33Z",
  "event_type": "in"   // or "out"
}

Response 200:
{
  "status": "recorded",
  "attendance_id": "...",
  "employee": "John Doe",
  "date": "2026-06-12",
  "time_in": "08:07:33"
}`}</pre>
      </div>
    </div>
  )
}
