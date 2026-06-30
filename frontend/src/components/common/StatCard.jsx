export default function StatCard({ label, value, icon: Icon, color = 'red', sub }) {
  const colors = {
    red:   'bg-brand-red text-white',
    slate: 'bg-brand-slate text-white',
    green: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
  }
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colors[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
