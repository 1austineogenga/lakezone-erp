import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { PlusIcon, TrashIcon, CheckIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'

const fmt   = (n) => `KES ${Number(n || 0).toLocaleString()}`
const fmtN  = (n) => Number(n || 0).toLocaleString()

const STATUS_COLORS = {
  draft:    'bg-gray-100 text-gray-600',
  posted:   'bg-green-100 text-green-700',
  reversed: 'bg-red-100 text-red-500',
}

const ENTRY_TYPES = [
  'manual', 'invoice', 'payment', 'bill', 'expense', 'payroll', 'adjustment', 'period_close',
]

const EMPTY_LINE = { account: '', description: '', debit: '', credit: '', project: '', cost_code: '' }

export default function GLJournalPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('journal')
  const [statusFilter, setStatusFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    entry_type: 'manual',
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    project: '',
    lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }],
  })

  const { data: journals, isLoading } = useQuery({
    queryKey: ['journals', statusFilter, periodFilter],
    queryFn: () => api.get('/finance/journals/', {
      params: {
        ...(statusFilter && { status: statusFilter }),
        ...(periodFilter && { period: periodFilter }),
      }
    }),
    select: r => r.data,
  })

  const { data: trialBalance } = useQuery({
    queryKey: ['trial-balance', periodFilter],
    queryFn: () => api.get('/finance/trial-balance/', { params: periodFilter ? { period: periodFilter } : undefined }),
    select: r => r.data,
    enabled: tab === 'trial-balance',
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/finance/accounts/'),
    select: r => r.data,
  })

  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/projects/'),
    select: r => r.data,
  })

  const createMut = useMutation({
    mutationFn: (data) => api.post('/finance/journals/', data),
    onSuccess: () => {
      toast.success('Journal entry created.')
      qc.invalidateQueries(['journals'])
      qc.invalidateQueries(['trial-balance'])
      setShowForm(false)
      setForm({ entry_type: 'manual', entry_date: new Date().toISOString().split('T')[0], description: '', project: '', lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }] })
    },
    onError: (err) => toast.error(err.response?.data?.lines?.[0] || err.response?.data?.detail || 'Failed to create journal.'),
  })

  const postMut = useMutation({
    mutationFn: (id) => api.post(`/finance/journals/${id}/post/`),
    onSuccess: () => { toast.success('Journal posted.'); qc.invalidateQueries(['journals']); qc.invalidateQueries(['trial-balance']) },
    onError: (err) => toast.error(err.response?.data?.detail || 'Post failed.'),
  })

  const reverseMut = useMutation({
    mutationFn: (id) => api.post(`/finance/journals/${id}/reverse/`),
    onSuccess: () => { toast.success('Reversing entry created.'); qc.invalidateQueries(['journals']) },
  })

  const addLine    = () => setForm(f => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))
  const removeLine = (i) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))
  const updateLine = (i, key, val) => setForm(f => {
    const lines = [...f.lines]
    lines[i] = { ...lines[i], [key]: val }
    return { ...f, lines }
  })

  const totalDebits  = form.lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0)
  const totalCredits = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced   = Math.abs(totalDebits - totalCredits) < 0.01

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isBalanced) { toast.error('Journal is not balanced.'); return }
    const payload = {
      ...form,
      project: form.project || undefined,
      lines: form.lines
        .filter(l => l.account)
        .map(l => ({
          account: l.account,
          description: l.description,
          debit:  parseFloat(l.debit)  || 0,
          credit: parseFloat(l.credit) || 0,
          project: l.project || undefined,
          cost_code: l.cost_code || undefined,
        })),
    }
    createMut.mutate(payload)
  }

  const cls = 'px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        {[
          { key: 'journal',       label: 'Journal Entries' },
          { key: 'trial-balance', label: 'Trial Balance' },
        ].map(opt => (
          <button key={opt.key} onClick={() => setTab(opt.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${tab === opt.key
                ? 'bg-brand-slate text-white border-brand-slate'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {opt.label}
          </button>
        ))}

        {/* Filters */}
        <input type="month" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red"
          placeholder="Filter by period" />

        {tab === 'journal' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
            <option value="">All Statuses</option>
            {Object.keys(STATUS_COLORS).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        )}

        {tab === 'journal' && (
          <button onClick={() => setShowForm(s => !s)}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
            <PlusIcon className="h-4 w-4" /> New Journal Entry
          </button>
        )}
      </div>

      {/* Create form */}
      {tab === 'journal' && showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-brand-slate text-sm">New Journal Entry</h3>
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type *</label>
              <select value={form.entry_type} onChange={e => setForm(f => ({ ...f, entry_type: e.target.value }))}
                className={cls}>
                {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date *</label>
              <input required type="date" value={form.entry_date}
                onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))}
                className={cls} />
            </div>
            <div className="flex-1 min-w-64">
              <label className="block text-xs text-gray-500 mb-1">Description *</label>
              <input required value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={`w-full ${cls}`} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Project</label>
              <select value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                className={cls}>
                <option value="">None</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Journal lines */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  <th className="pb-2 text-left font-medium">Account *</th>
                  <th className="pb-2 text-left font-medium pl-2">Description</th>
                  <th className="pb-2 text-right font-medium pl-2">Debit (KES)</th>
                  <th className="pb-2 text-right font-medium pl-2">Credit (KES)</th>
                  <th className="pb-2 text-left font-medium pl-2">Project</th>
                  <th className="pb-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, i) => (
                  <tr key={i}>
                    <td className="pt-2">
                      <select value={line.account} onChange={e => updateLine(i, 'account', e.target.value)}
                        className={`w-48 ${cls}`}>
                        <option value="">Select account…</option>
                        {accounts?.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                      </select>
                    </td>
                    <td className="pt-2 pl-2">
                      <input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                        className={`w-36 ${cls}`} placeholder="Optional" />
                    </td>
                    <td className="pt-2 pl-2">
                      <input type="number" min="0" step="0.01" value={line.debit}
                        onChange={e => updateLine(i, 'debit', e.target.value)}
                        className={`w-28 text-right ${cls}`} />
                    </td>
                    <td className="pt-2 pl-2">
                      <input type="number" min="0" step="0.01" value={line.credit}
                        onChange={e => updateLine(i, 'credit', e.target.value)}
                        className={`w-28 text-right ${cls}`} />
                    </td>
                    <td className="pt-2 pl-2">
                      <select value={line.project} onChange={e => updateLine(i, 'project', e.target.value)}
                        className={`w-36 ${cls}`}>
                        <option value="">None</option>
                        {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="pt-2 pl-2">
                      {form.lines.length > 2 && (
                        <button type="button" onClick={() => removeLine(i)}
                          className="text-gray-300 hover:text-red-500">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={2} className="pt-3 pr-2 text-right text-xs font-semibold text-gray-500">Totals:</td>
                  <td className={`pt-3 pl-2 text-right font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(totalDebits)}
                  </td>
                  <td className={`pt-3 pl-2 text-right font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(totalCredits)}
                  </td>
                  <td colSpan={2} className="pt-3 pl-2">
                    {isBalanced
                      ? <span className="text-xs text-green-600 font-medium">✓ Balanced</span>
                      : <span className="text-xs text-red-600 font-medium">✗ Not balanced</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={addLine}
              className="flex items-center gap-1.5 text-xs text-brand-red font-medium">
              <PlusIcon className="h-4 w-4" /> Add Line
            </button>
            <div className="ml-auto flex gap-2">
              <button type="submit" disabled={createMut.isPending || !isBalanced}
                className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-brand-red-dark disabled:opacity-60">
                Save Journal
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Journal list */}
      {tab === 'journal' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">General Ledger — Journal Entries</h3>
          </div>
          {isLoading
            ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
            : !journals || journals.length === 0
              ? <p className="text-sm text-gray-400 p-8 text-center">No journal entries yet.</p>
              : <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Reference', 'Type', 'Date', 'Period', 'Description', 'Debits', 'Credits', 'Status', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {journals.map(j => (
                        <tr key={j.id} className={`hover:bg-gray-50 ${j.is_reversing ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3 font-mono text-xs font-medium text-brand-slate">
                            {j.reference}
                            {j.is_reversing && <span className="ml-1 text-red-500 text-xs">(Rev)</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 capitalize">{j.entry_type.replace('_', ' ')}</td>
                          <td className="px-4 py-3 text-gray-700">{j.entry_date}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{j.period}</td>
                          <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{j.description}</td>
                          <td className="px-4 py-3 text-right font-medium">{fmtN(j.total_debits)}</td>
                          <td className="px-4 py-3 text-right font-medium">{fmtN(j.total_credits)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[j.status]}`}>
                              {j.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {j.status === 'draft' && (
                                <button onClick={() => postMut.mutate(j.id)}
                                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                                  <CheckIcon className="h-3.5 w-3.5" /> Post
                                </button>
                              )}
                              {j.status === 'posted' && (
                                <button onClick={() => reverseMut.mutate(j.id)}
                                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium">
                                  <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> Reverse
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          }
        </div>
      )}

      {/* Trial balance */}
      {tab === 'trial-balance' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-brand-slate text-sm">Trial Balance</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Period: {trialBalance?.period || 'All'} —
                {trialBalance?.is_balanced
                  ? <span className="text-green-600 font-medium"> ✓ Balanced</span>
                  : <span className="text-red-600 font-medium"> ✗ Not balanced</span>}
              </p>
            </div>
          </div>
          {!trialBalance || trialBalance.rows?.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No posted journal entries {periodFilter ? `for ${periodFilter}` : 'yet'}.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Account Code', 'Account Name', 'Type', 'Total Debits', 'Total Credits', 'Balance'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trialBalance.rows.map(r => (
                      <tr key={r.account_code} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-slate">{r.account_code}</td>
                        <td className="px-4 py-3 text-gray-700">{r.account_name}</td>
                        <td className="px-4 py-3 text-gray-500 capitalize text-xs">{r.account_type}</td>
                        <td className="px-4 py-3 text-right">{fmtN(r.total_debit)}</td>
                        <td className="px-4 py-3 text-right">{fmtN(r.total_credit)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${r.balance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                          {r.balance < 0 ? `(${fmtN(Math.abs(r.balance))})` : fmtN(r.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-semibold text-gray-600">Totals</td>
                      <td className="px-4 py-3 text-right font-bold">{fmtN(trialBalance.total_debits)}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmtN(trialBalance.total_credits)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${trialBalance.is_balanced ? 'text-green-600' : 'text-red-600'}`}>
                        {trialBalance.is_balanced ? '—' : fmtN(Math.abs(trialBalance.total_debits - trialBalance.total_credits))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
          }
        </div>
      )}
    </div>
  )
}
