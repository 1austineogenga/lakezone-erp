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

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="rounded border-gray-300 text-brand-red focus:ring-brand-red/40 h-3 w-3" />
      <span className="text-xs text-gray-600">{label}</span>
    </label>
  )
}

const INSPECTION_STAGES = ['Pre-construction', 'During work', 'Before covering up', 'Final']
const CHECKLIST_ITEMS = [
  'Approved drawings and latest revisions available on site',
  'Relevant materials approved and available',
  'Setting out / levels / dimensions checked',
  'Quality tests or records completed where applicable',
  'Area safe, accessible and ready for inspection',
]
const ATTACHMENTS = ['Marked-up drawing', 'Test results', 'Photos', 'Survey records', 'Material approvals']
const INSPECTION_RESULTS = ['Accepted', 'Accepted with comments', 'Re-inspection required']

export default function RFIPage() {
  const navigate = useNavigate()

  const [header, setHeader] = useState({
    project_name: '', inspection_no: '', contract_no: '', date: '',
    location: '', requested_datetime: '',
  })
  const h = (key) => (val) => setHeader(p => ({ ...p, [key]: val }))

  const [workDescription, setWorkDescription] = useState('')
  const [inspectionStage, setInspectionStage] = useState('')

  const [checklist, setChecklist] = useState(() =>
    CHECKLIST_ITEMS.reduce((acc, item) => ({ ...acc, [item]: { yes: false, no: false, remarks: '' } }), {})
  )
  const setCheck = (item, key, val) => setChecklist(p => ({ ...p, [item]: { ...p[item], [key]: val } }))

  const [attachments, setAttachments] = useState(() =>
    ATTACHMENTS.reduce((acc, a) => ({ ...acc, [a]: false }), { other: '' })
  )

  const [contractor, setContractor] = useState({ requested_by_name: '', designation: '', signature_date: '' })
  const c = (key) => (val) => setContractor(p => ({ ...p, [key]: val }))

  const [engineer, setEngineer] = useState({
    result: '', comments: '', inspected_by_name: '', designation: '', signature_date: '',
  })
  const e = (key) => (val) => setEngineer(p => ({ ...p, [key]: val }))

  const handlePrint = () => {
    const stageBoxes = INSPECTION_STAGES.map(s =>
      `<span style="margin-right:16px">${s === inspectionStage ? '☑' : '☐'} ${s}</span>`
    ).join('')

    const checkRows = CHECKLIST_ITEMS.map(item => {
      const v = checklist[item]
      return `<tr>
        <td style="padding:6px 10px">${item}</td>
        <td style="padding:6px 10px;text-align:center">${v.yes ? '☑ Yes' : '☐ Yes'} &nbsp; ${v.no ? '☑ No' : '☐ No'}</td>
        <td style="padding:6px 10px">${v.remarks}</td>
      </tr>`
    }).join('')

    const attList = ATTACHMENTS.filter(a => attachments[a]).join(', ') + (attachments.other ? `, Other: ${attachments.other}` : '')

    const resultBoxes = INSPECTION_RESULTS.map(r =>
      `<span style="margin-right:16px">${r === engineer.result ? '☑' : '☐'} ${r}</span>`
    ).join('')

    printDoc({
      title: 'Request for Inspection (RFI)',
      html: `
        <table style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
          <tr>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:140px"><b>Project Name</b></td>
            <td style="padding:8px 12px">${header.project_name}</td>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:120px"><b>Inspection No.</b></td>
            <td style="padding:8px 12px">${header.inspection_no}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Contract No.</b></td>
            <td style="padding:8px 12px">${header.contract_no}</td>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Date</b></td>
            <td style="padding:8px 12px">${header.date}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Location/Chainage</b></td>
            <td style="padding:8px 12px">${header.location}</td>
            <td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Requested inspection date/time</b></td>
            <td style="padding:8px 12px">${header.requested_datetime}</td>
          </tr>
        </table>

        <div class="section-title">A. Work Item / Activity Ready for Inspection</div>
        <table style="margin-bottom:16px;border:1px solid #e2e8f0">
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:140px"><b>Description</b></td><td style="padding:8px 12px">${workDescription}</td></tr>
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Inspection stage</b></td><td style="padding:10px 12px">${stageBoxes}</td></tr>
        </table>

        <div class="section-title">B. Contractor Readiness Checklist</div>
        <table style="margin-bottom:16px">
          <thead><tr style="background:#e11d4815"><th>Checklist item</th><th style="width:120px;text-align:center">Yes/No</th><th>Remarks</th></tr></thead>
          <tbody>${checkRows}</tbody>
        </table>

        <div class="section-title">C. Attachments Submitted</div>
        <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:16px;font-size:11px">
          ${attList || 'None'}
        </div>

        <div class="section-title">D. Contractor Request</div>
        <table style="margin-bottom:16px;border:1px solid #e2e8f0">
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:140px;vertical-align:top"><b>Requested by</b></td>
              <td style="padding:8px 12px">Name: ${contractor.requested_by_name} &nbsp;&nbsp; Designation: ${contractor.designation}</td></tr>
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;vertical-align:top"><b>Signature / Date</b></td>
              <td style="padding:8px 12px">${contractor.signature_date}</td></tr>
        </table>

        <div class="section-title">E. Engineer / Consultant Response</div>
        <table style="margin-bottom:24px;border:1px solid #e2e8f0">
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;width:140px"><b>Inspection result</b></td><td style="padding:10px 12px">${resultBoxes}</td></tr>
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b;vertical-align:top"><b>Comments / observations</b></td><td style="padding:8px 12px;min-height:60px">${engineer.comments}</td></tr>
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Inspected by</b></td>
              <td style="padding:8px 12px">Name: ${engineer.inspected_by_name} &nbsp;&nbsp; Designation: ${engineer.designation}</td></tr>
          <tr><td style="padding:8px 12px;background:#f8fafc;font-size:10px;color:#64748b"><b>Signature / date</b></td>
              <td style="padding:8px 12px">${engineer.signature_date}</td></tr>
        </table>
      `
    })
  }

  const PrintBtn = ({ size = 'sm' }) => (
    <button onClick={handlePrint}
      className={`flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white font-semibold rounded-lg hover:bg-brand-red/90 transition-colors ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <PrinterIcon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {size === 'sm' ? 'Print RFI' : 'Download / Print PDF'}
    </button>
  )

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)}>
            <ArrowLeftIcon className="w-4 h-4 text-gray-400 hover:text-brand-slate" />
          </button>
          <h1 className="text-sm font-bold text-brand-slate">Request for Inspection (RFI)</h1>
        </div>
        <PrintBtn />
      </div>

      <Section title="RFI Header">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Project Name"                 value={header.project_name}        onChange={h('project_name')} />
          <Field label="Inspection No."               value={header.inspection_no}       onChange={h('inspection_no')} />
          <Field label="Contract No."                 value={header.contract_no}         onChange={h('contract_no')} />
          <Field label="Date"                         value={header.date}                onChange={h('date')} type="date" />
          <Field label="Location/Chainage"            value={header.location}            onChange={h('location')} />
          <Field label="Requested Inspection Date/Time" value={header.requested_datetime} onChange={h('requested_datetime')} type="datetime-local" />
        </div>
      </Section>

      <Section title="A. Work Item / Activity Ready for Inspection">
        <div className="space-y-3">
          <Textarea label="Description of work item / activity" value={workDescription} onChange={setWorkDescription} rows={2} />
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-2">Inspection Stage</label>
            <div className="flex flex-wrap gap-4">
              {INSPECTION_STAGES.map(stage => (
                <label key={stage} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="inspection_stage" value={stage} checked={inspectionStage === stage}
                    onChange={() => setInspectionStage(stage)}
                    className="text-brand-red focus:ring-brand-red/40 h-3 w-3" />
                  <span className="text-xs text-gray-600">{stage}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="B. Contractor Readiness Checklist">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-[10px] font-semibold text-gray-500 px-3 py-2 border-b border-gray-200">Checklist item</th>
                <th className="text-center text-[10px] font-semibold text-gray-500 px-3 py-2 border-b border-gray-200 w-28">Yes / No</th>
                <th className="text-left text-[10px] font-semibold text-gray-500 px-3 py-2 border-b border-gray-200 w-40">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {CHECKLIST_ITEMS.map(item => (
                <tr key={item} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-gray-700">{item}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-3">
                      <Checkbox label="Yes" checked={checklist[item].yes}
                        onChange={v => { setCheck(item, 'yes', v); if (v) setCheck(item, 'no', false) }} />
                      <Checkbox label="No" checked={checklist[item].no}
                        onChange={v => { setCheck(item, 'no', v); if (v) setCheck(item, 'yes', false) }} />
                    </div>
                  </td>
                  <td className="px-3 py-1">
                    <input value={checklist[item].remarks} onChange={e => setCheck(item, 'remarks', e.target.value)}
                      className="border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="C. Attachments Submitted">
        <div className="flex flex-wrap gap-4">
          {ATTACHMENTS.map(a => (
            <Checkbox key={a} label={a} checked={!!attachments[a]}
              onChange={v => setAttachments(p => ({ ...p, [a]: v }))} />
          ))}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-600">Other:</span>
            <input value={attachments.other} onChange={e => setAttachments(p => ({ ...p, other: e.target.value }))}
              className="border border-gray-200 rounded px-1.5 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-brand-red/40" />
          </div>
        </div>
      </Section>

      <Section title="D. Contractor Request">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Requested by (Name)"  value={contractor.requested_by_name} onChange={c('requested_by_name')} />
          <Field label="Designation"          value={contractor.designation}       onChange={c('designation')} />
          <Field label="Signature Date"       value={contractor.signature_date}    onChange={c('signature_date')} type="date" />
        </div>
      </Section>

      <Section title="E. Engineer / Consultant Response">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-2">Inspection Result</label>
            <div className="flex flex-wrap gap-4">
              {INSPECTION_RESULTS.map(r => (
                <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="inspection_result" value={r} checked={engineer.result === r}
                    onChange={() => setEngineer(p => ({ ...p, result: r }))}
                    className="text-brand-red focus:ring-brand-red/40 h-3 w-3" />
                  <span className="text-xs text-gray-600">{r}</span>
                </label>
              ))}
            </div>
          </div>
          <Textarea label="Comments / observations" value={engineer.comments} onChange={e('comments')} rows={3} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Inspected by (Name)" value={engineer.inspected_by_name} onChange={e('inspected_by_name')} />
            <Field label="Designation"         value={engineer.designation}       onChange={e('designation')} />
            <Field label="Signature Date"      value={engineer.signature_date}    onChange={e('signature_date')} type="date" />
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <PrintBtn size="md" />
      </div>
    </div>
  )
}
