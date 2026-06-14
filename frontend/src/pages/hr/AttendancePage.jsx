import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getDailySheet, getMonthlyReport, bulkMarkAttendance, getAttendance } from '../../api/hr'
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline'

const today = new Date().toISOString().split('T')[0]

const STATUS_COLORS = {
  present:        'bg-green-100 text-green-700',
  absent:         'bg-red-100 text-red-700',
  late:           'bg-yellow-100 text-yellow-700',
  half_day:       'bg-orange-100 text-orange-700',
  on_leave:       'bg-blue-100 text-blue-700',
  public_holiday: 'bg-gray-100 text-gray-500',
  off:            'bg-gray-50 text-gray-400',
}

export default function AttendancePage() {
  const qc = useQueryClient()
  const [view, setView]       = useState('daily')
  const [date, setDate]       = useState(today)
  const [month, setMonth]     = useState(today.slice(0, 7))

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

  return (
    <div className="space-y-5">
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
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
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
                { label: 'On Leave', val: onLeave,  color: 'text-blue-600',   bg: 'bg-blue-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-brand-slate text-sm">
                Attendance Sheet — {date}
              </h3>
              <span className="text-xs text-gray-400">{dailySheet?.length || 0} employees</span>
            </div>
            {loadingDaily
              ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
              : !dailySheet || dailySheet.length === 0
                ? <p className="text-sm text-gray-400 p-8 text-center">No attendance data. Add employees first.</p>
                : <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Employee', 'Type', 'Time In', 'Time Out', 'Status', 'Source', 'Quick Mark'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dailySheet.map(rec => (
                          <tr key={rec.employee_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-brand-slate text-xs">{rec.employee_number}</p>
                              <p className="text-xs text-gray-500">{rec.full_name}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                ${rec.employment_type === 'staff' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                                {rec.employment_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 text-xs font-mono">{rec.time_in || '—'}</td>
                            <td className="px-4 py-3 text-gray-700 text-xs font-mono">{rec.time_out || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[rec.status] || 'bg-gray-100 text-gray-600'}`}>
                                {rec.status?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 capitalize">{rec.source || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <button title="Mark Present" onClick={() => markStatus(rec.employee_id, 'present')}
                                  className={`p-1 rounded ${rec.status === 'present' ? 'text-green-600' : 'text-gray-300 hover:text-green-600'}`}>
                                  <CheckCircleIcon className="h-4 w-4" />
                                </button>
                                <button title="Mark Absent" onClick={() => markStatus(rec.employee_id, 'absent')}
                                  className={`p-1 rounded ${rec.status === 'absent' ? 'text-red-600' : 'text-gray-300 hover:text-red-600'}`}>
                                  <XCircleIcon className="h-4 w-4" />
                                </button>
                                <button title="Mark On Leave" onClick={() => markStatus(rec.employee_id, 'on_leave')}
                                  className={`p-1 rounded ${rec.status === 'on_leave' ? 'text-blue-600' : 'text-gray-300 hover:text-blue-600'}`}>
                                  <ClockIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

  const { data: records, isLoading } = useQuery({
    queryKey: ['attendance-log', dateFilter],
    queryFn: () => getAttendance({ date: dateFilter, source: 'biometric' }),
    select: r => r.data?.results ?? r.data,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
        <span className="text-xs text-gray-500">Showing biometric-sourced records only</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Biometric Attendance Log — {dateFilter}</h3>
        </div>
        {isLoading
          ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
          : !records || records.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No biometric records for this date.</p>
            : <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Employee', 'Device', 'Time In', 'Time Out', 'Status', 'Late Mins'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-slate text-xs">{r.employee_number}</p>
                        <p className="text-xs text-gray-500">{r.full_name}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.device_name || '—'}</td>
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
        }
      </div>
    </div>
  )
}
