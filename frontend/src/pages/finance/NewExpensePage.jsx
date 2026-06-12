import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { createExpense } from '../../api/finance'
import api from '../../api/client'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const CATEGORIES = ['materials', 'labour', 'plant', 'subcontractor', 'preliminaries', 'overhead', 'other']
const emptyItem = { date: '', description: '', category: 'other', amount: '', receipt_ref: '' }

export default function NewExpensePage() {
  const navigate = useNavigate()
  const [form, setForm]   = useState({ title: '', project: '', notes: '' })
  const [items, setItems] = useState([{ ...emptyItem }])

  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn:  () => api.get('/projects/'),
    select:   r => r.data,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: createExpense,
    onSuccess:  (res) => { toast.success(`Claim ${res.data.reference} created.`); navigate('/finance/expenses') },
    onError:    () => toast.error('Failed to create claim.'),
  })

  const setItem = (i, field, value) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))

  const total = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    mutate({
      ...form,
      project: form.project || null,
      items: items.map(it => ({ ...it, amount: parseFloat(it.amount) })),
    })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-brand-slate">New Expense Claim</h2>
        <p className="text-sm text-gray-500">Submit a reimbursement claim for business expenses</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-brand-slate mb-4">Claim Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                placeholder="e.g. Site visit expenses — Nairobi" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project (optional)</label>
              <select value={form.project} onChange={e => setForm({...form, project: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
                <option value="">No project</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                placeholder="Additional context…" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-brand-slate">Expense Items</h3>
            <button type="button" onClick={() => setItems(p => [...p, { ...emptyItem }])}
              className="flex items-center gap-1.5 text-xs text-brand-red font-medium">
              <PlusIcon className="h-4 w-4" /> Add Item
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Date *</label>}
                  <input required type="date" value={item.date} onChange={e => setItem(i, 'date', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-red" />
                </div>
                <div className="col-span-3">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Description *</label>}
                  <input required value={item.description} onChange={e => setItem(i, 'description', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder="What was spent on" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Category</label>}
                  <select value={item.category} onChange={e => setItem(i, 'category', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-red">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Amount (KES) *</label>}
                  <input required type="number" min="0" step="0.01" value={item.amount} onChange={e => setItem(i, 'amount', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder="0.00" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Receipt Ref</label>}
                  <input value={item.receipt_ref} onChange={e => setItem(i, 'receipt_ref', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder="Ref no." />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button type="button" disabled={items.length === 1} onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                    className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end text-sm">
            <span className="text-gray-500 mr-3">Total:</span>
            <span className="font-bold text-brand-slate">KES {total.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/finance/expenses')}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={isPending}
            className="px-5 py-2.5 text-sm font-medium text-white bg-brand-red hover:bg-brand-red-dark rounded-lg disabled:opacity-60">
            {isPending ? 'Saving…' : 'Save Claim'}
          </button>
        </div>
      </form>
    </div>
  )
}
