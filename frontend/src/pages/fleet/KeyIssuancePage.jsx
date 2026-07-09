import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  PlusIcon, KeyIcon, ArrowPathIcon, MagnifyingGlassIcon,
  ClockIcon, CheckCircleIcon, ExclamationTriangleIcon, EyeIcon,
} from '@heroicons/react/24/outline'
import api from '../../api/client'
import { getEmployees } from '../../api/hr'
import usePermissions from '../../hooks/usePermissions'

const getKeyIssuances   = (p) => api.get('/fleet/key-issuances/', { params: p })
const createKeyIssuance = (d) => api.post('/fleet/key-issuances/', d)
const updateKeyIssuance = (id, d) => api.patch(`/fleet/key-issuances/${id}/`, d)
const getVehicles       = (p) => api.get('/fleet/vehicles/', { params: p })

const DRIVER_POSITIONS = ['driver', 'equipment operator', 'machine operator', 'operator']

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'
const lbl = 'block text-xs font-medium text-gray-600 mb-1'

const FUEL_OPTS = [
  { value: 'full', label: 'Full' },
  { value: 'three_quarter', label: '3/4' },
  { value: 'half', label: '1/2' },
  { value: 'quarter', label: '1/4' },
  { value: 'empty', label: 'Empty' },
]

const REQUESTOR_ROLE_LABELS = {
  managing_director: 'Managing Director',
  hr_manager: 'HR Manager',
  admin_officer: 'Admin Officer',
  project_manager: 'Project Manager',
  site_manager: 'Site Manager',
  other: 'Other',
}

function CondPill({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[['ok', 'OK', 'bg-emerald-500'], ['not_ok', 'Fail', 'bg-red-500'], ['na', 'N/A', 'bg-gray-400']].map(([v, lbl, color]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${value === v ? `${color} text-white shadow-sm` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          {lbl}
        </button>
      ))}
    </div>
  )
}

function FuelPill({ value, onChange }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {FUEL_OPTS.map(({ value: v, label }) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${value === v ? 'bg-brand-slate text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

const BLANK_ISSUE = {
  vehicle: '',
  issued_to_name: '',
  requested_by_name: '',
  requested_by_role: 'other',
  destination: '',
  purpose: '',
  issue_datetime: '',
  expected_return_datetime: '',
  issue_mileage: '',
  pre_fuel_level: 'full',
  pre_engine_oil: 'ok',
  pre_tire_condition: 'ok',
  pre_body_condition: 'ok',
  pre_lights: 'ok',
  pre_brakes: 'ok',
  pre_wipers: 'ok',
  pre_notes: '',
}

const BLANK_RETURN = {
  actual_return_datetime: '',
  return_mileage: '',
  return_fuel_level: 'full',
  return_engine_oil: 'ok',
  return_tire_condition: 'ok',
  return_body_condition: 'ok',
  return_lights: 'ok',
  return_brakes: 'ok',
  return_wipers: 'ok',
  return_notes: '',
  delay_justification: '',
}

// ── Issue Key Modal ───────────────────────────────────────────────────────────
function IssueKeyModal({ vehicles, onClose, qc }) {
  const [form, setForm] = useState(BLANK_ISSUE)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => getEmployees({ page_size: 500, is_active: true }),
    select: r => {
      const list = r.data?.results ?? r.data ?? []
      return Array.isArray(list) ? list : []
    },
  })

  const mut = useMutation({
    mutationFn: createKeyIssuance,
    onSuccess: () => {
      toast.success('Vehicle release recorded.')
      qc.invalidateQueries({ queryKey: ['key-issuances'] })
      onClose()
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to record.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.issued_to_name.trim()) { toast.error('Driver / operator name is required.'); return }
    if (!form.destination.trim()) { toast.error('Destination is required.'); return }
    if (!form.issue_datetime) { toast.error('Issue date & time is required.'); return }
    if (!form.expected_return_datetime) { toast.error('Expected return date & time is required.'); return }
    const payload = { ...form }
    if (!payload.vehicle) delete payload.vehicle
    if (!payload.issue_mileage) delete payload.issue_mileage
    mut.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col">
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <KeyIcon className="h-4 w-4 text-white/70" />
            <div>
              <h2 className="text-white font-bold text-base">Vehicle Release — Issue Key</h2>
              <p className="text-white/50 text-xs mt-0.5">Record vehicle release, destination and pre-departure condition</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Vehicle & Assignment */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vehicle / Machine</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Vehicle / Machine (optional)</label>
                <select className={inp} value={form.vehicle} onChange={e => set('vehicle', e.target.value)}>
                  <option value="">— Select vehicle / machine —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_no}{v.vehicle_name ? ` — ${v.vehicle_name}` : ''}{v.make || v.model_name ? ` (${[v.make, v.model_name].filter(Boolean).join(' ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Issue Date & Time *</label>
                <input type="datetime-local" required className={inp} value={form.issue_datetime} onChange={e => set('issue_datetime', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Expected Return *</label>
                <input type="datetime-local" required className={inp} value={form.expected_return_datetime} onChange={e => set('expected_return_datetime', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Mileage at Issue (km)</label>
                <input type="number" className={inp} value={form.issue_mileage} onChange={e => set('issue_mileage', e.target.value)} placeholder="e.g. 45,200" />
              </div>
            </div>
          </div>

          {/* Personnel */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Personnel</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Issued To *</label>
                <select required className={inp} value={form.issued_to_name} onChange={e => set('issued_to_name', e.target.value)}>
                  <option value="">— Select employee —</option>
                  {allEmployees.map(e => (
                    <option key={e.id} value={`${e.first_name} ${e.last_name}`.trim()}>
                      {e.first_name} {e.last_name}{e.position_title ? ` — ${e.position_title}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Requested By *</label>
                <input required className={inp} value={form.requested_by_name} onChange={e => set('requested_by_name', e.target.value)} placeholder="Name of authorizing person (MD, HR, Admin…)" />
              </div>
            </div>
          </div>

          {/* Trip */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Trip Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Destination *</label>
                <input required className={inp} value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="e.g. Thika Road Site, Westlands Office" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Purpose</label>
                <textarea rows={2} className={`${inp} resize-none`} value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="Brief description of trip purpose" />
              </div>
            </div>
          </div>

          {/* Pre-departure Checklist */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pre-Departure Condition Check</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700 w-36">Fuel Level</span>
                <FuelPill value={form.pre_fuel_level} onChange={v => set('pre_fuel_level', v)} />
              </div>
              {[
                ['pre_engine_oil', 'Engine Oil'],
                ['pre_tire_condition', 'Tires'],
                ['pre_body_condition', 'Body / Frame'],
                ['pre_lights', 'Lights & Indicators'],
                ['pre_brakes', 'Brakes'],
                ['pre_wipers', 'Wipers & Mirrors'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 w-36">{label}</span>
                  <CondPill value={form[key]} onChange={v => set(key, v)} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pre-departure Notes</label>
                <textarea rows={2} className={`${inp} resize-none`} value={form.pre_notes} onChange={e => set('pre_notes', e.target.value)} placeholder="Any observations before departure…" />
              </div>
            </div>
          </div>

        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" form="issue-form" onClick={handleSubmit} disabled={mut.isPending}
            className="flex-1 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90">
            {mut.isPending ? 'Recording…' : 'Issue Key'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Record Return Modal ───────────────────────────────────────────────────────
function ReturnModal({ record, onClose, qc }) {
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const expected = record.expected_return_datetime ? new Date(record.expected_return_datetime) : null
  const isLate = expected && now > expected

  const [form, setForm] = useState({
    ...BLANK_RETURN,
    actual_return_datetime: localNow,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const mut = useMutation({
    mutationFn: (d) => updateKeyIssuance(record.id, { ...d, status: 'returned' }),
    onSuccess: () => {
      toast.success('Return recorded.')
      qc.invalidateQueries({ queryKey: ['key-issuances'] })
      onClose()
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to record return.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.actual_return_datetime) { toast.error('Return date & time is required.'); return }
    if (isLate && !form.delay_justification.trim()) { toast.error('Please provide justification for the late return.'); return }
    const payload = { ...form }
    if (!payload.return_mileage) delete payload.return_mileage
    mut.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col">
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ArrowPathIcon className="h-4 w-4 text-white/70" />
            <div>
              <h2 className="text-white font-bold text-base">Record Vehicle Return</h2>
              <p className="text-white/50 text-xs mt-0.5">
                {record.vehicle_label || 'Vehicle'} — Issued to {record.issued_to_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        {isLate && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 font-medium">
              This vehicle is overdue — expected back by {expected?.toLocaleString('en-KE')}. Justification is required.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Actual Return Date & Time *</label>
              <input type="datetime-local" required className={inp} value={form.actual_return_datetime} onChange={e => set('actual_return_datetime', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Mileage on Return (km)</label>
              <input type="number" className={inp} value={form.return_mileage} onChange={e => set('return_mileage', e.target.value)} placeholder="e.g. 45,420" />
            </div>
          </div>

          {/* Return Condition Check */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Return Condition Check</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700 w-36">Fuel Level</span>
                <FuelPill value={form.return_fuel_level} onChange={v => set('return_fuel_level', v)} />
              </div>
              {[
                ['return_engine_oil', 'Engine Oil'],
                ['return_tire_condition', 'Tires'],
                ['return_body_condition', 'Body / Frame'],
                ['return_lights', 'Lights & Indicators'],
                ['return_brakes', 'Brakes'],
                ['return_wipers', 'Wipers & Mirrors'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 w-36">{label}</span>
                  <CondPill value={form[key]} onChange={v => set(key, v)} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Return Notes</label>
                <textarea rows={2} className={`${inp} resize-none`} value={form.return_notes} onChange={e => set('return_notes', e.target.value)} placeholder="Any damage, issues or observations on return…" />
              </div>
            </div>
          </div>

          {/* Delay justification */}
          <div>
            <label className={`${lbl} ${isLate ? 'text-red-600 font-semibold' : ''}`}>
              Delay Justification {isLate && <span className="text-red-500">*</span>}
            </label>
            <textarea rows={3} className={`${inp} resize-none`} value={form.delay_justification}
              onChange={e => set('delay_justification', e.target.value)}
              placeholder={isLate ? 'Required — explain reason for late return…' : 'Optional — explain any delay or deviation…'} />
          </div>

        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={mut.isPending}
            className="flex-1 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90">
            {mut.isPending ? 'Recording…' : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── View Detail Modal ─────────────────────────────────────────────────────────
function DetailModal({ record, onClose }) {
  const fuelLabel = (v) => FUEL_OPTS.find(o => o.value === v)?.label || v || '—'
  const condLabel = (v) => ({ ok: 'OK', not_ok: 'FAIL', na: 'N/A' })[v] || '—'
  const condColor = (v) => ({ ok: 'text-emerald-600 bg-emerald-50', not_ok: 'text-red-600 bg-red-50', na: 'text-gray-500 bg-gray-100' })[v] || 'text-gray-500 bg-gray-100'

  const roleLabel = REQUESTOR_ROLE_LABELS[record.requested_by_role] || record.requested_by_role

  const printRecord = () => {
    const win = window.open('', '_blank')
    const expected = record.expected_return_datetime ? new Date(record.expected_return_datetime).toLocaleString('en-KE') : '—'
    const issued = new Date(record.issue_datetime).toLocaleString('en-KE')
    const returned = record.actual_return_datetime ? new Date(record.actual_return_datetime).toLocaleString('en-KE') : '—'
    const cond = (v) => ({ ok: 'OK', not_ok: 'FAIL', na: 'N/A' })[v] || '—'
    const fuel = (v) => FUEL_OPTS.find(o => o.value === v)?.label || v || '—'

    win.document.write(`<!DOCTYPE html><html><head><title>Key Issuance — ${record.vehicle_label || 'Vehicle'}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #222; }
      h1 { font-size: 15px; margin-bottom: 4px; }
      .sub { color: #888; font-size: 10px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
      th { background: #1a2332; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
      td { padding: 5px 8px; border-bottom: 1px solid #eee; }
      .ok { color: green; font-weight: bold; }
      .not_ok { color: red; font-weight: bold; }
      .na { color: gray; }
      .section { font-size: 10px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: 1px; margin: 14px 0 6px; }
      @media print { body { margin: 10mm; } }
    </style></head><body>
    <h1>Vehicle Vehicle Release Record</h1>
    <p class="sub">Lake Zone Enterprises Ltd — Fleet Management</p>
    <table>
      <tr><th colspan="4">Issue Details</th></tr>
      <tr><td><b>Vehicle</b></td><td>${record.vehicle_label || '—'}</td><td><b>Status</b></td><td>${record.status?.toUpperCase()}</td></tr>
      <tr><td><b>Issued To</b></td><td>${record.issued_to_name}</td><td><b>Issued At</b></td><td>${issued}</td></tr>
      <tr><td><b>Requested By</b></td><td>${record.requested_by_name}</td><td><b>Role</b></td><td>${roleLabel}</td></tr>
      <tr><td><b>Destination</b></td><td>${record.destination}</td><td><b>Expected Return</b></td><td>${expected}</td></tr>
      <tr><td><b>Purpose</b></td><td colspan="3">${record.purpose || '—'}</td></tr>
      <tr><td><b>Issue Mileage</b></td><td colspan="3">${record.issue_mileage ? record.issue_mileage + ' km' : '—'}</td></tr>
    </table>
    <p class="section">Pre-Departure Condition</p>
    <table>
      <tr><th>Item</th><th>Condition</th><th>Item</th><th>Condition</th></tr>
      <tr><td>Fuel Level</td><td>${fuel(record.pre_fuel_level)}</td><td>Engine Oil</td><td class="${record.pre_engine_oil}">${cond(record.pre_engine_oil)}</td></tr>
      <tr><td>Tires</td><td class="${record.pre_tire_condition}">${cond(record.pre_tire_condition)}</td><td>Body / Frame</td><td class="${record.pre_body_condition}">${cond(record.pre_body_condition)}</td></tr>
      <tr><td>Lights</td><td class="${record.pre_lights}">${cond(record.pre_lights)}</td><td>Brakes</td><td class="${record.pre_brakes}">${cond(record.pre_brakes)}</td></tr>
      <tr><td>Wipers</td><td class="${record.pre_wipers}">${cond(record.pre_wipers)}</td><td></td><td></td></tr>
      ${record.pre_notes ? `<tr><td><b>Notes</b></td><td colspan="3">${record.pre_notes}</td></tr>` : ''}
    </table>
    ${record.status === 'returned' ? `
    <p class="section">Return Details</p>
    <table>
      <tr><th colspan="4">Return Information</th></tr>
      <tr><td><b>Actual Return</b></td><td>${returned}</td><td><b>Return Mileage</b></td><td>${record.return_mileage ? record.return_mileage + ' km' : '—'}</td></tr>
    </table>
    <p class="section">Return Condition</p>
    <table>
      <tr><th>Item</th><th>Condition</th><th>Item</th><th>Condition</th></tr>
      <tr><td>Fuel Level</td><td>${fuel(record.return_fuel_level)}</td><td>Engine Oil</td><td class="${record.return_engine_oil}">${cond(record.return_engine_oil)}</td></tr>
      <tr><td>Tires</td><td class="${record.return_tire_condition}">${cond(record.return_tire_condition)}</td><td>Body</td><td class="${record.return_body_condition}">${cond(record.return_body_condition)}</td></tr>
      <tr><td>Lights</td><td class="${record.return_lights}">${cond(record.return_lights)}</td><td>Brakes</td><td class="${record.return_brakes}">${cond(record.return_brakes)}</td></tr>
      ${record.return_notes ? `<tr><td><b>Notes</b></td><td colspan="3">${record.return_notes}</td></tr>` : ''}
      ${record.delay_justification ? `<tr><td><b>Delay Reason</b></td><td colspan="3">${record.delay_justification}</td></tr>` : ''}
    </table>` : ''}
    <p style="margin-top:20px;font-size:10px;color:#aaa;">Generated: ${new Date().toLocaleString('en-KE')}</p>
    <script>window.onload=()=>{window.print()}</script>
    </body></html>`)
    win.document.close()
  }

  const CheckRow = ({ label, value, color }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-600">{label}</span>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${condColor(value)}`}>{condLabel(value)}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col">
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <KeyIcon className="h-4 w-4 text-white/70" />
            <div>
              <h2 className="text-white font-bold text-base">Vehicle Release Record</h2>
              <p className="text-white/50 text-xs mt-0.5">{record.vehicle_label || 'Vehicle'} — {record.issued_to_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Issue Info</p>
              <p><span className="text-gray-500">Issued To:</span> <span className="font-semibold">{record.issued_to_name}</span></p>
              <p><span className="text-gray-500">Requested By:</span> {record.requested_by_name} ({roleLabel})</p>
              <p><span className="text-gray-500">Issued At:</span> {new Date(record.issue_datetime).toLocaleString('en-KE')}</p>
              <p><span className="text-gray-500">Expected Return:</span> {record.expected_return_datetime ? new Date(record.expected_return_datetime).toLocaleString('en-KE') : '—'}</p>
              {record.issue_mileage && <p><span className="text-gray-500">Mileage:</span> {record.issue_mileage} km</p>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trip Info</p>
              <p><span className="text-gray-500">Destination:</span> <span className="font-semibold">{record.destination}</span></p>
              {record.purpose && <p><span className="text-gray-500">Purpose:</span> {record.purpose}</p>}
              {record.actual_return_datetime && (
                <p><span className="text-gray-500">Actual Return:</span> {new Date(record.actual_return_datetime).toLocaleString('en-KE')}</p>
              )}
              {record.return_mileage && <p><span className="text-gray-500">Return Mileage:</span> {record.return_mileage} km</p>}
              {record.delay_justification && (
                <p><span className="text-gray-500">Delay Reason:</span> <span className="text-amber-700">{record.delay_justification}</span></p>
              )}
            </div>
          </div>

          {/* Checklists side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/50 rounded-xl p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Pre-Departure</p>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-xs text-gray-600">Fuel Level</span>
                <span className="text-xs font-semibold text-brand-slate">{fuelLabel(record.pre_fuel_level)}</span>
              </div>
              <CheckRow label="Engine Oil" value={record.pre_engine_oil} />
              <CheckRow label="Tires" value={record.pre_tire_condition} />
              <CheckRow label="Body / Frame" value={record.pre_body_condition} />
              <CheckRow label="Lights" value={record.pre_lights} />
              <CheckRow label="Brakes" value={record.pre_brakes} />
              <CheckRow label="Wipers" value={record.pre_wipers} />
              {record.pre_notes && <p className="text-xs text-gray-500 mt-2 italic">{record.pre_notes}</p>}
            </div>

            <div className={`rounded-xl p-4 ${record.status === 'returned' ? 'bg-emerald-50/50' : 'bg-gray-50'}`}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">On Return</p>
              {record.status === 'returned' ? (
                <>
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="text-xs text-gray-600">Fuel Level</span>
                    <span className="text-xs font-semibold text-brand-slate">{fuelLabel(record.return_fuel_level)}</span>
                  </div>
                  <CheckRow label="Engine Oil" value={record.return_engine_oil} />
                  <CheckRow label="Tires" value={record.return_tire_condition} />
                  <CheckRow label="Body / Frame" value={record.return_body_condition} />
                  <CheckRow label="Lights" value={record.return_lights} />
                  <CheckRow label="Brakes" value={record.return_brakes} />
                  <CheckRow label="Wipers" value={record.return_wipers} />
                  {record.return_notes && <p className="text-xs text-gray-500 mt-2 italic">{record.return_notes}</p>}
                </>
              ) : (
                <p className="text-xs text-gray-400 italic mt-4 text-center">Vehicle not yet returned</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Close
          </button>
          <button onClick={printRecord}
            className="flex-1 bg-brand-slate text-white text-sm font-bold py-2.5 rounded-xl hover:opacity-90">
            Print Record
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ record }) {
  const isOverdue = record.is_overdue || (
    record.status === 'out' &&
    record.expected_return_datetime &&
    new Date() > new Date(record.expected_return_datetime)
  )
  if (record.status === 'returned') {
    return (
      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
        <CheckCircleIcon className="h-3 w-3" /> Returned
      </span>
    )
  }
  if (isOverdue) {
    return (
      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 animate-pulse">
        <ExclamationTriangleIcon className="h-3 w-3" /> Overdue
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
      <ClockIcon className="h-3 w-3" /> Out
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KeyIssuancePage() {
  const { canWrite, role } = usePermissions()
  const qc = useQueryClient()

  // facility_manager has fleet 'write' via permissions; MD views only; site_manager hidden
  const canIssue = canWrite('fleet')
  const isMDView = role === 'managing_director' || role === 'general_manager'

  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('')
  const [showIssue, setShowIssue]   = useState(false)
  const [returnRec, setReturnRec]   = useState(null)
  const [viewRec, setViewRec]       = useState(null)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['key-issuances', search, statusFilter],
    queryFn: () => getKeyIssuances({ search: search || undefined, status: statusFilter || undefined }),
    select: r => { const d = r.data?.results ?? r.data ?? []; return Array.isArray(d) ? d : [] },
  })

  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: async () => {
      let results = [], page = 1, hasMore = true
      while (hasMore) {
        const r = await getVehicles({ page_size: 200, page })
        const d = r.data?.results ?? (Array.isArray(r.data) ? r.data : [])
        results = results.concat(d)
        hasMore = !!r.data?.next
        page++
      }
      return results
    },
  })

  const outCount      = records.filter(r => r.status === 'out').length
  const overdueCount  = records.filter(r => r.is_overdue || (r.status === 'out' && r.expected_return_datetime && new Date() > new Date(r.expected_return_datetime))).length
  const returnedCount = records.filter(r => r.status === 'returned').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand-slate">Vehicle Release Log</h1>
          <p className="text-xs text-gray-500 mt-0.5">Track vehicle & machine key releases and vehicle returns</p>
        </div>
        {canIssue && (
          <button onClick={() => setShowIssue(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
            <PlusIcon className="h-4 w-4" /> Issue Key
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{outCount}</p>
          <p className="text-xs text-gray-600 mt-0.5">Currently Out</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
          <p className="text-xs text-gray-600 mt-0.5">Overdue</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{returnedCount}</p>
          <p className="text-xs text-gray-600 mt-0.5">Returned</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search driver, destination, reg…"
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white w-64" />
        </div>
        <div className="flex gap-1.5">
          {[['', 'All'], ['out', 'Out'], ['returned', 'Returned']].map(([v, l]) => (
            <button key={v} onClick={() => setStatus(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                ${statusFilter === v ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-2">{[1,2,3].map(i => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <KeyIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold">No Vehicle Releases Found</p>
            {canIssue && <p className="text-xs mt-1">Click "Issue Key" to record a new vehicle release.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Vehicle / Machine', 'Driver / Operator', 'Requested By', 'Destination', 'Issued', 'Exp. Return', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map(r => {
                  const isOverdue = r.is_overdue || (r.status === 'out' && r.expected_return_datetime && new Date() > new Date(r.expected_return_datetime))
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-brand-slate whitespace-nowrap">{r.vehicle_label || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{r.issued_to_name}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <div>{r.requested_by_name}</div>
                        <div className="text-[10px] text-gray-400 capitalize">{REQUESTOR_ROLE_LABELS[r.requested_by_role] || r.requested_by_role}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{r.destination}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(r.issue_datetime).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className={`px-4 py-3 whitespace-nowrap ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                        {r.expected_return_datetime ? new Date(r.expected_return_datetime).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge record={r} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setViewRec(r)} title="View"
                            className="p-1.5 rounded-lg bg-gray-100 text-brand-slate hover:bg-brand-slate hover:text-white">
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {r.status !== 'returned' && canIssue && (
                            <button onClick={() => setReturnRec(r)} title="Record Return"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold hover:bg-emerald-200">
                              <ArrowPathIcon className="h-3 w-3" /> Return
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showIssue && <IssueKeyModal vehicles={vehicles} onClose={() => setShowIssue(false)} qc={qc} />}
      {returnRec && <ReturnModal record={returnRec} onClose={() => setReturnRec(null)} qc={qc} />}
      {viewRec && <DetailModal record={viewRec} onClose={() => setViewRec(null)} />}
    </div>
  )
}
