import api from './client'

export const getStockItems     = (p)     => api.get('/inventory/items/', { params: p })
export const getStockItem      = (id)    => api.get(`/inventory/items/${id}/`)
export const createStockItem   = (d)     => api.post('/inventory/items/', d)
export const updateStockItem   = (id, d) => api.patch(`/inventory/items/${id}/`, d)
export const getStockLevels    = (p)     => api.get('/inventory/levels/', { params: p })
export const getTransactions   = (p)     => api.get('/inventory/transactions/', { params: p })
export const createTransaction = (d)     => api.post('/inventory/transactions/', d)
export const getStores         = ()      => api.get('/inventory/stores/')
