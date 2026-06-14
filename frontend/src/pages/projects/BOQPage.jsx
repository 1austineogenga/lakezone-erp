import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { DocumentArrowUpIcon, ChevronDownIcon, ChevronRightIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { getProjectBOQs, importBOQ } from '../../api/projects'
import { printBOQ } from '../../utils/print'

function fmt(val) {
  return `KES ${Number(val || 0).toLocaleString()}`
}

function BillRow({ bill }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 text-left"
      >
        {expanded
          ? <ChevronDownIcon className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronRightIcon className="h-4 w-4 text-gray-400 shrink-0" />}
        <span className="text-xs font-semibold text-brand-slate w-10 shrink-0">Bill {bill.bill_number}</span>
        <span className="flex-1 text-xs text-gray-700">{bill.description}</span>
        <span className="text-xs font-semibold text-brand-slate">{fmt(bill.sub_total)}</span>
      </button>
      {expanded && bill.items && bill.items.length > 0 && (
        <div className="px-5 pb-4">
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Item #', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bill.items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{item.item_number}</td>
                    <td className="px-3 py-2 text-gray-700">{item.description}</td>
                    <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                    <td className="px-3 py-2 text-gray-700">{Number(item.quantity || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-700">{fmt(item.rate)}</td>
                    <td className="px-3 py-2 font-medium text-brand-slate">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BOQPage({ projectName }) {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const fileRef = useRef()

  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)

  const { data: boqs = [], isLoading } = useQuery({
    queryKey: ['project-boqs', projectId],
    queryFn: () => getProjectBOQs(projectId),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!projectId,
  })

  const importMut = useMutation({
    mutationFn: (formData) => importBOQ(projectId, formData),
    onSuccess: (res) => {
      const d = res.data
      const bills = d.bills_count ?? d.bills ?? '?'
      const items = d.items_count ?? d.items ?? '?'
      toast.success(`BOQ imported — ${bills} bills, ${items} items`)
      qc.invalidateQueries({ queryKey: ['project-boqs', projectId] })
      setShowUpload(false)
      setTitle('')
      setFile(null)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to import BOQ.'),
  })

  const handleImport = (e) => {
    e.preventDefault()
    if (!file) return toast.error('Please select an .xlsx file.')
    const fd = new FormData()
    fd.append('file', file)
    if (title) fd.append('title', title)
    importMut.mutate(fd)
  }

  const activeBoq = boqs[0] || null
  const grandTotal = activeBoq
    ? Number(activeBoq.sub_total || 0) * 1.1 * 1.1
    : 0

  const UploadForm = (
    <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <DocumentArrowUpIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <h3 className="font-semibold text-brand-slate">Import BOQ</h3>
        <p className="text-xs text-gray-400 mt-1">Upload an Excel (.xlsx) file to import the Bill of Quantities.</p>
      </div>
      <form onSubmit={handleImport} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. BOQ Rev 1"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Excel File (.xlsx) *</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-brand-red transition-colors"
          >
            {file
              ? <p className="text-sm font-medium text-brand-slate">{file.name}</p>
              : <p className="text-sm text-gray-400">Click to select file</p>}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => setFile(e.target.files[0] || null)}
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={importMut.isPending || !file}
            className="px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {importMut.isPending ? 'Parsing…' : 'Import BOQ'}
          </button>
          {activeBoq && (
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="px-5 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )

  if (isLoading) {
    return <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
  }

  if (!activeBoq || showUpload) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-brand-slate text-lg">Bill of Quantities</h2>
            <p className="text-xs text-gray-400 mt-0.5">Import from Excel to get started</p>
          </div>
        </div>
        {UploadForm}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Bill of Quantities</h2>
          <p className="text-xs text-gray-400 mt-0.5">{activeBoq.title || 'BOQ'} · {activeBoq.bills?.length || 0} bills</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => printBOQ(activeBoq, projectName)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
            <PrinterIcon className="h-3.5 w-3.5" /> Print BOQ
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90"
          >
            <DocumentArrowUpIcon className="h-3.5 w-3.5" /> Import New BOQ
          </button>
        </div>
      </div>

      {/* Grand Total Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-gray-200 border-l-4 border-l-slate-500 rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-700">{fmt(activeBoq.sub_total)}</p>
          <p className="text-xs text-gray-500 mt-1">Sub Total</p>
        </div>
        <div className="bg-blue-50 border border-gray-200 border-l-4 border-l-blue-500 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-700">{fmt(Number(activeBoq.sub_total || 0) * 1.1)}</p>
          <p className="text-xs text-gray-500 mt-1">+ 10% VoP</p>
        </div>
        <div className="bg-green-50 border border-gray-200 border-l-4 border-l-green-500 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">{fmt(grandTotal)}</p>
          <p className="text-xs text-gray-500 mt-1">Grand Total (+ 10% Contingency)</p>
        </div>
      </div>

      {/* Bills */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Bills</h3>
        </div>
        {(activeBoq.bills || []).length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">No bills in this BOQ.</p>
        ) : (
          <div>
            {(activeBoq.bills || []).map(bill => (
              <BillRow key={bill.id} bill={bill} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
