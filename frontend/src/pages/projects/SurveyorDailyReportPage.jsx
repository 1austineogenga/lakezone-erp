import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { printSurveyorDaily } from '../../utils/print'

function Field({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30" />
    </div>
  )
}

function Textarea({ label, value, onChange, rows = 2 }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none" />
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

const blankActivity = () => ({ no: '', location: '', activity: '', output: '', remarks: '' })
const blankControl = () => ({ point_id: '', easting: '', northing: '', level: '', status: '' })

export default function SurveyorDailyReportPage() {
  const navigate = useNavigate()
  const inputCls = 'border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40'

  const [header, setHeader] = useState({
    project_name: '', contract_no: '', location: '', date: '', day: '', weather: '',
    surveyor: '', assistant: '', total_station: '', battery: '', staff_prism: '',
    vehicle_access: '', rtk_gps: ''
  })

  const h = (key) => (val) => setHeader(p => ({ ...p, [key]: val }))

  const [works, setWorks] = useState(() => Array.from({ length: 8 }, blankActivity))
  const [controlPoints, setControlPoints] = useState(() => Array.from({ length: 4 }, blankControl))
  const [notes, setNotes] = useState({ issues: '', instructions: '', next_day: '' })

  const setWork = (i, key, val) => setWorks(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))
  const setControl = (i, key, val) => setControlPoints(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))

  const handlePrint = () => {
    printSurveyorDaily({
      ...header,
      activities: works,
      control_points: controlPoints,
      issues_encountered: notes.issues,
      instructions_received_issued: notes.instructions,
      planned_activities_for_next_day: notes.next_day,
    })
  }

  const PrintBtn = () => (
    <button onClick={handlePrint}
      className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:bg-brand-red/90 transition-colors">
      <PrinterIcon className="w-3.5 h-3.5" />
      Print Report
    </button>
  )

  return (
    <div className="space-y-5 pb-12">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)}>
            <ArrowLeftIcon className="w-4 h-4 text-gray-400 hover:text-brand-slate" />
          </button>
          <h1 className="text-sm font-bold text-brand-slate">Surveyor Daily Report</h1>
        </div>
        <PrintBtn />
      </div>

      {/* Section A: Report Header */}
      <Section title="Report Header">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Project Name"        value={header.project_name}   onChange={h('project_name')} />
          <Field label="Contract No."        value={header.contract_no}    onChange={h('contract_no')} />
          <Field label="Location / Section"  value={header.location}       onChange={h('location')} />
          <Field label="Date"                value={header.date}           onChange={h('date')}         type="date" />
          <Field label="Day"                 value={header.day}            onChange={h('day')} />
          <Field label="Weather"             value={header.weather}        onChange={h('weather')} />
          <Field label="Surveyor Name"       value={header.surveyor}       onChange={h('surveyor')} />
          <Field label="Assistant Name"      value={header.assistant}      onChange={h('assistant')} />
          <Field label="Total Station"       value={header.total_station}  onChange={h('total_station')} />
          <Field label="Battery / Calibration" value={header.battery}     onChange={h('battery')} />
          <Field label="Staff / Prism"       value={header.staff_prism}    onChange={h('staff_prism')} />
          <Field label="Vehicle / Access"    value={header.vehicle_access} onChange={h('vehicle_access')} />
          <Field label="RTK / GPS"           value={header.rtk_gps}        onChange={h('rtk_gps')} />
        </div>
      </Section>

      {/* Section B: Survey Activities Completed */}
      <Section title="B. Survey Activities Completed">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                {['No.', 'Location / Chainage', 'Activity', 'Output / Reference', 'Remarks'].map(col => (
                  <th key={col} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {works.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-2 py-1"><input value={row.no}       onChange={e => setWork(i, 'no', e.target.value)}       className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.location} onChange={e => setWork(i, 'location', e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.activity} onChange={e => setWork(i, 'activity', e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.output}   onChange={e => setWork(i, 'output', e.target.value)}   className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.remarks}  onChange={e => setWork(i, 'remarks', e.target.value)}  className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => setWorks(p => [...p, blankActivity()])}
          className="mt-2 text-xs text-brand-red hover:underline">
          + Add row
        </button>
      </Section>

      {/* Section C: Control Points / Levels Checked */}
      <Section title="C. Control Points / Levels Checked">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                {['Point ID', 'Easting', 'Northing', 'Level', 'Status / Observation'].map(col => (
                  <th key={col} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {controlPoints.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-2 py-1"><input value={row.point_id} onChange={e => setControl(i, 'point_id', e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.easting}  onChange={e => setControl(i, 'easting', e.target.value)}  className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.northing} onChange={e => setControl(i, 'northing', e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.level}    onChange={e => setControl(i, 'level', e.target.value)}    className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.status}   onChange={e => setControl(i, 'status', e.target.value)}   className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => setControlPoints(p => [...p, blankControl()])}
          className="mt-2 text-xs text-brand-red hover:underline">
          + Add row
        </button>
      </Section>

      {/* Section D: Issues, Instructions and Next Plan */}
      <Section title="D. Issues, Instructions and Next Plan">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Textarea label="Issues Encountered"              value={notes.issues}        onChange={val => setNotes(p => ({ ...p, issues: val }))}        rows={4} />
          <Textarea label="Instructions Received / Issued"  value={notes.instructions}  onChange={val => setNotes(p => ({ ...p, instructions: val }))}  rows={4} />
          <Textarea label="Planned Activities for Next Day" value={notes.next_day}       onChange={val => setNotes(p => ({ ...p, next_day: val }))}       rows={4} />
        </div>
      </Section>

      {/* Bottom print button */}
      <div className="flex justify-end">
        <PrintBtn />
      </div>
    </div>
  )
}
