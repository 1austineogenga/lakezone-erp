import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { printCounterIssueVoucher } from '../../utils/print'

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

export default function CounterIssueVoucherPage() {
  const navigate = useNavigate()

  const [header, setHeader] = useState({ date: '', issue_point: '', issued_to: '' })
  const [items, setItems] = useState(Array(4).fill(null).map(() => ({ description: '', qty_requested: '', qty_issued: '', remarks: '' })))
  const [signatories, setSignatories] = useState([
    { role: 'Requisition Officer', name: '', designation: '', signature: '', date: '' },
    { role: 'Issuing Officer', name: '', designation: '', signature: '', date: '' },
    { role: 'Receiving Officer', name: '', designation: '', signature: '', date: '' },
  ])

  const setItemField = (i, key, val) => setItems(p => p.map((it, j) => j === i ? { ...it, [key]: val } : it))
  const setSig = (i, key, val) => setSignatories(p => p.map((s, j) => j === i ? { ...s, [key]: val } : s))

  const handlePrint = () => printCounterIssueVoucher({ ...header, items, signatories })

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
          <h1 className="text-sm font-bold text-brand-slate">Counter Issue Voucher</h1>
        </div>
        {PrintBtn}
      </div>

      {/* Header */}
      <Section title="Voucher Details">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date" type="date" value={header.date} onChange={v => setHeader(p => ({ ...p, date: v }))} />
          <Field label="Issue Point" value={header.issue_point} onChange={v => setHeader(p => ({ ...p, issue_point: v }))} />
          <Field label="Issued To" value={header.issued_to} onChange={v => setHeader(p => ({ ...p, issued_to: v }))} />
        </div>
      </Section>

      {/* Items (transposed) */}
      <Section title="Counter Issue Items">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-600 w-32">Item</th>
                {items.map((item, i) => (
                  <th key={i} className="border border-gray-200 p-1">
                    <input value={item.description} onChange={e => setItemField(i, 'description', e.target.value)}
                      className={inputCls} placeholder={`Item ${i + 1}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Qty Requested', 'qty_requested'],
                ['Qty Issued', 'qty_issued'],
                ['Remarks', 'remarks'],
              ].map(([label, key]) => (
                <tr key={key}>
                  <td className="border border-gray-200 px-2 py-1.5 font-medium text-brand-slate">{label}</td>
                  {items.map((item, i) => (
                    <td key={i} className="border border-gray-200 p-1">
                      <input value={item[key]} onChange={e => setItemField(i, key, e.target.value)} className={inputCls} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setItems(p => [...p, { description: '', qty_requested: '', qty_issued: '', remarks: '' }])}
            className="mt-2 text-xs text-brand-red hover:underline">+ Add item column</button>
        </div>
      </Section>

      {/* Signatories */}
      <Section title="Signatories">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Role', 'Name', 'Designation', 'Signature', 'Date'].map(h => (
                  <th key={h} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signatories.map((s, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 px-2 py-1.5 font-medium text-brand-slate whitespace-nowrap">{s.role}</td>
                  <td className="border border-gray-200 p-1"><input value={s.name} onChange={e => setSig(i, 'name', e.target.value)} className={inputCls} /></td>
                  <td className="border border-gray-200 p-1"><input value={s.designation} onChange={e => setSig(i, 'designation', e.target.value)} className={inputCls} /></td>
                  <td className="border border-gray-200 p-1"><input value={s.signature} onChange={e => setSig(i, 'signature', e.target.value)} className={inputCls} /></td>
                  <td className="border border-gray-200 p-1"><input type="date" value={s.date} onChange={e => setSig(i, 'date', e.target.value)} className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Bottom print */}
      <div className="flex justify-end">{PrintBtn}</div>
    </div>
  )
}
