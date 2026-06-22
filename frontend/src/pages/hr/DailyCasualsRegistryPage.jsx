import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { printDailyCasualsRegistry } from '../../utils/print'

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

export default function DailyCasualsRegistryPage() {
  const navigate = useNavigate()
  const inputCls = 'border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40'

  const [header, setHeader] = useState({ project_name: '', date: '' })

  const [rows, setRows] = useState(() =>
    Array.from({ length: 26 }, (_, i) => ({
      no: i + 1, name: '', phone: '', id_no: '', time_in: '', time_out: '', signature: ''
    }))
  )

  const [footer, setFooter] = useState({
    remarks: '', foreman_name: '', foreman_sig: '', authorized_name: '', authorized_sig: ''
  })

  const setRow = (i, key, val) => setRows(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r))
  const f = (key) => (val) => setFooter(p => ({ ...p, [key]: val }))

  const handlePrint = () => {
    printDailyCasualsRegistry({ ...header, rows, ...footer })
  }

  const PrintBtn = () => (
    <button onClick={handlePrint}
      className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:bg-brand-red/90 transition-colors">
      <PrinterIcon className="w-3.5 h-3.5" />
      Print Registry
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
          <h1 className="text-sm font-bold text-brand-slate">Daily Casuals Registry</h1>
        </div>
        <PrintBtn />
      </div>

      {/* Registry Header */}
      <Section title="Registry Header">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Project Name" value={header.project_name} onChange={val => setHeader(p => ({ ...p, project_name: val }))} />
          <Field label="Date" type="date" value={header.date} onChange={val => setHeader(p => ({ ...p, date: val }))} />
        </div>
      </Section>

      {/* Registry Table */}
      <Section title="Daily Casuals Registry">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200 w-10">No.</th>
                <th className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">Name</th>
                <th className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">Phone No.</th>
                <th className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">ID No.</th>
                <th className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">Time In</th>
                <th className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200">Time Out</th>
                <th className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1.5 border-b border-gray-200 min-w-[100px]">Signature</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-2 py-1 text-center text-gray-500 font-medium w-10">{row.no}</td>
                  <td className="px-2 py-1"><input value={row.name}      onChange={e => setRow(i, 'name', e.target.value)}      className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.phone}     onChange={e => setRow(i, 'phone', e.target.value)}     className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.id_no}     onChange={e => setRow(i, 'id_no', e.target.value)}     className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.time_in}   onChange={e => setRow(i, 'time_in', e.target.value)}   className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.time_out}  onChange={e => setRow(i, 'time_out', e.target.value)}  className={inputCls} /></td>
                  <td className="px-2 py-1"><input value={row.signature} onChange={e => setRow(i, 'signature', e.target.value)} className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Footer / Certification */}
      <Section title="Certification">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Textarea label="Remarks" value={footer.remarks} onChange={f('remarks')} rows={3} />
          </div>
          <Field label="Foreman / Supervisor Name"      value={footer.foreman_name}     onChange={f('foreman_name')} />
          <Field label="Foreman / Supervisor Signature" value={footer.foreman_sig}      onChange={f('foreman_sig')} />
          <Field label="Authorized By Name"             value={footer.authorized_name}  onChange={f('authorized_name')} />
          <Field label="Authorized By Signature"        value={footer.authorized_sig}   onChange={f('authorized_sig')} />
        </div>
      </Section>

      {/* Bottom print button */}
      <div className="flex justify-end">
        <PrintBtn />
      </div>
    </div>
  )
}
