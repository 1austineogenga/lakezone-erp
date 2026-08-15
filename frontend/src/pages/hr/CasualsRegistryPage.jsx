import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import useAuthStore from '../../store/authStore'
import {
  PlusIcon, MagnifyingGlassIcon, XMarkIcon,
  CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, UserIcon,
  DocumentTextIcon, PaperAirplaneIcon, ClipboardDocumentListIcon,
  PhotoIcon, TrashIcon,
} from '@heroicons/react/24/outline'

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red'
const lbl = 'block text-xs font-medium text-gray-500 mb-1'

const today = new Date().toISOString().slice(0, 10)

const EMPTY = { id_number: '', full_name: '', phone: '', placement: '', daily_rate: '', notes: '' }

const STATUS_BADGE = {
  draft:       'bg-gray-100 text-gray-600',
  submitted:   'bg-amber-100 text-amber-700',
  hr_approved: 'bg-purple-100 text-purple-700',
  approved:    'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-700',
  paid:        'bg-green-100 text-green-700',
}

export default function CasualsRegistryPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const role = user?.role || ''

  const [tab, setTab]               = useState('register')
  const [search, setSearch]         = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(EMPTY)
  const [existingId, setExistingId] = useState(null)
  const [lookupMsg, setLookupMsg]   = useState('')
  const [expanded, setExpanded]     = useState(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportNotes, setReportNotes]         = useState('')
  const [reviewModal, setReviewModal]         = useState(null)  // {report, action}
  const [reviewNotes, setReviewNotes]         = useState('')

  // Assign Work modal state
  const [assignModal, setAssignModal]         = useState(null)  // casual object
  const [assignText, setAssignText]           = useState('')

  // Evidence upload state
  const [evidenceFiles, setEvidenceFiles]     = useState([])
  const [evidenceCaption, setEvidenceCaption] = useState('')
  const [evidenceCasual, setEvidenceCasual]   = useState('')
  const [uploading, setUploading]             = useState(false)

  const f = k => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-names'],
    queryFn:  () => api.get('/auth/branches/', { params: { page_size: 50 } }),
    select:   r => (r.data?.results ?? r.data ?? []).map(b => b.name),
  })
  const { data: projectLocations = [] } = useQuery({
    queryKey: ['project-locations'],
    queryFn:  () => api.get('/projects/', { params: { page_size: 100 } }),
    select:   r => [...new Set((r.data?.results ?? r.data ?? []).map(p => p.location).filter(Boolean))],
  })
  const placementOptions = [...branches, ...projectLocations]

  const { data: casuals = [], isLoading } = useQuery({
    queryKey: ['casuals', search],
    queryFn:  () => api.get('/hr/casuals/', { params: { search: search || undefined } }),
    select:   r => r.data?.results ?? r.data ?? [],
    refetchInterval: 60_000,
  })

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['casual-reports'],
    queryFn:  () => api.get('/hr/casual-reports/', { params: { page_size: 50 } }),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  tab === 'reports',
  })

  // Today's evidence
  const { data: todayEvidence = [], refetch: refetchEvidence } = useQuery({
    queryKey: ['casual-evidence', today],
    queryFn:  () => api.get('/hr/casual-evidence/', { params: { work_date: today } }),
    select:   r => r.data?.results ?? r.data ?? [],
    enabled:  tab === 'register',
  })

  const activeToday   = casuals.filter(c => c.is_active_today)
  const inactiveToday = casuals.filter(c => !c.is_active_today)

  const toggleMut = useMutation({
    mutationFn: ({ id, assignment }) => api.post(`/hr/casuals/${id}/toggle-active/`, assignment ? { assignment } : {}),
    onSuccess:  () => qc.invalidateQueries(['casuals']),
    onError:    () => toast.error('Failed to update status.'),
  })

  const saveMut = useMutation({
    mutationFn: data => existingId
      ? api.patch(`/hr/casuals/${existingId}/`, data)
      : api.post('/hr/casuals/', data),
    onSuccess: () => {
      toast.success(existingId ? 'Casual updated.' : 'Casual added.')
      qc.invalidateQueries(['casuals'])
      setShowForm(false)
      setForm(EMPTY)
      setExistingId(null)
      setLookupMsg('')
    },
    onError: e => toast.error(e?.response?.data?.detail || 'Failed to save casual.'),
  })

  const generateReportMut = useMutation({
    mutationFn: () => api.post('/hr/casual-reports/', { report_date: today, notes: reportNotes }),
    onSuccess: (res) => {
      toast.success(`Report ${res.data.reference} generated.`)
      qc.invalidateQueries(['casual-reports'])
      setShowReportModal(false)
      setReportNotes('')
      setTab('reports')
    },
    onError: e => toast.error(e?.response?.data?.detail || 'Failed to generate report.'),
  })

  const submitReportMut = useMutation({
    mutationFn: id => api.post(`/hr/casual-reports/${id}/submit/`),
    onSuccess: () => {
      toast.success('Report submitted for HR approval.')
      qc.invalidateQueries(['casual-reports'])
    },
    onError: e => toast.error(e?.response?.data?.detail || 'Failed to submit.'),
  })

  const approveReportMut = useMutation({
    mutationFn: ({ id, action, notes }) =>
      api.post(`/hr/casual-reports/${id}/approve/`, { action, notes }),
    onSuccess: (_, { action }) => {
      const msg = action === 'approve' ? 'Report approved. Expense claim created.'
                : action === 'hr_approve' ? 'Report HR-approved.'
                : 'Report rejected.'
      toast.success(msg)
      qc.invalidateQueries(['casual-reports'])
      setReviewModal(null)
      setReviewNotes('')
    },
    onError: e => toast.error(e?.response?.data?.detail || 'Action failed.'),
  })

  const deleteEvidenceMut = useMutation({
    mutationFn: id => api.delete(`/hr/casual-evidence/${id}/`),
    onSuccess:  () => { toast.success('Evidence deleted.'); refetchEvidence() },
    onError:    () => toast.error('Failed to delete evidence.'),
  })

  const handleIdLookup = async () => {
    const id = form.id_number.trim()
    if (!id) return
    setLookupMsg('')
    setExistingId(null)
    try {
      const res = await api.get('/hr/casuals/lookup/', { params: { id_number: id } })
      const c = res.data
      if (c) {
        setForm({ id_number: c.id_number, full_name: c.full_name, phone: c.phone,
                  placement: c.placement, daily_rate: c.daily_rate, notes: c.notes || '' })
        setExistingId(c.id)
        setLookupMsg(`Returning casual — ${c.full_name}. Details pre-filled. Save to update or just close and activate from the list.`)
      }
    } catch {
      setLookupMsg('New casual — not found in register.')
    }
  }

  const handleSubmit = e => {
    e.preventDefault()
    saveMut.mutate(form)
  }

  const handleAssignWork = (c) => {
    setAssignModal(c)
    setAssignText(c.assignment || '')
  }

  const handleConfirmAssign = async () => {
    if (!assignModal) return
    try {
      await api.patch(`/hr/casuals/${assignModal.id}/`, { assignment: assignText })
      await api.post(`/hr/casuals/${assignModal.id}/toggle-active/`, { assignment: assignText })
      toast.success(`${assignModal.full_name} activated.`)
      qc.invalidateQueries(['casuals'])
      setAssignModal(null)
      setAssignText('')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to activate.')
    }
  }

  const handleEvidenceUpload = async () => {
    if (!evidenceFiles.length) { toast.error('Select at least one image.'); return }
    setUploading(true)
    try {
      for (const file of evidenceFiles) {
        const fd = new FormData()
        fd.append('work_date', today)
        fd.append('image', file)
        fd.append('caption', evidenceCaption)
        if (evidenceCasual) fd.append('casual', evidenceCasual)
        await api.post('/hr/casual-evidence/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      toast.success('Evidence uploaded.')
      setEvidenceFiles([])
      setEvidenceCaption('')
      setEvidenceCasual('')
      refetchEvidence()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const hour = new Date().getHours()
  const pastSixPm = hour >= 18

  const canHrApprove  = ['hr_manager', 'system_admin'].includes(role)
  const canMdApprove  = ['managing_director', 'system_admin'].includes(role)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Casuals Register</h2>
          <p className="text-xs text-gray-500 mt-0.5">{today} — {activeToday.length} active today</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'register' && activeToday.length > 0 && (
            <button onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-brand-red text-brand-red text-sm font-semibold rounded-xl hover:bg-brand-red/5">
              <DocumentTextIcon className="h-4 w-4" /> Generate Report
            </button>
          )}
          <button onClick={() => { setShowForm(true); setForm(EMPTY); setExistingId(null); setLookupMsg('') }}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-sm font-semibold rounded-xl hover:opacity-90">
            <PlusIcon className="h-4 w-4" /> Add Casual
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { id: 'register', label: 'Daily Register', icon: UserIcon },
          { id: 'reports',  label: 'Daily Reports', icon: ClipboardDocumentListIcon },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${tab === t.id ? 'bg-white text-brand-slate shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {pastSixPm && tab === 'register' && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
          Past 6:00 PM — all casuals will show as inactive at the start of tomorrow.
        </div>
      )}

      {/* ── REGISTER TAB ── */}
      {tab === 'register' && (
        <>
          <div className="relative max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name or ID number…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red" />
          </div>

          {isLoading ? (
            <p className="text-center text-gray-400 text-sm py-10">Loading…</p>
          ) : casuals.length === 0 ? (
            <div className="text-center py-16">
              <UserIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No casuals registered yet.</p>
              <p className="text-xs text-gray-400 mt-1">Add a casual using the button above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Today */}
              {activeToday.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Active Today ({activeToday.length})</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
                    {activeToday.map(c => (
                      <ActiveCasualRow key={c.id} c={c}
                        onDeactivate={() => toggleMut.mutate({ id: c.id })}
                        toggling={toggleMut.isPending}
                        expanded={expanded} setExpanded={setExpanded} />
                    ))}
                  </div>
                </div>
              )}

              {/* Inactive */}
              {inactiveToday.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Inactive ({inactiveToday.length})</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
                    {inactiveToday.map(c => (
                      <InactiveCasualRow key={c.id} c={c}
                        onAssignWork={() => handleAssignWork(c)}
                        expanded={expanded} setExpanded={setExpanded} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Work Evidence Section */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <PhotoIcon className="h-5 w-5 text-brand-red" />
              <h3 className="text-sm font-bold text-brand-slate">Work Evidence — {today}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Images (select one or more)</label>
                <input type="file" accept="image/*" multiple
                  onChange={e => setEvidenceFiles(Array.from(e.target.files))}
                  className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-red file:text-white hover:file:opacity-90" />
                {evidenceFiles.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">{evidenceFiles.length} file(s) selected</p>
                )}
              </div>
              <div>
                <label className={lbl}>Caption (optional)</label>
                <input value={evidenceCaption} onChange={e => setEvidenceCaption(e.target.value)}
                  placeholder="Describe the work shown…" className={inp} />
              </div>
              <div>
                <label className={lbl}>Casual (optional)</label>
                <select value={evidenceCasual} onChange={e => setEvidenceCasual(e.target.value)} className={inp}>
                  <option value="">Overall / Site</option>
                  {activeToday.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={handleEvidenceUpload} disabled={uploading || !evidenceFiles.length}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
              <PhotoIcon className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload Evidence'}
            </button>

            {/* Existing evidence thumbnails */}
            {todayEvidence.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Uploaded Today</p>
                <div className="flex flex-wrap gap-3">
                  {todayEvidence.map(ev => (
                    <div key={ev.id} className="relative group">
                      <img src={ev.image_url || ev.image} alt={ev.caption || 'evidence'}
                        className="w-16 h-16 object-cover rounded-xl border border-gray-100" />
                      {ev.caption && (
                        <p className="text-[9px] text-gray-500 mt-0.5 max-w-[64px] truncate">{ev.caption}</p>
                      )}
                      <button onClick={() => deleteEvidenceMut.mutate(ev.id)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── REPORTS TAB ── */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {reportsLoading ? (
            <p className="text-center text-gray-400 text-sm py-10">Loading…</p>
          ) : reports.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardDocumentListIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No daily reports yet.</p>
              <p className="text-xs text-gray-400 mt-1">Activate casuals then generate a report from the Daily Register tab.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
              {reports.map(r => (
                <ReportRow key={r.id} r={r}
                  onSubmit={() => submitReportMut.mutate(r.id)}
                  submitting={submitReportMut.isPending}
                  onReview={(action) => { setReviewModal({ report: r, action }); setReviewNotes('') }}
                  canHrApprove={canHrApprove}
                  canMdApprove={canMdApprove} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Casual MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-brand-slate">{existingId ? 'Update Casual' : 'Add Casual'}</h3>
              <button onClick={() => setShowForm(false)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={lbl}>National ID Number *</label>
                <div className="flex gap-2">
                  <input {...f('id_number')} required placeholder="Enter ID number to check if returning" className={inp} />
                  <button type="button" onClick={handleIdLookup}
                    className="px-3 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 whitespace-nowrap">
                    Check
                  </button>
                </div>
                {lookupMsg && (
                  <p className={`text-xs mt-1 ${existingId ? 'text-brand-red font-medium' : 'text-gray-500'}`}>{lookupMsg}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={lbl}>Full Name *</label><input {...f('full_name')} required placeholder="As on ID" className={inp} /></div>
                <div><label className={lbl}>Phone *</label><input {...f('phone')} required placeholder="07XXXXXXXX" className={inp} /></div>
                <div><label className={lbl}>Daily Rate (KES)</label><input {...f('daily_rate')} type="number" min="0" placeholder="0" className={inp} /></div>
                <div>
                  <label className={lbl}>Placement *</label>
                  <select {...f('placement')} required className={inp}>
                    <option value="">Select location…</option>
                    {placementOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={lbl}>Notes</label>
                <input {...f('notes')} placeholder="Optional" className={inp} />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saveMut.isPending}
                  className="px-5 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
                  {saveMut.isPending ? 'Saving…' : existingId ? 'Update' : 'Add Casual'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Work MODAL ── */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-brand-slate">Assign Work — {assignModal.full_name}</h3>
              <button onClick={() => setAssignModal(null)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="mb-4">
              <label className={lbl}>Today's Assignment</label>
              <textarea value={assignText} onChange={e => setAssignText(e.target.value)}
                rows={3} placeholder="Describe the work for today…" className={inp} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleConfirmAssign}
                className="px-5 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90">
                Confirm &amp; Activate
              </button>
              <button onClick={() => setAssignModal(null)}
                className="px-5 py-2 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Report MODAL ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-brand-slate">Generate Daily Report</h3>
              <button onClick={() => setShowReportModal(false)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              This will snapshot all <strong>{activeToday.length} active casuals</strong> for today ({today}) into a daily payment report.
            </p>

            <div className="rounded-xl border border-gray-100 overflow-hidden mb-4 max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['Name', 'Phone', 'Assignment', 'Rate'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeToday.map(c => (
                    <tr key={c.id} className="bg-white">
                      <td className="px-3 py-2 font-medium text-brand-slate">{c.full_name}</td>
                      <td className="px-3 py-2 text-gray-500">{c.phone}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">{c.assignment || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">KES {Number(c.daily_rate || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mb-4">
              <label className={lbl}>Notes (optional)</label>
              <textarea value={reportNotes} onChange={e => setReportNotes(e.target.value)}
                rows={2} placeholder="Any notes for this report…" className={inp} />
            </div>

            <div className="flex gap-2">
              <button onClick={() => generateReportMut.mutate()} disabled={generateReportMut.isPending}
                className="flex items-center gap-1.5 px-5 py-2 bg-brand-red text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
                <DocumentTextIcon className="h-4 w-4" />
                {generateReportMut.isPending ? 'Generating…' : 'Generate Report'}
              </button>
              <button onClick={() => setShowReportModal(false)}
                className="px-5 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Review MODAL ── */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-brand-slate capitalize">
                {reviewModal.action === 'approve' ? 'MD Approve Report'
                  : reviewModal.action === 'hr_approve' ? 'HR Approve Report'
                  : 'Reject Report'}
              </h3>
              <button onClick={() => setReviewModal(null)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>

            <p className="text-sm text-gray-600 mb-1">
              Report: <strong>{reviewModal.report.reference}</strong> — {reviewModal.report.report_date}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Total: <strong>KES {Number(reviewModal.report.total_amount || 0).toLocaleString()}</strong>
              {' '}({reviewModal.report.items?.length ?? '?'} casuals)
            </p>
            {reviewModal.action === 'approve' && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                Approving will create an expense claim in Finance for batch payment to casuals.
              </p>
            )}

            <div className="mb-4">
              <label className={lbl}>{reviewModal.action === 'reject' ? 'Rejection Reason *' : 'Notes (optional)'}</label>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                rows={2} placeholder={reviewModal.action === 'reject' ? 'Reason for rejection…' : 'Optional notes…'}
                className={inp} />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => approveReportMut.mutate({
                  id: reviewModal.report.id,
                  action: reviewModal.action,
                  notes: reviewNotes,
                })}
                disabled={approveReportMut.isPending || (reviewModal.action === 'reject' && !reviewNotes.trim())}
                className={`flex items-center gap-1.5 px-5 py-2 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-60
                  ${reviewModal.action === 'reject' ? 'bg-red-600' : 'bg-green-600'}`}>
                {approveReportMut.isPending ? 'Processing…'
                  : reviewModal.action === 'approve' ? 'Approve & Create Claim'
                  : reviewModal.action === 'hr_approve' ? 'HR Approve'
                  : 'Reject'}
              </button>
              <button onClick={() => setReviewModal(null)}
                className="px-5 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActiveCasualRow({ c, onDeactivate, toggling, expanded, setExpanded }) {
  const isOpen = expanded === c.id
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 bg-brand-red">
          {c.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-slate truncate">{c.full_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{c.placement} · KES {Number(c.daily_rate || 0).toLocaleString()}/day</p>
        </div>
        <button onClick={onDeactivate} disabled={toggling}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60">
          <XMarkIcon className="h-3.5 w-3.5" /> Deactivate
        </button>
        <button onClick={() => setExpanded(isOpen ? null : c.id)}
          className="text-gray-400 hover:text-gray-600 shrink-0">
          {isOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
        </button>
      </div>
      {isOpen && <CasualDetail c={c} />}
    </div>
  )
}

function InactiveCasualRow({ c, onAssignWork, expanded, setExpanded }) {
  const isOpen = expanded === c.id
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 bg-gray-300">
          {c.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-slate truncate">{c.full_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{c.placement}</p>
        </div>
        <button onClick={onAssignWork}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-red text-white hover:opacity-90">
          <CheckCircleIcon className="h-3.5 w-3.5" /> Assign Work
        </button>
        <button onClick={() => setExpanded(isOpen ? null : c.id)}
          className="text-gray-400 hover:text-gray-600 shrink-0">
          {isOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
        </button>
      </div>
      {isOpen && <CasualDetail c={c} />}
    </div>
  )
}

function CasualDetail({ c }) {
  return (
    <div className="border-t border-gray-50 bg-gray-50/60 px-5 py-4 text-xs space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="font-semibold text-gray-500 mb-1 uppercase tracking-wider text-[10px]">Assignment</p>
          <p className="text-gray-700 whitespace-pre-wrap">{c.assignment || '—'}</p>
        </div>
        <div className="space-y-1 text-gray-600">
          <p><span className="font-medium">Placement:</span> {c.placement}</p>
          <p><span className="font-medium">Daily Rate:</span> KES {Number(c.daily_rate || 0).toLocaleString()}</p>
          <p><span className="font-medium">Total Days Logged:</span> {parseFloat(c.total_days || 0).toFixed(1)}</p>
          <p><span className="font-medium">Total Amount:</span> KES {Number(c.total_amount || 0).toLocaleString()}</p>
          {c.notes && <p><span className="font-medium">Notes:</span> {c.notes}</p>}
        </div>
      </div>
    </div>
  )
}

function ReportRow({ r, onSubmit, submitting, onReview, canHrApprove, canMdApprove }) {
  const [open, setOpen] = useState(false)
  const statusLabel = r.status_display || r.status

  // Fetch evidence when expanded
  const { data: evidence = [] } = useQuery({
    queryKey: ['casual-evidence', r.report_date],
    queryFn:  () => api.get('/hr/casual-evidence/', { params: { work_date: r.report_date } }),
    select:   res => res.data?.results ?? res.data ?? [],
    enabled:  open,
  })

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-brand-slate">{r.reference}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize
              ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-500'}`}>
              {statusLabel}
            </span>
            {r.expense_status && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold capitalize">
                Claim: {r.expense_status}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {r.report_date} · {r.items?.length ?? 0} casuals · KES {Number(r.total_amount || 0).toLocaleString()}
          </p>
          {r.submitted_by_name && (
            <p className="text-[10px] text-gray-400 mt-0.5">Submitted by {r.submitted_by_name}</p>
          )}
          {r.hr_approved_by_name && (
            <p className="text-[10px] text-gray-400">HR Approved by {r.hr_approved_by_name}</p>
          )}
          {r.approved_by_name && r.status !== 'hr_approved' && (
            <p className="text-[10px] text-gray-400">
              {r.status === 'rejected' ? 'Rejected' : 'MD Approved'} by {r.approved_by_name}
            </p>
          )}
          {r.status === 'rejected' && r.rejection_notes && (
            <p className="text-[10px] text-red-600 mt-0.5">Reason: {r.rejection_notes}</p>
          )}
          {r.expense_reference && (
            <p className="text-[10px] text-gray-400">Claim ref: {r.expense_reference}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {r.status === 'draft' && (
            <button onClick={onSubmit} disabled={submitting}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-red text-white hover:opacity-90 disabled:opacity-60">
              <PaperAirplaneIcon className="h-3.5 w-3.5" /> Submit
            </button>
          )}
          {r.status === 'submitted' && canHrApprove && (
            <button onClick={() => onReview('hr_approve')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:opacity-90">
              <CheckCircleIcon className="h-3.5 w-3.5" /> HR Approve
            </button>
          )}
          {r.status === 'hr_approved' && canMdApprove && (
            <button onClick={() => onReview('approve')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:opacity-90">
              <CheckCircleIcon className="h-3.5 w-3.5" /> MD Approve
            </button>
          )}
          {(r.status === 'submitted' || r.status === 'hr_approved') && (
            <button onClick={() => onReview('reject')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-100 hover:bg-red-100">
              <XMarkIcon className="h-3.5 w-3.5" /> Reject
            </button>
          )}
          <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-gray-600">
            {open ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-50 bg-gray-50/60 px-5 py-4 space-y-4">
          {r.items?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Report Items</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white">
                    <tr className="border-b border-gray-100">
                      {['Name', 'ID', 'Phone', 'Assignment', 'Rate', 'Days', 'Amount'].map(h => (
                        <th key={h} className="px-3 py-1.5 text-left font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {r.items.map(item => (
                      <tr key={item.id} className="bg-white/80">
                        <td className="px-3 py-2 font-medium text-brand-slate">{item.full_name}</td>
                        <td className="px-3 py-2 text-gray-500">{item.id_number}</td>
                        <td className="px-3 py-2 text-gray-500">{item.phone}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">{item.assignment}</td>
                        <td className="px-3 py-2">KES {Number(item.daily_rate || 0).toLocaleString()}</td>
                        <td className="px-3 py-2">{item.days_worked}</td>
                        <td className="px-3 py-2 font-semibold text-brand-slate">KES {Number(item.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gray-200">
                    <tr className="bg-white">
                      <td colSpan={6} className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Total</td>
                      <td className="px-3 py-2 font-bold text-brand-slate">KES {Number(r.total_amount || 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {evidence.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Work Evidence</p>
              <div className="flex flex-wrap gap-3">
                {evidence.map(ev => (
                  <div key={ev.id} className="text-center">
                    <img src={ev.image_url || ev.image} alt={ev.caption || 'evidence'}
                      className="w-16 h-16 object-cover rounded-xl border border-gray-100" />
                    {ev.caption && (
                      <p className="text-[9px] text-gray-500 mt-0.5 max-w-[64px] truncate">{ev.caption}</p>
                    )}
                    {ev.casual_name && (
                      <p className="text-[9px] text-gray-400 max-w-[64px] truncate">{ev.casual_name}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
