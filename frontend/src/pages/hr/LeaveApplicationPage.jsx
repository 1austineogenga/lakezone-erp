import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { getLeaveApplications, getLeaveTypes } from '../../api/hr'
import { printLeaveApplication } from '../../utils/print'
import useAuthStore from '../../store/authStore'
import api from '../../api/client'

const inputCls = 'border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40'

function Field({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30" />
    </div>
  )
}

function Textarea({ label, value, onChange, rows = 2 }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-600 mb-1">{label}</label>
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


const OFFICE_LABELS = [
  'Leave Balance Brought Forward (Previous Year)',
  "Current Year's Leave Entitlement",
  'Leave Applied for (This Application)',
  'Leave Already Taken to Date',
  'Leave Days Outstanding (After this Leave)',
  'Supporting Documents Attached (If Applicable, Yes/NO)',
]

export default function LeaveApplicationPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const { data: leave } = useQuery({
    queryKey: ['leave-application', id],
    queryFn: () => getLeaveApplications({ id }),
    select: r => {
      const results = r.data?.results ?? r.data
      if (Array.isArray(results)) return results.find(l => String(l.id) === String(id))
      return r.data
    },
  })

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn:  () => getLeaveTypes().then(r => r.data?.results ?? r.data ?? []),
  })

  const [coverageLines, setCoverageLines] = useState(['','','','',''])
  const [coverageSig, setCoverageSig] = useState({ signature: '', date: '' })
  const [ackSig, setAckSig] = useState({ signature: '', id_no: '' })
  const [officeRows, setOfficeRows] = useState(
    OFFICE_LABELS.map((_, i) => ({ details: i === 2 ? '' : '', date: '' }))
  )
  const [hodSig, setHodSig] = useState({ name: '', signature: '' })
  const [hrSig, setHrSig] = useState({ name: '', signature: '' })

  if (!leave) return <p className="text-sm text-gray-600 p-8 text-center">Loading…</p>

  const handlePrint = () => printLeaveApplication(leave || {}, user || {})

  const PrintBtn = (
    <button onClick={handlePrint}
      className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:bg-brand-red/90 transition-colors">
      <PrinterIcon className="w-3.5 h-3.5" />
      Print
    </button>
  )

  return (
    <div className="space-y-5 pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)}>
            <ArrowLeftIcon className="w-4 h-4 text-gray-400 hover:text-brand-slate" />
          </button>
          <h1 className="text-sm font-bold text-brand-slate">Leave Application Form</h1>
        </div>
        {PrintBtn}
      </div>

      {/* Section A */}
      <Section title="A. Applicant Details">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Name', leave?.employee_name],
            ['Designation', leave?.employee_designation || '—'],
            ['Department', leave?.employee_department || '—'],
            ['Date', new Date().toLocaleDateString()],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-medium text-gray-600 mb-1">{label}</p>
              <p className="text-xs font-semibold text-brand-slate bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">{value || '—'}</p>
            </div>
          ))}
        </div>

        {/* Leave type checkboxes (read-only) */}
        <div className="mt-3">
          <p className="text-[10px] font-medium text-gray-600 mb-1">Leave Type</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
            {leaveTypes.map(lt => {
              const isChecked = lt.name === leave?.leave_type_name || lt.id === leave?.leave_type
              return (
                <label key={lt.id} className="flex items-center gap-1.5 text-xs cursor-default">
                  <span className={`inline-flex items-center justify-center w-4 h-4 border rounded ${isChecked ? 'bg-brand-red border-brand-red text-white' : 'border-gray-300'}`}>
                    {isChecked ? '✓' : ''}
                  </span>
                  {lt.name}
                </label>
              )
            })}
          </div>
        </div>

        {/* Dates (read-only) */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          {[
            ['From Date', leave?.start_date],
            ['To Date', leave?.end_date],
            ['No. of Days', leave?.days_requested],
            ['Time From', '___'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-medium text-gray-600 mb-1">{label}</p>
              <p className="text-xs font-semibold text-brand-slate bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">{value || '—'}</p>
            </div>
          ))}
        </div>

        {/* Reason (read-only) */}
        <div className="mt-3">
          <p className="text-[10px] font-medium text-gray-600 mb-1">Reason</p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-xs min-h-[48px]">{leave?.reason || '—'}</div>
        </div>
      </Section>

      {/* Section B */}
      <Section title="B. Leave Coverage">
        <p className="text-xs text-gray-600 mb-3">The following key duties will be performed by the covering staff during the leave period:</p>
        <div className="space-y-2">
          {coverageLines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-4">{i + 1}.</span>
              <input value={line} onChange={e => setCoverageLines(p => p.map((v, j) => j === i ? e.target.value : v))}
                className={inputCls} />
            </div>
          ))}
        </div>
        <button onClick={() => setCoverageLines(p => [...p, ''])}
          className="mt-2 text-xs text-brand-red hover:underline">+ Add line</button>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label="Employee Signature" value={coverageSig.signature} onChange={v => setCoverageSig(p => ({ ...p, signature: v }))} />
          <Field label="Date" type="date" value={coverageSig.date} onChange={v => setCoverageSig(p => ({ ...p, date: v }))} />
        </div>
      </Section>

      {/* Section C */}
      <Section title="C. Acknowledgment & Acceptance">
        <p className="text-xs text-gray-600 mb-3">I, the above-listed duties during the period of leave…</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Signature" value={ackSig.signature} onChange={v => setAckSig(p => ({ ...p, signature: v }))} />
          <Field label="ID No." value={ackSig.id_no} onChange={v => setAckSig(p => ({ ...p, id_no: v }))} />
        </div>
      </Section>

      {/* Section D */}
      <Section title="D. Office Use (HR Only)">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-600 w-8">#</th>
                <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-600">Item</th>
                <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-600">Days / Details</th>
                <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {OFFICE_LABELS.map((label, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 px-2 py-1.5 text-gray-600">{i + 1}</td>
                  <td className="border border-gray-200 px-2 py-1.5 text-brand-slate">{label}</td>
                  <td className="border border-gray-200 p-1">
                    <input
                      value={i === 2 && !officeRows[i].details ? (leave?.days_requested ?? '') : officeRows[i].details}
                      onChange={e => setOfficeRows(p => p.map((r, j) => j === i ? { ...r, details: e.target.value } : r))}
                      className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input type="date" value={officeRows[i].date}
                      onChange={e => setOfficeRows(p => p.map((r, j) => j === i ? { ...r, date: e.target.value } : r))}
                      className={inputCls} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-600 uppercase">HOD / Supervisor</p>
            <Field label="Name" value={hodSig.name} onChange={v => setHodSig(p => ({ ...p, name: v }))} />
            <Field label="Signature" value={hodSig.signature} onChange={v => setHodSig(p => ({ ...p, signature: v }))} />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-600 uppercase">HR Department</p>
            <Field label="Name" value={hrSig.name} onChange={v => setHrSig(p => ({ ...p, name: v }))} />
            <Field label="Signature" value={hrSig.signature} onChange={v => setHrSig(p => ({ ...p, signature: v }))} />
          </div>
        </div>
      </Section>

      {/* Bottom print button */}
      <div className="flex justify-end">{PrintBtn}</div>
    </div>
  )
}
