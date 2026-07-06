import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon, PrinterIcon, MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline'
import api from '../../api/client'
import useAuthStore from '../../store/authStore'

const getReceivingForms = (p) => api.get('/fleet/receiving/', { params: p })
const createReceivingForm = (d) => api.post('/fleet/receiving/', d)
const updateReceivingForm = (id, d) => api.patch(`/fleet/receiving/${id}/`, d)

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'

const CHECKLIST_ITEMS = [
  { key: 'engine_oil_level',       label: 'Engine Oil Level' },
  { key: 'brake_system',           label: 'Brake System' },
  { key: 'steering_suspension',    label: 'Steering & Suspension' },
  { key: 'headlights_indicators',  label: 'Headlights / Indicators' },
  { key: 'tires_condition',        label: 'Tires Condition' },
  { key: 'battery_condition',      label: 'Battery Condition' },
  { key: 'cooling_system',         label: 'Cooling System' },
  { key: 'fuel_system',            label: 'Fuel System' },
  { key: 'exhaust_system',         label: 'Exhaust System' },
  { key: 'body_frame_condition',   label: 'Body / Frame / Rust / Damage' },
  { key: 'wipers_washers_mirrors', label: 'Wipers / Washers / Mirrors' },
  { key: 'horn',                   label: 'Horn' },
  { key: 'tipping_hydraulic_system', label: 'Tipping Hydraulic System' },
]

const DEFAULT_SPARE_PARTS = [
  { name: 'Hydraulic Jack & Handle', quantity: '' },
  { name: 'Spare Wheel',             quantity: '' },
  { name: 'Life Saver',              quantity: '' },
  { name: 'First Aid Box',           quantity: '' },
  { name: 'Fire Extinguisher',       quantity: '' },
  { name: 'Wheel Spanner',           quantity: '' },
]

const DEFAULT_TOOLS = [
  { name: 'Ball Pein Hammer',          quantity: '' },
  { name: 'Screw Driver / Set',         quantity: '' },
  { name: 'Adjustable Spanner 250mm',  quantity: '' },
  { name: 'Hand Grease Gun',           quantity: '' },
  { name: 'Masonry Pliers',            quantity: '' },
  { name: 'Fixed Spanners (10-12)',     quantity: '' },
  { name: 'Fixed Spanners (14-17)',     quantity: '' },
  { name: 'Fixed Spanners (19-22)',     quantity: '' },
  { name: 'Fixed Spanners (24-27)',     quantity: '' },
]

const BLANK_FORM = {
  vehicle_make_model:     '',
  registration_number:    '',
  chassis_number:         '',
  date_of_inspection:     new Date().toISOString().slice(0, 10),
  log_number:             '',
  mileage:                '',
  // checklist
  engine_oil_level:       'ok',
  brake_system:           'ok',
  steering_suspension:    'ok',
  headlights_indicators:  'ok',
  tires_condition:        'ok',
  battery_condition:      'ok',
  cooling_system:         'ok',
  fuel_system:            'ok',
  exhaust_system:         'ok',
  body_frame_condition:   'ok',
  wipers_washers_mirrors: 'ok',
  horn:                   'ok',
  tipping_hydraulic_system: 'na',
  inspection_notes:       '',
  // compliance
  compliance_certificate:        'ok',
  compliance_certificate_expiry: '',
  insurance_expiry:              '',
  speed_governor_expiry:         '',
  mv_inspection_cert:            'present',
  mv_inspection_cert_expiry:     '',
  // spare parts & tools
  spare_parts: DEFAULT_SPARE_PARTS.map(r => ({ ...r })),
  tools:       DEFAULT_TOOLS.map(r => ({ ...r })),
  notes: '',
}

// ── Checklist pill ────────────────────────────────────────────────────────────

function CheckPill({ value, onChange }) {
  const opts = [
    { v: 'ok',     label: 'OK',    cls: 'bg-green-100 text-green-700 border-green-300' },
    { v: 'not_ok', label: 'Fail',  cls: 'bg-red-100 text-red-700 border-red-300' },
    { v: 'na',     label: 'N/A',   cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  ]
  return (
    <div className="flex gap-1">
      {opts.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all
            ${value === o.v ? o.cls + ' ring-1 ring-offset-1 ring-current' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── JSON list editor (spare parts / tools) ────────────────────────────────────

function ListEditor({ rows, onChange, label }) {
  const set = (i, k, v) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r)
    onChange(next)
  }
  const add = () => onChange([...rows, { name: '', quantity: '' }])
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_100px_32px] gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1">
        <span>Item</span><span>Qty</span><span />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_100px_32px] gap-1 items-center">
          <input className={inp} value={row.name} onChange={e => set(i, 'name', e.target.value)} placeholder={`${label} name`} />
          <input className={inp} value={row.quantity} onChange={e => set(i, 'quantity', e.target.value)} placeholder="e.g. 1pc" />
          <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs text-brand-red font-semibold hover:underline">+ Add row</button>
    </div>
  )
}

// ── Vehicle Receiving Form Modal ──────────────────────────────────────────────

function ReceivingFormModal({ onClose, editData }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(editData ? {
    ...editData,
    compliance_certificate_expiry: editData.compliance_certificate_expiry || '',
    insurance_expiry:              editData.insurance_expiry || '',
    speed_governor_expiry:         editData.speed_governor_expiry || '',
    mv_inspection_cert_expiry:     editData.mv_inspection_cert_expiry || '',
    spare_parts: editData.spare_parts?.length ? editData.spare_parts : DEFAULT_SPARE_PARTS.map(r => ({ ...r })),
    tools:       editData.tools?.length       ? editData.tools       : DEFAULT_TOOLS.map(r => ({ ...r })),
  } : { ...BLANK_FORM, spare_parts: DEFAULT_SPARE_PARTS.map(r => ({ ...r })), tools: DEFAULT_TOOLS.map(r => ({ ...r })) })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveMut = useMutation({
    mutationFn: (d) => editData ? updateReceivingForm(editData.id, d) : createReceivingForm(d),
    onSuccess: () => {
      toast.success(editData ? 'Form updated' : 'Vehicle receiving form submitted')
      qc.invalidateQueries({ queryKey: ['vehicle-receiving'] })
      onClose()
    },
    onError: e => {
      const d = e.response?.data
      toast.error(d?.detail || JSON.stringify(d) || 'Failed to save')
    },
  })

  const handleSubmit = () => {
    if (!form.vehicle_make_model.trim() || !form.registration_number.trim() || !form.date_of_inspection) {
      toast.error('Vehicle make/model, registration number and date are required')
      return
    }
    const payload = {
      ...form,
      mileage: form.mileage !== '' ? Number(form.mileage) : null,
      compliance_certificate_expiry: form.compliance_certificate_expiry || null,
      insurance_expiry:              form.insurance_expiry || null,
      speed_governor_expiry:         form.speed_governor_expiry || null,
      mv_inspection_cert_expiry:     form.mv_inspection_cert_expiry || null,
    }
    saveMut.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[96vh] flex flex-col">

        {/* Header */}
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Vehicle Receiving Form</h2>
            <p className="text-white/50 text-xs mt-0.5">Fill in all sections and submit</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-7">

          {/* Section 1 — Vehicle Details */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pb-1 border-b border-gray-100">
              1. Vehicle Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vehicle Make / Model <span className="text-brand-red">*</span></label>
                <input className={inp} value={form.vehicle_make_model}
                  onChange={e => set('vehicle_make_model', e.target.value)} placeholder="e.g. ISUZU FVZ (Tipper)" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Registration Number <span className="text-brand-red">*</span></label>
                <input className={inp} value={form.registration_number}
                  onChange={e => set('registration_number', e.target.value.toUpperCase())} placeholder="e.g. KBY 469D" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Chassis Number</label>
                <input className={inp} value={form.chassis_number}
                  onChange={e => set('chassis_number', e.target.value.toUpperCase())} placeholder="VIN / chassis no." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Date of Inspection <span className="text-brand-red">*</span></label>
                <input type="date" className={inp} value={form.date_of_inspection}
                  onChange={e => set('date_of_inspection', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Log Number</label>
                <input className={inp} value={form.log_number}
                  onChange={e => set('log_number', e.target.value)} placeholder="e.g. ADH434" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mileage (km)</label>
                <input type="number" min="0" className={inp} value={form.mileage}
                  onChange={e => set('mileage', e.target.value)} placeholder="Current odometer reading" />
              </div>
            </div>
          </section>

          {/* Section 2 — Inspection Checklist */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pb-1 border-b border-gray-100">
              2. Inspection & Maintenance Checklist
            </h3>
            <div className="space-y-2.5">
              {CHECKLIST_ITEMS.map((item, idx) => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-gray-700 min-w-0">
                    <span className="text-gray-400 mr-1.5 font-mono">{String(idx + 1).padStart(2, '0')}.</span>
                    {item.label}
                  </span>
                  <CheckPill value={form[item.key]} onChange={v => set(item.key, v)} />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Inspection Notes</label>
              <textarea rows={2} className={`${inp} resize-none`} value={form.inspection_notes}
                onChange={e => set('inspection_notes', e.target.value)}
                placeholder="Any issues observed during inspection…" />
            </div>
          </section>

          {/* Section 3 — Spare Parts */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pb-1 border-b border-gray-100">
              3. Spare Parts
            </h3>
            <ListEditor rows={form.spare_parts} onChange={v => set('spare_parts', v)} label="Part" />
          </section>

          {/* Section 4 — Compliance Certificates */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pb-1 border-b border-gray-100">
              4. Compliance Certificates
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Compliance Certificate</label>
                  <CheckPill value={form.compliance_certificate} onChange={v => set('compliance_certificate', v)} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" className={inp} value={form.compliance_certificate_expiry}
                    onChange={e => set('compliance_certificate_expiry', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Insurance Expiry</label>
                  <input type="date" className={inp} value={form.insurance_expiry}
                    onChange={e => set('insurance_expiry', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Speed Governor Expiry</label>
                  <input type="date" className={inp} value={form.speed_governor_expiry}
                    onChange={e => set('speed_governor_expiry', e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Motor Vehicle Inspection Certificate</label>
                  <div className="flex gap-2">
                    {[['present', 'Present'], ['not_found', 'Not Found'], ['expired', 'Expired']].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => set('mv_inspection_cert', v)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all
                          ${form.mv_inspection_cert === v
                            ? v === 'present' ? 'bg-green-100 text-green-700 border-green-300 ring-1 ring-offset-1 ring-green-400'
                              : v === 'expired' ? 'bg-red-100 text-red-700 border-red-300 ring-1 ring-offset-1 ring-red-400'
                              : 'bg-amber-100 text-amber-700 border-amber-300 ring-1 ring-offset-1 ring-amber-400'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">MV Cert Expiry</label>
                  <input type="date" className={inp} value={form.mv_inspection_cert_expiry}
                    onChange={e => set('mv_inspection_cert_expiry', e.target.value)} />
                </div>
              </div>
            </div>
          </section>

          {/* Section 5 — Tools */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pb-1 border-b border-gray-100">
              5. Tools
            </h3>
            <ListEditor rows={form.tools} onChange={v => set('tools', v)} label="Tool" />
          </section>

          {/* Additional Notes */}
          <section>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Additional Notes</label>
            <textarea rows={2} className={`${inp} resize-none`} value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Any other observations…" />
          </section>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={handleSubmit} disabled={saveMut.isPending}
            className="flex-1 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90">
            {saveMut.isPending ? 'Submitting…' : editData ? 'Update Form' : 'Submit Receiving Form'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Print View ────────────────────────────────────────────────────────────────

function PrintView({ form, onClose }) {
  const printRef = useRef(null)

  const handlePrint = () => {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=900,height=700')
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vehicle Receiving Form — ${form.registration_number}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
          h1 { font-size: 15px; font-weight: 700; text-align: center; margin-bottom: 4px; }
          .sub { font-size: 10px; text-align: center; color: #555; margin-bottom: 14px; }
          h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin: 14px 0 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 10px; }
          th { background: #f3f3f3; font-weight: 700; }
          .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 700; }
          .ok { background: #d1fae5; color: #065f46; }
          .not_ok { background: #fee2e2; color: #991b1b; }
          .na { background: #f3f4f6; color: #6b7280; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
          .field { margin-bottom: 4px; }
          .label { font-size: 9px; color: #666; font-weight: 700; text-transform: uppercase; }
          .value { font-size: 11px; font-weight: 600; }
          .sig { border-top: 1px solid #ccc; margin-top: 30px; padding-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
          .sig-line { border-bottom: 1px solid #333; height: 20px; margin-bottom: 4px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const badge = (v) => {
    const map = { ok: 'OK ✓', not_ok: 'FAIL ✗', na: 'N/A' }
    return `<span class="badge ${v}">${map[v] || v}</span>`
  }

  const checklistHtml = CHECKLIST_ITEMS.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.label}</td>
      <td>${badge(form[item.key])}</td>
    </tr>
  `).join('')

  const sparesHtml = (form.spare_parts || []).filter(r => r.name).map((r, i) => `
    <tr><td>${i + 1}</td><td>${r.name}</td><td>${r.quantity || '—'}</td></tr>
  `).join('')

  const toolsHtml = (form.tools || []).filter(r => r.name).map((r, i) => `
    <tr><td>${i + 1}</td><td>${r.name}</td><td>${r.quantity || '—'}</td></tr>
  `).join('')

  const mvCertMap = { present: 'Present ✓', not_found: 'Not Found', expired: 'Expired' }
  const checkBadge = (v) => v === 'ok' ? badge('ok') : badge(v)

  const printHtml = `
    <h1>VEHICLE RECEIVING FORM</h1>
    <p class="sub">Generated by Lakezone ERP &nbsp;|&nbsp; ${new Date().toLocaleString()}</p>

    <h2>1. Vehicle Details</h2>
    <div class="grid2">
      <div class="field"><div class="label">Make / Model</div><div class="value">${form.vehicle_make_model}</div></div>
      <div class="field"><div class="label">Registration No.</div><div class="value">${form.registration_number}</div></div>
      <div class="field"><div class="label">Chassis Number</div><div class="value">${form.chassis_number || '—'}</div></div>
      <div class="field"><div class="label">Date of Inspection</div><div class="value">${fmtDate(form.date_of_inspection)}</div></div>
      <div class="field"><div class="label">Log Number</div><div class="value">${form.log_number || '—'}</div></div>
      <div class="field"><div class="label">Mileage</div><div class="value">${form.mileage ? Number(form.mileage).toLocaleString() + ' km' : '—'}</div></div>
    </div>

    <h2>2. Inspection & Maintenance Checklist</h2>
    <table>
      <thead><tr><th>#</th><th>Item</th><th>Status</th></tr></thead>
      <tbody>${checklistHtml}</tbody>
    </table>
    ${form.inspection_notes ? `<p style="font-size:10px;color:#555;margin-top:4px;"><strong>Notes:</strong> ${form.inspection_notes}</p>` : ''}

    <h2>3. Spare Parts</h2>
    <table>
      <thead><tr><th>#</th><th>Item</th><th>Quantity</th></tr></thead>
      <tbody>${sparesHtml || '<tr><td colspan="3" style="color:#999">None recorded</td></tr>'}</tbody>
    </table>

    <h2>4. Compliance Certificates</h2>
    <table>
      <thead><tr><th>Certificate</th><th>Status</th><th>Expiry</th></tr></thead>
      <tbody>
        <tr><td>Compliance Certificate</td><td>${checkBadge(form.compliance_certificate)}</td><td>${fmtDate(form.compliance_certificate_expiry)}</td></tr>
        <tr><td>Insurance</td><td>—</td><td>${fmtDate(form.insurance_expiry)}</td></tr>
        <tr><td>Speed Governor</td><td>—</td><td>${fmtDate(form.speed_governor_expiry)}</td></tr>
        <tr><td>MV Inspection Certificate</td><td><span class="badge ${form.mv_inspection_cert === 'present' ? 'ok' : form.mv_inspection_cert === 'expired' ? 'not_ok' : 'na'}">${mvCertMap[form.mv_inspection_cert] || '—'}</span></td><td>${fmtDate(form.mv_inspection_cert_expiry)}</td></tr>
      </tbody>
    </table>

    <h2>5. Tools</h2>
    <table>
      <thead><tr><th>#</th><th>Item</th><th>Quantity</th></tr></thead>
      <tbody>${toolsHtml || '<tr><td colspan="3" style="color:#999">None recorded</td></tr>'}</tbody>
    </table>

    ${form.notes ? `<h2>Additional Notes</h2><p style="font-size:11px;">${form.notes}</p>` : ''}

    <div class="sig">
      <div>
        <div class="sig-line"></div>
        <div style="font-size:10px;font-weight:700;">Submitted By</div>
        <div style="font-size:10px;color:#555;">${form.submitted_by_name || '—'}</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div style="font-size:10px;font-weight:700;">Approved By (MD)</div>
      </div>
    </div>
  `

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[96vh] flex flex-col">

        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Vehicle Receiving Form</h2>
            <p className="text-white/50 text-xs mt-0.5">{form.registration_number} — {form.vehicle_make_model}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {/* Hidden div for print content */}
          <div ref={printRef} style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: printHtml }} />

          {/* Screen preview */}
          <div className="space-y-5">

            {/* Vehicle Details */}
            <section>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">1. Vehicle Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ['Make / Model', form.vehicle_make_model],
                  ['Registration', form.registration_number],
                  ['Chassis No.', form.chassis_number || '—'],
                  ['Date of Inspection', form.date_of_inspection ? new Date(form.date_of_inspection).toLocaleDateString('en-KE') : '—'],
                  ['Log Number', form.log_number || '—'],
                  ['Mileage', form.mileage ? `${Number(form.mileage).toLocaleString()} km` : '—'],
                ].map(([l, v]) => (
                  <div key={l} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">{l}</p>
                    <p className="text-xs font-bold text-brand-slate mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Checklist */}
            <section>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">2. Inspection Checklist</h3>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                {CHECKLIST_ITEMS.map((item, i) => {
                  const val = form[item.key]
                  const cls = val === 'ok' ? 'bg-green-100 text-green-700' : val === 'not_ok' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                  const lbl = val === 'ok' ? 'OK ✓' : val === 'not_ok' ? 'FAIL' : 'N/A'
                  return (
                    <div key={item.key} className={`flex items-center justify-between px-4 py-2.5 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <span className="text-xs text-gray-700"><span className="text-gray-400 font-mono mr-1">{String(i + 1).padStart(2, '0')}.</span>{item.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>{lbl}</span>
                    </div>
                  )
                })}
              </div>
              {form.inspection_notes && <p className="text-xs text-gray-600 mt-2 italic">{form.inspection_notes}</p>}
            </section>

            {/* Spare Parts */}
            {(form.spare_parts || []).some(r => r.name) && (
              <section>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">3. Spare Parts</h3>
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left font-semibold text-gray-600">#</th><th className="px-3 py-2 text-left font-semibold text-gray-600">Item</th><th className="px-3 py-2 text-left font-semibold text-gray-600">Qty</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {form.spare_parts.filter(r => r.name).map((r, i) => (
                      <tr key={i}><td className="px-3 py-2 text-gray-400">{i + 1}</td><td className="px-3 py-2 font-medium text-gray-800">{r.name}</td><td className="px-3 py-2 text-gray-600">{r.quantity || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Compliance */}
            <section>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">4. Compliance Certificates</h3>
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left font-semibold text-gray-600">Certificate</th><th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th><th className="px-3 py-2 text-left font-semibold text-gray-600">Expiry</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    ['Compliance Certificate', form.compliance_certificate, form.compliance_certificate_expiry],
                    ['Insurance', null, form.insurance_expiry],
                    ['Speed Governor', null, form.speed_governor_expiry],
                    ['MV Inspection Certificate', form.mv_inspection_cert, form.mv_inspection_cert_expiry],
                  ].map(([label, status, expiry]) => (
                    <tr key={label}>
                      <td className="px-3 py-2 text-gray-700">{label}</td>
                      <td className="px-3 py-2">
                        {status && (
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            status === 'ok' || status === 'present' ? 'bg-green-100 text-green-700' :
                            status === 'not_ok' || status === 'expired' ? 'bg-red-100 text-red-700' :
                            status === 'not_found' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {status === 'ok' ? 'OK ✓' : status === 'not_ok' ? 'FAIL' : status === 'present' ? 'Present ✓' : status === 'not_found' ? 'Not Found' : status === 'expired' ? 'Expired' : 'N/A'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{expiry ? new Date(expiry).toLocaleDateString('en-KE') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Tools */}
            {(form.tools || []).some(r => r.name) && (
              <section>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">5. Tools</h3>
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left font-semibold text-gray-600">#</th><th className="px-3 py-2 text-left font-semibold text-gray-600">Item</th><th className="px-3 py-2 text-left font-semibold text-gray-600">Qty</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {form.tools.filter(r => r.name).map((r, i) => (
                      <tr key={i}><td className="px-3 py-2 text-gray-400">{i + 1}</td><td className="px-3 py-2 font-medium text-gray-800">{r.name}</td><td className="px-3 py-2 text-gray-600">{r.quantity || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {form.notes && (
              <section>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Additional Notes</h3>
                <p className="text-xs text-gray-600">{form.notes}</p>
              </section>
            )}

            <div className="flex items-center gap-3 text-xs text-gray-400 border-t border-gray-100 pt-3">
              <span>Submitted by: <strong className="text-gray-700">{form.submitted_by_name || '—'}</strong></span>
              {form.created_at && <span>on <strong className="text-gray-700">{new Date(form.created_at).toLocaleString('en-KE')}</strong></span>}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={handlePrint}
            className="flex items-center gap-2 flex-1 justify-center bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl hover:opacity-90">
            <PrinterIcon className="h-4 w-4" /> Print Form
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const SITE_MANAGER_ROLES = new Set([
  'site_manager', 'site_engineer', 'site_foreman', 'project_manager',
])
const MD_ROLES = new Set(['managing_director', 'md', 'ceo', 'director', 'system_admin'])

export default function VehicleReceivingPage() {
  const user = useAuthStore(s => s.user)
  const role = user?.role || ''
  const canReceive = SITE_MANAGER_ROLES.has(role) || MD_ROLES.has(role)
  const isViewer   = MD_ROLES.has(role)

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [viewForm, setViewForm] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['vehicle-receiving', search],
    queryFn: () => getReceivingForms(search ? { registration_number: search } : {}),
    select: r => r.data?.results ?? r.data ?? [],
  })

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand-slate">Vehicle Receiving</h1>
          <p className="text-xs text-gray-500 mt-0.5">Record and review vehicle receiving inspection forms</p>
        </div>
        {canReceive && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
            <PlusIcon className="h-4 w-4" /> Receive Vehicle
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by registration…"
          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-2">{[1,2,3].map(i => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : forms.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-sm font-semibold">No Vehicle Received Yet</p>
            {canReceive && <p className="text-xs mt-1">Click "Receive Vehicle" to record one.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Date', 'Registration', 'Make / Model', 'Log No.', 'Mileage', 'Submitted By', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {forms.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {f.date_of_inspection ? new Date(f.date_of_inspection).toLocaleDateString('en-KE') : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-brand-slate">{f.registration_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{f.vehicle_make_model}</td>
                    <td className="px-4 py-3 text-gray-600">{f.log_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{f.mileage ? `${Number(f.mileage).toLocaleString()} km` : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{f.submitted_by_name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setViewForm(f)}
                          className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                          <EyeIcon className="h-3.5 w-3.5" /> View
                        </button>
                        {!isViewer && (
                          <button onClick={() => setEditForm(f)}
                            className="px-2 py-1 text-xs border border-blue-200 rounded hover:bg-blue-50 text-blue-700">
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && <ReceivingFormModal onClose={() => setShowForm(false)} />}
      {editForm  && <ReceivingFormModal editData={editForm} onClose={() => setEditForm(null)} />}
      {viewForm  && <PrintView form={viewForm} onClose={() => setViewForm(null)} />}
    </div>
  )
}
