import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getFinanceDashboard } from '../../api/finance'
import {
  ArrowTrendingUpIcon, ArrowTrendingDownIcon,
  ExclamationTriangleIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

const StatCard = ({ label, value, sub, subColor = 'text-gray-400', icon: Icon, iconColor }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <div className="flex items-start justify-between mb-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <div className={`p-2 rounded-lg bg-opacity-10 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
    <p className="text-xl font-bold text-brand-slate">{value}</p>
    {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
  </div>
)

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700',
  certified: 'bg-indigo-100 text-indigo-700', partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700',
  disputed: 'bg-orange-100 text-orange-700', cancelled: 'bg-gray-100 text-gray-400',
  pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700',
}

export default function FinanceDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn:  getFinanceDashboard,
    select:   r => r.data,
  })

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
  if (!data) return null

  const { ar, ap, recent_invoices, recent_bills } = data

  return (
    <div className="space-y-6">
      {/* AR Summary */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Accounts Receivable
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Billed" value={fmt(ar.total_billed)}
            icon={ArrowTrendingUpIcon} iconColor="bg-blue-500 text-blue-500" />
          <StatCard label="Received" value={fmt(ar.total_received)}
            icon={CheckCircleIcon} iconColor="bg-green-500 text-green-500"
            sub={`${ar.total_billed > 0 ? Math.round((ar.total_received / ar.total_billed) * 100) : 0}% collected`}
            subColor="text-green-500" />
          <StatCard label="Outstanding" value={fmt(ar.total_outstanding)}
            icon={ArrowTrendingUpIcon} iconColor="bg-yellow-500 text-yellow-500" />
          <StatCard label="Overdue" value={fmt(ar.overdue)}
            icon={ExclamationTriangleIcon} iconColor="bg-red-500 text-red-500"
            sub="Requires follow-up" subColor="text-red-500" />
        </div>
      </div>

      {/* AP Summary */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Accounts Payable
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Payable" value={fmt(ap.total_billed)}
            icon={ArrowTrendingDownIcon} iconColor="bg-purple-500 text-purple-500" />
          <StatCard label="Paid" value={fmt(ap.total_paid)}
            icon={CheckCircleIcon} iconColor="bg-green-500 text-green-500"
            sub={`${ap.total_billed > 0 ? Math.round((ap.total_paid / ap.total_billed) * 100) : 0}% paid`}
            subColor="text-green-500" />
          <StatCard label="Outstanding" value={fmt(ap.total_outstanding)}
            icon={ArrowTrendingDownIcon} iconColor="bg-yellow-500 text-yellow-500" />
          <StatCard label="Overdue" value={fmt(ap.overdue)}
            icon={ExclamationTriangleIcon} iconColor="bg-red-500 text-red-500"
            sub="Past due date" subColor="text-red-500" />
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent invoices */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Recent Invoices (AR)</h3>
            <Link to="/finance/invoices" className="text-xs text-brand-red hover:underline">View all</Link>
          </div>
          {recent_invoices.length === 0
            ? <p className="text-sm text-gray-400 p-5">No invoices yet.</p>
            : <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {recent_invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-mono text-xs text-brand-slate font-medium">{inv.invoice_number}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[140px]">{inv.client_name}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <p className="text-xs font-medium">{fmt(inv.total_amount)}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[inv.status]}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        {/* Recent bills */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Recent Bills (AP)</h3>
            <Link to="/finance/bills" className="text-xs text-brand-red hover:underline">View all</Link>
          </div>
          {recent_bills.length === 0
            ? <p className="text-sm text-gray-400 p-5">No bills yet.</p>
            : <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {recent_bills.map(bill => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-mono text-xs text-brand-slate font-medium">{bill.bill_number}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[140px]">{bill.supplier_name}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <p className="text-xs font-medium">{fmt(bill.total_amount)}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[bill.status]}`}>
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>
    </div>
  )
}
