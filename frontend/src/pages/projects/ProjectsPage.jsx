import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { BuildingOffice2Icon, PlusIcon, ArrowRightIcon, DocumentArrowUpIcon, TableCellsIcon } from '@heroicons/react/24/outline'
import { getProjects, createProject, importProjects, importBudgetWorkbook } from '../../api/projects'

const STATUS_COLORS = {
  planning:  'bg-gray-100 text-gray-600',
  active:    'bg-green-100 text-green-700',
  on_hold:   'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
}

const STATUS_LABELS = {
  planning: 'Planning', active: 'Active', on_hold: 'On Hold', completed: 'Completed', suspended: 'Suspended',
}

const EMPTY_FORM = {
  code: '', name: '', client: '', contract_number: '', contract_value: '',
  location: '', start_date: '', end_date: '', description: '', status: 'planning',
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showModal, setShowModal]         = useState(false)
  const [showImport, setShowImport]       = useState(false)
  const [showBudgetImport, setShowBudget] = useState(false)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [importFile, setImportFile]       = useState(null)
  const [budgetFile, setBudgetFile]       = useState(null)
  const fileRef   = useRef()
  const budgetRef = useRef()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects({ page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const createMut = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      toast.success('Project created.')
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowModal(false)
      setForm(EMPTY_FORM)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to create project.'),
  })

  const importMut = useMutation({
    mutationFn: (fd) => importProjects(fd),
    onSuccess: (res) => {
      const { created, updated, skipped } = res.data
      toast.success(`Import complete — ${created} created, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}`)
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowImport(false)
      setImportFile(null)
    },
    onError: e => toast.error(e.response?.data?.error || 'Import failed.'),
  })

  const budgetImportMut = useMutation({
    mutationFn: (fd) => importBudgetWorkbook(fd),
    onSuccess: (res) => {
      const projects = res.data?.projects ?? []
      const summary = projects.map(p =>
        `${p.project_code} (${p.items_created} budget lines)`
      ).join(', ')
      toast.success(`Budget imported — ${summary}`)
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowBudget(false)
      setBudgetFile(null)
    },
    onError: e => toast.error(e.response?.data?.error || 'Budget import failed.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.contract_value) delete payload.contract_value
    createMut.mutate(payload)
  }

  const handleImport = (e) => {
    e.preventDefault()
    if (!importFile) return toast.error('Please select an Excel file.')
    const fd = new FormData()
    fd.append('file', importFile)
    importMut.mutate(fd)
  }

  const handleBudgetImport = (e) => {
    e.preventDefault()
    if (!budgetFile) return toast.error('Please select the budget workbook.')
    const fd = new FormData()
    fd.append('file', budgetFile)
    budgetImportMut.mutate(fd)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Projects</h2>
          <p className="text-xs text-gray-400 mt-0.5">{projects.length} total projects</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBudget(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-50"
          >
            <TableCellsIcon className="h-3.5 w-3.5" /> Import Budget Workbook
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50"
          >
            <DocumentArrowUpIcon className="h-3.5 w-3.5" /> Import Projects Excel
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90"
          >
            <PlusIcon className="h-3.5 w-3.5" /> New Project
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <BuildingOffice2Icon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No projects yet</p>
          <p className="text-xs text-gray-400 mt-1">Create manually or import from Excel.</p>
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => setShowImport(true)}
              className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
              <DocumentArrowUpIcon className="h-3.5 w-3.5" /> Import Excel
            </button>
            <button onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
              Create Project
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-x-auto hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || STATUS_COLORS.planning}`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                  <span className="bg-brand-slate text-white text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide">
                    {p.code || '—'}
                  </span>
                </div>
                <h3 className="font-semibold text-brand-slate text-sm leading-snug mb-1">{p.name}</h3>
                <p className="text-xs text-gray-400 mb-3">{p.client || '—'}</p>
                <div className="border-t border-gray-100 pt-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Contract Value</span>
                    <span className="font-semibold text-brand-slate">KES {Number(p.contract_value || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Period</span>
                    <span className="text-gray-600">{p.start_date || '—'} → {p.end_date || '—'}</span>
                  </div>
                  {p.location && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Location</span>
                      <span className="text-gray-600">{p.location}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 pb-4">
                <button
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-brand-red text-brand-red text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
                >
                  View Project <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Excel Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-brand-slate">Import Projects from Excel</h3>
              <button onClick={() => { setShowImport(false); setImportFile(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              {/* Template guide */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-5 text-xs text-blue-700 space-y-1">
                <p className="font-semibold mb-1">Excel column headers required:</p>
                <p><span className="font-mono bg-blue-100 px-1 rounded">Code</span> — unique project code (required)</p>
                <p><span className="font-mono bg-blue-100 px-1 rounded">Name</span> — project name (required)</p>
                <p><span className="font-mono bg-blue-100 px-1 rounded">Client</span> — client / employer name</p>
                <p><span className="font-mono bg-blue-100 px-1 rounded">Contract Number</span> — contract reference</p>
                <p><span className="font-mono bg-blue-100 px-1 rounded">Contract Value</span> — amount in KES</p>
                <p><span className="font-mono bg-blue-100 px-1 rounded">Location</span> — site location</p>
                <p><span className="font-mono bg-blue-100 px-1 rounded">Start Date</span> — YYYY-MM-DD or DD/MM/YYYY</p>
                <p><span className="font-mono bg-blue-100 px-1 rounded">End Date</span> — YYYY-MM-DD or DD/MM/YYYY</p>
                <p><span className="font-mono bg-blue-100 px-1 rounded">Status</span> — planning / active / on hold / completed</p>
              </div>

              <form onSubmit={handleImport} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Excel File (.xlsx) *</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-brand-red transition-colors"
                  >
                    {importFile
                      ? <p className="text-sm font-medium text-brand-slate">{importFile.name}</p>
                      : <><DocumentArrowUpIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                         <p className="text-sm text-gray-400">Click to select file</p></>}
                    <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                      onChange={e => setImportFile(e.target.files[0] || null)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={importMut.isPending || !importFile}
                    className="px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                    {importMut.isPending ? 'Importing…' : 'Import Projects'}
                  </button>
                  <button type="button" onClick={() => { setShowImport(false); setImportFile(null) }}
                    className="px-5 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-brand-slate">New Project</h3>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Project Code *', key: 'code',             placeholder: 'e.g. LZ-2026-001' },
                  { label: 'Project Name *', key: 'name',             placeholder: 'Project name' },
                  { label: 'Client Name',    key: 'client',           placeholder: 'Client / employer' },
                  { label: 'Contract No.',   key: 'contract_number',  placeholder: 'Contract reference' },
                  { label: 'Contract Value (KES)', key: 'contract_value', placeholder: '0', type: 'number' },
                  { label: 'Location',       key: 'location',         placeholder: 'Site location' },
                  { label: 'Start Date',     key: 'start_date',       type: 'date' },
                  { label: 'End Date',       key: 'end_date',         type: 'date' },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input type={type || 'text'} value={form[key]}
                      onChange={e => field(key, e.target.value)} placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => field('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea rows={3} value={form.description} onChange={e => field('description', e.target.value)}
                  placeholder="Brief project description…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={createMut.isPending || !form.code || !form.name}
                  className="px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                  {createMut.isPending ? 'Creating…' : 'Create Project'}
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

      {/* Import Budget Workbook Modal */}
      {showBudgetImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-brand-slate">Import Budget Workbook</h3>
              <button onClick={() => { setShowBudget(false); setBudgetFile(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-5 text-xs text-blue-700 space-y-1">
                <p className="font-semibold mb-1">Combined MN + NS Budget Workbook format</p>
                <p>The system will automatically detect projects from sheet prefixes (e.g. <span className="font-mono bg-blue-100 px-1 rounded">MN_Materials</span>, <span className="font-mono bg-blue-100 px-1 rounded">NS_FuelPlant</span>).</p>
                <p className="mt-2">For each project found, it will:</p>
                <ul className="list-disc list-inside space-y-0.5 mt-1">
                  <li>Create or update the Project record</li>
                  <li>Create a Budget with all weekly line items</li>
                  <li>Import Materials, Fuel, and Casual Labour breakdowns</li>
                </ul>
                <p className="mt-2 text-blue-600 font-medium">After import, go to the project to upload its BOQ separately.</p>
              </div>
              <form onSubmit={handleBudgetImport} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Budget Workbook (.xlsx) *</label>
                  <div
                    onClick={() => budgetRef.current?.click()}
                    className="w-full border-2 border-dashed border-blue-200 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  >
                    {budgetFile
                      ? <p className="text-sm font-medium text-brand-slate">{budgetFile.name}</p>
                      : <><TableCellsIcon className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                         <p className="text-sm text-gray-400">Click to select workbook</p></>}
                    <input ref={budgetRef} type="file" accept=".xlsx" className="hidden"
                      onChange={e => setBudgetFile(e.target.files[0] || null)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={budgetImportMut.isPending || !budgetFile}
                    className="px-5 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                    {budgetImportMut.isPending ? 'Importing…' : 'Import Budget Workbook'}
                  </button>
                  <button type="button" onClick={() => { setShowBudget(false); setBudgetFile(null) }}
                    className="px-5 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
