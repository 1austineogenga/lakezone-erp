import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { printDoc } from '../../utils/print'

function Field({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30" />
    </div>
  )
}

function Textarea({ label, value, onChange, rows = 3 }) {
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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const blankActivity = () => ({ activity: '', location: '', output: '', remarks: '' })
const BENCHMARK_ITEMS = ['Benchmarks / control points', 'Support to earthworks / drainage', 'As-built / quantity pick-up']

export default function SurveyorWeeklyReportPage() {
  const navigate = useNavigate()
  const inputCls = 'border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40'

  const [header, setHeader] = useState({ project_name: '', contract_no: '', week_no: '', period: '', from_date: '', to_date: '' })
  const h = (key) => (val) => setHeader(p => ({ ...p, [key]: val }))

  const [dailyActivities, setDailyActivities] = useState(() =>
    DAYS.reduce((acc, day) => ({ ...acc, [day]: blankActivity() }), {})
  )
  const setDay = (day, key, val) => setDailyActivities(p => ({ ...p, [day]: { ...p[day], [key]: val } }))

  const [benchmarks, setBenchmarks] = useState(() =>
    BENCHMARK_ITEMS.reduce((acc, item) => ({ ...acc, [item]: { status: '', action: '', remarks: '' } }), {})
  )
  const setBench = (item, key, val) => setBenchmarks(p => ({ ...p, [item]: { ...p[item], [key]: val } }))

  const [notes, setNotes] = useState({ equipment: '', challenges: '', next_week: '' })
  const n = (key) => (val) => setNotes(p => ({ ...p, [key]: val }))

  const [sigs, setSigs] = useState({ prepared_by: '', reviewed_by: '' })

  const handlePrint = () => {
    const dayRows = DAYS.map(day => {
      const r = dailyActivities[day]
      return `<tr><td>${day}</td><td>${r.activity}</td><td>${r.location}</td><td>${r.output}</td><td>${r.remarks}</td></tr>`
    }).join('')

    const benchRows = BENCHMARK_ITEMS.map(item => {
      const b = benchmarks[item]
      return `<tr><td>${item}</td><td>${b.status}</td><td>${b.action}</td><td>${b.remarks}</td></tr>`
    }).join('')

    printDoc({
      title: 'Surveyor Weekly Report',
      html: `
        <table style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
          <tr>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:130px"><b>Project Name</b></td>
            <td style="padding:8px 12px">${header.project_name}</td>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:80px"><b>Week No.</b></td>
            <td style="padding:8px 12px">${header.week_no}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Contract No./Location</b></td>
            <td style="padding:8px 12px">${header.contract_no}</td>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Period</b></td>
            <td style="padding:8px 12px">${header.from_date ? header.from_date + ' – ' + header.to_date : header.period}</td>
          </tr>
        </table>

        <div class="section-title">A. Weekly Summary of Survey Activities</div>
        <table style="margin-bottom:16px">
          <thead><tr style="background:#e11d4815"><th>Day</th><th>Activity</th><th>Location/Chainage</th><th>Output</th><th>Remarks</th></tr></thead>
          <tbody>${dayRows}</tbody>
        </table>

        <div class="section-title">B. Benchmark / Control Summary and Support to Teams</div>
        <table style="margin-bottom:16px">
          <thead><tr style="background:#e11d4815"><th>Item</th><th>Status this week</th><th>Action required</th><th>Remarks</th></tr></thead>
          <tbody>${benchRows}</tbody>
        </table>

        <div class="section-title">C. Equipment Status, Constraints and Next Week Plan</div>
        <table style="margin-bottom:24px;border:1px solid #e2e8f0">
          <tr><td style="padding:10px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:220px;vertical-align:top"><b>Equipment condition / calibration</b></td><td style="padding:10px 12px">${notes.equipment}</td></tr>
          <tr><td style="padding:10px 12px;background:#f8fafc;font-size:10px;color:#64748b;vertical-align:top"><b>Challenges / constraints</b></td><td style="padding:10px 12px">${notes.challenges}</td></tr>
          <tr><td style="padding:10px 12px;background:#f8fafc;font-size:10px;color:#64748b;vertical-align:top"><b>Planned activities for next week</b></td><td style="padding:10px 12px">${notes.next_week}</td></tr>
        </table>

        <div class="sig-row" style="grid-template-columns:repeat(2,1fr)">
          <div class="sig-box"><label>Prepared by (Surveyor)</label><span>${sigs.prepared_by || '&nbsp;'}</span></div>
          <div class="sig-box"><label>Reviewed by (Site Agent / Engineer)</label><span>${sigs.reviewed_by || '&nbsp;'}</span></div>
        </div>
      `
    })
  }

  const PrintBtn = ({ size = 'sm' }) => (
    <button onClick={handlePrint}
      className={`flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white font-semibold rounded-lg hover:bg-brand-red/90 transition-colors ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <PrinterIcon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {size === 'sm' ? 'Print Report' : 'Download / Print PDF'}
    </button>
  )

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)}>
            <ArrowLeftIcon className="w-4 h-4 text-gray-400 hover:text-brand-slate" />
          </button>
          <h1 className="text-sm font-bold text-brand-slate">Surveyor Weekly Report</h1>
        </div>
        <PrintBtn />
      </div>

      <Section title="Report Header">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Project Name"          value={header.project_name} onChange={h('project_name')} />
          <Field label="Contract No./Location" value={header.contract_no}  onChange={h('contract_no')} />
          <Field label="Week No."              value={header.week_no}      onChange={h('week_no')} />
          <Field label="Period"                value={header.period}       onChange={h('period')} />
          <Field label="From Date"             value={header.from_date}    onChange={h('from_date')} type="date" />
          <Field label="To Date"               value={header.to_date}      onChange={h('to_date')}   type="date" />
        </div>
      </Section>

      <Section title="A. Weekly Summary of Survey Activities">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                {['Day', 'Activity', 'Location/Chainage', 'Output', 'Remarks'].map(col => (
                  <th key={col} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} className="border-b border-gray-100 last:border-0">
                  <td className="px-2 py-1 text-[10px] font-medium text-brand-slate w-24">{day}</td>
                  <td className="px-2 py-1"><input value={dailyActivities[day].activity} onChange={e => setDay(day, 'activity', e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={dailyActivities[day].location} onChange={e => setDay(day, 'location', e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={dailyActivities[day].output}   onChange={e => setDay(day, 'output',   e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={dailyActivities[day].remarks}  onChange={e => setDay(day, 'remarks',  e.target.value)} className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="B. Benchmark / Control Summary and Support to Teams">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                {['Item', 'Status this week', 'Action required', 'Remarks'].map(col => (
                  <th key={col} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BENCHMARK_ITEMS.map(item => (
                <tr key={item} className="border-b border-gray-100 last:border-0">
                  <td className="px-2 py-1 text-[10px] font-medium text-brand-slate w-48">{item}</td>
                  <td className="px-2 py-1"><input value={benchmarks[item].status}  onChange={e => setBench(item, 'status',  e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={benchmarks[item].action}  onChange={e => setBench(item, 'action',  e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={benchmarks[item].remarks} onChange={e => setBench(item, 'remarks', e.target.value)} className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="C. Equipment Status, Constraints and Next Week Plan">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Textarea label="Equipment condition / calibration" value={notes.equipment}   onChange={n('equipment')} />
          <Textarea label="Challenges / constraints"          value={notes.challenges}  onChange={n('challenges')} />
          <Textarea label="Planned activities for next week"  value={notes.next_week}   onChange={n('next_week')} />
        </div>
      </Section>

      <Section title="Signatures">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prepared by (Surveyor)"              value={sigs.prepared_by}  onChange={v => setSigs(p => ({ ...p, prepared_by: v }))} />
          <Field label="Reviewed by (Site Agent / Engineer)" value={sigs.reviewed_by}  onChange={v => setSigs(p => ({ ...p, reviewed_by: v }))} />
        </div>
      </Section>

      <div className="flex justify-end">
        <PrintBtn size="md" />
      </div>
    </div>
  )
}
