import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { getFuelPrices, createFuelPrice, updateFuelPrice, deleteFuelPrice } from '../../api/fleet'

const fmtDt = s => new Date(s).toLocaleDateString()

export default function FuelPriceManagementPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Fuel Price Management</h2>
          <p className="text-xs text-gray-400 mt-0.5">Manage fuel prices for cost calculations</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
          <PlusIcon className="h-4 w-4" />
          Add Price
        </button>
      </div>

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
          <label className="block text-xs font-medium text-gray-500 mb-1">Fuel Type</label>
          <select value={filterFuelType} onChange={e => setFilterFuelType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="">All Types</option>
            {fuelTypes.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
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
            <p className="text-sm text-gray-400">No fuel prices found</p>
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
                    <td className="px-5 py-3 text-gray-500">{fmtDt(p.effective_date)}</td>
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
