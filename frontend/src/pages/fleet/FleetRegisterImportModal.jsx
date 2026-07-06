import { useRef, useState } from 'react'
import { ArrowUpTrayIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import { importFleetRegister } from '../../api/fleet'

const STATUS_BADGE = {
  valid:          'bg-green-100 text-green-700',
  expiring_soon:  'bg-amber-100 text-amber-700',
  expired:        'bg-red-100 text-red-700',
  not_in_system:  'bg-orange-100 text-orange-700',
  not_applicable: 'bg-gray-100 text-gray-500',
  unknown:        'bg-gray-100 text-gray-400',
}
const STATUS_LABEL = {
  valid: 'Valid', expiring_soon: 'Expiring Soon', expired: 'EXPIRED',
  not_in_system: 'Not in System', not_applicable: 'N/A', unknown: '—',
}

export default function FleetRegisterImportModal({ onClose, onSuccess }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleFile = async (file) => {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const res = await importFleetRegister(file)
      setResult(res.data)
      toast.success(`Import complete: ${res.data.imported} new, ${res.data.updated} updated`)
      onSuccess?.()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold text-base">Import Fleet Master Register</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Drop zone */}
          {!result && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${dragging ? 'border-brand-red bg-red-50' : 'border-gray-200 hover:border-brand-red hover:bg-gray-50'}`}
            >
              <ArrowUpTrayIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-600">
                {loading ? 'Uploading…' : 'Drag & drop your Excel file here, or click to browse'}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">Supports: Fleet Master Register (.xlsx)</p>
              <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => handleFile(e.target.files[0])} />
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'New Vehicles', value: result.imported, color: 'text-green-600' },
                  { label: 'Updated', value: result.updated, color: 'text-blue-600' },
                  { label: 'Compliance Alerts', value: result.compliance_alerts, color: 'text-amber-600' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>

              {result.errors?.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5" /> {result.errors.length} error(s)
                  </p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-[10px] text-red-600">{e}</p>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg p-3">
                <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                Import complete — {result.total} assets synced to Fleet &amp; Assets modules.
              </div>

              <button onClick={() => { setResult(null) }}
                className="w-full text-xs text-brand-red hover:underline">
                Import another file
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose}
            className="px-4 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            {result ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
