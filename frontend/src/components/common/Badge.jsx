const variants = {
  active:     'bg-emerald-100 text-emerald-700',
  completed:  'bg-blue-100 text-blue-700',
  pending:    'bg-amber-100 text-amber-700',
  cancelled:  'bg-red-100 text-red-700',
  draft:      'bg-gray-100 text-gray-600',
  approved:   'bg-emerald-100 text-emerald-700',
  rejected:   'bg-red-100 text-red-700',
  default:    'bg-gray-100 text-gray-600',
}

export default function Badge({ status, label }) {
  const cls = variants[status?.toLowerCase()] ?? variants.default
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label ?? status}
    </span>
  )
}
