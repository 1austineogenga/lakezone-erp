import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  WrenchScrewdriverIcon, PlusIcon, XMarkIcon,
  CalendarDaysIcon, CurrencyDollarIcon, UserIcon,
} from '@heroicons/react/24/outline'
import { getMaintenance, createMaintenance, getVehicles } from '../../api/fleet'

const MAINT_TYPES = ['service', 'repair', 'inspection', 'tyre', 'oil', 'other']

const TYPE_COLOR = {
  service:    'bg-blue-100 text-blue-700',
  repair:     'bg-red-100 text-red-700',
  inspection: 'bg-purple-100 text-purple-700',
  tyre:       'bg-amber-100 text-amber-700',
  oil:        'bg-green-100 text-green-700',
  other:      'bg-gray-100 text-gray-600',
}

const EMPTY = {
  vehicle: '', maintenance_type: 'service', description: '',
  date: '', cost: '', performed_by: '', notes: '',
  odometer_at_service: '', next_service_odometer: '',
}

export default function MaintenancePage() {
  const qc = useQueryClient()
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState(EMPTY)
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [typeFilter, setTypeFilter]     = useState('')

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

  const filtered = typeFilter ? records.filter(r => r.maintenance_type === typeFilter) : records

  const totalCost = filtered.reduce((sum, r) => sum + (Number(r.cost) || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Maintenance</h2>
          <p className="text-xs text-gray-600 mt-0.5">Service history &amp; schedules</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Log Service
        </button>
      </div>

      {/* Summary cards */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-2xl p-4">
            <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
            <p className="text-xs text-gray-600 mt-0.5">Records</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4">
            <p className="text-2xl font-bold text-emerald-600">KES {totalCost.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-0.5">Total Cost</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4">
            <p className="text-2xl font-bold text-amber-600">
              {filtered.filter(r => r.next_service_odometer).length}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">With Next Service</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-brand-red bg-white">
          <option value="">All Vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
        </select>

        <div className="flex items-center gap-1.5 flex-wrap">
          {['', ...MAINT_TYPES].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize
                ${typeFilter === t
                  ? 'bg-brand-red text-white border-brand-red'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
              {t || 'All Types'}
            </button>
          ))}
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-brand-slate text-sm">Log Maintenance</h3>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }}>
              <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle *</label>
              <select value={form.vehicle} onChange={e => field('vehicle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                <option value="">Select…</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select value={form.maintenance_type} onChange={e => field('maintenance_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                {MAINT_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => field('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cost (KES)</label>
              <input type="number" value={form.cost} onChange={e => field('cost', e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Odometer at Service (km)</label>
              <input type="number" value={form.odometer_at_service} onChange={e => field('odometer_at_service', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Next Service (km)</label>
              <input type="number" value={form.next_service_odometer} onChange={e => field('next_service_odometer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Performed By</label>
              <input value={form.performed_by} onChange={e => field('performed_by', e.target.value)}
                placeholder="Mechanic / garage"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input value={form.description} onChange={e => field('description', e.target.value)}
                placeholder="Brief description"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => field('notes', e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate}
              disabled={createMut.isPending || !form.vehicle || !form.date}
              className="px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
              {createMut.isPending ? 'Saving…' : 'Save Record'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }}
              className="px-4 py-2 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {isLoading ? (
        <p className="text-sm text-gray-600 p-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-14 text-center">
          <WrenchScrewdriverIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No records found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex items-start gap-4">
              {/* Type badge */}
              <div className={`shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-semibold capitalize ${TYPE_COLOR[r.maintenance_type] || TYPE_COLOR.other}`}>
                {r.maintenance_type}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-brand-slate">{r.vehicle_no || r.vehicle}</p>
                  {r.description && <p className="text-xs text-gray-600 truncate">{r.description}</p>}
                </div>
                {r.notes && <p className="text-xs text-gray-600 mt-1">{r.notes}</p>}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 flex-wrap">
                  {r.date && (
                    <span className="flex items-center gap-1">
                      <CalendarDaysIcon className="h-3.5 w-3.5" /> {r.date}
                    </span>
                  )}
                  {r.performed_by && (
                    <span className="flex items-center gap-1">
                      <UserIcon className="h-3.5 w-3.5" /> {r.performed_by}
                    </span>
                  )}
                  {r.odometer_at_service && (
                    <span>{Number(r.odometer_at_service).toLocaleString()} km</span>
                  )}
                  {r.next_service_odometer && (
                    <span className="text-blue-500">Next: {Number(r.next_service_odometer).toLocaleString()} km</span>
                  )}
                </div>
              </div>

              {r.cost && (
                <div className="shrink-0 text-right">
                  <div className="flex items-center gap-1 text-emerald-600">
                    <CurrencyDollarIcon className="h-3.5 w-3.5" />
                    <p className="text-sm font-bold">KES {Number(r.cost).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
