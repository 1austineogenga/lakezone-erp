import api from './client'

export const getPRs        = (p) => api.get('/procurement/requisitions/', { params: p })
export const getPR         = (id) => api.get(`/procurement/requisitions/${id}/`)
export const createPR      = (d) => api.post('/procurement/requisitions/', d)
export const approvePR     = (id, d) => api.post(`/procurement/requisitions/${id}/approve/`, d)
export const getPOs        = (p) => api.get('/procurement/orders/', { params: p })
export const getPO         = (id) => api.get(`/procurement/orders/${id}/`)
export const getSuppliers  = () => api.get('/procurement/suppliers/')
