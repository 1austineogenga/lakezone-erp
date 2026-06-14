import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { getProjectDashboard } from '../../api/projects'

const IPC_STATUS_COLORS = {
  draft:      'bg-gray-100 text-gray-600',
  submitted:  'bg-blue-100 text-blue-700',
  certified:  'bg-green-100 text-green-700',
  paid:       'bg-emerald-100 text-emerald-700',
  disputed:   'bg-red-100 text-red-700',
}

export default function ProjectDashboard({ dashData: prefetched }) {
  const { projectId } = useParams()

  const { data: fetched, isLoading } = useQuery({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => getProjectDashboard(projectId),
    select: r => r.data,
    enabled: !!projectId && !prefetched,
  })

  const data = prefetched || fetched

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-56 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  const project      = data?.project      || {}
  const budget       = data?.budget_summary || {}
  const ipcSummary   = data?.ipc_summary   || {}
  const riskSummary  = data?.risk_summary  || {}
  const recentIPCs   = data?.recent_ipcs   || []

  const statCards = [
    {
      label: 'Contract Value',
      value: `KES ${Number(project.contract_value || 0).toLocaleString()}`,
      border: 'border-l-slate-500', bg: 'bg-slate-50', text: 'text-slate-700',
    },
    {
      label: 'Budget Base Total',
      value: `KES ${Number(budget.base_total || 0).toLocaleString()}`,
      border: 'border-l-blue-500', bg: 'bg-blue-50', text: 'text-blue-700',
    },
    {
      label: 'Total Claimed / IPCs',
      value: `KES ${Number(ipcSummary.total_claimed || 0).toLocaleString()}`,
      border: 'border-l-green-500', bg: 'bg-green-50', text: 'text-green-700',
    },
    {
      label: 'Total Paid',
      value: `KES ${Number(ipcSummary.total_paid || 0).toLocaleString()}`,
      border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700',
    },
    {
      label: 'Open Risks',
      value: riskSummary.open_count ?? 0,
      border: 'border-l-red-500', bg: 'bg-red-50', text: 'text-red-700',
    },
  ]

  const budgetChartData = [
    {
      name: 'Materials',
      Base: Number(budget.materials?.base || budget.materials || 0),
      'High Case': Number(budget.materials?.high || 0),
    },
    {
      name: 'Fuel',
      Base: Number(budget.fuel?.base || budget.fuel || 0),
      'High Case': Number(budget.fuel?.high || 0),
    },
    {
      name: 'Labour',
      Base: Number(budget.labour?.base || budget.labour || 0),
      'High Case': Number(budget.labour?.high || 0),
    },
    {
      name: 'Casuals',
      Base: Number(budget.casuals?.base || budget.casuals || 0),
      'High Case': Number(budget.casuals?.high || 0),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-bold text-brand-slate text-lg">Project Dashboard</h2>
        <p className="text-xs text-gray-400 mt-0.5">Overview of project financials and progress</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-200 border-l-4 ${s.border} rounded-xl p-4`}>
            <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Budget Breakdown Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Budget Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={budgetChartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => `KES ${Number(v).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Base" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="High Case" fill="#93c5fd" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Risk Summary</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[100px] bg-red-50 border border-red-100 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{riskSummary.open_count ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Open</p>
            </div>
            <div className="flex-1 min-w-[100px] bg-orange-50 border border-orange-100 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{riskSummary.high_count ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">High Impact</p>
            </div>
            <div className="flex-1 min-w-[100px] bg-red-50 border border-red-100 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-800">{riskSummary.critical_count ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Critical</p>
            </div>
            <div className="flex-1 min-w-[100px] bg-green-50 border border-green-100 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{riskSummary.mitigated_count ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Mitigated</p>
            </div>
          </div>

          {/* Latest Progress */}
          {data?.latest_progress && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-brand-slate mb-2">Latest Progress — Week {data.latest_progress.week_no}</p>
              <p className="text-xs text-gray-500">
                Actual Spend: <span className="font-medium text-brand-slate">KES {Number(data.latest_progress.total_actual || 0).toLocaleString()}</span>
              </p>
              {data.latest_progress.progress_notes && (
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{data.latest_progress.progress_notes}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* IPC List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate text-sm">Recent IPCs</h3>
          <span className="text-xs text-gray-400">{ipcSummary.ipc_count ?? 0} total</span>
        </div>
        {recentIPCs.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">No IPCs submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['IPC #', 'Period', 'Chainage', 'Claimed', 'Certified', 'Paid', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentIPCs.map(ipc => (
                  <tr key={ipc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-semibold text-brand-slate">{ipc.ipc_number}</td>
                    <td className="px-4 py-2.5 text-gray-600">{ipc.period_from} → {ipc.period_to}</td>
                    <td className="px-4 py-2.5 text-gray-600">{ipc.chainage_from} – {ipc.chainage_to}</td>
                    <td className="px-4 py-2.5 font-medium">KES {Number(ipc.amount_claimed || 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5">KES {Number(ipc.amount_certified || 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5">KES {Number(ipc.amount_paid || 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${IPC_STATUS_COLORS[ipc.status] || 'bg-gray-100 text-gray-600'}`}>
                        {ipc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
