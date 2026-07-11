import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getDailySheet, getMonthlyReport, bulkMarkAttendance, getAttendance } from '../../api/hr'
import { CheckCircleIcon, XCircleIcon, ClockIcon, ClipboardDocumentListIcon, MapPinIcon, ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/outline'

function exportCSV(sheet, date) {
  const rows = [
    ['#', 'Employee No', 'Full Name', 'Status', 'Time In', 'Time Out', 'Source', 'Location'],
    ...sheet.map((r, i) => [
      i + 1,
      r.employee_number,
      r.full_name,
      r.status?.replace('_', ' ') ?? '',
      r.time_in ?? '',
      r.time_out ?? '',
      r.source ?? '',
      r.location ?? '',
    ]),
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `attendance-${date}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function printReport(sheet, date, summary) {
  const statusColor = s => ({
    present: '#16a34a', absent: '#dc2626', late: '#ca8a04',
    on_leave: '#334155', half_day: '#ea580c',
  }[s] || '#6b7280')

  const rows = sheet.map((r, i) => `
    <tr style="border-bottom:1px solid #e5e7eb;${i % 2 === 0 ? '' : 'background:#f9fafb'}">
      <td style="padding:6px 10px;font-size:12px">${i + 1}</td>
      <td style="padding:6px 10px;font-size:12px;font-weight:600">${r.employee_number}</td>
      <td style="padding:6px 10px;font-size:12px">${r.full_name}</td>
      <td style="padding:6px 10px;font-size:12px;color:${statusColor(r.status)};font-weight:600;text-transform:capitalize">${(r.status ?? '').replace('_', ' ')}</td>
      <td style="padding:6px 10px;font-size:12px;font-family:monospace">${r.time_in ?? '—'}</td>
      <td style="padding:6px 10px;font-size:12px;font-family:monospace">${r.time_out ?? '—'}</td>
      <td style="padding:6px 10px;font-size:12px;text-transform:capitalize">${r.source ?? '—'}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html><head><title>Attendance Report — ${date}</title>
  <style>body{font-family:Arial,sans-serif;margin:24px;color:#1e293b}
  h1{margin:0;font-size:18px}p{margin:4px 0;font-size:12px;color:#64748b}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#1e293b;color:#fff;padding:8px 10px;font-size:11px;text-align:left}
  .summary{display:flex;gap:16px;margin:16px 0}
  .card{background:#f1f5f9;border-radius:8px;padding:10px 20px;text-align:center}
  .card .val{font-size:22px;font-weight:700}.card .lbl{font-size:11px;color:#64748b}
  @media print{body{margin:8px}}</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e293b;padding-bottom:12px;margin-bottom:12px">
    <div><h1>Lake Zone Enterprises Ltd</h1><p style="font-size:14px;font-weight:600;color:#1e293b">Daily Attendance Report</p><p>Date: ${date}</p></div>
    <p style="font-size:11px;color:#94a3b8">Printed: ${new Date().toLocaleString()}</p>
  </div>
  <div class="summary">
    <div class="card"><div class="val" style="color:#16a34a">${summary.present}</div><div class="lbl">Present</div></div>
    <div class="card"><div class="val" style="color:#dc2626">${summary.absent}</div><div class="lbl">Absent</div></div>
    <div class="card"><div class="val" style="color:#ca8a04">${summary.late}</div><div class="lbl">Late</div></div>
    <div class="card"><div class="val" style="color:#334155">${summary.onLeave}</div><div class="lbl">On Leave</div></div>
    <div class="card"><div class="val" style="color:#1e293b">${sheet.length}</div><div class="lbl">Total</div></div>
  </div>
  <table><thead><tr>
    <th>#</th><th>Emp No</th><th>Full Name</th><th>Status</th><th>Time In</th><th>Time Out</th><th>Source</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <p style="margin-top:20px;font-size:10px;color:#94a3b8;text-align:center">Lake Zone ERP — Confidential</p>
  <script>window.onload=()=>{window.print()}</script></body></html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  w.document.write(html)
  w.document.close()
}

// Cache geocode results for the session
const geocodeCache = {}

function LocationName({ coords }) {
  const [name, setName] = useState(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (!coords) { setLoading(false); return }

    if (geocodeCache[coords]) {
      setName(geocodeCache[coords])
      setLoading(false)
      return
    }

    const [lat, lon] = coords.split(',')
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
      headers: { 'Accept-Language': 'en' },
    })
      .then(r => r.json())
      .then(data => {
        const a = data.address || {}
        const label = a.suburb || a.village || a.town || a.city || a.county || a.state || data.display_name || coords
        geocodeCache[coords] = label
        if (mounted.current) { setName(label); setLoading(false) }
      })
      .catch(() => {
        geocodeCache[coords] = coords
        if (mounted.current) { setName(coords); setLoading(false) }
      })

    return () => { mounted.current = false }
  }, [coords])

  if (!coords) return <span className="text-gray-400">—</span>
  if (loading) return <span className="text-gray-400 text-xs italic">locating…</span>

  const [lat, lon] = coords.split(',')
  return (
    <a href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
      <MapPinIcon className="h-3 w-3 flex-shrink-0" />
      {name}
    </a>
  )
}

const today = new Date().toISOString().split('T')[0]

const STATUS_COLORS = {
  present:        'bg-green-100 text-green-700',
  absent:         'bg-red-100 text-red-700',
  late:           'bg-yellow-100 text-yellow-700',
  half_day:       'bg-orange-100 text-orange-700',
  on_leave:       'bg-slate-100 text-brand-slate',
  public_holiday: 'bg-gray-100 text-gray-500',
  off:            'bg-gray-50 text-gray-400',
}

const PAGE_SIZE = 12

function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-600">
      <span>{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(1)} disabled={page === 1}
          className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">«</button>
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">‹</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce((acc, p, idx, arr) => {
            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
            acc.push(p)
            return acc
          }, [])
          .map((p, i) => p === '…'
            ? <span key={`e${i}`} className="px-1">…</span>
            : <button key={p} onClick={() => onChange(p)}
                className={`px-2.5 py-1 rounded border text-xs font-medium ${p === page ? 'bg-brand-slate text-white border-brand-slate' : 'border-gray-200 hover:bg-gray-50'}`}>
                {p}
              </button>
          )
        }
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">›</button>
        <button onClick={() => onChange(totalPages)} disabled={page === totalPages}
          className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">»</button>
      </div>
    </div>
  )
}

export default function AttendancePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [view, setView]       = useState('daily')
  const [date, setDate]       = useState(today)
  const [month, setMonth]     = useState(today.slice(0, 7))
  const [page, setPage]       = useState(1)

  const { data: dailySheet, isLoading: loadingDaily } = useQuery({
    queryKey: ['daily-sheet', date],
    queryFn: () => getDailySheet({ date }),
    select: r => r.data?.results ?? r.data,
    enabled: view === 'daily',
  })

  const bulkMut = useMutation({
    mutationFn: bulkMarkAttendance,
    onSuccess: () => { toast.success('Attendance updated.'); qc.invalidateQueries(['daily-sheet', date]) },
    onError: () => toast.error('Failed to update.'),
  })

  const markStatus = (employeeId, status) => {
    bulkMut.mutate({ records: [{ employee: employeeId, date, status }] })
  }

  const present  = dailySheet?.filter(r => r.status === 'present').length  || 0
  const absent   = dailySheet?.filter(r => r.status === 'absent').length   || 0
  const late     = dailySheet?.filter(r => r.status === 'late').length     || 0
  const onLeave  = dailySheet?.filter(r => r.status === 'on_leave').length || 0

  const totalRows  = dailySheet?.length || 0
  const safePage   = Math.min(page, Math.max(1, Math.ceil(totalRows / PAGE_SIZE)))
  const pageSlice  = dailySheet?.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE) ?? []

  return (
    <div className="space-y-5">
      {/* Top action bar */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate('/hr/casuals-registry')}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
          <ClipboardDocumentListIcon className="h-3.5 w-3.5" /> Daily Casuals Registry →
        </button>
      </div>
      {/* View toggle */}
      <div className="flex gap-2 flex-wrap items-center">
        {[
          { key: 'daily',   label: 'Daily Sheet' },
          { key: 'log',     label: 'Biometric Log' },
        ].map(opt => (
          <button key={opt.key} onClick={() => setView(opt.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${view === opt.key ? 'bg-brand-slate text-white border-brand-slate' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {opt.label}
          </button>
        ))}

        {view === 'daily' && (
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
        )}
      </div>

      {/* Daily sheet */}
      {view === 'daily' && (
        <div className="space-y-4">
          {/* Summary */}
          {dailySheet && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Present',  val: present,  color: 'text-green-600',  bg: 'bg-green-50' },
                { label: 'Absent',   val: absent,   color: 'text-red-600',    bg: 'bg-red-50' },
                { label: 'Late',     val: late,     color: 'text-yellow-700', bg: 'bg-yellow-50' },
                { label: 'On Leave', val: onLeave,  color: 'text-brand-slate', bg: 'bg-slate-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-brand-slate text-sm">
                Attendance Sheet — {date}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">{totalRows} employees</span>
                {dailySheet && dailySheet.length > 0 && (<>
                  <button onClick={() => exportCSV(dailySheet, date)}
                    title="Export CSV"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 text-gray-600">
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" /> CSV
                  </button>
                  <button onClick={() => printReport(dailySheet, date, { present, absent, late, onLeave })}
                    title="Print / PDF"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 text-gray-600">
                    <PrinterIcon className="h-3.5 w-3.5" /> Print
                  </button>
                </>)}
              </div>
            </div>
            {loadingDaily
              ? <p className="text-sm text-gray-600 p-8 text-center">Loading…</p>
              : !dailySheet || dailySheet.length === 0
                ? <p className="text-sm text-gray-600 p-8 text-center">No attendance data. Add employees first.</p>
                : <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {['#', 'Employee', 'Time In', 'Time Out', 'Status', 'Location', 'Source', 'Quick Mark'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {pageSlice.map((rec, idx) => (
                            <tr key={rec.employee_id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-brand-slate text-xs">{rec.employee_number}</p>
                                <p className="text-xs text-gray-600">{rec.full_name}</p>
                              </td>
                              <td className="px-4 py-3 text-gray-700 text-xs font-mono">{rec.time_in || '—'}</td>
                              <td className="px-4 py-3 text-gray-700 text-xs font-mono">{rec.time_out || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[rec.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {rec.status?.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <LocationName coords={rec.location} />
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 capitalize">{rec.source || '—'}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1.5">
                                  <button title="Mark Present" onClick={() => markStatus(rec.employee_id, 'present')}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                                      ${rec.status === 'present'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-green-50 text-green-700 hover:bg-green-600 hover:text-white border border-green-200'}`}>
                                    <CheckCircleIcon className="h-3.5 w-3.5" /> P
                                  </button>
                                  <button title="Mark Absent" onClick={() => markStatus(rec.employee_id, 'absent')}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                                      ${rec.status === 'absent'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200'}`}>
                                    <XCircleIcon className="h-3.5 w-3.5" /> A
                                  </button>
                                  <button title="Mark On Leave" onClick={() => markStatus(rec.employee_id, 'on_leave')}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                                      ${rec.status === 'on_leave'
                                        ? 'bg-brand-slate text-white'
                                        : 'bg-slate-50 text-brand-slate hover:bg-brand-slate hover:text-white border border-slate-200'}`}>
                                    <ClockIcon className="h-3.5 w-3.5" /> L
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={safePage} total={totalRows} pageSize={PAGE_SIZE} onChange={setPage} />
                  </>
            }
          </div>
        </div>
      )}

      {/* Biometric log */}
      {view === 'log' && <BiometricLog />}
    </div>
  )
}

function BiometricLog() {
  const [dateFilter, setDateFilter] = useState(today)
  const [page, setPage] = useState(1)

  const { data: records, isLoading } = useQuery({
    queryKey: ['attendance-log', dateFilter],
    queryFn: () => getAttendance({ date: dateFilter, source: 'biometric' }),
    select: r => r.data?.results ?? r.data,
  })

  const total     = records?.length || 0
  const safePage  = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)))
  const pageSlice = records?.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE) ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
        <span className="text-xs text-gray-600">Showing biometric-sourced records only</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate text-sm">Biometric Attendance Log — {dateFilter}</h3>
          {total > 0 && <span className="text-xs text-gray-500">{total} records</span>}
        </div>
        {isLoading
          ? <p className="text-sm text-gray-600 p-8 text-center">Loading…</p>
          : !records || records.length === 0
            ? <p className="text-sm text-gray-600 p-8 text-center">No biometric records for this date.</p>
            : <>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>{['#', 'Employee', 'Device', 'Time In', 'Time Out', 'Status', 'Late Mins'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageSlice.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-brand-slate text-xs">{r.employee_number}</p>
                          <p className="text-xs text-gray-600">{r.full_name}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{r.device_name || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.time_in || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.time_out || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || ''}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-yellow-700">
                          {r.late_minutes > 0 ? `${r.late_minutes} min` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={safePage} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
              </>
        }
      </div>
    </div>
  )
}
