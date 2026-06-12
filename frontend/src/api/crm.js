import api from './client'

export const getClients      = (p) => api.get('/crm/clients/', { params: p })
export const getClient       = (id) => api.get(`/crm/clients/${id}/`)
export const createClient    = (d) => api.post('/crm/clients/', d)
export const getOpportunities = (p) => api.get('/crm/opportunities/', { params: p })
