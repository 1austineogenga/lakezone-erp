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

const blankPlant = () => ({ plant: '', id_unit: '', qty: '', status: '', remarks: '' })
const blankWork = () => ({ no: '', location: '', description: '', unit_qty: '', remarks: '' })

export default function ForemanDailyReportPage() {
  const navigate = useNavigate()
  const inputCls = 'border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40'

  const [header, setHeader] = useState({
    project_name: '', contract_no: '', location: '', date: '', day: '', weather: '',
  })
  const h = (key) => (val) => setHeader(p => ({ ...p, [key]: val }))

  const [labour, setLabour] = useState({
    skilled: '', semi_skilled: '', unskilled: '', supervisors: '',
    total_workforce: '', operators: '', visitors: '', shift_hours: '',
  })
  const l = (key) => (val) => setLabour(p => ({ ...p, [key]: val }))

  const [plants, setPlants] = useState(() => Array.from({ length: 7 }, blankPlant))
  const [works, setWorks] = useState(() => Array.from({ length: 6 }, blankWork))
  const setPlant = (i, key, val) => setPlants(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))
  const setWork = (i, key, val) => setWorks(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))

  const [notes, setNotes] = useState({ instructions: '', delays: '', safety: '', next_day: '' })
  const n = (key) => (val) => setNotes(p => ({ ...p, [key]: val }))

  const [sigs, setSigs] = useState({ prepared_by: '', checked_by: '' })

  const handlePrint = () => {
    const plantsRows = plants.filter(p => p.plant).map(p =>
      `<tr><td>${p.plant}</td><td>${p.id_unit}</td><td>${p.qty}</td><td>${p.status}</td><td>${p.remarks}</td></tr>`
    ).join('')
    const worksRows = works.filter(w => w.description || w.location).map((w, i) =>
      `<tr><td>${i + 1}</td><td>${w.location}</td><td>${w.description}</td><td>${w.unit_qty}</td><td>${w.remarks}</td></tr>`
    ).join('')

    printDoc({
      title: 'Foreman Daily Report',
      html: `
        <table style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:130px"><b>Project Name</b></td><td style="padding:8px 12px">${header.project_name}</td>
              <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:80px"><b>Date</b></td><td style="padding:8px 12px">${header.date}</td></tr>
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Contract No.</b></td><td style="padding:8px 12px">${header.contract_no}</td>
              <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Day</b></td><td style="padding:8px 12px">${header.day}</td></tr>
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Location/Section</b></td><td style="padding:8px 12px">${header.location}</td>
              <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Weather</b></td><td style="padding:8px 12px">${header.weather}</td></tr>
        </table>

        <div class="section-title">A. Labour on Site</div>
        <table style="margin-bottom:16px;border:1px solid #e2e8f0">
          <tr>
            <td style="padding:7px 10px;background:#f8fafc;font-size:10px;color:#64748b;width:50%"><b>Skilled labour</b></td><td style="padding:7px 10px;width:15%">${labour.skilled}</td>
            <td style="padding:7px 10px;background:#f8fafc;font-size:10px;color:#64748b;width:50%"><b>Semi-skilled labour</b></td><td style="padding:7px 10px">${labour.semi_skilled}</td>
          </tr>
          <tr>
            <td style="padding:7px 10px;background:#f8fafc;font-size:10px;color:#64748b"><b>Unskilled labour</b></td><td style="padding:7px 10px">${labour.unskilled}</td>
            <td style="padding:7px 10px;background:#f8fafc;font-size:10px;color:#64748b"><b>Operators</b></td><td style="padding:7px 10px">${labour.operators}</td>
          </tr>
          <tr>
            <td style="padding:7px 10px;background:#f8fafc;font-size:10px;color:#64748b"><b>Supervisors</b></td><td style="padding:7px 10px">${labour.supervisors}</td>
            <td style="padding:7px 10px;background:#f8fafc;font-size:10px;color:#64748b"><b>Visitors</b></td><td style="padding:7px 10px">${labour.visitors}</td>
          </tr>
          <tr>
            <td style="padding:7px 10px;background:#f8fafc;font-size:10px;color:#64748b"><b>Total workforce</b></td><td style="padding:7px 10px">${labour.total_workforce}</td>
            <td style="padding:7px 10px;background:#f8fafc;font-size:10px;color:#64748b"><b>Shift/Hours worked</b></td><td style="padding:7px 10px">${labour.shift_hours}</td>
          </tr>
        </table>

        <div class="section-title">B. Plant / Equipment and Materials</div>
        <table style="margin-bottom:16px">
          <thead><tr style="background:#e11d4815"><th>Plant/Material</th><th>ID/Unit</th><th>Qty</th><th>Status</th><th>Remarks</th></tr></thead>
          <tbody>${plantsRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">—</td></tr>'}</tbody>
        </table>

        <div class="section-title">C. Work Activities Executed</div>
        <table style="margin-bottom:16px">
          <thead><tr style="background:#e11d4815"><th>No.</th><th>Location/Chainage</th><th>Description of work</th><th>Unit/Qty</th><th>Remarks</th></tr></thead>
          <tbody>${worksRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">—</td></tr>'}</tbody>
        </table>

        <div class="section-title">D. Instructions, Issues and Next Plan</div>
        <table style="margin-bottom:24px;border:1px solid #e2e8f0">
          <tr><td style="padding:10px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:220px;vertical-align:top"><b>Instructions received (Verbal or Written)</b></td><td style="padding:10px 12px;min-height:60px">${notes.instructions}</td></tr>
          <tr><td style="padding:10px 12px;background:#f8fafc;font-size:10px;color:#64748b;vertical-align:top"><b>Delays / challenges</b></td><td style="padding:10px 12px">${notes.delays}</td></tr>
          <tr><td style="padding:10px 12px;background:#f8fafc;font-size:10px;color:#64748b;vertical-align:top"><b>Safety / quality / environment remarks</b></td><td style="padding:10px 12px">${notes.safety}</td></tr>
          <tr><td style="padding:10px 12px;background:#f8fafc;font-size:10px;color:#64748b;vertical-align:top"><b>Planned activities for next day</b></td><td style="padding:10px 12px">${notes.next_day}</td></tr>
        </table>

        <div class="sig-row" style="grid-template-columns:repeat(2,1fr)">
          <div class="sig-box"><label>Prepared by (Foreman)</label><span>${sigs.prepared_by || '&nbsp;'}</span></div>
          <div class="sig-box"><label>Checked by (Site Agent / Engineer)</label><span>${sigs.checked_by || '&nbsp;'}</span></div>
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
          <h1 className="text-sm font-bold text-brand-slate">Foreman Daily Report</h1>
        </div>
        <PrintBtn />
      </div>

      <Section title="Report Header">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Project Name"      value={header.project_name} onChange={h('project_name')} />
          <Field label="Contract No."      value={header.contract_no}  onChange={h('contract_no')} />
          <Field label="Location/Section"  value={header.location}     onChange={h('location')} />
          <Field label="Date"              value={header.date}          onChange={h('date')} type="date" />
          <Field label="Day"               value={header.day}           onChange={h('day')} />
          <Field label="Weather"           value={header.weather}       onChange={h('weather')} />
        </div>
      </Section>

      <Section title="A. Labour on Site">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Skilled Labour"      value={labour.skilled}         onChange={l('skilled')} />
          <Field label="Semi-skilled Labour" value={labour.semi_skilled}    onChange={l('semi_skilled')} />
          <Field label="Unskilled Labour"    value={labour.unskilled}       onChange={l('unskilled')} />
          <Field label="Operators"           value={labour.operators}       onChange={l('operators')} />
          <Field label="Supervisors"         value={labour.supervisors}     onChange={l('supervisors')} />
          <Field label="Visitors"            value={labour.visitors}        onChange={l('visitors')} />
          <Field label="Total Workforce"     value={labour.total_workforce} onChange={l('total_workforce')} />
          <Field label="Shift / Hours Worked" value={labour.shift_hours}   onChange={l('shift_hours')} />
        </div>
      </Section>

      <Section title="B. Plant / Equipment and Materials">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                {['Plant/Material', 'ID/Unit', 'Qty', 'Status', 'Remarks'].map(col => (
                  <th key={col} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plants.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-2 py-1"><input value={row.plant}    onChange={e => setPlant(i, 'plant', e.target.value)}    className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.id_unit}  onChange={e => setPlant(i, 'id_unit', e.target.value)}  className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.qty}      onChange={e => setPlant(i, 'qty', e.target.value)}      className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.status}   onChange={e => setPlant(i, 'status', e.target.value)}   className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.remarks}  onChange={e => setPlant(i, 'remarks', e.target.value)}  className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => setPlants(p => [...p, blankPlant()])}
          className="mt-2 text-xs text-brand-red hover:underline">+ Add row</button>
      </Section>

      <Section title="C. Work Activities Executed">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                {['No.', 'Location/Chainage', 'Description of Work', 'Unit/Qty', 'Remarks'].map(col => (
                  <th key={col} className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {works.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-2 py-1 w-10"><input value={row.no}          onChange={e => setWork(i, 'no', e.target.value)}          className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.location}    onChange={e => setWork(i, 'location', e.target.value)}    className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.description} onChange={e => setWork(i, 'description', e.target.value)} className={inputCls} /></td>
                  <td className="px-2 py-1 w-20"><input value={row.unit_qty}   onChange={e => setWork(i, 'unit_qty', e.target.value)}   className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.remarks}    onChange={e => setWork(i, 'remarks', e.target.value)}     className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => setWorks(p => [...p, blankWork()])}
          className="mt-2 text-xs text-brand-red hover:underline">+ Add row</button>
      </Section>

      <Section title="D. Instructions, Issues and Next Plan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Instructions received (Verbal or Written)" value={notes.instructions} onChange={n('instructions')} />
          <Textarea label="Delays / challenges"                        value={notes.delays}        onChange={n('delays')} />
          <Textarea label="Safety / quality / environment remarks"     value={notes.safety}        onChange={n('safety')} />
          <Textarea label="Planned activities for next day"           value={notes.next_day}      onChange={n('next_day')} />
        </div>
      </Section>

      <Section title="Signatures">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prepared by (Foreman)"              value={sigs.prepared_by} onChange={v => setSigs(p => ({ ...p, prepared_by: v }))} />
          <Field label="Checked by (Site Agent / Engineer)" value={sigs.checked_by}  onChange={v => setSigs(p => ({ ...p, checked_by: v }))} />
        </div>
      </Section>

      <div className="flex justify-end">
        <PrintBtn size="md" />
      </div>
    </div>
  )
}
