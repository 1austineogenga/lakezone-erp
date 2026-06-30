import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  TruckIcon, PlusIcon, MagnifyingGlassIcon, ArrowPathIcon,
  MapPinIcon, WrenchScrewdriverIcon, ExclamationTriangleIcon,
  SignalIcon, PrinterIcon, ChevronUpDownIcon,
} from '@heroicons/react/24/outline'
import { getVehicles, createVehicle, getFleetConfig, syncAssetsToFleet } from '../../api/fleet'
import api from '../../api/client'

// ── Icon: live GPS tracked ──────────────────────────────────────────────────
function LiveIcon() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
    </span>
  )
}
// ── Icon: not GPS tracked ───────────────────────────────────────────────────
function OfflineIcon() {
  return <WrenchScrewdriverIcon className="h-3 w-3 text-gray-400" />
}

const STATUS_LABEL = { MOVING: 'Moving', IDLE: 'Idling', STOP: 'Stopped', INACTIVE: 'Offline' }
const STATUS_CLS   = {
  MOVING:   'bg-green-100 text-green-700',
  IDLE:     'bg-amber-100 text-amber-700',
  STOP:     'bg-gray-100 text-gray-500',
  INACTIVE: 'bg-red-100 text-red-500',
}
const ERP_CLS = {
  OPER:       'bg-green-100 text-green-700',
  'NON-OPER': 'bg-red-100 text-red-700',
  IDLE:       'bg-amber-100 text-amber-700',
  UNKNOWN:    'bg-gray-100 text-gray-400',
}
const ERP_LABEL = {
  OPER: 'Operational', 'NON-OPER': 'Non-Operational', IDLE: 'Idle', UNKNOWN: 'Unknown',
}

// Group vehicles by asset_category
const CATEGORY_ORDER = ['Plant Machine', 'Vehicle', 'Canter / Truck', 'Prime Mover', 'Trailer', 'Low Loader', 'Tipper']
const CATEGORY_LABEL = {
  'Plant Machine': 'Plant Machines',
  'Vehicle':       'Vehicles',
  'Canter / Truck':'Canters & Trucks',
  'Prime Mover':   'Prime Movers',
  'Trailer':       'Trailers & Low Loaders',
  'Low Loader':    'Trailers & Low Loaders',
  'Tipper':        'Tippers',
  '':              'Other',
}
// Merge similar labels
function normCat(v) {
  if (!v) return 'Other'
  if (v === 'Low Loader' || v === 'Trailer') return 'Movers & Trailers'
  if (v === 'Canter / Truck') return 'Canters & Trucks'
  if (v === 'Plant Machine') return 'Plant Machines'
  if (v === 'Prime Mover') return 'Prime Movers'
  if (v === 'Tipper') return 'Tippers'
  if (v === 'Vehicle') return 'Vehicles'
  return v
}
const CAT_COLOR = {
  'Plant Machines':    'bg-blue-50 text-blue-700 border-blue-200',
  'Vehicles':          'bg-green-50 text-green-700 border-green-200',
  'Canters & Trucks':  'bg-orange-50 text-orange-700 border-orange-200',
  'Prime Movers':      'bg-purple-50 text-purple-700 border-purple-200',
  'Movers & Trailers': 'bg-gray-50 text-gray-600 border-gray-200',
  'Tippers':           'bg-amber-50 text-amber-700 border-amber-200',
  'Other':             'bg-gray-50 text-gray-500 border-gray-200',
}

function complianceBadge(c) {
  const s = c.status
  if (s === 'expired')       return <span key={c.id} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">EXPIRED</span>
  if (s === 'not_in_system') return <span key={c.id} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-orange-100 text-orange-700">Not in System</span>
  if (s === 'expiring_soon') return <span key={c.id} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700">Expiring</span>
  return null
}

const EMPTY = {
  vehicle_no: '', vehicle_name: '', vehicle_type: '', make: '', model_name: '',
  year: '', fuel_type: 'diesel', fuel_capacity: 60, asset_category: '', chassis_number: '',
  year_manufacture: '', year_acquired: '', current_site: '', erp_status: 'OPER',
}

export default function VehiclesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch]           = useState('')
  const [catFilter, setCatFilter]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState(EMPTY)
  const [sortKey, setSortKey]         = useState('asset_no')

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
      setShowForm(false); setForm(EMPTY)
    },
    onError: e => toast.error(e.response?.data?.vehicle_no?.[0] || 'Failed to add vehicle.'),
  })

  const syncMut = useMutation({
    mutationFn: syncAssetsToFleet,
    onSuccess: r => {
      const d = r.data
      toast.success(`Sync complete — ${d.created} created, ${d.linked} linked.`)
      qc.invalidateQueries({ queryKey: ['fleet-vehicles'] })
    },
    onError: () => toast.error('Sync failed.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = () => {
    const payload = { ...form, is_live: false, source: 'register' }
    if (!payload.year) delete payload.year
    if (!payload.project) delete payload.project
    if (!payload.api_config) delete payload.api_config
    createMut.mutate(payload)
  }

  // ── Print ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const win = window.open('', '_blank')
    const sorted = [...filtered].sort((a, b) => (a.asset_no || 999) - (b.asset_no || 999))
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Lakezone Fleet Register</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:10px;margin:20px;color:#111}
        h2{font-size:14px;margin-bottom:2px}p.sub{font-size:9px;color:#666;margin-bottom:12px}
        table{width:100%;border-collapse:collapse}
        th{background:#1e293b;color:#fff;padding:5px 7px;text-align:left;font-size:9px}
        td{padding:4px 7px;border-bottom:1px solid #e5e7eb;vertical-align:top}
        tr:nth-child(even) td{background:#f9fafb}
        .live{color:#16a34a;font-weight:bold}.notrack{color:#9ca3af}
        .red{color:#dc2626;font-weight:bold}.amber{color:#d97706;font-weight:bold}
      </style>
    </head><body>
      <h2>Lakezone Enterprises Ltd — Fleet & Machinery Register</h2>
      <p class="sub">Printed: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} &nbsp;|&nbsp; ${sorted.length} assets shown</p>
      <table><thead><tr>
        <th>#</th><th>Reg / ID</th><th>Description</th><th>Make & Model</th>
        <th>Category</th><th>Year</th><th>Location</th><th>Status</th><th>GPS</th><th>Compliance</th>
      </tr></thead><tbody>
      ${sorted.map((v,i)=>{
        const comp = (v.compliance||[]).filter(c=>c.status==='expired'||c.status==='not_in_system')
        return `<tr>
          <td>${v.asset_no||i+1}</td>
          <td><b>${v.vehicle_no}</b></td>
          <td>${v.vehicle_name||'—'}</td>
          <td>${[v.make,v.model_name].filter(Boolean).join(' ')||'—'}</td>
          <td>${normCat(v.asset_category)||'—'}</td>
          <td>${v.year_manufacture||v.year||'—'}</td>
          <td>${v.current_site||v.last_location||'—'}</td>
          <td>${v.is_live?(STATUS_LABEL[v.last_status]||'—'):(ERP_LABEL[v.erp_status]||'—')}</td>
          <td class="${v.is_live?'live':'notrack'}">${v.is_live?'Live GPS':'Not tracked'}</td>
          <td class="red">${comp.map(c=>c.compliance_type).join(', ')||'OK'}</td>
        </tr>`}).join('')}
      </tbody></table></body></html>`)
    win.document.close(); win.focus(); win.print()
  }

  // ── Derived counts ───────────────────────────────────────────────────────
  const liveCount   = vehicles.filter(v => v.is_live).length
  const totalCount  = vehicles.length
  const warnCount   = vehicles.filter(v => (v.compliance||[]).some(c => c.status === 'expired' || c.status === 'not_in_system')).length

  const categories = [...new Set(vehicles.map(v => normCat(v.asset_category)))].filter(Boolean).sort()

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      v.vehicle_no?.toLowerCase().includes(q) ||
      v.vehicle_name?.toLowerCase().includes(q) ||
      v.make?.toLowerCase().includes(q) ||
      v.model_name?.toLowerCase().includes(q) ||
      v.current_site?.toLowerCase().includes(q) ||
      v.asset_category?.toLowerCase().includes(q)
    const matchCat    = !catFilter || normCat(v.asset_category) === catFilter
    const matchStatus = !statusFilter ||
      (statusFilter === 'live'     && v.is_live) ||
      (statusFilter === 'untracked'&& !v.is_live) ||
      (statusFilter === 'warn'     && (v.compliance||[]).some(c => c.status==='expired'||c.status==='not_in_system')) ||
      (statusFilter === 'nonop'    && v.erp_status === 'NON-OPER')
    return matchSearch && matchCat && matchStatus
  }).sort((a, b) => {
    if (sortKey === 'asset_no') return (a.asset_no||999)-(b.asset_no||999)
    if (sortKey === 'vehicle_no') return (a.vehicle_no||'').localeCompare(b.vehicle_no||'')
    if (sortKey === 'location') return (a.current_site||a.last_location||'').localeCompare(b.current_site||b.last_location||'')
    return 0
  })

  // Group by normalised category
  const grouped = {}
  filtered.forEach(v => {
    const cat = normCat(v.asset_category) || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(v)
  })
  const groupOrder = ['Plant Machines','Vehicles','Canters & Trucks','Prime Movers','Movers & Trailers','Tippers','Other']

  return (
    <div className="space-y-4">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Vehicles & Machinery</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalCount} total · {liveCount} GPS-tracked · {warnCount > 0 && <span className="text-red-500 font-medium">{warnCount} compliance issues</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-brand-slate text-xs font-semibold rounded-xl hover:border-gray-400 transition-colors">
            <PrinterIcon className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-brand-slate text-xs font-semibold rounded-xl hover:border-emerald-500 hover:text-emerald-700 transition-colors disabled:opacity-60">
            <ArrowPathIcon className={`h-3.5 w-3.5 ${syncMut.isPending ? 'animate-spin' : ''}`} />
            {syncMut.isPending ? 'Syncing…' : 'Sync from Assets'}
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity">
            <PlusIcon className="h-3.5 w-3.5" /> Add Vehicle
          </button>
        </div>
      </div>

      {/* ── Summary pills ────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Total Assets', val: totalCount, color: 'text-brand-slate', bg: 'bg-gray-50', filter: '' },
          { label: 'GPS Tracked',  val: liveCount,  color: 'text-emerald-600', bg: 'bg-emerald-50', filter: 'live' },
          { label: 'Not Tracked',  val: totalCount - liveCount, color: 'text-gray-500', bg: 'bg-gray-50', filter: 'untracked' },
          { label: 'Compliance Issues', val: warnCount, color: 'text-red-600', bg: 'bg-red-50', filter: 'warn' },
        ].map(({ label, val, color, bg, filter }) => (
          <button key={label} onClick={() => setStatusFilter(f => f === filter ? '' : filter)}
            className={`${bg} rounded-xl px-4 py-2 text-left transition-all border ${statusFilter===filter ? 'border-brand-red shadow-sm' : 'border-transparent'}`}>
            <p className={`text-lg font-bold leading-none ${color}`}>{val}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* ── Filters bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-gray-100 rounded-xl px-4 py-2.5">
        {/* Category filter */}
        <div className="flex gap-1 flex-wrap flex-1">
          <button onClick={() => setCatFilter('')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${!catFilter ? 'bg-brand-slate text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            All
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCatFilter(c => c === cat ? '' : cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${catFilter === cat ? 'bg-brand-red text-white border-brand-red' : `${CAT_COLOR[cat]||'bg-gray-50 text-gray-600 border-gray-200'} hover:opacity-80`}`}>
              {cat}
            </button>
          ))}
        </div>
        {/* Sort + Search */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <ChevronUpDownIcon className="h-3.5 w-3.5" />
            <select value={sortKey} onChange={e => setSortKey(e.target.value)}
              className="border-0 bg-transparent text-xs text-gray-600 focus:outline-none">
              <option value="asset_no">Asset #</option>
              <option value="vehicle_no">Reg No.</option>
              <option value="location">Location</option>
            </select>
          </div>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search reg, make, site…"
              className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red w-44" />
          </div>
        </div>
      </div>

      {/* ── Add Vehicle Form ──────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Add Vehicle / Machine</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Reg No. / ID *', key: 'vehicle_no', placeholder: 'e.g. KBZ 123A' },
              { label: 'Name / Description', key: 'vehicle_name', placeholder: 'e.g. Grader' },
              { label: 'Make', key: 'make', placeholder: 'e.g. Caterpillar' },
              { label: 'Model', key: 'model_name', placeholder: 'e.g. 140G' },
              { label: 'Type', key: 'vehicle_type', placeholder: 'e.g. Grader' },
              { label: 'Category', key: 'asset_category', placeholder: 'e.g. Plant Machine' },
              { label: 'Chassis / Serial', key: 'chassis_number', placeholder: '' },
              { label: 'Year of Mfg.', key: 'year_manufacture', placeholder: '2020', type: 'number' },
              { label: 'Year Acquired', key: 'year_acquired', placeholder: '2024', type: 'number' },
              { label: 'Tank (L)', key: 'fuel_capacity', placeholder: '60', type: 'number' },
              { label: 'Site / Location', key: 'current_site', placeholder: 'e.g. Njambini' },
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
                  <option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ERP Status</label>
              <select value={form.erp_status} onChange={e => field('erp_status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                <option value="OPER">Operational</option>
                <option value="NON-OPER">Non-Operational</option>
                <option value="IDLE">Idle</option>
                <option value="UNKNOWN">Unknown</option>
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
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={createMut.isPending || !form.vehicle_no}
              className="px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
              {createMut.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }}
              className="px-4 py-2 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Main Table ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-gray-50 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-16 text-center">
          <TruckIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">No vehicles match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupOrder.filter(g => grouped[g]?.length).map(groupName => (
            <div key={groupName} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {/* Group header */}
              <div className={`px-4 py-2 flex items-center justify-between border-b border-gray-100 ${CAT_COLOR[groupName] || 'bg-gray-50'}`}>
                <span className="text-xs font-bold tracking-wide uppercase">{groupName}</span>
                <span className="text-xs font-medium opacity-70">{grouped[groupName].length} assets</span>
              </div>

              {/* Table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-2 text-left font-semibold text-gray-500 w-6">#</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500 w-24">Reg / ID</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Description</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Make & Model</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Location</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-500">GPS</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {grouped[groupName].map(v => {
                    const compIssues = (v.compliance||[]).filter(c => c.status==='expired'||c.status==='not_in_system'||c.status==='expiring_soon')
                    const hasWarn    = compIssues.length > 0 || v.erp_status === 'NON-OPER'
                    const location   = v.current_site || v.last_location || '—'
                    return (
                      <tr key={v.id}
                        onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                        className={`cursor-pointer transition-colors hover:bg-gray-50 ${hasWarn ? 'bg-red-50/30' : ''}`}>
                        {/* # */}
                        <td className="px-4 py-3 text-gray-400">{v.asset_no || '—'}</td>
                        {/* Reg */}
                        <td className="px-4 py-3">
                          <span className="font-bold text-brand-slate">{v.vehicle_no}</span>
                        </td>
                        {/* Description */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{v.vehicle_name || '—'}</p>
                          {v.chassis_number && v.chassis_number !== 'N/A' && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{v.chassis_number}</p>
                          )}
                        </td>
                        {/* Make & Model */}
                        <td className="px-4 py-3 text-gray-600">
                          {[v.make, v.model_name].filter(Boolean).join(' ') || '—'}
                        </td>
                        {/* Location */}
                        <td className="px-4 py-3">
                          {location !== '—' ? (
                            <span className="flex items-center gap-1 text-gray-600">
                              <MapPinIcon className="h-3 w-3 text-gray-400 shrink-0" />
                              <span className="truncate max-w-[140px]">{location}</span>
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        {/* GPS */}
                        <td className="px-4 py-3 text-center">
                          {v.is_live ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <LiveIcon />
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLS[v.last_status||'']||'bg-gray-100 text-gray-400'}`}>
                                {STATUS_LABEL[v.last_status] || 'Unknown'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <OfflineIcon />
                              <span className="text-[9px] text-gray-400">Untracked</span>
                            </div>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          {v.erp_status ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ERP_CLS[v.erp_status]||'bg-gray-100 text-gray-400'}`}>
                              {ERP_LABEL[v.erp_status]||v.erp_status}
                            </span>
                          ) : <span className="text-gray-400 text-[10px]">—</span>}
                        </td>
                        {/* Compliance */}
                        <td className="px-4 py-3">
                          {compIssues.length > 0 ? (
                            <div className="flex flex-wrap gap-1 items-center">
                              <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
                              {compIssues.map(c => complianceBadge(c))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-green-600 font-medium">OK</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
