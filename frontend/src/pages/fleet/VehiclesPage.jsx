import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  TruckIcon, PlusIcon, MagnifyingGlassIcon, ArrowUpTrayIcon,
  MapPinIcon, BeakerIcon, ClockIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { getVehicles, createVehicle, getFleetConfig } from '../../api/fleet'
import api from '../../api/client'
import FleetRegisterImportModal from './FleetRegisterImportModal'

const STATUS_DOT   = { MOVING: 'bg-green-500', IDLE: 'bg-amber-400', STOP: 'bg-gray-300', INACTIVE: 'bg-red-400', '': 'bg-gray-200' }
const STATUS_LABEL = { MOVING: 'Moving', IDLE: 'Idling', STOP: 'Stopped', INACTIVE: 'Offline' }
const STATUS_PILL  = {
  MOVING:   'bg-green-100 text-green-700',
  IDLE:     'bg-amber-100 text-amber-700',
  STOP:     'bg-gray-100 text-gray-500',
  INACTIVE: 'bg-red-100 text-red-600',
  '':       'bg-gray-100 text-gray-400',
}

const EMPTY = {
  vehicle_no: '', vehicle_name: '', imei: '', vehicle_type: '', make: '', model_name: '',
  year: '', fuel_type: 'diesel', fuel_capacity: 60, api_config: '', project: '',
}

function FuelBar({ pct }) {
  const n = Number(pct)
  const color = n < 10 ? 'bg-red-500' : n < 25 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(n, 100)}%` }} />
    </div>
  )
}

export default function VehiclesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch]       = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
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

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = () => {
    const payload = { ...form }
    if (!payload.year) delete payload.year
    if (!payload.project) delete payload.project
    if (!payload.api_config) delete payload.api_config
    createMut.mutate(payload)
  }

  const filtered = vehicles.filter(v => {
    const matchSearch = !search ||
      v.vehicle_no?.toLowerCase().includes(search.toLowerCase()) ||
      v.vehicle_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.make?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || (v.last_status || '') === statusFilter
    return matchSearch && matchStatus
  })

  const statusCounts = vehicles.reduce((acc, v) => {
    const s = v.last_status || 'INACTIVE'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  const fmtTime = mins => {
    if (mins == null) return '—'
    if (mins < 2) return 'Just now'
    if (mins < 60) return `${Math.round(mins)}m ago`
    return `${Math.round(mins / 60)}h ago`
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Vehicles & Machines</h2>
          <p className="text-xs text-gray-400 mt-0.5">{vehicles.length} registered</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-brand-slate text-xs font-semibold rounded-xl hover:border-brand-red hover:text-brand-red transition-colors">
            <ArrowUpTrayIcon className="h-3.5 w-3.5" /> Import
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity">
            <PlusIcon className="h-3.5 w-3.5" /> Add Vehicle
          </button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {[['', 'All', vehicles.length], ['MOVING', 'Moving', statusCounts.MOVING || 0],
          ['IDLE', 'Idling', statusCounts.IDLE || 0], ['STOP', 'Stopped', statusCounts.STOP || 0],
          ['INACTIVE', 'Offline', statusCounts.INACTIVE || 0]
        ].map(([val, label, count]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${statusFilter === val
                ? 'bg-brand-red text-white border-brand-red'
                : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
            {val && <span className={`w-2 h-2 rounded-full ${STATUS_DOT[val]}`} />}
            {label}
            <span className={`ml-0.5 ${statusFilter === val ? 'text-white/80' : 'text-gray-400'}`}>({count})</span>
          </button>
        ))}

        {/* Search */}
        <div className="relative ml-auto">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-brand-red" />
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-brand-slate text-sm">New Vehicle / Machine</h3>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }}>
              <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Vehicle No. *', key: 'vehicle_no', placeholder: 'e.g. KBZ 123A' },
              { label: 'Vehicle Name',  key: 'vehicle_name', placeholder: 'e.g. Site Truck' },
              { label: 'IMEI',          key: 'imei', placeholder: 'Tracking device IMEI' },
              { label: 'Make',          key: 'make', placeholder: 'e.g. Toyota' },
              { label: 'Model',         key: 'model_name', placeholder: 'e.g. Hilux' },
              { label: 'Year',          key: 'year', placeholder: '2020', type: 'number' },
              { label: 'Tank (litres)', key: 'fuel_capacity', placeholder: '60', type: 'number' },
              { label: 'Vehicle Type',  key: 'vehicle_type', placeholder: 'e.g. Truck, Excavator' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input type={type || 'text'} value={form[key]} onChange={e => field(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fuel Type</label>
              <select value={form.fuel_type} onChange={e => field('fuel_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                {['diesel','petrol','electric','hybrid'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
              <select value={form.project} onChange={e => field('project', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                <option value="">— Unassigned —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">API Config</label>
              <select value={form.api_config} onChange={e => field('api_config', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                <option value="">— None —</option>
                {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={createMut.isPending || !form.vehicle_no}
              className="px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
              {createMut.isPending ? 'Saving…' : 'Save Vehicle'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }}
              className="px-4 py-2 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Vehicle Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-24 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-16 mb-4" />
              <div className="h-1.5 bg-gray-100 rounded mb-2" />
              <div className="h-3 bg-gray-100 rounded w-20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-16 text-center">
          <TruckIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">{search || statusFilter ? 'No vehicles match your filters.' : 'No vehicles yet. Add one above.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(v => (
            <div key={v.id} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-brand-red/20 cursor-pointer transition-all p-4 group">
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-brand-slate text-sm group-hover:text-brand-red transition-colors">{v.vehicle_no}</p>
                  {v.vehicle_name && <p className="text-xs text-gray-400 mt-0.5 truncate">{v.vehicle_name}</p>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${STATUS_PILL[v.last_status || '']}`}>
                  {STATUS_LABEL[v.last_status] || 'Unknown'}
                </span>
              </div>

              {/* Fuel Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-gray-400 flex items-center gap-1"><BeakerIcon className="h-3 w-3" /> Fuel</span>
                  <span className="font-medium text-gray-600">
                    {v.last_fuel != null ? `${Number(v.last_fuel).toFixed(0)}%` : '—'}
                  </span>
                </div>
                {v.last_fuel != null && <FuelBar pct={v.last_fuel} />}
              </div>

              {/* Meta row */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <MapPinIcon className="h-3 w-3" />
                  {v.last_speed != null ? `${Number(v.last_speed).toFixed(0)} km/h` : '—'}
                </span>
                <span className="flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />
                  {fmtTime(v.last_seen_minutes_ago)}
                </span>
              </div>

              {/* Make / Type */}
              {(v.make || v.vehicle_type) && (
                <p className="text-[10px] text-gray-300 mt-2 truncate">
                  {[v.make, v.model_name, v.vehicle_type].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showImport && (
        <FleetRegisterImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['fleet-vehicles'] })}
        />
      )}
    </div>
  )
}
