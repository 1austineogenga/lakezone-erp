import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon, PencilIcon, TrashIcon, ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { getFuelPrices, createFuelPrice, updateFuelPrice, deleteFuelPrice, fetchErcFuelPrices } from '../../api/fleet'

const fmtDt = s => new Date(s).toLocaleDateString()

export default function FuelPriceManagementPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [ercResult, setErcResult] = useState(null)
  const [formData, setFormData] = useState({
    fuel_type: 'diesel',
    location: 'Nairobi',
    price_per_litre: '',
    effective_date: new Date().toISOString().split('T')[0],
  })
  const [filterLocation, setFilterLocation] = useState('')
  const [filterFuelType, setFilterFuelType] = useState('')

  const { data: allPrices = [] } = useQuery({
    queryKey: ['fuel-prices'],
    queryFn: getFuelPrices,
    select: r => r.data?.results ?? r.data ?? [],
  })

  const prices = allPrices.filter(p => 
    (!filterLocation || p.location === filterLocation) &&
    (!filterFuelType || p.fuel_type === filterFuelType)
  )

  const createMut = useMutation({
    mutationFn: createFuelPrice,
    onSuccess: () => {
      queryClient.invalidateQueries(['fuel-prices'])
      setShowForm(false)
      setFormData({
        fuel_type: 'diesel',
        location: 'Nairobi',
        price_per_litre: '',
        effective_date: new Date().toISOString().split('T')[0],
      })
    },
  })

  const updateMut = useMutation({
    mutationFn: (data) => updateFuelPrice(editingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['fuel-prices'])
      setEditingId(null)
      setFormData({
        fuel_type: 'diesel',
        location: 'Nairobi',
        price_per_litre: '',
        effective_date: new Date().toISOString().split('T')[0],
      })
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteFuelPrice,
    onSuccess: () => {
      queryClient.invalidateQueries(['fuel-prices'])
    },
  })

  const ercMut = useMutation({
    mutationFn: fetchErcFuelPrices,
    onSuccess: r => {
      setErcResult(r.data)
      queryClient.invalidateQueries(['fuel-prices'])
      if (r.data.scraped_from_erc) {
        toast.success(`ERC prices fetched — ${r.data.fetched.length} records saved.`)
      } else {
        toast.info('Could not auto-fetch from ERC website. Please enter prices manually.')
      }
    },
    onError: () => toast.error('Failed to fetch ERC prices.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingId) {
      updateMut.mutate(formData)
    } else {
      createMut.mutate(formData)
    }
  }

  const handleEdit = (price) => {
    setEditingId(price.id)
    setFormData(price)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      fuel_type: 'diesel',
      location: 'Nairobi',
      price_per_litre: '',
      effective_date: new Date().toISOString().split('T')[0],
    })
  }

  const locations = [...new Set(allPrices.map(p => p.location))]
  const fuelTypes = [
    { value: 'diesel', label: 'Diesel' },
    { value: 'petrol', label: 'Super Petrol' },
    { value: 'kerosene', label: 'Kerosene' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Fuel Price Management</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Kenya ERC reviews pump prices on the <strong>14th of every month</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => ercMut.mutate()} disabled={ercMut.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-brand-slate text-xs font-semibold rounded-xl hover:border-emerald-500 hover:text-emerald-700 transition-colors disabled:opacity-60">
            <ArrowPathIcon className={`h-3.5 w-3.5 ${ercMut.isPending ? 'animate-spin' : ''}`} />
            {ercMut.isPending ? 'Fetching ERC…' : 'Fetch ERC Prices'}
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
            <PlusIcon className="h-4 w-4" />
            Add Price
          </button>
        </div>
      </div>

      {/* ERC fetch result banner */}
      {ercResult && (
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${ercResult.scraped_from_erc ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <InformationCircleIcon className={`h-5 w-5 mt-0.5 shrink-0 ${ercResult.scraped_from_erc ? 'text-green-600' : 'text-amber-600'}`} />
          <div className="flex-1 min-w-0">
            {ercResult.scraped_from_erc ? (
              <p className="text-xs font-semibold text-green-800">ERC prices fetched and saved for {ercResult.effective_date}</p>
            ) : (
              <p className="text-xs font-semibold text-amber-800">Could not auto-fetch from ERC website — please enter prices manually below.</p>
            )}
            {ercResult.current_prices && Object.keys(ercResult.current_prices).length > 0 && (
              <div className="mt-2 flex gap-4 flex-wrap">
                {Object.entries(ercResult.current_prices).map(([ft, p]) => (
                  <div key={ft} className="text-xs">
                    <span className="text-gray-600 capitalize">{ft}: </span>
                    <span className="font-bold text-gray-800">KSh {p.price_per_litre}/L</span>
                    <span className="text-gray-600 ml-1">({p.effective_date})</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-gray-600 mt-1">Next review: {ercResult.next_review}</p>
          </div>
          <button onClick={() => setErcResult(null)} className="text-gray-400 hover:text-gray-600 shrink-0 text-xs">✕</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">{editingId ? 'Edit' : 'Add'} Fuel Price</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fuel Type *</label>
                <select value={formData.fuel_type} onChange={e => setFormData({ ...formData, fuel_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                  {fuelTypes.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Location *</label>
                <select value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                  <option value="Nairobi">Nairobi</option>
                  <option value="Mombasa">Mombasa</option>
                  <option value="Kisumu">Kisumu</option>
                  <option value="Nakuru">Nakuru</option>
                  <option value="Eldoret">Eldoret</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Price per Litre (KSh) *</label>
                <input type="number" step="0.01" value={formData.price_per_litre} 
                  onChange={e => setFormData({ ...formData, price_per_litre: e.target.value })}
                  required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date *</label>
                <input type="date" value={formData.effective_date} 
                  onChange={e => setFormData({ ...formData, effective_date: e.target.value })}
                  required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={handleCancel}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending}
                className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {editingId ? 'Update' : 'Add'} Price
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fuel Type</label>
          <select value={filterFuelType} onChange={e => setFilterFuelType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="">All Types</option>
            {fuelTypes.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
          <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="">All Locations</option>
            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>
      </div>

      {/* Prices Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Fuel Prices ({prices.length})</h3>
        </div>
        {prices.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-600">No fuel prices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Fuel Type', 'Location', 'Price/L', 'Effective Date', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prices.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-semibold text-brand-slate">
                      {fuelTypes.find(ft => ft.value === p.fuel_type)?.label}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{p.location}</td>
                    <td className="px-5 py-3 font-bold text-green-600">KSh {p.price_per_litre}</td>
                    <td className="px-5 py-3 text-gray-600">{fmtDt(p.effective_date)}</td>
                    <td className="px-5 py-3 flex gap-2">
                      <button onClick={() => handleEdit(p)}
                        className="p-2 text-gray-400 hover:text-brand-red transition-colors">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteMut.mutate(p.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
