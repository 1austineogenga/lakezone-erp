import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { printInspectionAcceptance } from '../../utils/print'

const inputCls = 'border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-red/40'

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

export default function InspectionAcceptanceFormPage() {
  const navigate = useNavigate()

  const [header, setHeader] = useState({ date: '', supplier: '', order_no: '' })
  const [items, setItems] = useState(Array(12).fill(null).map(() => ({ units_qty: '', description: '' })))
  const [members, setMembers] = useState([
    { no: 1, name: '', designation: '', signature: '', date: '' },
    { no: 2, name: '', designation: '', signature: '', date: '' },
    { no: 3, name: '', designation: '', signature: '', date: '' },
  ])

  const setItem = (i, key, val) => setItems(p => p.map((it, j) => j === i ? { ...it, [key]: val } : it))
  const setMember = (i, key, val) => setMembers(p => p.map((m, j) => j === i ? { ...m, [key]: val } : m))

  const handlePrint = () => printInspectionAcceptance({ ...header, items, members })

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
          <h1 className="text-sm font-bold text-brand-slate">Inspection & Acceptance Form</h1>
        </div>
        {PrintBtn}
      </div>

      {/* Header */}
      <Section title="Inspection Details">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date" type="date" value={header.date} onChange={v => setHeader(p => ({ ...p, date: v }))} />
          <Field label="Supplier" value={header.supplier} onChange={v => setHeader(p => ({ ...p, supplier: v }))} />
          <Field label="Order No." value={header.order_no} onChange={v => setHeader(p => ({ ...p, order_no: v }))} />
        </div>
      </Section>

      {/* Items Table */}
      <Section title="Items Received">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-500 w-32">Units / Quantity</th>
                <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-500">Item Description</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 p-1">
                    <input value={item.units_qty} onChange={e => setItem(i, 'units_qty', e.target.value)} className={inputCls} />
                  </td>
                  <td className="border border-gray-200 p-1">
                    <input value={item.description} onChange={e => setItem(i, 'description', e.target.value)} className={inputCls} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setItems(p => [...p, { units_qty: '', description: '' }])}
            className="mt-2 text-xs text-brand-red hover:underline">+ Add row</button>
        </div>
      </Section>

      {/* Members */}
      <Section title="Inspection & Acceptance Members">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['#', 'Name', 'Designation', 'Signature', 'Date'].map(h => (
                  <th key={h} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 px-2 py-1.5 text-gray-500">{m.no}</td>
                  <td className="border border-gray-200 p-1"><input value={m.name} onChange={e => setMember(i, 'name', e.target.value)} className={inputCls} /></td>
                  <td className="border border-gray-200 p-1"><input value={m.designation} onChange={e => setMember(i, 'designation', e.target.value)} className={inputCls} /></td>
                  <td className="border border-gray-200 p-1"><input value={m.signature} onChange={e => setMember(i, 'signature', e.target.value)} className={inputCls} /></td>
                  <td className="border border-gray-200 p-1"><input type="date" value={m.date} onChange={e => setMember(i, 'date', e.target.value)} className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setMembers(p => [...p, { no: p.length + 1, name: '', designation: '', signature: '', date: '' }])}
            className="mt-2 text-xs text-brand-red hover:underline">+ Add row</button>
        </div>
      </Section>

      {/* Bottom print */}
      <div className="flex justify-end">{PrintBtn}</div>
    </div>
  )
}
