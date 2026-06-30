import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  ArrowLeftIcon, ArrowPathIcon, MapPinIcon, BoltIcon,
  BeakerIcon, ExclamationTriangleIcon,
  PencilIcon, TrashIcon, CheckIcon, XMarkIcon, PlusIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import {
  getVehicle, getVehicleLive, getFuelEvents, getTrips, getAlerts,
  acknowledgeAlert, updateVehicle, deleteVehicle, updateCompliance,
  getMaintenance, createMaintenance,
} from '../../api/fleet'
import api from '../../api/client'

const STATUS_DOT   = { MOVING: 'bg-green-500', IDLE: 'bg-yellow-400', STOP: 'bg-gray-400', INACTIVE: 'bg-red-400' }
const STATUS_LABEL = { MOVING: 'Moving', IDLE: 'Idling', STOP: 'Stopped', INACTIVE: 'Offline' }
const FUEL_COLORS  = { fill: 'bg-green-100 text-green-700', drain: 'bg-red-100 text-red-700', theft: 'bg-purple-100 text-purple-700' }

const COMPLIANCE_TYPE_LABEL = {
  insurance: 'Insurance', inspection: 'Inspection Certificate', speed_governor: 'Speed Governor Cert',
}
const COMPLIANCE_STATUS_CLS = {
  valid: 'bg-green-100 text-green-700', expiring_soon: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700', not_in_system: 'bg-orange-100 text-orange-700',
  not_applicable: 'bg-gray-100 text-gray-400', unknown: 'bg-gray-100 text-gray-400',
}
const COMPLIANCE_STATUS_LABEL = {
  valid: 'Valid', expiring_soon: 'Expiring Soon', expired: 'EXPIRED',
  not_in_system: 'Not in System', not_applicable: 'N/A', unknown: '—',
}

const fmt = (n, d = 1) => Number(n || 0).toFixed(d)
const fmtDt = s => new Date(s).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })

function EditVehicleModal({ vehicle, projects, configs, onClose, onSaved }) {
  const [assetSearch, setAssetSearch] = useState('')
  const [showAssets, setShowAssets] = useState(false)

  const { data: assets = [] } = useQuery({
    queryKey: ['assets-all'],
    queryFn: () => api.get('/inventory/assets/'),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: showAssets,
  })

  const filteredAssets = assets.filter(a =>
    !assetSearch ||
    a.serial_number?.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.name?.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.asset_code?.toLowerCase().includes(assetSearch.toLowerCase())
  )

  const [form, setForm] = useState({
    vehicle_no:    vehicle.vehicle_no || '',
    vehicle_name:  vehicle.vehicle_name || '',
    imei:          vehicle.imei || '',
    vehicle_type:  vehicle.vehicle_type || '',
    make:          vehicle.make || '',
    model_name:    vehicle.model_name || '',
    year:          vehicle.year || '',
    fuel_type:     vehicle.fuel_type || 'diesel',
    fuel_capacity: vehicle.fuel_capacity || 60,
    project:       vehicle.project || '',
    api_config:    vehicle.api_config || '',
    erp_status:    vehicle.erp_status || '',
    priority_flag: vehicle.priority_flag || '',
    current_site:  vehicle.current_site || '',
    meter_reading: vehicle.meter_reading || '',
    erp_code:      vehicle.erp_code || '',
    chassis_number: vehicle.chassis_number || '',
    year_manufacture: vehicle.year_manufacture || '',
    year_acquired:  vehicle.year_acquired || '',
    known_defects:  vehicle.known_defects || '',
    required_actions: vehicle.required_actions || '',
    notes:          vehicle.notes || '',
    is_active:      vehicle.is_active,
  })
  const [saving, setSaving] = useState(false)

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const fillFromAsset = (asset) => {
    const [make, ...modelParts] = (asset.make_model || '').split(' ')
    setForm(f => ({
      ...f,
      vehicle_name:     f.vehicle_name  || asset.name || '',
      make:             f.make          || make || '',
      model_name:       f.model_name    || modelParts.join(' ') || '',
      chassis_number:   f.chassis_number|| asset.serial_number || '',
      current_site:     f.current_site  || asset.location || '',
      erp_status:       f.erp_status    || (asset.status === 'operational' ? 'OPER' : asset.status === 'non_operational' ? 'NON-OPER' : f.erp_status),
    }))
    setShowAssets(false)
    setAssetSearch('')
    toast.info(`Filled from asset ${asset.asset_code}`)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.year) delete payload.year
      if (!payload.year_manufacture) delete payload.year_manufacture
      if (!payload.year_acquired) delete payload.year_acquired
      if (!payload.project) delete payload.project
      if (!payload.api_config) delete payload.api_config
      await updateVehicle(vehicle.id, payload)
      toast.success('Vehicle updated.')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.vehicle_no?.[0] || 'Failed to update vehicle.')
    } finally {
      setSaving(false)
    }
  }

  const textFields = [
    { label: 'Vehicle No. *', key: 'vehicle_no' },
    { label: 'Vehicle Name',  key: 'vehicle_name' },
    { label: 'IMEI',          key: 'imei' },
    { label: 'Make',          key: 'make' },
    { label: 'Model',         key: 'model_name' },
    { label: 'Year',          key: 'year', type: 'number' },
    { label: 'Tank (litres)', key: 'fuel_capacity', type: 'number' },
    { label: 'Vehicle Type',  key: 'vehicle_type' },
    { label: 'Chassis No.',   key: 'chassis_number' },
    { label: 'Yr Manufacture',key: 'year_manufacture', type: 'number' },
    { label: 'Yr Acquired',   key: 'year_acquired', type: 'number' },
    { label: 'Current Site',  key: 'current_site' },
    { label: 'Meter Reading', key: 'meter_reading' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-brand-slate">Edit Vehicle — {vehicle.vehicle_no}</h2>
          <button onClick={onClose}><XMarkIcon className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Fill from Asset */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-blue-700 font-medium">Fill blank fields from an Asset record</p>
              <button onClick={() => setShowAssets(v => !v)}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                <ArrowDownTrayIcon className="h-3 w-3" /> {showAssets ? 'Hide' : 'Browse Assets'}
              </button>
            </div>
            {showAssets && (
              <div className="mt-2 space-y-2">
                <input value={assetSearch} onChange={e => setAssetSearch(e.target.value)}
                  placeholder="Search by name, serial, asset code…"
                  className="w-full px-2 py-1.5 border border-blue-200 rounded text-xs focus:outline-none focus:border-blue-500 bg-white" />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredAssets.slice(0, 20).map(a => (
                    <button key={a.id} onClick={() => fillFromAsset(a)}
                      className="w-full text-left px-3 py-2 bg-white rounded border border-blue-100 hover:border-blue-400 text-xs">
                      <span className="font-medium text-brand-slate">{a.asset_code}</span>
                      <span className="text-gray-500 ml-2">{a.name}</span>
                      {a.serial_number && <span className="text-gray-400 ml-2">· {a.serial_number}</span>}
                    </button>
                  ))}
                  {filteredAssets.length === 0 && <p className="text-xs text-gray-400 py-2 text-center">No assets found.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {textFields.map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type || 'text'} value={form[key]}
                  onChange={e => field(key, e.target.value)}
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select value={form.priority_flag} onChange={e => field('priority_flag', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                <option value="">— None —</option>
                {['HIGH','MEDIUM','LOW'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
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
          <div className="grid grid-cols-1 gap-3">
            {[['known_defects','Known Defects'],['required_actions','Required Actions'],['notes','Notes']].map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <textarea rows={2} value={form[key]} onChange={e => field(key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red resize-none" />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={form.is_active} onChange={e => field('is_active', e.target.checked)}
              className="rounded" />
            Active / Operational
          </label>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.vehicle_no}
            className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ComplianceRow({ vehicleId, item, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [expiryDate, setExpiryDate] = useState(item.expiry_date || '')
  const [statusOverride, setStatusOverride] = useState(item.status || 'unknown')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateCompliance(vehicleId, {
        compliance_type: item.compliance_type,
        expiry_date: expiryDate || null,
        status: expiryDate ? undefined : statusOverride,
      })
      toast.success('Compliance updated.')
      onUpdated()
      setEditing(false)
    } catch {
      toast.error('Failed to update compliance.')
    } finally {
      setSaving(false)
    }
  }

  const statusCls = COMPLIANCE_STATUS_CLS[item.status] || 'bg-gray-100 text-gray-400'
  const statusLabel = COMPLIANCE_STATUS_LABEL[item.status] || item.status
  const typeLabel = COMPLIANCE_TYPE_LABEL[item.compliance_type] || item.compliance_type

  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600 font-medium">{typeLabel}</span>
        <div className="flex items-center gap-2">
          {!editing && item.expiry_date && (
            <span className="text-[10px] text-gray-400">{item.expiry_date}</span>
          )}
          {!editing && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
          )}
          <button onClick={() => setEditing(e => !e)}
            className="text-gray-400 hover:text-brand-red transition-colors">
            {editing ? <XMarkIcon className="w-3.5 h-3.5" /> : <PencilIcon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Expiry Date</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-brand-red" />
          </div>
          {!expiryDate && (
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Status</label>
              <select value={statusOverride} onChange={e => setStatusOverride(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-brand-red">
                {Object.entries(COMPLIANCE_STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 px-3 py-1 bg-brand-red text-white text-xs rounded hover:opacity-90 disabled:opacity-60">
            <CheckIcon className="w-3 h-3" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}

function AddComplianceForm({ vehicleId, onAdded }) {
  const [type, setType] = useState('insurance')
  const [expiry, setExpiry] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    setSaving(true)
    try {
      await updateCompliance(vehicleId, { compliance_type: type, expiry_date: expiry || null })
      toast.success('Compliance record added.')
      onAdded()
      setExpiry('')
    } catch {
      toast.error('Failed to add compliance record.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-50 pt-3">
      <div>
        <label className="block text-[10px] text-gray-500 mb-1">Type</label>
        <select value={type} onChange={e => setType(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-brand-red">
          {Object.entries(COMPLIANCE_TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 mb-1">Expiry Date</label>
        <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-brand-red" />
      </div>
      <button onClick={handleAdd} disabled={saving}
        className="flex items-center gap-1 px-3 py-1.5 bg-brand-red text-white text-xs rounded hover:opacity-90 disabled:opacity-60">
        <CheckIcon className="w-3 h-3" /> {saving ? 'Saving…' : 'Add'}
      </button>
    </div>
  )
}

export default function VehicleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('fuel')
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: vehicle } = useQuery({
    queryKey: ['fleet-vehicle', id],
    queryFn: () => getVehicle(id),
    select: r => r.data,
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-active'],
    queryFn: () => api.get('/projects/'),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: showEdit,
  })

  const { data: configs = [] } = useQuery({
    queryKey: ['fleet-config'],
    queryFn: () => api.get('/fleet/config/'),
    select: r => r.data?.results ?? (Array.isArray(r.data) ? r.data : [r.data].filter(Boolean)),
    enabled: showEdit,
  })

  const { data: liveHistory = [] } = useQuery({
    queryKey: ['fleet-vehicle-live', id],
    queryFn: () => getVehicleLive(id),
    select: r => {
      const d = r.data?.results ?? r.data ?? []
      return (Array.isArray(d) ? d : []).slice(-48)
    },
    refetchInterval: 120_000,
  })

  const { data: fuelEvents = [] } = useQuery({
    queryKey: ['fleet-fuel-events-v', id],
    queryFn: () => getFuelEvents({ vehicle: id, limit: 50 }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: tab === 'fuel',
  })

  const { data: trips = [] } = useQuery({
    queryKey: ['fleet-trips-v', id],
    queryFn: () => getTrips({ vehicle: id, limit: 50 }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: tab === 'trips',
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['fleet-alerts-v', id],
    queryFn: () => getAlerts({ vehicle: id, limit: 30 }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: tab === 'alerts',
  })

  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: ['fleet-maintenance-v', id],
    queryFn: () => getMaintenance({ vehicle: id }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: tab === 'maintenance',
  })

  const ackMut = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      toast.success('Alert acknowledged.')
      qc.invalidateQueries({ queryKey: ['fleet-alerts-v', id] })
      qc.invalidateQueries({ queryKey: ['fleet-dashboard'] })
    },
  })

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteVehicle(id)
      toast.success('Vehicle deleted.')
      qc.invalidateQueries({ queryKey: ['fleet-vehicles'] })
      navigate('/fleet/vehicles')
    } catch {
      toast.error('Failed to delete vehicle.')
      setDeleting(false)
    }
  }

  const refreshVehicle = () => {
    qc.invalidateQueries({ queryKey: ['fleet-vehicle', id] })
    qc.invalidateQueries({ queryKey: ['fleet-vehicles'] })
  }

  if (!vehicle) return <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>

  const fuelChartData = liveHistory
    .filter(d => d.fuel_level != null)
    .map(d => ({
      time: new Date(d.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fuel: Number(d.fuel_level).toFixed(1),
      speed: Number(d.speed || 0).toFixed(1),
    }))

  const odomKm = vehicle.last_odometer ? (vehicle.last_odometer / 1000).toFixed(0) : null
  const fuelUnit = vehicle.fuel_sensor_unit === 'L' ? 'L' : '%'
  const fuelDisplay = (val) => val != null ? Number(val).toFixed(1) : '—'

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; font-size: 11px; }
          .space-y-5 { gap: 0.75rem; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/fleet/vehicles')} className="text-gray-400 hover:text-brand-slate mt-1 no-print">
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-bold text-brand-slate text-lg">{vehicle.vehicle_no}</h2>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
<button onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-slate text-white text-xs font-medium rounded-lg hover:opacity-90">
                <PencilIcon className="h-3.5 w-3.5" /> Edit
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 no-print">
                🖨 Print
              </button>
              <button onClick={() => setShowDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-brand-red text-xs font-medium rounded-lg hover:bg-red-50 no-print">
                <TrashIcon className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
            {vehicle.last_status && (
              <>
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[vehicle.last_status] || 'bg-gray-300'}`} />
                <span className="text-sm text-gray-500">{STATUS_LABEL[vehicle.last_status] || vehicle.last_status}</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {[vehicle.vehicle_name, vehicle.make, vehicle.model_name, vehicle.year].filter(Boolean).join(' · ')}
            {vehicle.project_name ? ` · ${vehicle.project_name}` : ''}
          </p>
          {vehicle.last_location && (
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <MapPinIcon className="h-3 w-3" /> {vehicle.last_location}
            </p>
          )}
        </div>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Speed',      val: vehicle.last_speed != null ? `${fmt(vehicle.last_speed)} km/h` : '—', icon: BoltIcon,     color: 'text-blue-600' },
          { label: 'Fuel Level', val: vehicle.last_fuel != null ? `${fuelDisplay(vehicle.last_fuel)} ${fuelUnit}` : '—', icon: BeakerIcon, color: 'text-green-600' },
          { label: 'Odometer',   val: odomKm != null ? `${odomKm} km` : '—',                              icon: MapPinIcon,   color: 'text-brand-slate' },
          {
            label: 'Last Seen',
            val: vehicle.last_seen_minutes_ago != null
              ? vehicle.last_seen_minutes_ago < 2 ? 'Just now'
              : vehicle.last_seen_minutes_ago < 60 ? `${Math.round(vehicle.last_seen_minutes_ago)}m ago`
              : `${Math.round(vehicle.last_seen_minutes_ago / 60)}h ago`
              : '—',
            icon: ArrowPathIcon, color: 'text-gray-500',
          },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <s.icon className={`h-5 w-5 ${s.color} mb-1`} />
            <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Fuel trend chart */}
      {fuelChartData.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Fuel Level Trend (last 48 readings)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={fuelChartData}>
              <defs>
                <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={fuelUnit === 'L' ? [0, 'auto'] : [0, 100]} tick={{ fontSize: 10 }} unit={fuelUnit} />
              <Tooltip formatter={(v, n) => [`${v} ${fuelUnit}`, n === 'fuel' ? `Fuel (${fuelUnit})` : 'Speed km/h']} />
              <Area type="monotone" dataKey="fuel" stroke="#22c55e" fill="url(#fuelGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Compliance & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Compliance — always shown, always editable */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-brand-slate">Compliance Status</h3>
          </div>
          {vehicle.compliance?.length > 0 ? (
            <div>
              {vehicle.compliance.map(c => (
                <ComplianceRow key={c.id} vehicleId={id} item={c} onUpdated={refreshVehicle} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No compliance records yet.</p>
          )}
          <AddComplianceForm vehicleId={id} onAdded={refreshVehicle} />
        </div>

        <div className="space-y-4">
          {vehicle.current_assignment && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-xs font-bold text-brand-slate mb-3">Current Assignment</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Driver / Operator</span>
                  <span className="font-medium text-brand-slate">
                    {vehicle.current_assignment.employee_name || vehicle.current_assignment.driver_name || '—'}
                  </span>
                </div>
                {vehicle.current_assignment.site && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Site</span>
                    <span className="font-medium text-brand-slate">{vehicle.current_assignment.site}</span>
                  </div>
                )}
                {vehicle.current_assignment.employee && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">HR Record</span>
                    <span className="text-green-600 font-medium">Matched ✓</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vehicle Details — always visible, blank fields show "—" with edit hint */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-brand-slate">Vehicle Details</h3>
              <button onClick={() => setShowEdit(true)}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-red transition-colors">
                <PencilIcon className="h-3 w-3" /> Edit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Priority',      vehicle.priority_flag],
                ['Current Site',  vehicle.current_site],
                ['Meter Reading', vehicle.meter_reading],
                ['Year Mfg',      vehicle.year_manufacture],
                ['Year Acquired', vehicle.year_acquired],
                ['Chassis No.',   vehicle.chassis_number],
              ].map(([label, val]) => (
                <div key={label}>
                  <div className="text-gray-400">{label}</div>
                  {val
                    ? <div className="font-medium text-brand-slate">{val}</div>
                    : <button onClick={() => setShowEdit(true)}
                        className="text-gray-400 hover:text-brand-red transition-colors underline underline-offset-2 text-[10px]">
                        + add
                      </button>
                  }
                </div>
              ))}
            </div>
            {vehicle.known_defects && (
              <div>
                <div className="text-[10px] font-semibold text-red-600 uppercase mb-1">Known Defects</div>
                <p className="text-xs text-gray-600">{vehicle.known_defects}</p>
              </div>
            )}
            {vehicle.required_actions && (
              <div>
                <div className="text-[10px] font-semibold text-amber-600 uppercase mb-1">Required Actions</div>
                <p className="text-xs text-gray-600">{vehicle.required_actions}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="flex border-b border-gray-100">
          {[['fuel', 'Fuel Events'], ['trips', 'Trip History'], ['alerts', 'Alerts'], ['maintenance', 'Maintenance']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-5 py-3 text-xs font-medium border-b-2 transition-colors
                ${tab === k ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-brand-slate'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'fuel' && (
          fuelEvents.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No fuel events recorded.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Type', 'Time', 'Before', 'After', 'Change', 'Location'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fuelEvents.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FUEL_COLORS[e.event_type] || 'bg-gray-100 text-gray-600'}`}>
                            {e.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtDt(e.occurred_at)}</td>
                        <td className="px-4 py-3 text-xs">{fuelDisplay(e.fuel_before)} {e.fuel_unit || 'L'}</td>
                        <td className="px-4 py-3 text-xs">{fuelDisplay(e.fuel_after)} {e.fuel_unit || 'L'}</td>
                        <td className={`px-4 py-3 text-xs font-medium ${e.event_type === 'fill' ? 'text-green-600' : 'text-red-600'}`}>
                          {e.event_type === 'fill' ? '+' : ''}{fuelDisplay(Math.abs(e.fuel_change))} {e.fuel_unit || 'L'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate">{e.location_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}

        {tab === 'trips' && (
          trips.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No trips recorded.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Start', 'End', 'From', 'To', 'Distance', 'Duration', 'Max Speed'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trips.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtDt(t.started_at)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {t.ended_at ? fmtDt(t.ended_at) : <span className="text-green-600 font-medium">In Progress</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[120px] truncate">{t.start_location || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[120px] truncate">{t.end_location || '—'}</td>
                        <td className="px-4 py-3 text-xs font-medium">{t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{t.duration_minutes ? `${t.duration_minutes} min` : '—'}</td>
                        <td className="px-4 py-3 text-xs">{t.max_speed ? `${fmt(t.max_speed)} km/h` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}

        {tab === 'alerts' && (
          alerts.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No alerts for this vehicle.</p>
            : <div className="divide-y divide-gray-100">
                {alerts.map(a => (
                  <div key={a.id} className={`px-5 py-4 flex items-start gap-3 ${a.acknowledged ? 'opacity-50' : ''}`}>
                    <ExclamationTriangleIcon className={`h-4 w-4 mt-0.5 shrink-0 ${a.severity === 'critical' ? 'text-red-500' : a.severity === 'high' ? 'text-orange-500' : a.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-brand-slate">{a.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDt(a.occurred_at)}</p>
                    </div>
                    {!a.acknowledged && (
                      <button onClick={() => ackMut.mutate(a.id)} className="text-xs text-blue-600 hover:underline shrink-0">
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </div>
        )}

        {tab === 'maintenance' && (
          maintenanceRecords.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No maintenance records. Add via the Maintenance page.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Type', 'Date', 'Odometer', 'Description', 'Next Service Date', 'Next Service km', 'Cost'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {maintenanceRecords.map(m => {
                      const today = new Date()
                      const nextDate = m.next_service_date ? new Date(m.next_service_date) : null
                      const daysLeft = nextDate ? Math.round((nextDate - today) / 86400000) : null
                      const dueSoon = daysLeft !== null && daysLeft <= 14
                      const overdue = daysLeft !== null && daysLeft < 0
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium capitalize">{m.maintenance_type}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{m.date}</td>
                          <td className="px-4 py-3 text-xs">{m.odometer_at_service ? `${(m.odometer_at_service / 1000).toFixed(0)} km` : '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate">{m.description}</td>
                          <td className={`px-4 py-3 text-xs font-medium ${overdue ? 'text-red-600' : dueSoon ? 'text-amber-600' : 'text-gray-600'}`}>
                            {m.next_service_date || '—'}
                            {daysLeft !== null && (
                              <span className="ml-1 text-[10px]">
                                {overdue ? `(${Math.abs(daysLeft)}d overdue)` : `(${daysLeft}d)`}
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-xs font-medium ${m.next_service_odometer && vehicle.last_odometer && m.next_service_odometer - vehicle.last_odometer < 500000 ? 'text-amber-600' : 'text-gray-600'}`}>
                            {m.next_service_odometer ? `${(m.next_service_odometer / 1000).toFixed(0)} km` : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{m.cost ? `KES ${Number(m.cost).toLocaleString()}` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditVehicleModal
          vehicle={vehicle}
          projects={projects}
          configs={configs}
          onClose={() => setShowEdit(false)}
          onSaved={refreshVehicle}
        />
      )}

      {/* Delete Confirm */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <TrashIcon className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-brand-slate mb-2">Delete Vehicle?</h3>
            <p className="text-xs text-gray-500 mb-4">
              This will permanently delete <strong>{vehicle.vehicle_no}</strong> and all associated data.
              This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowDelete(false)}
                className="px-4 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
