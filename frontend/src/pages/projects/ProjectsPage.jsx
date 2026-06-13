import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { BuildingOffice2Icon, PlusIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { getProjects, createProject } from '../../api/projects'

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
  code: '', name: '', client_name: '', contract_number: '', contract_value: '',
  location: '', start_date: '', end_date: '', description: '', status: 'planning',
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects({ page_size: 100 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const createMut = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      toast.success('Project created successfully.')
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowModal(false)
      setForm(EMPTY_FORM)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to create project.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.contract_value) delete payload.contract_value
    createMut.mutate(payload)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Projects</h2>
          <p className="text-xs text-gray-400 mt-0.5">{projects.length} total projects</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90"
        >
          <PlusIcon className="h-3.5 w-3.5" /> New Project
        </button>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <BuildingOffice2Icon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No projects yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first project to get started.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || STATUS_COLORS.planning}`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                  <span className="bg-brand-slate text-white text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide">
                    {p.code || p.project_code || '—'}
                  </span>
                </div>
                <h3 className="font-semibold text-brand-slate text-sm leading-snug mb-1">
                  {p.name || p.project_name}
                </h3>
                <p className="text-xs text-gray-400 mb-3">{p.client_name || p.client || '—'}</p>
                <div className="border-t border-gray-100 pt-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Contract Value</span>
                    <span className="font-semibold text-brand-slate">
                      KES {(p.contract_value || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Period</span>
                    <span className="text-gray-600">
                      {p.start_date || '—'} → {p.end_date || '—'}
                    </span>
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
                  { label: 'Project Code *', key: 'code', placeholder: 'e.g. LZ-2024-001' },
                  { label: 'Project Name *', key: 'name', placeholder: 'Project name' },
                  { label: 'Client Name', key: 'client_name', placeholder: 'Client / employer' },
                  { label: 'Contract No.', key: 'contract_number', placeholder: 'Contract reference' },
                  { label: 'Contract Value (KES)', key: 'contract_value', placeholder: '0', type: 'number' },
                  { label: 'Location', key: 'location', placeholder: 'Site location' },
                  { label: 'Start Date', key: 'start_date', type: 'date' },
                  { label: 'End Date', key: 'end_date', type: 'date' },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input
                      type={type || 'text'}
                      value={form[key]}
                      onChange={e => field(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => field('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red"
                  >
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => field('description', e.target.value)}
                  placeholder="Brief project description…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={createMut.isPending || !form.code || !form.name}
                  className="px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
                >
                  {createMut.isPending ? 'Creating…' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                  className="px-5 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50"
                >
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
