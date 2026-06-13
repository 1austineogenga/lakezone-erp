import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { WrenchScrewdriverIcon, PlusIcon } from '@heroicons/react/24/outline'
import { getMaintenance, createMaintenance, getVehicles } from '../../api/fleet'

const MAINT_TYPES = ['service', 'repair', 'inspection', 'tyre', 'oil', 'other']

const EMPTY = {
  vehicle: '', maintenance_type: 'service', description: '',
  date: '', cost: '', performed_by: '', notes: '',
  odometer_at_service: '', next_service_odometer: '',
}

export default function MaintenancePage() {
  const qc = useQueryClient()
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState(EMPTY)
  const [vehicleFilter, setVehicleFilter] = useState('')

  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: getVehicles,
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['fleet-maintenance', vehicleFilter],
    queryFn: () => getMaintenance(vehicleFilter ? { vehicle: vehicleFilter } : {}),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const createMut = useMutation({
    mutationFn: createMaintenance,
    onSuccess: () => {
      toast.success('Maintenance record saved.')
      qc.invalidateQueries({ queryKey: ['fleet-maintenance'] })
      setShowForm(false)
      setForm(EMPTY)
    },
    onError: () => toast.error('Failed to save record.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = () => {
    const payload = { ...form }
    if (!payload.cost) delete payload.cost
    if (!payload.odometer_at_service) delete payload.odometer_at_service
    if (!payload.next_service_odometer) delete payload.next_service_odometer
    createMut.mutate(payload)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Maintenance Records</h2>
          <p className="text-xs text-gray-400 mt-0.5">Service history and upcoming schedules</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Add Record
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Vehicle</label>
        <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
          <option value="">All Vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Maintenance Record</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle *</label>
              <select value={form.vehicle} onChange={e => field('vehicle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                <option value="">Select…</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select value={form.maintenance_type} onChange={e => field('maintenance_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                {MAINT_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => field('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cost (KES)</label>
              <input type="number" value={form.cost} onChange={e => field('cost', e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Odometer at Service (km)</label>
              <input type="number" value={form.odometer_at_service} onChange={e => field('odometer_at_service', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Next Service (km)</label>
              <input type="number" value={form.next_service_odometer} onChange={e => field('next_service_odometer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Performed By</label>
              <input value={form.performed_by} onChange={e => field('performed_by', e.target.value)}
                placeholder="Mechanic / garage"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input value={form.description} onChange={e => field('description', e.target.value)}
                placeholder="Brief description"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => field('notes', e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate}
              disabled={createMut.isPending || !form.vehicle || !form.maintenance_type || !form.date}
              className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
              {createMut.isPending ? 'Saving…' : 'Save Record'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }}
              className="px-4 py-2 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <WrenchScrewdriverIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No maintenance records yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Vehicle', 'Type', 'Date', 'Odometer', 'Next Service', 'Cost', 'Performed By', 'Description'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-brand-slate">{r.vehicle_no || r.vehicle}</td>
                    <td className="px-4 py-3 text-xs capitalize text-gray-600">{r.maintenance_type}</td>
                    <td className="px-4 py-3 text-xs">{r.date || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.odometer_at_service ? `${Number(r.odometer_at_service).toLocaleString()} km` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-blue-600">{r.next_service_odometer ? `${Number(r.next_service_odometer).toLocaleString()} km` : '—'}</td>
                    <td className="px-4 py-3 text-xs">{r.cost ? `KES ${Number(r.cost).toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.performed_by || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate">{r.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
