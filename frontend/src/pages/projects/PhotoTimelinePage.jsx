import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  PhotoIcon, PlusIcon, TrashIcon, XMarkIcon,
  ArrowsPointingOutIcon, ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'

const CATEGORIES = [
  { value: '',           label: 'All Photos' },
  { value: 'general',   label: 'General' },
  { value: 'progress',  label: 'Work Progress' },
  { value: 'issue',     label: 'Issue / Problem' },
  { value: 'safety',    label: 'Safety' },
  { value: 'material',  label: 'Material Delivery' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'completion','label': 'Completion' },
]

const CAT_COLORS = {
  general:    'bg-gray-100 text-gray-600',
  progress:   'bg-blue-100 text-blue-700',
  issue:      'bg-red-100 text-red-700',
  safety:     'bg-yellow-100 text-yellow-700',
  material:   'bg-green-100 text-green-700',
  equipment:  'bg-purple-100 text-purple-700',
  completion: 'bg-teal-100 text-teal-700',
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ projectId, projectName, onClose }) {
  const qc = useQueryClient()
  const fileRef = useRef()
  const [files, setFiles] = useState([])
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'progress',
    caption: '',
    location_note: '',
  })
  const [previews, setPreviews] = useState([])

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files).slice(0, 10)
    setFiles(selected)
    setPreviews(selected.map(f => URL.createObjectURL(f)))
  }

  const mut = useMutation({
    mutationFn: async (data) => {
      const results = []
      for (const file of files) {
        const fd = new FormData()
        fd.append('image', file)
        fd.append('project_id', projectId)
        fd.append('project_name', projectName || '')
        fd.append('date', data.date)
        fd.append('category', data.category)
        fd.append('caption', data.caption)
        fd.append('location_note', data.location_note)
        results.push(await axios.post('/api/v1/reports/photos/', fd))
      }
      return results
    },
    onSuccess: () => {
      qc.invalidateQueries(['site-photos', projectId])
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`)
      onClose()
    },
    onError: () => toast.error('Upload failed'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-brand-slate px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Upload Site Photos</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-white/70 hover:text-white" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-brand-red transition-colors"
          >
            <PhotoIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Click to select photos (up to 10)</p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP accepted</p>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.filter(c => c.value).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Caption</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
              placeholder="Describe what's in these photos" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Location / Area</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.location_note} onChange={e => setForm(f => ({ ...f, location_note: e.target.value }))}
              placeholder="e.g. Chainage 1+200, Section A" />
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mut.mutate(form)}
            disabled={files.length === 0 || mut.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-brand-red text-white font-medium disabled:opacity-50"
          >
            {mut.isPending ? `Uploading ${files.length} photo${files.length > 1 ? 's' : ''}…` : `Upload ${files.length || ''} Photo${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const photo = photos[idx]
  const prev = () => setIdx(i => Math.max(0, i - 1))
  const next = () => setIdx(i => Math.min(photos.length - 1, i + 1))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
      onClick={onClose}>
      <button onClick={e => { e.stopPropagation(); prev() }}
        disabled={idx === 0}
        className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all">
        <ChevronLeftIcon className="h-6 w-6" />
      </button>

      <div className="max-w-4xl max-h-[90vh] mx-16 flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <img
          src={photo.image_url || photo.image}
          alt={photo.caption}
          className="max-h-[75vh] max-w-full object-contain rounded-lg"
        />
        <div className="mt-3 text-center text-white/90">
          <p className="font-medium">{photo.caption || 'No caption'}</p>
          <p className="text-sm text-white/60 mt-0.5">
            {fmtDate(photo.date)}{photo.location_note ? ` · ${photo.location_note}` : ''}
            {' · '}{idx + 1} / {photos.length}
          </p>
        </div>
      </div>

      <button onClick={e => { e.stopPropagation(); next() }}
        disabled={idx === photos.length - 1}
        className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all">
        <ChevronRightIcon className="h-6 w-6" />
      </button>

      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PhotoTimelinePage({ projectName }) {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [catFilter, setCatFilter] = useState('')

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['site-photos', projectId, catFilter],
    queryFn: () => axios.get('/api/v1/reports/photos/', {
      params: { project_id: projectId, ...(catFilter ? { category: catFilter } : {}) }
    }).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!projectId,
    select: d => Array.isArray(d) ? d : [],
  })

  const deleteMut = useMutation({
    mutationFn: (id) => axios.delete(`/api/v1/reports/photos/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['site-photos', projectId]); toast.success('Photo deleted') },
  })

  // Group by date
  const grouped = photos.reduce((acc, p) => {
    const d = p.date
    if (!acc[d]) acc[d] = []
    acc[d].push(p)
    return acc
  }, {})
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  // Flat list for lightbox navigation
  const flatPhotos = dates.flatMap(d => grouped[d])

  return (
    <div className="space-y-6">
      {showUpload && (
        <UploadModal projectId={projectId} projectName={projectName} onClose={() => setShowUpload(false)} />
      )}
      {lightbox !== null && (
        <Lightbox photos={flatPhotos} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-slate">Site Photo Timeline</h2>
          <p className="text-xs text-gray-500 mt-0.5">{photos.length} photos across {dates.length} days</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
          <PlusIcon className="h-4 w-4" /> Upload Photos
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c.value}
            onClick={() => setCatFilter(c.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
              ${catFilter === c.value
                ? 'bg-brand-red text-white border-brand-red'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-red'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : dates.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <PhotoIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No photos yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload site photos to build a visual timeline</p>
          <button onClick={() => setShowUpload(true)}
            className="mt-4 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium">
            Upload First Photo
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {dates.map(date => {
            const dayPhotos = grouped[date]
            return (
              <div key={date}>
                {/* Date heading */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-semibold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                    {fmtDate(date)}
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {/* Photo grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {dayPhotos.map((photo, pi) => {
                    const flatIdx = flatPhotos.findIndex(p => p.id === photo.id)
                    return (
                      <div key={photo.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer"
                        onClick={() => setLightbox(flatIdx)}>
                        <img
                          src={photo.image_url || photo.image}
                          alt={photo.caption}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100">
                          <div className="flex justify-between items-start">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CAT_COLORS[photo.category] || CAT_COLORS.general}`}>
                              {CATEGORIES.find(c => c.value === photo.category)?.label || 'General'}
                            </span>
                            <button
                              onClick={e => { e.stopPropagation(); if (window.confirm('Delete this photo?')) deleteMut.mutate(photo.id) }}
                              className="p-1 rounded-lg bg-black/50 text-white hover:bg-red-600 transition-colors">
                              <TrashIcon className="h-3 w-3" />
                            </button>
                          </div>
                          <div>
                            {photo.caption && (
                              <p className="text-white text-[10px] font-medium truncate">{photo.caption}</p>
                            )}
                            {photo.location_note && (
                              <p className="text-white/70 text-[10px] truncate">{photo.location_note}</p>
                            )}
                          </div>
                        </div>
                        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-0">
                          <ArrowsPointingOutIcon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
