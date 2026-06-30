import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getVATSummary, getWHTRegister } from '../../api/finance'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`
const fmtK = (n) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(Math.round(n))

export default function TaxCompliancePage() {
  const [view, setView] = useState('vat')

  const { data: vatData } = useQuery({
    queryKey: ['vat-summary'],
    queryFn: getVATSummary,
    select: r => r.data?.results ?? r.data,
  })

  const { data: whtData } = useQuery({
    queryKey: ['wht-register'],
    queryFn: getWHTRegister,
    select: r => r.data?.results ?? r.data,
  })

  return (
    <div className="space-y-5">
      {/* Toggle */}
      <div className="flex gap-2">
        {[
          { key: 'vat', label: 'VAT Summary (16%)' },
          { key: 'wht', label: 'WHT Register (KRA)' },
        ].map(opt => (
          <button key={opt.key} onClick={() => setView(opt.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${view === opt.key
                ? 'bg-brand-slate text-white border-brand-slate'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {view === 'vat' && <VATSection data={vatData} />}
      {view === 'wht' && <WHTSection data={whtData} />}
    </div>
  )
}

function VATSection({ data }) {
  if (!data) return <div className="p-8 text-center text-gray-600 text-sm">Loading…</div>

  const { monthly = [], totals = {} } = data

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Output VAT (Sales)</p>
          <p className="text-xl font-bold text-blue-700">{fmt(totals.output_vat)}</p>
          <p className="text-xs text-gray-600 mt-1">VAT charged on invoices issued</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Input VAT (Purchases)</p>
          <p className="text-xl font-bold text-purple-700">{fmt(totals.input_vat)}</p>
          <p className="text-xs text-gray-600 mt-1">VAT paid on bills received</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Net VAT Payable to KRA</p>
          <p className={`text-xl font-bold ${totals.net_vat_payable >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {fmt(totals.net_vat_payable)}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {totals.net_vat_payable >= 0 ? 'Payable to KRA' : 'VAT credit / refund due'}
          </p>
        </div>
      </div>

      {/* Chart */}
      {monthly.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Monthly VAT Position</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="output_vat" name="Output VAT" fill="#3b82f6" />
              <Bar dataKey="input_vat"  name="Input VAT"  fill="#8b5cf6" />
              <Bar dataKey="net_vat_payable" name="Net VAT" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Monthly VAT Return Summary</h3>
        </div>
        {monthly.length === 0
          ? <p className="text-sm text-gray-600 p-8 text-center">No VAT data yet.</p>
          : <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Period', 'Output VAT', 'Input VAT', 'Net VAT Payable', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthly.map(row => (
                  <tr key={row.month} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-brand-slate">{row.month}</td>
                    <td className="px-4 py-3 text-blue-700">{fmt(row.output_vat)}</td>
                    <td className="px-4 py-3 text-purple-700">{fmt(row.input_vat)}</td>
                    <td className={`px-4 py-3 font-semibold ${row.net_vat_payable >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt(row.net_vat_payable)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${row.net_vat_payable > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        {row.net_vat_payable > 0 ? 'Payable' : 'Credit'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  )
}

function WHTSection({ data }) {
  if (!data) return <div className="p-8 text-center text-gray-600 text-sm">Loading…</div>

  const { entries = [], by_supplier = [], total_wht = 0 } = data

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Total WHT Withheld</p>
          <p className="text-xl font-bold text-orange-600">{fmt(total_wht)}</p>
          <p className="text-xs text-gray-600 mt-1">Amount to remit to KRA</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Suppliers with WHT</p>
          <p className="text-xl font-bold text-brand-slate">{by_supplier.length}</p>
        </div>
      </div>

      {/* By supplier */}
      {by_supplier.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">WHT by Supplier (KRA Certificate Summary)</h3>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Supplier', 'Bills', 'Total WHT Withheld'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {by_supplier.map(s => (
                <tr key={s.supplier_name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.count}</td>
                  <td className="px-4 py-3 font-semibold text-orange-600">{fmt(s.total_wht)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail entries */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">WHT Transaction Register</h3>
        </div>
        {entries.length === 0
          ? <p className="text-sm text-gray-600 p-8 text-center">No WHT entries. Set withholding_tax on bills to populate this register.</p>
          : <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Bill #', 'Supplier', 'Project', 'Date', 'Subtotal', 'WHT Rate', 'WHT Amount'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map(e => (
                    <tr key={e.bill_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-brand-slate">{e.bill_number}</td>
                      <td className="px-4 py-3 text-gray-700">{e.supplier_name}</td>
                      <td className="px-4 py-3 text-gray-600">{e.project_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{e.issue_date}</td>
                      <td className="px-4 py-3">{fmt(e.subtotal)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-medium">
                          {e.wht_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-orange-600">{fmt(e.wht_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  )
}
