import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getPayrollPeriod, getPayrollEntries, generatePayroll, approvePayroll } from '../../api/hr'
import { ArrowLeftIcon, BoltIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import api from '../../api/client'

const fmt = n => `KES ${Number(n || 0).toLocaleString()}`

const STATUS_COLORS = {
  draft:      'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  approved:   'bg-green-100 text-green-700',
  paid:       'bg-emerald-100 text-emerald-700',
  closed:     'bg-gray-100 text-gray-400',
}

export default function PayrollPeriodPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: period, isLoading: loadingPeriod } = useQuery({
    queryKey: ['payroll-period', id],
    queryFn: () => getPayrollPeriod(id),
    select: r => r.data,
  })

  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ['payroll-entries', id],
    queryFn: () => getPayrollEntries({ period: id }),
    select: r => r.data,
  })

  const generateMut = useMutation({
    mutationFn: generatePayroll,
    onSuccess: d => {
      toast.success(`Generated ${d.data.created} entries.`)
      qc.invalidateQueries(['payroll-period', id])
      qc.invalidateQueries(['payroll-entries', id])
    },
  })

  const approveMut = useMutation({
    mutationFn: approvePayroll,
    onSuccess: () => {
      toast.success('Payroll approved.')
      qc.invalidateQueries(['payroll-period', id])
    },
  })

  const payMut = useMutation({
    mutationFn: () => api.post(`/hr/payroll/periods/${id}/pay/`),
    onSuccess: () => {
      toast.success('Payroll marked as paid.')
      qc.invalidateQueries(['payroll-period', id])
    },
  })

  if (loadingPeriod) return <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
  if (!period) return null

  const totalGross = entries?.reduce((s, e) => s + Number(e.gross_pay || 0), 0) || 0
  const totalPAYE  = entries?.reduce((s, e) => s + Number(e.paye || 0), 0) || 0
  const totalNSSF  = entries?.reduce((s, e) => s + Number(e.nssf_employee || 0), 0) || 0
  const totalNHIF  = entries?.reduce((s, e) => s + Number(e.nhif_employee || 0), 0) || 0
  const totalNet   = entries?.reduce((s, e) => s + Number(e.net_pay || 0), 0) || 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/hr/payroll')} className="text-gray-400 hover:text-brand-slate mt-1">
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-bold text-brand-slate text-lg">{period.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[period.status]}`}>
              {period.status}
            </span>
            <div className="ml-auto flex gap-2">
              {period.status === 'draft' && (
                <button onClick={() => generateMut.mutate(id)} disabled={generateMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  <BoltIcon className="h-3.5 w-3.5" /> Generate Payroll
                </button>
              )}
              {period.status === 'processing' && (
                <button onClick={() => approveMut.mutate(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
                </button>
              )}
              {period.status === 'approved' && (
                <button onClick={() => payMut.mutate()}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">
                  Mark as Paid
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">Payment Date: {period.payment_date || '—'}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Gross Pay',    val: totalGross, color: 'text-brand-slate' },
          { label: 'PAYE',         val: totalPAYE,  color: 'text-red-600' },
          { label: 'NSSF',         val: totalNSSF,  color: 'text-orange-600' },
          { label: 'NHIF / SHIF',  val: totalNHIF,  color: 'text-yellow-700' },
          { label: 'Net Pay',      val: totalNet,   color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{fmt(s.val)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Payroll entries table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate text-sm">Payroll Entries</h3>
          <span className="text-xs text-gray-400">{entries?.length || 0} employees</span>
        </div>
        {loadingEntries
          ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
          : !entries || entries.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No entries. Generate payroll first.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Employee', 'Type', 'Gross Pay', 'PAYE', 'NSSF', 'NHIF', 'Other Deductions', 'Net Pay'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-brand-slate text-xs">{e.employee_number}</p>
                          <p className="text-xs text-gray-500">{e.full_name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${e.employment_type === 'staff' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                            {e.employment_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-xs">{fmt(e.gross_pay)}</td>
                        <td className="px-4 py-3 text-xs text-red-600">{fmt(e.paye)}</td>
                        <td className="px-4 py-3 text-xs text-orange-600">{fmt(e.nssf_employee)}</td>
                        <td className="px-4 py-3 text-xs text-yellow-700">{fmt(e.nhif_employee)}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{fmt(e.other_deductions)}</td>
                        <td className="px-4 py-3 font-bold text-xs text-green-600">{fmt(e.net_pay)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-xs font-bold text-gray-700">TOTALS</td>
                      <td className="px-4 py-3 text-xs font-bold">{fmt(totalGross)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-red-600">{fmt(totalPAYE)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-orange-600">{fmt(totalNSSF)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-yellow-700">{fmt(totalNHIF)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-600">—</td>
                      <td className="px-4 py-3 text-xs font-bold text-green-600">{fmt(totalNet)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
        }
      </div>
    </div>
  )
}
