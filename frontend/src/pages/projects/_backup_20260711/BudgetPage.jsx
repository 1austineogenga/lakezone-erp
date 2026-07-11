import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { PlusIcon } from '@heroicons/react/24/outline'
import {
  getProjectBudgets, createBudget, getBudgetSummary, getBudgetItems, createBudgetItem,
} from '../../api/projects'
import usePermissions from '../../hooks/usePermissions'

const STATUS_OPTIONS = ['draft', 'active', 'locked']
const CATEGORY_OPTIONS = ['materials', 'fuel', 'labour', 'casuals', 'equipment', 'overheads', 'other']

const fmt = v => `KES ${Number(v || 0).toLocaleString()}`

const EMPTY_BUDGET_FORM = { title: '', period_weeks: 8, status: 'draft' }
const EMPTY_ITEM_FORM = {
  week_no: '', month: '', category: 'materials', description: '', quantity: '',
  unit: '', base_rate: '', base_cost: '', high_case_cost: '',
}

export default function BudgetPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const { canWrite } = usePermissions()
  const canEdit = canWrite('projects')

  const [tab, setTab] = useState('category')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [budgetForm, setBudgetForm] = useState(EMPTY_BUDGET_FORM)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM)
  const [itemSearch, setItemSearch] = useState('')

  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ['project-budgets', projectId],
    queryFn: () => getProjectBudgets(projectId),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!projectId,
  })

  const activeBudget = budgets[0] || null

  const { data: summary } = useQuery({
    queryKey: ['budget-summary', projectId, activeBudget?.id],
    queryFn: () => getBudgetSummary(projectId, activeBudget.id),
    select: r => r.data,
    enabled: !!activeBudget,
  })

  const { data: items = [] } = useQuery({
    queryKey: ['budget-items', projectId, activeBudget?.id],
    queryFn: () => getBudgetItems(projectId, activeBudget.id),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!activeBudget,
  })

  const createBudgetMut = useMutation({
    mutationFn: data => createBudget(projectId, data),
    onSuccess: () => {
      toast.success('Budget created.')
      qc.invalidateQueries({ queryKey: ['project-budgets', projectId] })
      setShowCreateForm(false)
      setBudgetForm(EMPTY_BUDGET_FORM)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to create budget.'),
  })

  const createItemMut = useMutation({
    mutationFn: data => createBudgetItem(projectId, activeBudget.id, data),
    onSuccess: () => {
      toast.success('Item added.')
      qc.invalidateQueries({ queryKey: ['budget-items', projectId, activeBudget?.id] })
      qc.invalidateQueries({ queryKey: ['budget-summary', projectId, activeBudget?.id] })
      setShowItemModal(false)
      setItemForm(EMPTY_ITEM_FORM)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to add item.'),
  })

  const bField = (k, v) => setBudgetForm(f => ({ ...f, [k]: v }))
  const iField = (k, v) => setItemForm(f => ({ ...f, [k]: v }))

  const totals = summary?.totals || {}
  const byCategory = summary?.by_category || []
  const byWeek = summary?.by_week || []

  const filteredItems = items.filter(it =>
    !itemSearch ||
    it.description?.toLowerCase().includes(itemSearch.toLowerCase()) ||
    it.category?.toLowerCase().includes(itemSearch.toLowerCase())
  )

  if (loadingBudgets) {
    return <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
  }

  if (!activeBudget && !showCreateForm) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Budget</h2>
          <p className="text-xs text-gray-600 mt-0.5">No budget created yet</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <p className="text-sm font-medium text-gray-600 mb-4">No budget for this project yet.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90"
          >
            Create Budget
          </button>
        </div>
      </div>
    )
  }

  if (showCreateForm) {
    return (
      <div className="space-y-4">
        <h2 className="font-bold text-brand-slate text-lg">Create Budget</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-md">
          <form onSubmit={e => { e.preventDefault(); createBudgetMut.mutate({ ...budgetForm, period_weeks: Number(budgetForm.period_weeks) }) }} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input type="text" value={budgetForm.title} onChange={e => bField('title', e.target.value)}
                placeholder="e.g. 2024 Project Budget"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Period (weeks)</label>
              <input type="number" value={budgetForm.period_weeks} onChange={e => bField('period_weeks', e.target.value)}
                min={1} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={budgetForm.status} onChange={e => bField('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={createBudgetMut.isPending}
                className="px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                {createBudgetMut.isPending ? 'Creating…' : 'Create Budget'}
              </button>
              {activeBudget && (
                <button type="button" onClick={() => setShowCreateForm(false)}
                  className="px-5 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Budget</h2>
          <p className="text-xs text-gray-600 mt-0.5">{activeBudget.title || 'Project Budget'} · {activeBudget.period_weeks} weeks</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
            <PlusIcon className="h-3.5 w-3.5" /> New Budget
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Base Total',        val: fmt(totals.base),             bg: 'bg-blue-50',    border: 'border-l-blue-500',    text: 'text-blue-700' },
          { label: 'High Case',         val: fmt(totals.high),             bg: 'bg-orange-50',  border: 'border-l-orange-500',  text: 'text-orange-700' },
          { label: 'Low Case',          val: fmt(totals.low),              bg: 'bg-green-50',   border: 'border-l-green-500',   text: 'text-green-700' },
          { label: 'Variance Reserve',  val: fmt(totals.variance_reserve), bg: 'bg-slate-50',   border: 'border-l-slate-500',   text: 'text-slate-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-200 border-l-4 ${s.border} rounded-xl p-4`}>
            <p className={`text-lg font-bold ${s.text}`}>{s.val}</p>
            <p className="text-xs text-gray-600 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'category', label: 'By Category' },
          { id: 'week',     label: 'By Week' },
          { id: 'items',    label: 'Line Items' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-brand-slate'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'category' && (
        <div className="space-y-4">
          {byCategory.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-brand-slate text-sm mb-4">Cost by Category</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byCategory} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => `KES ${Number(v).toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="base_total" name="Base Cost" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="high_total" name="High Case" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="font-semibold text-brand-slate text-sm">Category Breakdown</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Category', 'Items', 'Base Total', 'High Case Total'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byCategory.map(row => (
                  <tr key={row.category} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 capitalize font-medium text-brand-slate">{row.category}</td>
                    <td className="px-4 py-2.5 text-gray-600">{row.count}</td>
                    <td className="px-4 py-2.5 font-medium">{fmt(row.base_total)}</td>
                    <td className="px-4 py-2.5 text-orange-600">{fmt(row.high_total)}</td>
                  </tr>
                ))}
                {byCategory.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600">No data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'week' && (
        <div className="space-y-4">
          {byWeek.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-brand-slate text-sm mb-4">Weekly Cost Breakdown (Stacked)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byWeek}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="week_no" tickFormatter={w => `Wk ${w}`} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => `KES ${Number(v).toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="materials" name="Materials" fill="#3b82f6" stackId="a" />
                  <Bar dataKey="fuel"      name="Fuel"      fill="#f97316" stackId="a" />
                  <Bar dataKey="labour"    name="Labour"    fill="#8b5cf6" stackId="a" />
                  <Bar dataKey="casuals"   name="Casuals"   fill="#10b981" stackId="a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="font-semibold text-brand-slate text-sm">Weekly Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Week', 'Materials', 'Fuel', 'Labour', 'Casuals', 'Base Total'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {byWeek.map(row => (
                    <tr key={row.week_no} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-brand-slate">Week {row.week_no}</td>
                      <td className="px-4 py-2.5">{fmt(row.materials)}</td>
                      <td className="px-4 py-2.5">{fmt(row.fuel)}</td>
                      <td className="px-4 py-2.5">{fmt(row.labour)}</td>
                      <td className="px-4 py-2.5">{fmt(row.casuals)}</td>
                      <td className="px-4 py-2.5 font-semibold">{fmt(row.base_total)}</td>
                    </tr>
                  ))}
                  {byWeek.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">No weekly data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'items' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search items…"
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red"
            />
            {canEdit && (
              <button onClick={() => setShowItemModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
                <PlusIcon className="h-3.5 w-3.5" /> Add Item
              </button>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Week', 'Month', 'Category', 'Description', 'Qty', 'Unit', 'Base Rate', 'Base Cost', 'High Case'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-medium text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-gray-600">{item.week_no}</td>
                      <td className="px-3 py-2.5 text-gray-600">{item.month}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[200px] truncate">{item.description}</td>
                      <td className="px-3 py-2.5">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-gray-600">{item.unit}</td>
                      <td className="px-3 py-2.5">{fmt(item.base_rate)}</td>
                      <td className="px-3 py-2.5 font-medium">{fmt(item.base_cost)}</td>
                      <td className="px-3 py-2.5 text-orange-600">{fmt(item.high_case_cost)}</td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-600">No items found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-brand-slate">Add Budget Item</h3>
              <button onClick={() => { setShowItemModal(false); setItemForm(EMPTY_ITEM_FORM) }}
                className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createItemMut.mutate(itemForm) }} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Week #', key: 'week_no', type: 'number' },
                  { label: 'Month', key: 'month', placeholder: 'e.g. January' },
                  { label: 'Quantity', key: 'quantity', type: 'number' },
                  { label: 'Unit', key: 'unit', placeholder: 'e.g. m3' },
                  { label: 'Base Rate (KES)', key: 'base_rate', type: 'number' },
                  { label: 'Base Cost (KES)', key: 'base_cost', type: 'number' },
                  { label: 'High Case (KES)', key: 'high_case_cost', type: 'number' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input type={type || 'text'} value={itemForm[key]} onChange={e => iField(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={itemForm.category} onChange={e => iField('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input type="text" value={itemForm.description} onChange={e => iField('description', e.target.value)}
                  placeholder="Item description"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={createItemMut.isPending}
                  className="px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                  {createItemMut.isPending ? 'Saving…' : 'Add Item'}
                </button>
                <button type="button" onClick={() => { setShowItemModal(false); setItemForm(EMPTY_ITEM_FORM) }}
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
