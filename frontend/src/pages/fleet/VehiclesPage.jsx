import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  TruckIcon, PlusIcon, MagnifyingGlassIcon,
  MapPinIcon, WrenchScrewdriverIcon, ExclamationTriangleIcon,
  SignalIcon, PrinterIcon, ChevronUpDownIcon, ArrowPathIcon, XMarkIcon,
  CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import { getVehicles, createVehicle, getFleetConfig, previewAssetSync, syncAssetsToFleet } from '../../api/fleet'
import { createRequisition } from '../../api/requisitions'
import api from '../../api/client'
import usePermissions from '../../hooks/usePermissions'
import useAuthStore from '../../store/authStore'

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

const ACTION_STYLE = {
  create:  { bg: 'bg-green-50 border-green-200',  dot: 'bg-green-500',  label: 'New',    text: 'text-green-700'  },
  enrich:  { bg: 'bg-blue-50 border-blue-200',    dot: 'bg-blue-500',   label: 'Match',  text: 'text-blue-700'   },
  skip:    { bg: 'bg-gray-50 border-gray-200',    dot: 'bg-gray-400',   label: 'Skip',   text: 'text-gray-500'   },
}

function SyncModal({ onClose, qc }) {
  const [plan, setPlan]       = useState(null)
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  const preview = async () => {
    setLoading(true)
    try {
      const r = await previewAssetSync()
      setPlan(r.data.plan)
    } catch {
      toast.error('Failed to load preview.')
    } finally {
      setLoading(false)
    }
  }

  const execute = async () => {
    setLoading(true)
    try {
      const r = await syncAssetsToFleet()
      setResult(r.data)
      qc.invalidateQueries({ queryKey: ['fleet-vehicles'] })
    } catch {
      toast.error('Sync failed.')
    } finally {
      setLoading(false)
    }
  }

  const creates  = plan?.filter(p => p.action === 'create')  ?? []
  const enriches = plan?.filter(p => p.action === 'enrich')  ?? []
  const skips    = plan?.filter(p => p.action === 'skip')    ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Sync Assets → Fleet Register</h2>
            <p className="text-white/50 text-xs mt-0.5">Operations dept · Vehicles, Machinery, Trucks & Tracks</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Match-key legend */}
          <div className="text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
            <p className="font-semibold text-gray-700 mb-1">Match priority</p>
            <ol className="list-decimal list-inside space-y-0.5 text-gray-600">
              <li><span className="font-medium">Registration plate</span> vs Reg No. in fleet <span className="text-brand-red">(default)</span></li>
              <li>Serial number vs Reg No.</li>
              <li>Make & model vs fleet make + model</li>
              <li>Name vs fleet vehicle name</li>
              <li>Asset code vs Reg No.</li>
            </ol>
          </div>

          {result ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Sync complete</p>
                  <p className="text-xs text-green-700 mt-1">
                    {result.created} new · {result.enriched} enriched · {result.skipped} skipped
                  </p>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Errors</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              )}
            </div>
          ) : plan ? (
            <div className="space-y-3">
              {/* Summary chips */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: `${creates.length} to create`, bg: 'bg-green-100 text-green-700' },
                  { label: `${enriches.length} matched`, bg: 'bg-blue-100 text-blue-700' },
                  { label: `${skips.length} skipped`, bg: 'bg-gray-100 text-gray-600' },
                ].map(c => (
                  <span key={c.label} className={`text-xs font-semibold px-3 py-1 rounded-full ${c.bg}`}>{c.label}</span>
                ))}
              </div>

              {/* Plan list */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {plan.map((item, i) => {
                  const s = ACTION_STYLE[item.action] || ACTION_STYLE.skip
                  return (
                    <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs ${s.bg}`}>
                      <div className={`h-2 w-2 rounded-full mt-1 shrink-0 ${s.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold uppercase text-[10px] ${s.text}`}>{s.label}</span>
                          <span className="font-mono text-gray-500 text-[10px]">{item.asset_code}</span>
                          <span className="font-semibold text-gray-700 truncate">{item.asset_name}</span>
                        </div>
                        {item.action === 'enrich' && (
                          <p className="text-gray-500 mt-0.5">
                            Matched fleet <span className="font-medium text-gray-700">{item.vehicle_no}</span>
                            {' · '}<span className="italic">by {item.match_by?.replace(/_/g, ' ')}</span>
                          </p>
                        )}
                        {item.action === 'create' && (
                          <p className="text-gray-500 mt-0.5">
                            Will create as <span className="font-medium text-gray-700">{item.vehicle_no}</span>
                            {item.registration_plate && item.registration_plate !== item.vehicle_no && (
                              <> (plate: {item.registration_plate})</>
                            )}
                          </p>
                        )}
                        {item.action === 'skip' && (
                          <p className="text-gray-400 mt-0.5 italic">{item.reason}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <TruckIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600">Click "Preview" to see what will be synced.</p>
              <p className="text-xs text-gray-400 mt-1">No changes are made until you confirm.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0 justify-end">
          <button onClick={onClose} className="px-4 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Close
          </button>
          {!result && !plan && (
            <button onClick={preview} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-slate text-white text-xs font-semibold rounded-xl disabled:opacity-60">
              <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading…' : 'Preview'}
            </button>
          )}
          {plan && !result && (
            <>
              <button onClick={preview} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                <ArrowPathIcon className="h-3.5 w-3.5" /> Refresh
              </button>
              <button onClick={execute} disabled={loading || creates.length + enriches.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl disabled:opacity-60 hover:opacity-90">
                <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Syncing…' : `Confirm Sync (${creates.length + enriches.length} assets)`}
              </button>
            </>
          )}
          {result && (
            <button onClick={() => { setPlan(null); setResult(null) }}
              className="px-4 py-2 bg-brand-slate text-white text-xs font-semibold rounded-xl">
              Sync Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const SERVICE_TYPES = [
  'Routine Service / Oil Change',
  'Tyre Replacement / Repair',
  'Engine Repair',
  'Transmission / Gearbox',
  'Brake System',
  'Electrical / Wiring',
  'Body Repair / Welding',
  'Hydraulic System',
  'Cooling System',
  'Fuel System',
  'Suspension / Steering',
  'Pre-Inspection / Certification',
  'Other',
]

const URGENCY_OPTIONS = [
  { value: 'low',    label: 'Low — Scheduled maintenance' },
  { value: 'medium', label: 'Medium — Needs attention soon' },
  { value: 'high',   label: 'High — Affecting operations' },
  { value: 'urgent', label: 'Urgent — Unit is grounded / unsafe' },
]

function MaintenanceReqModal({ vehicles, preselectedVehicleId, onClose }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    vehicle_id: preselectedVehicleId || '',
    service_type: '',
    other_service_type: '',
    priority: 'medium',
    date_required: '',
    location: '',
    odometer_hours: '',
    last_service_date: '',
    last_service_reading: '',
    reported_by: user ? `${user.first_name} ${user.last_name}`.trim() : '',
    problem_description: '',
    defects_observed: '',
    parts_required: '',
    estimated_cost: '',
    preferred_vendor: '',
    notes: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selectedVehicle = vehicles.find(v => String(v.id) === String(form.vehicle_id))

  const mut = useMutation({
    mutationFn: createRequisition,
    onSuccess: (res) => {
      toast.success(`Maintenance requisition ${res.data.reference_number} submitted.`)
      qc.invalidateQueries({ queryKey: ['requisitions'] })
      onClose()
    },
    onError: e => toast.error(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Failed to submit.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.vehicle_id) { toast.error('Please select a vehicle.'); return }
    if (!form.service_type) { toast.error('Please select a service type.'); return }

    const v = selectedVehicle
    const vehicleLabel = [v?.vehicle_no, v?.vehicle_name].filter(Boolean).join(' — ')
    const svcLabel = form.service_type === 'Other' ? form.other_service_type : form.service_type

    const lines = [
      form.problem_description && `Problem: ${form.problem_description}`,
      form.defects_observed    && `Defects: ${form.defects_observed}`,
      form.location            && `Location / Site: ${form.location}`,
      form.odometer_hours      && `Current Odometer / Hours: ${form.odometer_hours}`,
      form.last_service_date   && `Last Service Date: ${form.last_service_date}`,
      form.last_service_reading && `Last Service Reading: ${form.last_service_reading}`,
      form.parts_required      && `Parts / Materials Required: ${form.parts_required}`,
      form.estimated_cost      && `Estimated Cost (KES): ${form.estimated_cost}`,
      form.preferred_vendor    && `Preferred Vendor / Garage: ${form.preferred_vendor}`,
      form.reported_by         && `Reported By: ${form.reported_by}`,
      form.notes               && `Additional Notes: ${form.notes}`,
    ].filter(Boolean)

    const payload = {
      title: `${svcLabel} — ${vehicleLabel}`,
      req_type: 'repair_maintenance',
      priority: form.priority,
      date_required: form.date_required || today,
      description: lines.join('\n'),
      fleet_vehicle_no: selectedVehicle?.vehicle_no || '',
      items: [{
        description: `${svcLabel} for ${vehicleLabel}`,
        quantity: 1,
        unit: 'job',
        unit_price: form.estimated_cost ? parseFloat(form.estimated_cost) : 0,
      }],
    }
    mut.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <WrenchScrewdriverIcon className="h-4 w-4 text-white/70" />
            <div>
              <h2 className="text-white font-bold text-base">Maintenance Requisition</h2>
              <p className="text-white/50 text-xs mt-0.5">Request service, maintenance or repair for a vehicle / machine</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Vehicle selection */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vehicle / Machine</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Select Vehicle / Machine *</label>
                <select required className={inp} value={form.vehicle_id} onChange={e => set('vehicle_id', e.target.value)}>
                  <option value="">— Select —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_no}{v.vehicle_name ? ` — ${v.vehicle_name}` : ''}{v.make || v.model_name ? ` (${[v.make, v.model_name].filter(Boolean).join(' ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selectedVehicle && (
                <div className="col-span-2 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-gray-500">Reg / ID</span><p className="font-bold text-brand-slate">{selectedVehicle.vehicle_no}</p></div>
                  <div><span className="text-gray-500">Make & Model</span><p className="font-medium text-gray-700">{[selectedVehicle.make, selectedVehicle.model_name].filter(Boolean).join(' ') || '—'}</p></div>
                  <div><span className="text-gray-500">Current Site</span><p className="font-medium text-gray-700">{selectedVehicle.current_site || selectedVehicle.last_location || '—'}</p></div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Current Location / Site</label>
                <input className={inp} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Njambini Site" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Odometer / Hours Reading</label>
                <input className={inp} value={form.odometer_hours} onChange={e => set('odometer_hours', e.target.value)} placeholder="e.g. 12,450 km or 3,200 hrs" />
              </div>
            </div>
          </div>

          {/* Service details */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Service Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Type of Service / Repair *</label>
                <select required className={inp} value={form.service_type} onChange={e => set('service_type', e.target.value)}>
                  <option value="">— Select service type —</option>
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {form.service_type === 'Other' && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Specify Service Type *</label>
                  <input required className={inp} value={form.other_service_type} onChange={e => set('other_service_type', e.target.value)} placeholder="Describe the service type" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Priority / Urgency *</label>
                <select className={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {URGENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date Required By</label>
                <input type="date" className={inp} value={form.date_required} onChange={e => set('date_required', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Problem Description *</label>
                <textarea required rows={3} className={`${inp} resize-none`} value={form.problem_description}
                  onChange={e => set('problem_description', e.target.value)}
                  placeholder="Describe the fault, symptoms, or what needs to be done in detail…" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Defects / Observations</label>
                <textarea rows={2} className={`${inp} resize-none`} value={form.defects_observed}
                  onChange={e => set('defects_observed', e.target.value)}
                  placeholder="List any observed defects, warning lights, unusual sounds, leaks, etc." />
              </div>
            </div>
          </div>

          {/* Service history */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Service History</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last Service Date</label>
                <input type="date" className={inp} value={form.last_service_date} onChange={e => set('last_service_date', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last Service Odometer / Hours</label>
                <input className={inp} value={form.last_service_reading} onChange={e => set('last_service_reading', e.target.value)} placeholder="e.g. 11,000 km or 3,000 hrs" />
              </div>
            </div>
          </div>

          {/* Cost & vendor */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Parts & Cost</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Parts / Materials Required</label>
                <textarea rows={2} className={`${inp} resize-none`} value={form.parts_required}
                  onChange={e => set('parts_required', e.target.value)}
                  placeholder="List any specific parts, fluids, or materials needed…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Cost (KES)</label>
                <input type="number" min="0" step="0.01" className={inp} value={form.estimated_cost}
                  onChange={e => set('estimated_cost', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Vendor / Garage</label>
                <input className={inp} value={form.preferred_vendor} onChange={e => set('preferred_vendor', e.target.value)} placeholder="e.g. CMC Motors, local garage" />
              </div>
            </div>
          </div>

          {/* Reported by & notes */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Additional Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reported By</label>
                <input className={inp} value={form.reported_by} onChange={e => set('reported_by', e.target.value)} placeholder="Name of person reporting" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Additional Notes</label>
                <textarea rows={2} className={`${inp} resize-none`} value={form.notes}
                  onChange={e => set('notes', e.target.value)} placeholder="Any other relevant information…" />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0 justify-end">
          <button type="button" onClick={onClose} className="px-4 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={mut.isPending}
            className="flex items-center gap-1.5 px-5 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90">
            <ClipboardDocumentListIcon className="h-3.5 w-3.5" />
            {mut.isPending ? 'Submitting…' : 'Submit Maintenance Requisition'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VehiclesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { canWrite } = usePermissions()
  const [search, setSearch]           = useState('')
  const [catFilter, setCatFilter]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [showSync, setShowSync]       = useState(false)
  const [showMaintReq, setShowMaintReq] = useState(false)
  const [form, setForm]               = useState(EMPTY)
  const [sortKey, setSortKey]         = useState('asset_no')
  const [page, setPage]               = useState(1)
  const PAGE_SIZE = 12

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['fleet-vehicles'],
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

  const resetPage = () => setPage(1)

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

  // Pagination
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Group by normalised category (from current page slice)
  const grouped = {}
  paged.forEach(v => {
    const cat = normCat(v.asset_category) || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(v)
  })
  const groupOrder = ['Plant Machines','Vehicles','Canters & Trucks','Prime Movers','Movers & Trailers','Tippers','Other']

  function PageNav() {
    if (totalPages <= 1) return null
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    return (
      <div className="flex items-center justify-between py-2 px-1">
        <p className="text-xs text-gray-500">
          Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors">
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </button>
          {pages.map(n => (
            <button key={n} onClick={() => setPage(n)}
              className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors
                ${safePage === n ? 'bg-brand-red text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {n}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors">
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Vehicles & Machinery</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            {totalCount} total · {liveCount} GPS-tracked · {warnCount > 0 && <span className="text-red-500 font-medium">{warnCount} compliance issues</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-brand-slate text-xs font-semibold rounded-xl hover:border-gray-400 transition-colors">
            <PrinterIcon className="h-3.5 w-3.5" /> Print
          </button>

          <button onClick={() => setShowMaintReq(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity">
            <WrenchScrewdriverIcon className="h-3.5 w-3.5" /> Maintenance Request
          </button>
          {canWrite('fleet') && (
            <>
              <button onClick={() => setShowSync(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-brand-slate text-xs font-semibold rounded-xl hover:border-gray-400 transition-colors">
                <ArrowPathIcon className="h-3.5 w-3.5" /> Sync from Assets
              </button>
              <button onClick={() => setShowForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity">
                <PlusIcon className="h-3.5 w-3.5" /> Add Vehicle
              </button>
            </>
          )}
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
          <button key={label} onClick={() => { setStatusFilter(f => f === filter ? '' : filter); resetPage() }}
            className={`${bg} rounded-xl px-4 py-2 text-left transition-all border ${statusFilter===filter ? 'border-brand-red shadow-sm' : 'border-transparent'}`}>
            <p className={`text-lg font-bold leading-none ${color}`}>{val}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* ── Filters bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-gray-100 rounded-xl px-4 py-2.5">
        {/* Category filter */}
        <div className="flex gap-1 flex-wrap flex-1">
          <button onClick={() => { setCatFilter(''); resetPage() }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${!catFilter ? 'bg-brand-slate text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            All
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => { setCatFilter(c => c === cat ? '' : cat); resetPage() }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${catFilter === cat ? 'bg-brand-red text-white border-brand-red' : `${CAT_COLOR[cat]||'bg-gray-50 text-gray-600 border-gray-200'} hover:opacity-80`}`}>
              {cat}
            </button>
          ))}
        </div>
        {/* Sort + Search */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs text-gray-600">
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
            <input value={search} onChange={e => { setSearch(e.target.value); resetPage() }}
              placeholder="Search reg, make, site…"
              className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red w-44" />
          </div>
        </div>
      </div>

      {/* ── Add Vehicle Form ──────────────────────────────────────────────── */}
      {showForm && canWrite('fleet') && (
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
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type || 'text'} value={form[key]} onChange={e => field(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fuel Type</label>
              <select value={form.fuel_type} onChange={e => field('fuel_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                {['diesel','petrol','electric','hybrid'].map(t => (
                  <option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ERP Status</label>
              <select value={form.erp_status} onChange={e => field('erp_status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
                <option value="OPER">Operational</option>
                <option value="NON-OPER">Non-Operational</option>
                <option value="IDLE">Idle</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
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
          <p className="text-sm font-medium text-gray-600">No vehicles match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <PageNav />
          {(() => {
            let rowCounter = 0
            return groupOrder.filter(g => grouped[g]?.length).map(groupName => (
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
                    <th className="px-4 py-2 text-left font-semibold text-gray-600 w-6">#</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600 w-24">Reg / ID</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Description</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Make & Model</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Location</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-600">GPS</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Compliance</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {grouped[groupName].map(v => {
                    rowCounter++
                    const rowNum     = rowCounter
                    const compIssues = (v.compliance||[]).filter(c => c.status==='expired'||c.status==='not_in_system'||c.status==='expiring_soon')
                    const hasWarn    = compIssues.length > 0 || v.erp_status === 'NON-OPER'
                    const location   = v.current_site || v.last_location || '—'
                    return (
                      <tr key={v.id}
                        onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                        className={`cursor-pointer transition-colors hover:bg-gray-50 ${hasWarn ? 'bg-red-50/30' : ''}`}>
                        {/* # */}
                        <td className="px-4 py-3 text-gray-500 font-mono text-[11px]">{rowNum}</td>
                        {/* Reg */}
                        <td className="px-4 py-3">
                          <span className="font-bold text-brand-slate">{v.vehicle_no}</span>
                        </td>
                        {/* Description */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{v.vehicle_name || '—'}</p>
                          {v.chassis_number && v.chassis_number !== 'N/A' && (
                            <p className="text-[10px] text-gray-600 mt-0.5">{v.chassis_number}</p>
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
                          ) : <span className="text-gray-600">—</span>}
                        </td>
                        {/* GPS */}
                        <td className="px-4 py-3 text-center">
                          {v.is_live ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <LiveIcon />
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLS[v.last_status||'']||'bg-gray-100 text-gray-600'}`}>
                                {STATUS_LABEL[v.last_status] || 'Unknown'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <OfflineIcon />
                              <span className="text-[9px] text-gray-600">Untracked</span>
                            </div>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          {v.erp_status ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ERP_CLS[v.erp_status]||'bg-gray-100 text-gray-600'}`}>
                              {ERP_LABEL[v.erp_status]||v.erp_status}
                            </span>
                          ) : <span className="text-gray-600 text-[10px]">—</span>}
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
                        {/* Actions */}
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => { setShowMaintReq(v.id) }}
                            title="Request Maintenance"
                            className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors">
                            <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))
          })()}
          <PageNav />
        </div>
      )}

      {showSync && <SyncModal onClose={() => setShowSync(false)} qc={qc} />}
      {showMaintReq && (
        <MaintenanceReqModal
          vehicles={vehicles}
          preselectedVehicleId={typeof showMaintReq === 'string' ? showMaintReq : ''}
          onClose={() => setShowMaintReq(false)}
        />
      )}
    </div>
  )
}
