import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEmployees } from '../../api/hr'
import api from '../../api/client'
import { PlusIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

function PaginationBar({ safePage, totalPages, filtered, setPage, border }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  return (
    <div className={`flex items-center justify-between px-4 py-3 bg-gray-50 ${border ? 'border-t' : 'border-b'} border-gray-100`}>
      <p className="text-xs text-gray-600">
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

const TYPE_COLORS = {
  staff:  'bg-indigo-100 text-indigo-700',
  casual: 'bg-purple-100 text-purple-700',
}

const PAGE_SIZE = 12

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
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search name or number…"
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red w-60" />
        </div>
        <select value={typeFilter} onChange={e => handleType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
          <option value="">All Types</option>
          <option value="staff">Staff (Permanent)</option>
          <option value="casual">Casuals</option>
        </select>
        <select value={deptFilter} onChange={e => handleDept(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
          <option value="">All Departments</option>
          {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <Link to="/hr/employees/new"
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
          <PlusIcon className="h-4 w-4" /> Add Employee
        </Link>
      </div>

      {/* Summary */}
      <div className="flex gap-3 items-center">
        <span className="text-xs text-gray-600">{filtered.length} employees shown</span>
        <span className="text-xs text-indigo-600 font-medium">{filtered.filter(e => e.employment_type === 'staff').length} staff</span>
        <span className="text-xs text-purple-600 font-medium">{filtered.filter(e => e.employment_type === 'casual').length} casuals</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading
          ? <p className="text-sm text-gray-600 p-8 text-center">Loading…</p>
          : filtered.length === 0
            ? <p className="text-sm text-gray-600 p-8 text-center">No employees found.</p>
            : <>
                {/* Pagination — top */}
                <PaginationBar safePage={safePage} totalPages={totalPages} filtered={filtered} setPage={setPage} />

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['#', 'Name', 'Type', 'Department', 'Position', 'Phone', 'Date Hired', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginated.map(emp => (
                        <tr key={emp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs font-medium text-brand-slate">
                            <Link to={`/hr/employees/${emp.id}`} className="hover:underline">{emp.employee_number}</Link>
                          </td>
                          <td className="px-4 py-3">
                            <Link to={`/hr/employees/${emp.id}`} className="flex items-center gap-2 hover:text-brand-red">
                              <div className="h-7 w-7 rounded-full bg-brand-slate text-white flex items-center justify-center text-xs font-bold shrink-0">
                                {emp.full_name?.[0] || '?'}
                              </div>
                              <span className="font-medium text-brand-slate">{emp.full_name}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[emp.employment_type]}`}>
                              {emp.employment_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{emp.department_name || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{emp.position_title || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{emp.phone || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{emp.date_hired}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                              ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {emp.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination — bottom */}
                <PaginationBar safePage={safePage} totalPages={totalPages} filtered={filtered} setPage={setPage} border />
              </>
        }
      </div>
    </div>
  )
}
