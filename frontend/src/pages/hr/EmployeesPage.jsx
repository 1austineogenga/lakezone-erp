import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEmployees } from '../../api/hr'
import api from '../../api/client'
import { PlusIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

const PAGE_SIZE = 12

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-cyan-500',
  'bg-teal-500',   'bg-emerald-500','bg-amber-500', 'bg-rose-500',
  'bg-pink-500',   'bg-sky-500',    'bg-orange-500','bg-lime-600',
]

function avatarColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function PaginationBar({ safePage, totalPages, filtered, setPage, border }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  return (
    <div className={`flex items-center justify-between px-4 py-3 bg-gray-50 ${border ? 'border-t' : 'border-b'} border-gray-100`}>
      <p className="text-xs text-gray-500">
        Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-40">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {pages.map(p => (
          <button key={p} onClick={() => setPage(p)}
            className={`px-2.5 py-1 rounded text-xs font-medium ${p === safePage ? 'bg-brand-red text-white' : 'hover:bg-gray-200 text-gray-600'}`}>
            {p}
          </button>
        ))}
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-40">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function EmployeesPage() {
  const [searchParams] = useSearchParams()
  const [search, setSearch]   = useState('')
  const [typeFilter, setType] = useState(searchParams.get('type') || '')
  const [deptFilter, setDept] = useState('')
  const [page, setPage]       = useState(1)

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', typeFilter, deptFilter],
    queryFn: () => getEmployees({
      ...(typeFilter && { employment_type: typeFilter }),
      ...(deptFilter && { department: deptFilter }),
      is_active: 'true',
      page_size: 500,
    }),
    select: r => Array.isArray(r.data) ? r.data : (r.data.results ?? []),
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/auth/departments/'),
    select: r => r.data?.results ?? r.data,
  })

  const filtered = (employees || []).filter(e =>
    !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_number?.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSearch = (val) => { setSearch(val); setPage(1) }
  const handleType   = (val) => { setType(val);   setPage(1) }
  const handleDept   = (val) => { setDept(val);   setPage(1) }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand-slate">Employees</h1>
          <div className="flex gap-3 mt-0.5">
            <span className="text-xs text-gray-500">{filtered.length} total</span>
            <span className="text-xs text-indigo-600 font-medium">{filtered.filter(e => e.employment_type === 'staff').length} staff</span>
            <span className="text-xs text-purple-600 font-medium">{filtered.filter(e => e.employment_type === 'casual').length} casuals</span>
          </div>
        </div>
        <Link to="/hr/employees/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-sm font-semibold rounded-xl hover:opacity-90">
          <PlusIcon className="h-4 w-4" /> Add Employee
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search name or number…"
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red w-56" />
        </div>
        <select value={typeFilter} onChange={e => handleType(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
          <option value="">All Types</option>
          <option value="staff">Staff (Permanent)</option>
          <option value="casual">Casuals</option>
        </select>
        <select value={deptFilter} onChange={e => handleDept(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red">
          <option value="">All Departments</option>
          {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-gray-500 p-8 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500 p-8 text-center">No employees found.</p>
        ) : (
          <>
            <PaginationBar safePage={safePage} totalPages={totalPages} filtered={filtered} setPage={setPage} />
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['#', 'Employee', 'Type', 'Department', 'Position', 'Phone', 'Date Hired', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((emp, idx) => {
                    const initials = (emp.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                    const bg = avatarColor(emp.full_name || '')
                    const isStaff = emp.employment_type === 'staff'
                    return (
                      <tr key={emp.id} className={`border-b border-gray-50 hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                        <td className="px-4 py-3">
                          <Link to={`/hr/employees/${emp.id}`}
                            className="font-mono text-xs font-semibold text-brand-slate hover:text-brand-red hover:underline">
                            {emp.employee_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/hr/employees/${emp.id}`} className="flex items-center gap-3 group">
                            <div className={`h-8 w-8 rounded-lg ${bg} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                              {initials}
                            </div>
                            <span className="text-sm font-semibold text-brand-slate group-hover:text-brand-red transition-colors">
                              {emp.full_name}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold
                            ${isStaff ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                            {isStaff ? 'Staff' : 'Casual'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{emp.department_name || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{emp.position_title || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 font-mono">{emp.phone || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{emp.date_hired}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold
                            ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar safePage={safePage} totalPages={totalPages} filtered={filtered} setPage={setPage} border />
          </>
        )}
      </div>
    </div>
  )
}
