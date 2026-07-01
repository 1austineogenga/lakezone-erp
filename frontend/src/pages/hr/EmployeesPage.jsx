import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEmployees } from '../../api/hr'
import api from '../../api/client'
import { PlusIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, PhoneIcon, BuildingOfficeIcon, CalendarIcon } from '@heroicons/react/24/outline'

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
    <div className={`flex items-center justify-between px-4 py-3 ${border ? 'border-t' : 'border-b'} border-gray-100`}>
      <p className="text-xs text-gray-500">
        Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {pages.map(p => (
          <button key={p} onClick={() => setPage(p)}
            className={`px-2.5 py-1 rounded text-xs font-medium ${p === safePage ? 'bg-brand-red text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
            {p}
          </button>
        ))}
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function EmployeeCard({ emp }) {
  const initials = (emp.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const bg = avatarColor(emp.full_name || '')
  const isStaff = emp.employment_type === 'staff'

  return (
    <Link to={`/hr/employees/${emp.id}`}
      className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col">

      {/* Coloured top strip + avatar */}
      <div className={`${bg} h-14 relative`}>
        <div className="absolute -bottom-6 left-5">
          <div className={`h-12 w-12 rounded-xl ${bg} border-2 border-white text-white flex items-center justify-center text-base font-bold shadow-md`}>
            {initials}
          </div>
        </div>
        {/* Type badge top-right */}
        <div className="absolute top-3 right-3">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isStaff ? 'bg-white/30 text-white' : 'bg-white/30 text-white'}`}>
            {isStaff ? 'Staff' : 'Casual'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="pt-8 px-5 pb-4 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-brand-slate text-sm leading-tight">{emp.full_name}</p>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">{emp.employee_number}</p>
          </div>
          <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold mt-0.5
            ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {emp.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {emp.position_title && (
          <p className="text-xs text-gray-600 font-medium mt-1">{emp.position_title}</p>
        )}

        <div className="mt-2 space-y-1.5">
          {emp.department_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <BuildingOfficeIcon className="h-3 w-3 shrink-0" />
              {emp.department_name}
            </div>
          )}
          {emp.phone && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <PhoneIcon className="h-3 w-3 shrink-0" />
              {emp.phone}
            </div>
          )}
          {emp.date_hired && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <CalendarIcon className="h-3 w-3 shrink-0" />
              Hired {emp.date_hired}
            </div>
          )}
        </div>
      </div>
    </Link>
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

  const staffCount   = filtered.filter(e => e.employment_type === 'staff').length
  const casualCount  = filtered.filter(e => e.employment_type === 'casual').length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand-slate">Employees</h1>
          <div className="flex gap-3 mt-0.5">
            <span className="text-xs text-gray-500">{filtered.length} total</span>
            <span className="text-xs text-indigo-600 font-medium">{staffCount} staff</span>
            <span className="text-xs text-purple-600 font-medium">{casualCount} casuals</span>
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

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-500">
          <p className="text-sm">No employees found.</p>
        </div>
      ) : (
        <>
          <PaginationBar safePage={safePage} totalPages={totalPages} filtered={filtered} setPage={setPage} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginated.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
          </div>
          <PaginationBar safePage={safePage} totalPages={totalPages} filtered={filtered} setPage={setPage} border />
        </>
      )}
    </div>
  )
}
