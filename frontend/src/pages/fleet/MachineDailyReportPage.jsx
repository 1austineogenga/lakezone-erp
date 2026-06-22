import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { getVehicle } from '../../api/fleet'
import { printMachineDaily } from '../../utils/print'

const HOUR_CATS = ['Hours Idle', 'Hours Worked', 'Hrs Breakdown', 'Hrs Standby', 'Fuel Used (Ltrs)', 'Fuel Balance (Ltrs)']
const MAINT_ITEMS = ['Engine oil check', 'Filter check', 'Greasing/lubrication', 'Tyre/track inspection', 'Hydraulic check', 'Coolant level']

function Field({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30"
      />
    </div>
  )
}

function Textarea({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <textarea
        rows={2}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none"
      />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h3 className="text-xs font-bold text-brand-slate">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export default function MachineDailyReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: vehicle } = useQuery({
    queryKey: ['fleet-vehicle', id],
    queryFn: () => getVehicle(id),
    select: r => r.data,
  })

  // ── header fields ─────────────────────────────────────────────────
  const [header, setHeader] = useState({
    project_name: '', contract_no: '', site_section: '', date: '',
    machine_type: '', fuel_type: '', primary_operator: '',
  })
  const h = (key) => (val) => setHeader(p => ({ ...p, [key]: val }))

  // ── daily hours ───────────────────────────────────────────────────
  const [dailyHours, setDailyHours] = useState(() => {
    const hrs = {}
    HOUR_CATS.forEach(c => { hrs[c] = '' })
    return hrs
  })

  // ── works rows ────────────────────────────────────────────────────
  const blankWork = () => ({ no: '', location: '', description: '', unit: '', qty: '', remarks: '' })
  const [works, setWorks] = useState([blankWork(), blankWork(), blankWork(), blankWork(), blankWork()])
  const setWork = (i, key, val) => setWorks(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))

  // ── maintenance ───────────────────────────────────────────────────
  const initMaint = () => {
    const m = {}
    MAINT_ITEMS.forEach(item => { m[item] = { status: '', notes: '' } })
    return m
  }
  const [maint, setMaint] = useState(initMaint)
  const setMaintField = (item, key, val) =>
    setMaint(p => ({ ...p, [item]: { ...p[item], [key]: val } }))

  // ── breakdowns ────────────────────────────────────────────────────
  const blankBreak = () => ({ day: '', description: '', hrs_lost: '', action: '' })
  const [breakdowns, setBreakdowns] = useState([blankBreak(), blankBreak(), blankBreak()])
  const setBreak = (i, key, val) => setBreakdowns(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))

  // ── notes fields ──────────────────────────────────────────────────
  const [notes, setNotes] = useState({ issues: '', instructions: '', next_day: '' })
  const n = (key) => (val) => setNotes(p => ({ ...p, [key]: val }))

  // ── print ─────────────────────────────────────────────────────────
  const handlePrint = () => {
    printMachineDaily({
      ...header,
      machine_name: vehicle?.vehicle_name || '',
      machine_id: vehicle?.vehicle_no || '',
      daily_hours: dailyHours,
      works,
      maintenance: maint,
      breakdowns,
      issues: notes.issues,
      instructions: notes.instructions,
      next_day: notes.next_day,
    })
  }

  const inputCls = 'border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40'

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-brand-slate">
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-brand-slate text-lg">Machine Daily Report</h2>
          {vehicle && (
            <p className="text-xs text-gray-400 mt-0.5">
              {vehicle.vehicle_no} · {vehicle.vehicle_name}
            </p>
          )}
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:bg-brand-red/90 transition-colors">
          <PrinterIcon className="h-3.5 w-3.5" /> Download / Print
        </button>
      </div>

      {/* Machine / Equipment Identification */}
      <Section title="Machine / Equipment Identification">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Project Name" value={header.project_name} onChange={h('project_name')} />
          <Field label="Contract No." value={header.contract_no} onChange={h('contract_no')} />
          <Field label="Site / Section" value={header.site_section} onChange={h('site_section')} />
          <Field label="Date" value={header.date} onChange={h('date')} type="date" />
          <Field
            label="Machine Name"
            value={vehicle?.vehicle_name || ''}
            onChange={() => {}}
            className="opacity-70 pointer-events-none"
          />
          <Field label="Machine Type" value={header.machine_type} onChange={h('machine_type')} />
          <Field label="Fuel Type" value={header.fuel_type} onChange={h('fuel_type')} />
          <Field label="Primary Operator" value={header.primary_operator} onChange={h('primary_operator')} />
          <div className="text-xs text-gray-400 flex items-center gap-1 col-span-1">
            <span className="font-medium text-brand-slate">{vehicle?.vehicle_no}</span>
            <span>—</span>
            <span>{vehicle?.vehicle_name}</span>
          </div>
        </div>
      </Section>

      {/* Section A. Daily Hours */}
      <Section title="A. Daily Hours">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-500 w-48">Category</th>
                <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-500 text-center w-32">Hours</th>
              </tr>
            </thead>
            <tbody>
              {HOUR_CATS.map(cat => (
                <tr key={cat}>
                  <td className="border border-gray-200 px-3 py-1.5 font-medium text-brand-slate">{cat}</td>
                  <td className="border border-gray-200 p-1">
                    <input
                      value={dailyHours[cat]}
                      onChange={e => setDailyHours(p => ({ ...p, [cat]: e.target.value }))}
                      className={inputCls + ' text-center'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section B. Work Activities Executed */}
      <Section title="B. Work Activities Executed">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['No.', 'Location / Chainage', 'Description of Work', 'Unit', 'Qty', 'Remarks'].map(col => (
                  <th key={col} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-500">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {works.map((w, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 p-1 w-10">
                    <input value={w.no} onChange={e => setWork(i, 'no', e.target.value)} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={w.location} onChange={e => setWork(i, 'location', e.target.value)} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={w.description} onChange={e => setWork(i, 'description', e.target.value)} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1 w-16">
                    <input value={w.unit} onChange={e => setWork(i, 'unit', e.target.value)} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1 w-20">
                    <input value={w.qty} onChange={e => setWork(i, 'qty', e.target.value)} className={inputCls + ' text-right'} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={w.remarks} onChange={e => setWork(i, 'remarks', e.target.value)} className={inputCls} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setWorks(p => [...p, blankWork()])}
            className="mt-2 text-xs text-brand-red hover:underline">
            + Add row
          </button>
        </div>
      </Section>

      {/* Section C. Maintenance & Inspections */}
      <Section title="C. Maintenance &amp; Inspections">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Maintenance Item', 'Status', 'Notes'].map(col => (
                  <th key={col} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-500">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MAINT_ITEMS.map(item => (
                <tr key={item}>
                  <td className="border border-gray-200 px-3 py-1.5 font-medium text-brand-slate">{item}</td>
                  {['status', 'notes'].map(key => (
                    <td key={key} className="border border-gray-200 p-1">
                      <input value={maint[item][key]} onChange={e => setMaintField(item, key, e.target.value)}
                        className={inputCls} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section D. Breakdowns / Downtime */}
      <Section title="D. Breakdowns / Downtime">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Day', 'Breakdown Desc.', 'Hrs Lost', 'Action Taken'].map(col => (
                  <th key={col} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-500">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breakdowns.map((b, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 p-1 w-20">
                    <input value={b.day} onChange={e => setBreak(i, 'day', e.target.value)} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={b.description} onChange={e => setBreak(i, 'description', e.target.value)} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1 w-20">
                    <input value={b.hrs_lost} onChange={e => setBreak(i, 'hrs_lost', e.target.value)} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={b.action} onChange={e => setBreak(i, 'action', e.target.value)} className={inputCls} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setBreakdowns(p => [...p, blankBreak()])}
            className="mt-2 text-xs text-brand-red hover:underline">
            + Add row
          </button>
        </div>
      </Section>

      {/* Section E. Issues, Instructions and Next Day Plan */}
      <Section title="E. Issues, Instructions and Next Day Plan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Issues encountered" value={notes.issues} onChange={n('issues')} />
          <Textarea label="Instructions received / issued" value={notes.instructions} onChange={n('instructions')} />
          <div className="md:col-span-2">
            <Textarea label="Planned activities for next day" value={notes.next_day} onChange={n('next_day')} />
          </div>
        </div>
      </Section>

      {/* Bottom print button */}
      <div className="flex justify-end">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-red text-white text-sm font-semibold rounded-lg hover:bg-brand-red/90 transition-colors">
          <PrinterIcon className="h-4 w-4" /> Download / Print PDF
        </button>
      </div>
    </div>
  )
}
