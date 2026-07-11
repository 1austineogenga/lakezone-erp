import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  PencilSquareIcon,
  ArrowTrendingUpIcon, ExclamationTriangleIcon, CheckCircleIcon,
  ArrowRightIcon, ShieldExclamationIcon, ClipboardDocumentListIcon,
  ListBulletIcon, CurrencyDollarIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import { getProjectDashboard, updateProject } from '../../api/projects'
import usePermissions from '../../hooks/usePermissions'

const IPC_STATUS_COLORS = {
  draft:      'bg-gray-100 text-gray-600',
  submitted:  'bg-blue-100 text-blue-700',
  certified:  'bg-green-100 text-green-700',
  paid:       'bg-emerald-100 text-emerald-700',
  disputed:   'bg-red-100 text-red-700',
}

function EditProjectModal({ project, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name:            project.name || '',
    client:          project.client || '',
    contract_number: project.contract_number || '',
    contract_value:  project.contract_value || '',
    location:        project.location || '',
    latitude:        project.latitude || '',
    longitude:       project.longitude || '',
    status:          project.status || 'active',
    start_date:      project.start_date || '',
    end_date:        project.end_date || '',
    description:     project.description || '',
  })

  const mut = useMutation({
    mutationFn: (data) => updateProject(project.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-dashboard', project.id] })
      toast.success('Project updated')
      onClose()
    },
    onError: () => toast.error('Failed to update project'),
  })

  const field = (label, key, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea
          rows={3}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
        />
      ) : type === 'select' ? (
        <select
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
        >
          {[['planning','Planning'],['active','Active'],['on_hold','On Hold'],['completed','Completed'],['suspended','Suspended']].map(([v,l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
        />
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold text-base">Edit Project Details</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {field('Project Name', 'name')}
          <div className="grid grid-cols-2 gap-4">
            {field('Client', 'client')}
            {field('Contract Number', 'contract_number')}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Contract Value (KES)', 'contract_value', 'number')}
            {field('Status', 'status', 'select')}
          </div>
          {field('Location', 'location')}
          <div className="grid grid-cols-2 gap-4">
            {field('Latitude', 'latitude', 'number')}
            {field('Longitude', 'longitude', 'number')}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Start Date', 'start_date', 'date')}
            {field('End Date', 'end_date', 'date')}
          </div>
          {field('Description', 'description', 'textarea')}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-4 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mut.mutate(form)}
            disabled={mut.isPending}
            className="px-5 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90"
          >
            {mut.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectDashboard({ dashData: prefetched }) {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const { canWrite } = usePermissions()
  const canEdit = canWrite('projects')

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-56 bg-gray-100 rounded-xl" />
        <div className="h-40 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  const project     = data?.project       || {}
  const budget      = data?.budget_summary || {}
  const ipcSummary  = data?.ipc_summary   || {}
  const riskSummary = data?.risk_summary  || {}
  const recentIPCs  = data?.recent_ipcs   || []

  const contractValue = Number(project.contract_value || 0)
  const totalActual   = Number(ipcSummary.total_claimed || 0)
  const boqProgress   = contractValue > 0 ? Math.min(100, Math.round((totalActual / contractValue) * 100)) : 0
  const variance      = totalActual - contractValue
  const isOverrun     = variance > 0

  const qc = useQueryClient()
  const goTab = (tab) => navigate(`/projects/${projectId}?tab=${tab}`)

  const generateWBSMut = useMutation({
    mutationFn: (replace) =>
      import('../../api/client').then(({ default: api }) =>
        api.post(`/projects/${projectId}/wbs/generate/`, { replace })
      ),
    onSuccess: (res) => {
      toast.success(res.data.detail)
      qc.invalidateQueries({ queryKey: ['wbs', projectId] })
      goTab('wbs')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to generate WBS.'),
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Project Dashboard</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            BOQ-driven overview · {project.client} · {project.location}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-500 hover:text-brand-slate hover:border-gray-300"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" /> Edit Details
          </button>
        )}
      </div>
      {editing && <EditProjectModal project={project} onClose={() => setEditing(false)} />}

      {/* ── Top KPI row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* 1. Budget vs Actual */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Budget vs. Actual</p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500">Contract Value</span>
              <span className="text-sm font-bold text-brand-slate">KES {contractValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500">Claimed (IPCs)</span>
              <span className="text-sm font-bold text-green-700">KES {totalActual.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-baseline pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-500">Variance</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isOverrun ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {Math.abs(variance) === 0
                  ? 'On Budget'
                  : `${isOverrun ? '+' : '-'}KES ${Math.abs(variance).toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>

        {/* 2. BOQ Progress */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">BOQ Progress</p>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-3xl font-bold text-brand-slate">{boqProgress}%</span>
            <span className="text-xs text-gray-500 mb-1">Completed</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${boqProgress >= 80 ? 'bg-green-500' : boqProgress >= 40 ? 'bg-blue-500' : 'bg-amber-400'}`}
              style={{ width: `${boqProgress}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Based on IPC claims vs. contract value</p>
        </div>

        {/* 3. Resource Utilization */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resource Utilization</p>
          {[
            { label: 'Labour',    value: budget.labour?.base    || budget.labour,    color: 'bg-blue-500' },
            { label: 'Materials', value: budget.materials?.base || budget.materials, color: 'bg-green-500' },
            { label: 'Fuel',      value: budget.fuel?.base      || budget.fuel,      color: 'bg-amber-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="mb-2">
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium text-brand-slate">KES {Number(value || 0).toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${color}`} style={{ width: value ? '100%' : '0%' }} />
              </div>
            </div>
          ))}
        </div>

        {/* 4. Variance Alerts */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Variance Alerts</p>
          <div className="space-y-2">
            {[
              { label: 'Cost Overrun!',                            active: isOverrun,                                  color: 'text-red-600 bg-red-50' },
              { label: `Open Risks: ${riskSummary.open_count ?? 0}`,     active: (riskSummary.open_count ?? 0) > 0,       color: 'text-amber-600 bg-amber-50' },
              { label: `Critical Risks: ${riskSummary.critical_count ?? 0}`, active: (riskSummary.critical_count ?? 0) > 0, color: 'text-red-700 bg-red-50' },
              { label: 'Budget Approved',                          active: false,                                      color: 'text-green-600 bg-green-50' },
            ].map(({ label, active, color }) => (
              <div
                key={label}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium ${active ? color : 'text-gray-400 bg-gray-50'}`}
              >
                <CheckCircleIcon className={`h-4 w-4 shrink-0 ${active ? '' : 'text-gray-300'}`} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOQ & WBS section ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-brand-slate text-sm">BOQ &amp; WBS Budget</h3>
          <div className="flex gap-2">
            <button
              onClick={() => goTab('boq')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-slate text-white text-xs font-medium rounded-lg hover:opacity-90"
            >
              <ClipboardDocumentListIcon className="h-3.5 w-3.5" /> Upload BOQ File
            </button>
            <button
              onClick={() => generateWBSMut.mutate(false)}
              disabled={generateWBSMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ListBulletIcon className="h-3.5 w-3.5" />
              {generateWBSMut.isPending ? 'Generating…' : 'Generate WBS'}
            </button>
          </div>
        </div>
        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {['WBS Code', 'Task Description', 'Quantity', 'Labor Cost', 'Material Cost', 'Equipment', 'Fuel Cost', 'Total Budget'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 border border-gray-100 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <ListBulletIcon className="h-8 w-8 text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">No WBS tasks yet</p>
                      <p className="text-xs">Upload a BOQ file first, then generate WBS tasks automatically.</p>
                      <button
                        onClick={() => goTab('boq')}
                        className="mt-1 flex items-center gap-1 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90"
                      >
                        Go to BOQ <ArrowRightIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Budget chart + Risk register ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Budget Breakdown Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Budget Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { name: 'Materials', Base: Number(budget.materials?.base || budget.materials || 0), 'High Case': Number(budget.materials?.high || 0) },
              { name: 'Fuel',      Base: Number(budget.fuel?.base      || budget.fuel      || 0), 'High Case': Number(budget.fuel?.high      || 0) },
              { name: 'Labour',    Base: Number(budget.labour?.base    || budget.labour    || 0), 'High Case': Number(budget.labour?.high    || 0) },
              { name: 'Casuals',   Base: Number(budget.casuals?.base   || budget.casuals   || 0), 'High Case': Number(budget.casuals?.high   || 0) },
            ]} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => `KES ${Number(v).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Base" fill="#1e293b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="High Case" fill="#94a3b8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Register Summary */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-brand-slate text-sm">Risk Register</h3>
            <button
              onClick={() => goTab('risks')}
              className="flex items-center gap-1 text-xs text-brand-red hover:underline font-medium"
            >
              View All <ArrowRightIcon className="h-3 w-3" />
            </button>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Open',      value: riskSummary.open_count      ?? 0, color: 'text-red-600 bg-red-50 border-red-100' },
              { label: 'High',      value: riskSummary.high_count      ?? 0, color: 'text-orange-600 bg-orange-50 border-orange-100' },
              { label: 'Critical',  value: riskSummary.critical_count  ?? 0, color: 'text-red-800 bg-red-50 border-red-200' },
              { label: 'Mitigated', value: riskSummary.mitigated_count ?? 0, color: 'text-green-700 bg-green-50 border-green-100' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`border rounded-xl p-4 text-center ${color}`}>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs mt-0.5 opacity-80">{label}</p>
              </div>
            ))}
          </div>
          {data?.latest_progress && (
            <div className="px-5 pb-4 pt-0 border-t border-gray-100 mt-0">
              <p className="text-xs font-semibold text-brand-slate mt-3 mb-1">
                Latest Progress — Week {data.latest_progress.week_no}
              </p>
              <p className="text-xs text-gray-600">
                Actual Spend:{' '}
                <span className="font-medium">KES {Number(data.latest_progress.total_actual || 0).toLocaleString()}</span>
              </p>
              {data.latest_progress.progress_notes && (
                <p className="text-xs text-gray-500 mt-1 italic">{data.latest_progress.progress_notes}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent IPCs ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate text-sm">Recent IPCs</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{ipcSummary.ipc_count ?? 0} total</span>
            <button
              onClick={() => goTab('ipcs')}
              className="flex items-center gap-1 text-xs text-brand-red hover:underline font-medium"
            >
              View All <ArrowRightIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
        {recentIPCs.length === 0 ? (
          <p className="text-sm text-gray-500 p-8 text-center">
            No IPCs submitted yet.{' '}
            <button onClick={() => goTab('ipcs')} className="text-brand-red hover:underline">
              Go to IPCs →
            </button>
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['IPC #', 'Period', 'Chainage', 'Claimed', 'Certified', 'Paid', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>
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
        )}
      </div>
    </div>
  )
}
