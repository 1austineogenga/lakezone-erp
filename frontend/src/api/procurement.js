import api from './client'

export const getPRs        = (p)     => api.get('/procurement/requisitions/', { params: p })
export const getPR         = (id)    => api.get(`/procurement/requisitions/${id}/`)
export const createPR      = (d)     => api.post('/procurement/requisitions/', d)
export const approvePR     = (id, d) => api.post(`/procurement/requisitions/${id}/approve/`, d)

export const getPOs        = (p)     => api.get('/procurement/purchase-orders/', { params: p })
export const getPO         = (id)    => api.get(`/procurement/purchase-orders/${id}/`)
export const createPO      = (d)     => api.post('/procurement/purchase-orders/', d)
export const updatePO      = (id, d) => api.patch(`/procurement/purchase-orders/${id}/`, d)

export const getSuppliers  = (p)     => api.get('/procurement/suppliers/', { params: p })
export const createSupplier = (d)   => api.post('/procurement/suppliers/', d)
export const updateSupplier = (id, d) => api.patch(`/procurement/suppliers/${id}/`, d)
