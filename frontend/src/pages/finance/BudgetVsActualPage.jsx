import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getBudgetVsActual, getBudgets, createBudget, deleteBudget } from '../../api/finance'
import api from '../../api/client'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

const COST_CODE_LABELS = {
  materials: 'Materials', labour: 'Labour', plant: 'Plant & Equipment',
  subcontractor: 'Subcontractor', preliminaries: 'Preliminaries',
  overhead: 'Overhead', other: 'Other',
}

export default function BudgetVsActualPage() {
  const qc = useQueryClient()
  const [projectId, setProjectId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ project: '', cost_code: 'materials', description: '', budgeted_amount: '' })

  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/projects/'),
    select: r => r.data,
  })

  const { data: bva, isLoading } = useQuery({
    queryKey: ['budget-vs-actual', projectId],
    queryFn: () => getBudgetVsActual(projectId ? { project: projectId } : undefined),
    select: r => r.data,
  })

  const createMut = useMutation({
    mutationFn: createBudget,
    onSuccess: () => {
      toast.success('Budget line added.')
      qc.invalidateQueries(['budget-vs-actual'])
      setShowForm(false)
      setForm({ project: '', cost_code: 'materials', description: '', budgeted_amount: '' })
    },
    onError: () => toast.error('Failed to save budget line.'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => { toast.success('Deleted.'); qc.invalidateQueries(['budget-vs-actual']) },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createMut.mutate({ ...form, budgeted_amount: parseFloat(form.budgeted_amount) })
  }

  const rows = bva?.rows || []
  const totals = bva?.totals || {}

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
          <option value="">All Projects</option>
          {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setShowForm(s => !s)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
          <PlusIcon className="h-4 w-4" /> Add Budget Line
        </button>
      </div>

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Budgeted</p>
            <p className="text-xl font-bold text-brand-slate">{fmt(totals.budgeted)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Actual Cost</p>
            <p className="text-xl font-bold text-gray-700">{fmt(totals.actual)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Variance</p>
            <p className={`text-xl font-bold ${totals.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totals.variance >= 0 ? '+' : ''}{fmt(totals.variance)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {totals.variance >= 0 ? 'Under budget' : 'Over budget'}
            </p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Budget Line</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Project *</label>
              <select required value={form.project} onChange={e => setForm({...form, project: e.target.value})}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
                <option value="">Select project…</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cost Code *</label>
              <select required value={form.cost_code} onChange={e => setForm({...form, cost_code: e.target.value})}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
                {Object.entries(COST_CODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Budgeted Amount (KES) *</label>
              <input required type="number" min="0" step="0.01" value={form.budgeted_amount}
                onChange={e => setForm({...form, budgeted_amount: e.target.value})}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-brand-red-dark disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Budget vs Actual by Cost Code</h3>
        </div>
        {isLoading
          ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
          : rows.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No budget lines. Add budget lines above to compare against actuals.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Project', 'Cost Code', 'Description', 'Budgeted', 'Actual', 'Variance', '%', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(row => {
                      const overBudget = row.variance < 0
                      const pct = Math.abs(row.variance_pct)
                      return (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700 text-xs">{row.project_name}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              {COST_CODE_LABELS[row.cost_code] || row.cost_code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row.description || '—'}</td>
                          <td className="px-4 py-3 font-medium text-brand-slate">{fmt(row.budgeted)}</td>
                          <td className="px-4 py-3 text-gray-700">{fmt(row.actual)}</td>
                          <td className={`px-4 py-3 font-semibold ${overBudget ? 'text-red-600' : 'text-green-600'}`}>
                            {overBudget ? '-' : '+'}{fmt(Math.abs(row.variance))}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${overBudget ? 'bg-red-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${overBudget ? 'text-red-600' : 'text-green-600'}`}>
                                {overBudget ? '-' : '+'}{pct}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => deleteMut.mutate(row.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors">
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-semibold text-gray-600 text-sm">Totals</td>
                      <td className="px-4 py-3 font-bold text-brand-slate">{fmt(totals.budgeted)}</td>
                      <td className="px-4 py-3 font-bold text-gray-700">{fmt(totals.actual)}</td>
                      <td className={`px-4 py-3 font-bold ${totals.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totals.variance >= 0 ? '+' : ''}{fmt(totals.variance)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
        }
      </div>
    </div>
  )
}
