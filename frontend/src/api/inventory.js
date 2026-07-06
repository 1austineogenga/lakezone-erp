import api from './client'

export const getStockItems     = (p)     => api.get('/inventory/items/', { params: p })
export const getStockItem      = (id)    => api.get(`/inventory/items/${id}/`)
export const createStockItem   = (d)     => api.post('/inventory/items/', d)
export const updateStockItem   = (id, d) => api.patch(`/inventory/items/${id}/`, d)
export const getStockLevels    = (p)     => api.get('/inventory/levels/', { params: p })
export const getTransactions   = (p)     => api.get('/inventory/transactions/', { params: p })
export const createTransaction = (d)     => api.post('/inventory/transactions/', d)
export const getStores         = ()      => api.get('/inventory/stores/')
export const getLowStockItems  = (p)     => api.get('/inventory/items/low-stock/', { params: p })

// Fixed Assets Register
export const getAssets           = (p)          => api.get('/inventory/assets/', { params: p })
export const getAsset            = (id)         => api.get(`/inventory/assets/${id}/`)
export const createAsset         = (d)          => api.post('/inventory/assets/', d)
export const updateAsset         = (id, d)      => api.patch(`/inventory/assets/${id}/`, d)
export const deleteAsset         = (id)         => api.delete(`/inventory/assets/${id}/`)
export const getAssetMaintenance = (assetId)    => api.get(`/inventory/assets/${assetId}/maintenance/`)
export const addAssetMaintenance = (assetId, d) => api.post(`/inventory/assets/${assetId}/maintenance/`, d)
export const getAssetDashboard   = ()           => api.get('/inventory/assets/dashboard/')

// Store Requests
export const getStoreItems      = (storeId)    => api.get(`/inventory/stores/${storeId}/items/`)
export const getStoreRequests   = (params)     => api.get('/inventory/store-requests/', { params })
export const getStoreRequest    = (id)         => api.get(`/inventory/store-requests/${id}/`)
export const createStoreRequest = (d)          => api.post('/inventory/store-requests/', d)
export const approveStoreRequest = (id, d)     => api.post(`/inventory/store-requests/${id}/approve/`, d)
export const rejectStoreRequest  = (id, d)     => api.post(`/inventory/store-requests/${id}/reject/`, d)
export const dispatchStoreRequest = (id, d)    => api.post(`/inventory/store-requests/${id}/dispatch/`, d)
export const receiveStoreRequest  = (id, d)    => api.post(`/inventory/store-requests/${id}/receive/`, d)
export const returnStoreRequest   = (id, d)    => api.post(`/inventory/store-requests/${id}/return/`, d)
export const cancelStoreRequest   = (id)       => api.post(`/inventory/store-requests/${id}/cancel/`)
