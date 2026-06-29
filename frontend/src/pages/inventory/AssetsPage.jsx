import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  PlusIcon, BuildingOfficeIcon, WrenchScrewdriverIcon,
  CurrencyDollarIcon, CheckCircleIcon, ExclamationTriangleIcon,
  ShieldCheckIcon, DocumentTextIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { getAssets, createAsset, updateAsset, getAssetDashboard } from '../../api/inventory'
import useAuthStore from '../../store/authStore'
import api from '../../api/client'

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEW_ALL_READONLY = [
  'managing_director', 'finance_officer', 'finance_manager',
  'admin_officer', 'general_manager',
]

const CATEGORY_OPTIONS = [
  { value: 'machinery',      label: 'Machinery & Plant',              color: 'bg-orange-100 text-orange-700' },
  { value: 'vehicles',       label: 'Vehicles (Cars/SUVs/Double Cabs)', color: 'bg-purple-100 text-purple-700' },
  { value: 'trucks_tracks',  label: 'Trucks & Tracks',               color: 'bg-red-100 text-red-700' },
  { value: 'it_equipment',   label: 'IT Equipment',                   color: 'bg-blue-100 text-blue-700' },
  { value: 'furniture',      label: 'Furniture & Fittings',           color: 'bg-amber-100 text-amber-700' },
  { value: 'office_equipment', label: 'Office Equipment',             color: 'bg-cyan-100 text-cyan-700' },
  { value: 'tools',          label: 'Tools & Equipment',              color: 'bg-green-100 text-green-700' },
  { value: 'communication',  label: 'Communication Equipment',        color: 'bg-pink-100 text-pink-700' },
  { value: 'safety',         label: 'Safety Equipment',               color: 'bg-rose-100 text-rose-700' },
  { value: 'other',          label: 'Other',                          color: 'bg-gray-100 text-gray-600' },
]

const STATUS_OPTIONS = [
  { value: 'operational',    label: 'Operational',    color: 'bg-green-100 text-green-700' },
  { value: 'functional',     label: 'Functional',     color: 'bg-teal-100 text-teal-700' },
  { value: 'non_operational',label: 'Non-Operational',color: 'bg-red-100 text-red-700' },
  { value: 'undetermined',   label: 'Undetermined',   color: 'bg-gray-100 text-gray-500' },
  { value: 'active',         label: 'Active',         color: 'bg-green-100 text-green-700' },
  { value: 'under_repair',   label: 'Under Repair',   color: 'bg-amber-100 text-amber-700' },
  { value: 'disposed',       label: 'Disposed',       color: 'bg-gray-100 text-gray-500' },
  { value: 'lost',           label: 'Lost',            color: 'bg-red-100 text-red-700' },
]

const CERT_STATUS_OPTIONS = [
  { value: '',             label: '— Select —' },
  { value: 'valid',        label: 'Valid' },
  { value: 'expired',      label: 'Expired' },
  { value: 'not_in_system',label: 'Not in System' },
]

const CONDITION_OPTIONS = ['new', 'good', 'fair', 'poor', 'condemned']

const EMPTY = {
  name: '', category: 'machinery', serial_number: '', make_model: '',
  purchase_date: '', purchase_value: '', current_value: '',
  condition: 'good', status: 'operational', location: '', assigned_to: '',
  notes: '', current_defects: '', requirements: '',
  // machinery
  hours_to_next_service: '',
  // vehicles & trucks
  registration_plate: '', kms_to_next_service: '',
  // insurance
  insurance_expiry: '', insurance_cert_number: '', insurance_policy_number: '',
  insurance_policy_type: '', insurance_insurer: '', insurance_chassis_number: '',
  insurance_commencement_date: '',
  // inspection
  inspection_cert_number: '', inspection_cert_status: '',
  inspection_cert_issue_date: '', inspection_cert_expiry: '',
  inspection_issuing_authority: '',
  // speed governor
  speed_governor_cert_number: '', speed_governor_cert_status: '',
  speed_governor_device_serial: '', speed_governor_cert_issue_date: '',
  speed_governor_cert_expiry: '', speed_governor_issuing_authority: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function certBadge(expiry, status) {
  if (status === 'expired') return 'bg-red-100 text-red-700'
  if (status === 'not_in_system') return 'bg-gray-100 text-gray-500'
  if (!expiry) return 'bg-gray-100 text-gray-400'
  const days = Math.ceil((new Date(expiry) - new Date()) / 86400000)
  if (days < 0) return 'bg-red-100 text-red-700'
  if (days <= 30) return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

function daysLabel(expiry) {
  if (!expiry) return null
  const days = Math.ceil((new Date(expiry) - new Date()) / 86400000)
  if (days < 0) return `Expired ${Math.abs(days)}d ago`
  if (days === 0) return 'Expires today'
  return `${days}d left`
}

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600', purple: 'bg-purple-50 text-purple-600', red: 'bg-red-50 text-red-600' }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${colors[color]}`}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-bold text-brand-slate">{value}</p>
      </div>
    </div>
  )
}

// ── Asset Modal ────────────────────────────────────────────────────────────────

function AssetModal({ asset, deptName, onClose }) {
  const isEdit = !!asset
  const [form, setForm] = useState(isEdit ? {
    ...EMPTY,
    name: asset.name, category: asset.category,
    serial_number: asset.serial_number || '', make_model: asset.make_model || '',
    purchase_date: asset.purchase_date || '', purchase_value: asset.purchase_value || '',
    current_value: asset.current_value || '', condition: asset.condition,
    status: asset.status, location: asset.location || '',
    assigned_to: asset.assigned_to || '', notes: asset.notes || '',
    current_defects: asset.current_defects || '', requirements: asset.requirements || '',
    hours_to_next_service: asset.hours_to_next_service ?? '',
    registration_plate: asset.registration_plate || '',
    kms_to_next_service: asset.kms_to_next_service ?? '',
    insurance_expiry: asset.insurance_expiry || '',
    insurance_cert_number: asset.insurance_cert_number || '',
    insurance_policy_number: asset.insurance_policy_number || '',
    insurance_policy_type: asset.insurance_policy_type || '',
    insurance_insurer: asset.insurance_insurer || '',
    insurance_chassis_number: asset.insurance_chassis_number || '',
    insurance_commencement_date: asset.insurance_commencement_date || '',
    inspection_cert_number: asset.inspection_cert_number || '',
    inspection_cert_status: asset.inspection_cert_status || '',
    inspection_cert_issue_date: asset.inspection_cert_issue_date || '',
    inspection_cert_expiry: asset.inspection_cert_expiry || '',
    inspection_issuing_authority: asset.inspection_issuing_authority || '',
    speed_governor_cert_number: asset.speed_governor_cert_number || '',
    speed_governor_cert_status: asset.speed_governor_cert_status || '',
    speed_governor_device_serial: asset.speed_governor_device_serial || '',
    speed_governor_cert_issue_date: asset.speed_governor_cert_issue_date || '',
    speed_governor_cert_expiry: asset.speed_governor_cert_expiry || '',
    speed_governor_issuing_authority: asset.speed_governor_issuing_authority || '',
  } : { ...EMPTY })

  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: isEdit ? d => updateAsset(asset.id, d) : createAsset,
    onSuccess: () => {
      toast.success(isEdit ? 'Asset updated' : 'Asset added')
      qc.invalidateQueries(['assets'])
      qc.invalidateQueries(['asset-dashboard'])
      onClose()
    },
    onError: e => toast.error(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Failed'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red'
  const isMachinery = form.category === 'machinery'
  const isVehicle = form.category === 'vehicles'
  const isTruck = form.category === 'trucks_tracks'
  const needsInsurance = isVehicle || isTruck
  const needsTruckCerts = isTruck

  const handleSave = () => {
    const payload = { ...form }
    if (!isEdit) payload.department = deptName
    ;['purchase_value', 'current_value', 'hours_to_next_service', 'kms_to_next_service'].forEach(k => {
      if (payload[k] === '') payload[k] = null
    })
    ;['purchase_date', 'insurance_expiry', 'insurance_commencement_date',
      'inspection_cert_issue_date', 'inspection_cert_expiry',
      'speed_governor_cert_issue_date', 'speed_governor_cert_expiry'].forEach(k => {
      if (payload[k] === '') payload[k] = null
    })
    mut.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-brand-slate">{isEdit ? 'Edit Asset' : 'Add Asset'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {deptName && (
            <div className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <BuildingOfficeIcon className="h-3.5 w-3.5" /> {deptName}
            </div>
          )}

          {/* Section: Basic Info */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                <input required className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. CAT Excavator, Toyota Hilux KDW 277S" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category *</label>
                <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Make / Model</label>
                <input className={inp} value={form.make_model} onChange={e => set('make_model', e.target.value)} placeholder="e.g. CAT 320D, Toyota Hilux 2.8" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Serial Number</label>
                <input className={inp} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Location / Site</label>
                <input className={inp} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Njambini Site, Head Office" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label>
                <input className={inp} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Condition</label>
                <select className={inp} value={form.condition} onChange={e => set('condition', e.target.value)}>
                  {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Date</label>
                <input type="date" className={inp} value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Value (KES)</label>
                <input type="number" min="0" className={inp} value={form.purchase_value} onChange={e => set('purchase_value', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Current Value (KES)</label>
                <input type="number" min="0" className={inp} value={form.current_value} onChange={e => set('current_value', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section: Machinery */}
          {isMachinery && (
            <div>
              <h3 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <WrenchScrewdriverIcon className="h-3.5 w-3.5" /> Machine Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Hours to Next Service</label>
                  <input type="number" min="0" step="0.1" className={inp} value={form.hours_to_next_service}
                    onChange={e => set('hours_to_next_service', e.target.value)} placeholder="e.g. 250" />
                </div>
              </div>
            </div>
          )}

          {/* Section: Vehicle / Truck Details */}
          {(isVehicle || isTruck) && (
            <div>
              <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <DocumentTextIcon className="h-3.5 w-3.5" /> Vehicle Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Registration Plate *</label>
                  <input className={inp} value={form.registration_plate} onChange={e => set('registration_plate', e.target.value.toUpperCase())} placeholder="e.g. KDW 277S" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Chassis Number</label>
                  <input className={inp} value={form.insurance_chassis_number} onChange={e => set('insurance_chassis_number', e.target.value.toUpperCase())} placeholder="e.g. ACVDSCJR3K4124443" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">KMs to Next Service</label>
                  <input type="number" min="0" className={inp} value={form.kms_to_next_service}
                    onChange={e => set('kms_to_next_service', e.target.value)} placeholder="e.g. 5000" />
                </div>
              </div>
            </div>
          )}

          {/* Section: Insurance Certificate */}
          {needsInsurance && (
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ShieldCheckIcon className="h-3.5 w-3.5" /> Insurance Certificate
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Certificate No.</label>
                  <input className={inp} value={form.insurance_cert_number} onChange={e => set('insurance_cert_number', e.target.value)} placeholder="e.g. C32524396" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Policy No.</label>
                  <input className={inp} value={form.insurance_policy_number} onChange={e => set('insurance_policy_number', e.target.value)} placeholder="e.g. 4010701016398202" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Policy Type</label>
                  <input className={inp} value={form.insurance_policy_type} onChange={e => set('insurance_policy_type', e.target.value)} placeholder="e.g. Comprehensive, Third Party" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Insurer</label>
                  <input className={inp} value={form.insurance_insurer} onChange={e => set('insurance_insurer', e.target.value)} placeholder="e.g. Old Mutual General Insurance" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Commencement Date</label>
                  <input type="date" className={inp} value={form.insurance_commencement_date} onChange={e => set('insurance_commencement_date', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date</label>
                  <input type="date" className={inp} value={form.insurance_expiry} onChange={e => set('insurance_expiry', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Section: Inspection Certificate */}
          {needsTruckCerts && (
            <div className="border border-amber-100 rounded-xl p-4 bg-amber-50/30">
              <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <DocumentTextIcon className="h-3.5 w-3.5" /> Inspection Certificate
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Certificate No.</label>
                  <input className={inp} value={form.inspection_cert_number} onChange={e => set('inspection_cert_number', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select className={inp} value={form.inspection_cert_status} onChange={e => set('inspection_cert_status', e.target.value)}>
                    {CERT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Issuing Authority</label>
                  <input className={inp} value={form.inspection_issuing_authority} onChange={e => set('inspection_issuing_authority', e.target.value)} placeholder="e.g. NTSA" />
                </div>
                <div />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Issue Date</label>
                  <input type="date" className={inp} value={form.inspection_cert_issue_date} onChange={e => set('inspection_cert_issue_date', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date</label>
                  <input type="date" className={inp} value={form.inspection_cert_expiry} onChange={e => set('inspection_cert_expiry', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Section: Speed Governor Certificate */}
          {needsTruckCerts && (
            <div className="border border-green-100 rounded-xl p-4 bg-green-50/30">
              <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ShieldCheckIcon className="h-3.5 w-3.5" /> Speed Governor Certificate
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Certificate No.</label>
                  <input className={inp} value={form.speed_governor_cert_number} onChange={e => set('speed_governor_cert_number', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select className={inp} value={form.speed_governor_cert_status} onChange={e => set('speed_governor_cert_status', e.target.value)}>
                    {CERT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Device Serial No.</label>
                  <input className={inp} value={form.speed_governor_device_serial} onChange={e => set('speed_governor_device_serial', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Issuing Authority</label>
                  <input className={inp} value={form.speed_governor_issuing_authority} onChange={e => set('speed_governor_issuing_authority', e.target.value)} placeholder="e.g. NTSA" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Issue Date</label>
                  <input type="date" className={inp} value={form.speed_governor_cert_issue_date} onChange={e => set('speed_governor_cert_issue_date', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date</label>
                  <input type="date" className={inp} value={form.speed_governor_cert_expiry} onChange={e => set('speed_governor_cert_expiry', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Section: Defects & Requirements */}
          <div>
            <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" /> Defects & Requirements
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Current Defects</label>
                <textarea rows={3} className={`${inp} resize-none`} value={form.current_defects}
                  onChange={e => set('current_defects', e.target.value)}
                  placeholder="List any known defects, one per line…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Requirements / Parts Needed</label>
                <textarea rows={3} className={`${inp} resize-none`} value={form.requirements}
                  onChange={e => set('requirements', e.target.value)}
                  placeholder="List required parts, services, or actions, one per line…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Additional Notes</label>
                <textarea rows={2} className={`${inp} resize-none`} value={form.notes}
                  onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3">
          <button onClick={handleSave} disabled={mut.isPending || !form.name}
            className="flex-1 bg-brand-red text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-60">
            {mut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Asset'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Asset Detail Card (expanded view) ─────────────────────────────────────────

function AssetCard({ asset, canEdit, onEdit }) {
  const cat = CATEGORY_OPTIONS.find(c => c.value === asset.category)
  const st = STATUS_OPTIONS.find(s => s.value === asset.status)
  const isTruck = asset.category === 'trucks_tracks'
  const isVehicle = asset.category === 'vehicles'
  const isMachine = asset.category === 'machinery'
  const needsInsurance = isVehicle || isTruck

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-400">{asset.asset_code}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat?.color}`}>{cat?.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st?.color}`}>{st?.label ?? asset.status}</span>
          </div>
          <p className="font-bold text-brand-slate mt-0.5">{asset.name}</p>
          {asset.registration_plate && (
            <p className="text-xs text-gray-500 font-mono mt-0.5">{asset.registration_plate}</p>
          )}
        </div>
        {canEdit && (
          <button onClick={() => onEdit(asset)}
            className="flex-shrink-0 text-xs text-brand-red border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 font-medium">
            Edit
          </button>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Basic details */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {asset.make_model && <Row label="Make/Model" value={asset.make_model} />}
          {asset.serial_number && <Row label="Serial No." value={asset.serial_number} />}
          {asset.location && <Row label="Location" value={asset.location} />}
          {asset.assigned_to && <Row label="Assigned To" value={asset.assigned_to} />}
          {asset.department && <Row label="Department" value={asset.department} />}
          {asset.purchase_value > 0 && <Row label="Purchase Value" value={`KES ${Number(asset.purchase_value).toLocaleString()}`} />}
          {asset.current_value > 0 && <Row label="Current Value" value={`KES ${Number(asset.current_value).toLocaleString()}`} />}
        </div>

        {/* Machine: hours */}
        {isMachine && asset.hours_to_next_service != null && (
          <div className="bg-orange-50 rounded-lg px-3 py-2 text-xs">
            <span className="text-orange-600 font-medium">⏱ Hours to Next Service: </span>
            <span className="font-bold text-orange-700">{asset.hours_to_next_service} hrs</span>
          </div>
        )}

        {/* Vehicle: kms */}
        {(isVehicle || isTruck) && asset.kms_to_next_service != null && (
          <div className="bg-purple-50 rounded-lg px-3 py-2 text-xs">
            <span className="text-purple-600 font-medium">🛣 KMs to Next Service: </span>
            <span className="font-bold text-purple-700">{Number(asset.kms_to_next_service).toLocaleString()} km</span>
          </div>
        )}

        {/* Certificates */}
        {needsInsurance && (
          <div className="space-y-2">
            <CertRow
              title="Insurance"
              certNo={asset.insurance_cert_number}
              policyNo={asset.insurance_policy_number}
              policyType={asset.insurance_policy_type}
              insurer={asset.insurance_insurer}
              commencement={asset.insurance_commencement_date}
              expiry={asset.insurance_expiry}
              status={null}
            />
            {isTruck && (
              <>
                <CertRow
                  title="Inspection"
                  certNo={asset.inspection_cert_number}
                  authority={asset.inspection_issuing_authority}
                  issued={asset.inspection_cert_issue_date}
                  expiry={asset.inspection_cert_expiry}
                  status={asset.inspection_cert_status}
                />
                <CertRow
                  title="Speed Governor"
                  certNo={asset.speed_governor_cert_number}
                  deviceSerial={asset.speed_governor_device_serial}
                  authority={asset.speed_governor_issuing_authority}
                  issued={asset.speed_governor_cert_issue_date}
                  expiry={asset.speed_governor_cert_expiry}
                  status={asset.speed_governor_cert_status}
                />
              </>
            )}
          </div>
        )}

        {/* Defects */}
        {asset.current_defects && (
          <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs">
            <p className="text-red-700 font-semibold mb-1 flex items-center gap-1">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" /> Defects
            </p>
            <p className="text-red-600 whitespace-pre-line">{asset.current_defects}</p>
          </div>
        )}

        {/* Requirements */}
        {asset.requirements && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">
            <p className="text-amber-700 font-semibold mb-1">📋 Requirements</p>
            <p className="text-amber-600 whitespace-pre-line">{asset.requirements}</p>
          </div>
        )}

        {/* Notes */}
        {asset.notes && (
          <p className="text-xs text-gray-500 italic">{asset.notes}</p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <>
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-medium">{value}</span>
    </>
  )
}

function CertRow({ title, certNo, policyNo, policyType, insurer, commencement, issued, expiry, status, authority, deviceSerial }) {
  const badge = certBadge(expiry, status)
  const days = daysLabel(expiry)
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${badge.includes('red') ? 'border-red-200 bg-red-50' : badge.includes('amber') ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`font-bold ${badge.includes('red') ? 'text-red-700' : badge.includes('amber') ? 'text-amber-700' : 'text-green-700'}`}>
          🛡 {title} Certificate
        </span>
        {days && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge}`}>{days}</span>}
        {status && !days && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge}`}>{status.replace('_', ' ')}</span>}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-600">
        {certNo && <><span className="text-gray-400">Cert No.</span><span className="font-mono">{certNo}</span></>}
        {policyNo && <><span className="text-gray-400">Policy No.</span><span className="font-mono">{policyNo}</span></>}
        {policyType && <><span className="text-gray-400">Type</span><span>{policyType}</span></>}
        {insurer && <><span className="text-gray-400">Insurer</span><span>{insurer}</span></>}
        {deviceSerial && <><span className="text-gray-400">Device Serial</span><span className="font-mono">{deviceSerial}</span></>}
        {authority && <><span className="text-gray-400">Authority</span><span>{authority}</span></>}
        {commencement && <><span className="text-gray-400">From</span><span>{commencement}</span></>}
        {issued && <><span className="text-gray-400">Issued</span><span>{issued}</span></>}
        {expiry && <><span className="text-gray-400">Expires</span><span className="font-semibold">{expiry}</span></>}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const user = useAuthStore(s => s.user)
  const role = user?.role || ''
  const canEdit = role === 'system_admin' || !VIEW_ALL_READONLY.includes(role)
  const canViewAll = role === 'system_admin' || VIEW_ALL_READONLY.includes(role)

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedDept, setSelectedDept] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editAsset, setEditAsset] = useState(null)
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/auth/departments/').then(r => r.data?.results ?? r.data ?? []),
    enabled: canViewAll,
  })

  const assetParams = { page_size: 500 }
  if (filterCategory) assetParams.category = filterCategory
  if (filterStatus) assetParams.status = filterStatus
  if (canViewAll && selectedDept) assetParams.department = selectedDept

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', assetParams],
    queryFn: () => getAssets(assetParams),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: dashboard } = useQuery({
    queryKey: ['asset-dashboard'],
    queryFn: () => getAssetDashboard().then(r => r.data),
  })

  const filtered = assets.filter(a =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.asset_code.toLowerCase().includes(search.toLowerCase()) ||
    (a.registration_plate || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.assigned_to || '').toLowerCase().includes(search.toLowerCase())
  )

  // Expiring certificates within 30 days
  const expiringCerts = assets.filter(a => {
    const check = (d) => { if (!d) return false; const days = Math.ceil((new Date(d) - new Date()) / 86400000); return days >= 0 && days <= 30 }
    return check(a.insurance_expiry) || check(a.inspection_cert_expiry) || check(a.speed_governor_cert_expiry)
  })

  const ownDeptName = user?.department_name || ''

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand-slate">Assets</h1>
          <p className="text-xs text-gray-400 mt-0.5">Fixed assets register — machines, vehicles & trucks</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}
            className="px-3 py-1.5 border border-gray-200 text-xs rounded-xl hover:bg-gray-50 text-gray-600">
            {viewMode === 'cards' ? 'Table View' : 'Card View'}
          </button>
          {canEdit && (
            <button onClick={() => { setEditAsset(null); setShowModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
              <PlusIcon className="h-4 w-4" /> Add Asset
            </button>
          )}
        </div>
      </div>

      {/* Department tabs */}
      {canViewAll ? (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500">Dept:</span>
          <button onClick={() => setSelectedDept(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!selectedDept ? 'bg-brand-slate text-white border-brand-slate' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            All
          </button>
          {departments.map(d => (
            <button key={d.id} onClick={() => setSelectedDept(d.name)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedDept === d.name ? 'bg-brand-slate text-white border-brand-slate' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {d.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border bg-blue-50 border-blue-200 text-blue-700">
          <BuildingOfficeIcon className="h-4 w-4 flex-shrink-0" />
          <span>{ownDeptName || 'Your Department'} — Department Assets</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={BuildingOfficeIcon} label="Total Assets" value={filtered.length} color="blue" />
        <StatCard icon={CurrencyDollarIcon} label="Current Value (KES)"
          value={(Number(dashboard?.total_current_value || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })} color="green" />
        <StatCard icon={CheckCircleIcon} label="Operational" value={filtered.filter(a => a.status === 'operational' || a.status === 'active').length} color="purple" />
        <StatCard icon={WrenchScrewdriverIcon} label="Under Repair / Non-Op" value={filtered.filter(a => a.status === 'under_repair' || a.status === 'non_operational').length} color="amber" />
        <StatCard icon={ExclamationTriangleIcon} label="Certs Expiring Soon" value={expiringCerts.length} color="red" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, plate, assigned to…"
          className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red w-52" />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red">
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span className="ml-auto text-xs text-gray-400">{filtered.length} asset{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <BuildingOfficeIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No assets found.</p>
          {canEdit && (
            <button onClick={() => setShowModal(true)} className="mt-3 text-xs text-brand-red font-medium hover:underline">
              + Add your first asset
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(asset => (
            <AssetCard key={asset.id} asset={asset} canEdit={canEdit} onEdit={a => { setEditAsset(a); setShowModal(true) }} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['Code', 'Name', 'Plate', 'Category', 'Dept', 'Status', 'Insurance Expiry', 'Inspection Expiry', 'Gov. Cert Expiry', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(asset => {
                const cat = CATEGORY_OPTIONS.find(c => c.value === asset.category)
                const st = STATUS_OPTIONS.find(s => s.value === asset.status)
                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-mono text-gray-400">{asset.asset_code}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{asset.name}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-500">{asset.registration_plate || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat?.color}`}>{cat?.label ?? asset.category}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{asset.department}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st?.color}`}>{st?.label ?? asset.status}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {asset.insurance_expiry
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${certBadge(asset.insurance_expiry, null)}`}>{asset.insurance_expiry}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {asset.inspection_cert_expiry
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${certBadge(asset.inspection_cert_expiry, asset.inspection_cert_status)}`}>{asset.inspection_cert_expiry}</span>
                        : asset.inspection_cert_status
                          ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${certBadge(null, asset.inspection_cert_status)}`}>{asset.inspection_cert_status.replace('_', ' ')}</span>
                          : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {asset.speed_governor_cert_expiry
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${certBadge(asset.speed_governor_cert_expiry, asset.speed_governor_cert_status)}`}>{asset.speed_governor_cert_expiry}</span>
                        : asset.speed_governor_cert_status
                          ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${certBadge(null, asset.speed_governor_cert_status)}`}>{asset.speed_governor_cert_status.replace('_', ' ')}</span>
                          : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEdit && (
                        <button onClick={() => { setEditAsset(asset); setShowModal(true) }}
                          className="text-xs text-brand-red hover:underline font-medium">Edit</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AssetModal
          asset={editAsset}
          deptName={editAsset?.department ?? ownDeptName}
          onClose={() => { setShowModal(false); setEditAsset(null) }}
        />
      )}
    </div>
  )
}
