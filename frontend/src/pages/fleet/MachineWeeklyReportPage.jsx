import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { getVehicle } from '../../api/fleet'
import { printMachineWeekly } from '../../utils/print'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_CATS = ['Hours Idle', 'Hours Worked', 'Hrs Breakdown', 'Hrs Standby']
const MAINT_ITEMS = [
  'Engine oil change', 'Filter replacement', 'Greasing/lubrication',
  'Tyre/track inspection', 'Hydraulic check', 'General servicing',
]

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

export default function MachineWeeklyReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: vehicle } = useQuery({
    queryKey: ['fleet-vehicle', id],
    queryFn: () => getVehicle(id),
    select: r => r.data,
  })

  // ── header fields ─────────────────────────────────────────────────
  const [header, setHeader] = useState({
    project_name: '', contract_no: '', week_no: '', period: '',
    from_date: '', to_date: '',
    category: '', operator: '',
    opening_meter: '', closing_meter: '',
    total_fuel: '', total_grease: '',
  })
  const h = (key) => (val) => setHeader(p => ({ ...p, [key]: val }))

  // ── hours grid ────────────────────────────────────────────────────
  const initHours = () => {
    const g = {}
    HOUR_CATS.forEach(cat => { g[cat] = {}; DAYS.forEach(d => { g[cat][d] = '' }); g[cat].total = '' })
    return g
  }
  const [hours, setHours] = useState(initHours)
  const setHour = (cat, day, val) =>
    setHours(p => ({ ...p, [cat]: { ...p[cat], [day]: val } }))
  const setHourTotal = (cat, val) =>
    setHours(p => ({ ...p, [cat]: { ...p[cat], total: val } }))

  // ── works rows ────────────────────────────────────────────────────
  const blankWork = () => ({ no: '', location: '', description: '', unit: '', weekly_target: '', weekly_achieved: '' })
  const [works, setWorks] = useState([blankWork(), blankWork(), blankWork(), blankWork(), blankWork()])
  const setWork = (i, key, val) => setWorks(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))

  // ── maintenance ───────────────────────────────────────────────────
  const initMaint = () => {
    const m = {}
    MAINT_ITEMS.forEach(item => { m[item] = { scheduled: '', completed: '', remarks: '' } })
    return m
  }
  const [maint, setMaint] = useState(initMaint)
  const setMaintField = (item, key, val) =>
    setMaint(p => ({ ...p, [item]: { ...p[item], [key]: val } }))

  // ── breakdowns ────────────────────────────────────────────────────
  const blankBreak = () => ({ day: '', description: '', hrs_lost: '', action: '' })
  const [breakdowns, setBreakdowns] = useState([blankBreak(), blankBreak(), blankBreak()])
  const setBreak = (i, key, val) => setBreakdowns(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))

  // ── narrative fields ──────────────────────────────────────────────
  const [notes, setNotes] = useState({ materials: '', issues: '', safety: '', next_week: '' })
  const n = (key) => (val) => setNotes(p => ({ ...p, [key]: val }))

  // ── print ─────────────────────────────────────────────────────────
  const handlePrint = () => {
    printMachineWeekly({
      ...header,
      machine_type: vehicle?.vehicle_name || '',
      machine_name: vehicle?.vehicle_name || '',
      machine_id: vehicle?.vehicle_no || '',
      hours,
      works,
      maintenance: maint,
      breakdowns,
      materials: notes.materials,
      issues: notes.issues,
      safety: notes.safety,
      next_week: notes.next_week,
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
          <h2 className="font-bold text-brand-slate text-lg">Machine Weekly Report</h2>
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

      {/* A. Identification */}
      <Section title="A. Machine / Equipment Identification">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Project Name" value={header.project_name} onChange={h('project_name')} />
          <Field label="Contract No. / Location" value={header.contract_no} onChange={h('contract_no')} />
          <Field label="Week No." value={header.week_no} onChange={h('week_no')} />
          <Field label="Period" value={header.period} onChange={h('period')} />
          <Field label="From Date" value={header.from_date} onChange={h('from_date')} type="date" />
          <Field label="To Date" value={header.to_date} onChange={h('to_date')} type="date" />
          <Field label="Machine Type / Category" value={header.category} onChange={h('category')} />
          <Field label="Primary Operator" value={header.operator} onChange={h('operator')} />
          <div className="text-xs text-gray-400 flex items-center gap-1 col-span-1">
            <span className="font-medium text-brand-slate">{vehicle?.vehicle_no}</span>
            <span>—</span>
            <span>{vehicle?.vehicle_name}</span>
          </div>
        </div>
      </Section>

      {/* B. Weekly Hours Summary */}
      <Section title="B. Weekly Hours Summary">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-500 w-32">Category</th>
                {DAYS.map(d => <th key={d} className="border border-gray-200 px-2 py-2 font-semibold text-gray-500 text-center w-16">{d}</th>)}
                <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-500 text-center w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {HOUR_CATS.map(cat => (
                <tr key={cat}>
                  <td className="border border-gray-200 px-3 py-1.5 font-medium text-brand-slate">{cat}</td>
                  {DAYS.map(d => (
                    <td key={d} className="border border-gray-200 p-1">
                      <input value={hours[cat][d]} onChange={e => setHour(cat, d, e.target.value)}
                        className={inputCls + ' text-center'} />
                    </td>
                  ))}
                  <td className="border border-gray-200 p-1">
                    <input value={hours[cat].total} onChange={e => setHourTotal(cat, e.target.value)}
                      className={inputCls + ' text-center font-bold'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* C. Fuels & Fluids */}
      <Section title="C. Weekly Fuels &amp; Fluids Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Opening Meter (Mon)" value={header.opening_meter} onChange={h('opening_meter')} />
          <Field label="Closing Meter (Sat)" value={header.closing_meter} onChange={h('closing_meter')} />
          <Field label="Total Fuel Added (Ltrs)" value={header.total_fuel} onChange={h('total_fuel')} />
          <Field label="Total Grease Added" value={header.total_grease} onChange={h('total_grease')} />
        </div>
      </Section>

      {/* D. Works Executed */}
      <Section title="D. Works Executed During the Week">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['No.', 'Location / Section', 'Description', 'Unit', 'Weekly Target', 'Weekly Achieved'].map(h => (
                  <th key={h} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-500">{h}</th>
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
                  <td className="border border-gray-200 p-1 w-24">
                    <input value={w.weekly_target} onChange={e => setWork(i, 'weekly_target', e.target.value)} className={inputCls + ' text-right'} />
                  </td>
                  <td className="border border-gray-200 p-1 w-24">
                    <input value={w.weekly_achieved} onChange={e => setWork(i, 'weekly_achieved', e.target.value)} className={inputCls + ' text-right'} />
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

      {/* E. Maintenance */}
      <Section title="E. Weekly Maintenance Summary">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Maintenance Item', 'Scheduled?', 'Completed?', 'Remarks'].map(h => (
                  <th key={h} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MAINT_ITEMS.map(item => (
                <tr key={item}>
                  <td className="border border-gray-200 px-3 py-1.5 font-medium text-brand-slate">{item}</td>
                  {['scheduled', 'completed', 'remarks'].map(key => (
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

      {/* F. Breakdowns */}
      <Section title="F. Breakdowns / Downtime">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Day', 'Breakdown Description', 'Hrs Lost', 'Action Taken'].map(h => (
                  <th key={h} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-500">{h}</th>
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

      {/* G. Narrative */}
      <Section title="G. Materials, Issues and Next Week Plan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Materials / consumables received or used" value={notes.materials} onChange={n('materials')} />
          <Textarea label="Major issues / constraints" value={notes.issues} onChange={n('issues')} />
          <Textarea label="Safety / quality / environment" value={notes.safety} onChange={n('safety')} />
          <Textarea label="Planned activities for next week" value={notes.next_week} onChange={n('next_week')} />
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
