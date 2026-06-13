import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { TruckIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { getVehicles, createVehicle, getFleetConfig } from '../../api/fleet'
import api from '../../api/client'

const STATUS_DOT   = { MOVING: 'bg-green-500', IDLE: 'bg-yellow-400', STOP: 'bg-gray-400', INACTIVE: 'bg-red-400', '': 'bg-gray-300' }
const STATUS_LABEL = { MOVING: 'Moving', IDLE: 'Idling', STOP: 'Stopped', INACTIVE: 'Offline' }

const EMPTY = {
  vehicle_no: '', vehicle_name: '', imei: '', vehicle_type: '', make: '', model_name: '',
  year: '', fuel_type: 'diesel', fuel_capacity: 60, api_config: '', project: '',
}

export default function VehiclesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: getVehicles,
    select: r => r.data?.results ?? r.data ?? [],
    refetchInterval: 120_000,
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-active'],
    queryFn: () => api.get('/projects/'),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: configs = [] } = useQuery({
    queryKey: ['fleet-config'],
    queryFn: getFleetConfig,
    select: r => r.data?.results ?? (Array.isArray(r.data) ? r.data : [r.data].filter(Boolean)),
  })

  const createMut = useMutation({
    mutationFn: createVehicle,
    onSuccess: () => {
      toast.success('Vehicle added.')
      qc.invalidateQueries({ queryKey: ['fleet-vehicles'] })
      setShowForm(false)
      setForm(EMPTY)
    },
    onError: e => toast.error(e.response?.data?.vehicle_no?.[0] || 'Failed to add vehicle.'),
  })

  const filtered = vehicles.filter(v =>
    v.vehicle_no?.toLowerCase().includes(search.toLowerCase()) ||
    v.vehicle_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.make?.toLowerCase().includes(search.toLowerCase())
  )

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = () => {
    const payload = { ...form }
    if (!payload.year) delete payload.year
    if (!payload.project) delete payload.project
    if (!payload.api_config) delete payload.api_config
    createMut.mutate(payload)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Vehicles & Machines</h2>
          <p className="text-xs text-gray-400 mt-0.5">{vehicles.length} registered</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Add Vehicle
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by vehicle no, name or make…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Vehicle / Machine</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Vehicle No. *',    key: 'vehicle_no',    placeholder: 'e.g. KBZ 123A' },
              { label: 'Vehicle Name',     key: 'vehicle_name',  placeholder: 'e.g. Site Truck' },
              { label: 'IMEI',             key: 'imei',          placeholder: 'Tracking device IMEI' },
              { label: 'Make',             key: 'make',          placeholder: 'e.g. Toyota' },
              { label: 'Model',            key: 'model_name',    placeholder: 'e.g. Hilux' },
              { label: 'Year',             key: 'year',          placeholder: '2020', type: 'number' },
              { label: 'Tank (litres)',    key: 'fuel_capacity', placeholder: '60', type: 'number' },
              { label: 'Vehicle Type',     key: 'vehicle_type',  placeholder: 'e.g. Truck, Excavator' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type || 'text'} value={form[key]} onChange={e => field(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fuel Type</label>
              <select value={form.fuel_type} onChange={e => field('fuel_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                {['diesel','petrol','electric','hybrid'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Project (optional)</label>
              <select value={form.project} onChange={e => field('project', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                <option value="">— Unassigned —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API Config</label>
              <select value={form.api_config} onChange={e => field('api_config', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                <option value="">— None —</option>
                {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={createMut.isPending || !form.vehicle_no}
              className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
              {createMut.isPending ? 'Saving…' : 'Save Vehicle'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }}
              className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Vehicles Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <TruckIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{search ? 'No matches.' : 'No vehicles yet. Add one above.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Status', 'Vehicle No.', 'Name / Make', 'Type', 'Project', 'Speed', 'Fuel', 'Last Seen'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(v => (
                  <tr key={v.id} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                    className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[v.last_status] || STATUS_DOT['']}`} />
                    </td>
                    <td className="px-4 py-3 font-semibold text-brand-slate text-xs">{v.vehicle_no}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {v.vehicle_name || '—'}
                      {v.make ? <span className="text-gray-400"> · {v.make}</span> : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{v.vehicle_type || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{v.project_name || '—'}</td>
                    <td className="px-4 py-3 text-xs">{v.last_speed != null ? `${Number(v.last_speed).toFixed(1)} km/h` : '—'}</td>
                    <td className="px-4 py-3 text-xs">{v.last_fuel != null ? `${Number(v.last_fuel).toFixed(1)}%` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {v.last_seen_minutes_ago != null
                        ? v.last_seen_minutes_ago < 2 ? 'Just now'
                          : v.last_seen_minutes_ago < 60 ? `${Math.round(v.last_seen_minutes_ago)}m ago`
                          : `${Math.round(v.last_seen_minutes_ago / 60)}h ago`
                        : '—'}
                    </td>
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
