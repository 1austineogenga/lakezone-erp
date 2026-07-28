import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

/**
 * Reusable filter bar.
 * Props:
 *   filters   – { search, date_from, date_to, ...extras }
 *   onChange  – fn(key, value) — caller manages state
 *   onClear   – fn() — reset all filters
 *   extras    – array of { key, label, type:'select'|'text', options:[{value,label}] }
 */
export default function FilterBar({ filters = {}, onChange, onClear, extras = [] }) {
  const hasActive = Object.values(filters).some(v => v !== '' && v != null)

  return (
    <div className="flex gap-2 mb-4 flex-wrap items-center">
      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search…"
          value={filters.search || ''}
          onChange={e => onChange('search', e.target.value)}
          className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-red w-44"
        />
      </div>

      {/* Date from */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
        <input
          type="date"
          value={filters.date_from || ''}
          onChange={e => onChange('date_from', e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      {/* Date to */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
        <input
          type="date"
          value={filters.date_to || ''}
          onChange={e => onChange('date_to', e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      {/* Extra selects / inputs */}
      {extras.map(({ key, label, type = 'select', options = [] }) =>
        type === 'select'
          ? (
            <select key={key}
              value={filters[key] || ''}
              onChange={e => onChange(key, e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-red">
              <option value="">{label}</option>
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )
          : (
            <input key={key}
              type="text"
              placeholder={label}
              value={filters[key] || ''}
              onChange={e => onChange(key, e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-red w-36"
            />
          )
      )}

      {/* Clear */}
      {hasActive && (
        <button onClick={onClear}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg hover:border-red-300 transition-colors">
          <XMarkIcon className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  )
}
