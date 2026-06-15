import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { PlusIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { printForemanWeekly, printSurveyorWeekly } from '../../utils/print'
import { getProgress, createProgress, getProjectBudgets, getBudgetItems } from '../../api/projects'

const fmt = v => `KES ${Number(v || 0).toLocaleString()}`

const EMPTY_FORM = {
  week_no: '', week_start: '', week_end: '',
  work_focus: '',
  materials_actual: '', fuel_actual: '', labour_actual: '', casuals_actual: '',
  casual_headcount: '', casual_person_days: '',
  progress_notes: '', issues: '', next_week_plan: '',
}

export default function WeeklyProgressPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: progressList = [], isLoading } = useQuery({
    queryKey: ['project-progress', projectId],
    queryFn: () => getProgress(projectId),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!projectId,
  })

  const { data: budgets = [] } = useQuery({
    queryKey: ['project-budgets', projectId],
    queryFn: () => getProjectBudgets(projectId),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!projectId,
  })

  const activeBudgetId = budgets[0]?.id

  const { data: budgetItems = [] } = useQuery({
    queryKey: ['budget-items', projectId, activeBudgetId],
    queryFn: () => getBudgetItems(projectId, activeBudgetId),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!activeBudgetId,
  })

  const createMut = useMutation({
    mutationFn: data => createProgress(projectId, data),
    onSuccess: () => {
      toast.success('Progress logged.')
      qc.invalidateQueries({ queryKey: ['project-progress', projectId] })
      setShowModal(false)
      setForm(EMPTY_FORM)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to log progress.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const totalActual = useMemo(() => {
    return (
      Number(form.materials_actual || 0) +
      Number(form.fuel_actual || 0) +
      Number(form.labour_actual || 0) +
      Number(form.casuals_actual || 0)
    )
  }, [form.materials_actual, form.fuel_actual, form.labour_actual, form.casuals_actual])

  // Build weekly budget lookup from items
  const weeklyBudget = useMemo(() => {
    const map = {}
    budgetItems.forEach(item => {
      const w = item.week_no
      if (w) map[w] = (map[w] || 0) + Number(item.base_cost || 0)
    })
    return map
  }, [budgetItems])

  // Chart data: cumulative actual vs cumulative budget
  const sorted = [...progressList].sort((a, b) => Number(a.week_no) - Number(b.week_no))
  let cumActual = 0
  let cumBudget = 0
  const chartData = sorted.map(p => {
    cumActual += Number(p.total_actual || 0)
    cumBudget += weeklyBudget[p.week_no] || 0
    return { week: `Wk ${p.week_no}`, 'Actual (cum)': cumActual, 'Budget (cum)': cumBudget }
  })

  const nextWeekNo = (sorted[sorted.length - 1]?.week_no || 0) + 1

  if (isLoading) return <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Weekly Progress</h2>
          <p className="text-xs text-gray-400 mt-0.5">{progressList.length} weeks logged</p>
        </div>
        <button onClick={() => { setForm(f => ({ ...f, week_no: String(nextWeekNo) })); setShowModal(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Log Week {nextWeekNo} Progress
        </button>
      </div>

      {/* Cumulative chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Cumulative Spend vs Budget</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => `KES ${Number(v).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Actual (cum)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Budget (cum)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Progress Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {progressList.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">No progress entries yet. Log the first week.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Week #', 'Period', 'Materials', 'Fuel', 'Labour', 'Casuals', 'Total Actual', 'Budget', 'Variance', 'Print'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map(p => {
                  const budget = weeklyBudget[p.week_no] || 0
                  const actual = Number(p.total_actual || 0)
                  const variance = budget - actual
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-semibold text-brand-slate">{p.week_no}</td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{p.week_start} → {p.week_end}</td>
                      <td className="px-3 py-3">{fmt(p.materials_actual)}</td>
                      <td className="px-3 py-3">{fmt(p.fuel_actual)}</td>
                      <td className="px-3 py-3">{fmt(p.labour_actual)}</td>
                      <td className="px-3 py-3">{fmt(p.casuals_actual)}</td>
                      <td className="px-3 py-3 font-semibold">{fmt(actual)}</td>
                      <td className="px-3 py-3 text-gray-500">{fmt(budget)}</td>
                      <td className={`px-3 py-3 font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variance >= 0 ? '+' : ''}{fmt(variance)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => printForemanWeekly(p)}
                            title="Print Foreman Weekly Report"
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-red font-medium whitespace-nowrap">
                            <PrinterIcon className="h-3.5 w-3.5" /> Foreman
                          </button>
                          <button onClick={() => printSurveyorWeekly(p)}
                            title="Print Surveyor Weekly Report"
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-red font-medium whitespace-nowrap">
                            <PrinterIcon className="h-3.5 w-3.5" /> Surveyor
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Progress Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-brand-slate">Log Weekly Progress</h3>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={e => {
              e.preventDefault()
              createMut.mutate({
                ...form,
                total_actual: totalActual,
                week_no: Number(form.week_no),
                materials_actual: Number(form.materials_actual || 0),
                fuel_actual: Number(form.fuel_actual || 0),
                labour_actual: Number(form.labour_actual || 0),
                casuals_actual: Number(form.casuals_actual || 0),
                casual_headcount: Number(form.casual_headcount || 0),
                casual_person_days: Number(form.casual_person_days || 0),
              })
            }} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Week #', key: 'week_no', type: 'number' },
                  { label: 'Week Start', key: 'week_start', type: 'date' },
                  { label: 'Week End', key: 'week_end', type: 'date' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input type={type} value={form[key]} onChange={e => field(key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Work Focus</label>
                <textarea rows={2} value={form.work_focus} onChange={e => field('work_focus', e.target.value)}
                  placeholder="Main activities this week…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-brand-slate">Actual Expenditure (KES)</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Materials Actual', key: 'materials_actual' },
                    { label: 'Fuel Actual', key: 'fuel_actual' },
                    { label: 'Labour Actual', key: 'labour_actual' },
                    { label: 'Casuals Actual', key: 'casuals_actual' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input type="number" value={form[key]} onChange={e => field(key, e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500">Total Actual: <span className="font-bold text-brand-slate">{fmt(totalActual)}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Casual Headcount', key: 'casual_headcount', type: 'number' },
                  { label: 'Casual Person-Days', key: 'casual_person_days', type: 'number' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input type={type} value={form[key]} onChange={e => field(key, e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                  </div>
                ))}
              </div>

              {[
                { label: 'Progress Notes', key: 'progress_notes', placeholder: 'What was achieved this week…' },
                { label: 'Issues / Blockers', key: 'issues', placeholder: 'Any issues encountered…' },
                { label: 'Next Week Plan', key: 'next_week_plan', placeholder: 'Plan for next week…' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <textarea rows={2} value={form[key]} onChange={e => field(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={createMut.isPending || !form.week_no}
                  className="px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                  {createMut.isPending ? 'Saving…' : 'Log Progress'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                  className="px-5 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
