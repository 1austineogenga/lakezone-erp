import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon, MapIcon } from '@heroicons/react/24/outline'
import { getGeofences, createGeofence, updateGeofence, deleteGeofence, getGeofenceEvents } from '../../api/fleet'

const fmtDt = s => new Date(s).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })

export default function GeofenceManagementPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    geofence_type: 'circle',
    coordinates: {},
  })
  const [selectedGeofence, setSelectedGeofence] = useState(null)

  const { data: geofences = [] } = useQuery({
    queryKey: ['geofences'],
    queryFn: getGeofences,
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: events = [] } = useQuery({
    queryKey: ['geofence-events', selectedGeofence?.id],
    queryFn: () => getGeofenceEvents({ geofence: selectedGeofence?.id }),
    enabled: !!selectedGeofence?.id,
    select: r => r.data?.results ?? r.data ?? [],
  })

  const createMut = useMutation({
    mutationFn: createGeofence,
    onSuccess: () => {
      queryClient.invalidateQueries(['geofences'])
      setShowForm(false)
      setFormData({ name: '', description: '', geofence_type: 'circle', coordinates: {} })
    },
  })

  const updateMut = useMutation({
    mutationFn: (data) => updateGeofence(editingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['geofences'])
      setEditingId(null)
      setFormData({ name: '', description: '', geofence_type: 'circle', coordinates: {} })
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteGeofence,
    onSuccess: () => {
      queryClient.invalidateQueries(['geofences'])
      setSelectedGeofence(null)
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

  const handleEdit = (geofence) => {
    setEditingId(geofence.id)
    setFormData(geofence)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ name: '', description: '', geofence_type: 'circle', coordinates: {} })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-brand-slate">Geofence Management</h2>
          <p className="text-xs text-gray-600 mt-0.5">Create and manage vehicle geofences</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
          <PlusIcon className="h-4 w-4" />
          New Geofence
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">{editingId ? 'Edit' : 'Create'} Geofence</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
                <select value={formData.geofence_type} onChange={e => setFormData({ ...formData, geofence_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                  <option value="circle">Circle</option>
                  <option value="polygon">Polygon</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows="2" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <MapIcon className="h-4 w-4 inline mr-1" />
                Coordinates will be set via map interface (coming soon). For now, enter JSON format.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={handleCancel}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending}
                className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {editingId ? 'Update' : 'Create'} Geofence
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Geofences List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-brand-slate text-sm">All Geofences</h3>
            </div>
            {geofences.length === 0 ? (
              <div className="p-10 text-center">
                <MapIcon className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No geofences defined yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {geofences.map(g => (
                  <div key={g.id} onClick={() => setSelectedGeofence(g)}
                    className={`px-5 py-4 cursor-pointer transition-colors ${selectedGeofence?.id === g.id ? 'bg-blue-50 border-l-4 border-l-brand-red' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-brand-slate">{g.name}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{g.description || 'No description'}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {g.geofence_type === 'circle' ? '⭕ Circle' : '🔺 Polygon'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {g.is_active ? '✓ Active' : '✗ Inactive'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-3">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(g); }}
                          className="p-2 text-gray-400 hover:text-brand-red transition-colors">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteMut.mutate(g.id); }}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Events Sidebar */}
        {selectedGeofence && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-brand-slate text-sm">Recent Events</h3>
              <p className="text-xs text-gray-600 mt-0.5">{selectedGeofence.name}</p>
            </div>
            {events.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-xs text-gray-600">No events yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {events.slice(0, 20).map(e => (
                  <div key={e.id} className="px-5 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.event_type === 'entry' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {e.event_type === 'entry' ? '→ Entry' : '← Exit'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-brand-slate">{e.vehicle_no}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{fmtDt(e.occurred_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
