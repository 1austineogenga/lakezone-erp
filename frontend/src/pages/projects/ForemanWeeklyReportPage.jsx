import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { printForemanWeekly } from '../../utils/print'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LABOUR_CATS = ['Skilled labour', 'Semi-skilled', 'Unskilled', 'Operators', 'Supervisors']

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

export default function ForemanWeeklyReportPage() {
  const navigate = useNavigate()

  // ── header fields ─────────────────────────────────────────────────
  const [header, setHeader] = useState({
    project_name: '', contract_no: '', week_no: '', period: '',
    from_date: '', to_date: '',
  })
  const h = (key) => (val) => setHeader(p => ({ ...p, [key]: val }))

  // ── labour grid ───────────────────────────────────────────────────
  const initLabour = () => {
    const l = {}
    LABOUR_CATS.forEach(cat => {
      l[cat] = {}
      DAYS.forEach(d => { l[cat][d] = '' })
      l[cat].total = ''
    })
    return l
  }
  const [labour, setLabour] = useState(initLabour)
  const setLabourDay = (cat, day, val) =>
    setLabour(p => ({ ...p, [cat]: { ...p[cat], [day]: val } }))
  const setLabourTotal = (cat, val) =>
    setLabour(p => ({ ...p, [cat]: { ...p[cat], total: val } }))

  // ── works rows ────────────────────────────────────────────────────
  const blankWork = () => ({ no: '', location: '', description: '', unit: '', weekly_target: '', weekly_achieved: '', remarks: '' })
  const [works, setWorks] = useState([blankWork(), blankWork(), blankWork(), blankWork(), blankWork(), blankWork()])
  const setWork = (i, key, val) => setWorks(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))

  // ── notes ─────────────────────────────────────────────────────────
  const [notes, setNotes] = useState({ materials: '', issues: '', safety: '', next_week: '' })
  const n = (key) => (val) => setNotes(p => ({ ...p, [key]: val }))

  // ── signatures ────────────────────────────────────────────────────
  const [sigs, setSigs] = useState({ prepared_by: '', reviewed_by: '' })
  const s = (key) => (val) => setSigs(p => ({ ...p, [key]: val }))

  // ── print ─────────────────────────────────────────────────────────
  const handlePrint = () => {
    printForemanWeekly({
      ...header,
      labour,
      works,
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
          <h2 className="font-bold text-brand-slate text-lg">Foreman Weekly Report</h2>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:bg-brand-red/90 transition-colors">
          <PrinterIcon className="h-3.5 w-3.5" /> Download / Print
        </button>
      </div>

      {/* Report Header */}
      <Section title="Report Header">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Project Name" value={header.project_name} onChange={h('project_name')} />
          <Field label="Contract No." value={header.contract_no} onChange={h('contract_no')} />
          <Field label="Week No." value={header.week_no} onChange={h('week_no')} />
          <Field label="Period" value={header.period} onChange={h('period')} />
          <Field label="From Date" value={header.from_date} onChange={h('from_date')} type="date" />
          <Field label="To Date" value={header.to_date} onChange={h('to_date')} type="date" />
        </div>
      </Section>

      {/* Section A. Weekly Labour Summary */}
      <Section title="A. Weekly Labour Summary">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-500 w-32">Category</th>
                {DAYS.map(d => (
                  <th key={d} className="border border-gray-200 px-2 py-2 font-semibold text-gray-500 text-center w-14">{d}</th>
                ))}
                <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-500 text-center w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {LABOUR_CATS.map(cat => (
                <tr key={cat}>
                  <td className="border border-gray-200 px-3 py-1.5 font-medium text-brand-slate">{cat}</td>
                  {DAYS.map(d => (
                    <td key={d} className="border border-gray-200 p-1">
                      <input
                        value={labour[cat][d]}
                        onChange={e => setLabourDay(cat, d, e.target.value)}
                        className={inputCls + ' text-center'}
                      />
                    </td>
                  ))}
                  <td className="border border-gray-200 p-1">
                    <input
                      value={labour[cat].total}
                      onChange={e => setLabourTotal(cat, e.target.value)}
                      className={inputCls + ' text-center font-bold'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section B. Works Executed */}
      <Section title="B. Works Executed">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['No.', 'Location / Section', 'Description', 'Unit', 'Weekly Target', 'Weekly Achieved', 'Remarks'].map(col => (
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
                  <td className="border border-gray-200 p-1 w-24">
                    <input value={w.weekly_target} onChange={e => setWork(i, 'weekly_target', e.target.value)} className={inputCls + ' text-right'} />
                  </td>
                  <td className="border border-gray-200 p-1 w-24">
                    <input value={w.weekly_achieved} onChange={e => setWork(i, 'weekly_achieved', e.target.value)} className={inputCls + ' text-right'} />
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

      {/* Section C. Materials, Issues and Next Week Plan */}
      <Section title="C. Materials, Issues and Next Week Plan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Materials received / used" value={notes.materials} onChange={n('materials')} />
          <Textarea label="Major issues / constraints" value={notes.issues} onChange={n('issues')} />
          <Textarea label="Safety / quality / environment summary" value={notes.safety} onChange={n('safety')} />
          <Textarea label="Planned activities for next week" value={notes.next_week} onChange={n('next_week')} />
        </div>
      </Section>

      {/* Signatures */}
      <Section title="Signatures">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prepared by (Foreman)" value={sigs.prepared_by} onChange={s('prepared_by')} />
          <Field label="Reviewed by (Site Agent / Engineer)" value={sigs.reviewed_by} onChange={s('reviewed_by')} />
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
