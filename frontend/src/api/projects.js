import api from './client'

export const getProjects    = (params) => api.get('/projects/', { params })
export const getProject     = (id)     => api.get(`/projects/${id}/`)
export const createProject  = (data)   => api.post('/projects/', data)
export const updateProject  = (id, d)  => api.patch(`/projects/${id}/`, d)
export const getProjectBOQ  = (id)     => api.get(`/projects/${id}/boq/`)
export const getCosting     = (id)     => api.get(`/projects/${id}/costing/`)
export const getProgress    = (id)     => api.get(`/projects/${id}/progress/`)
export const getTenders     = (pid)    => api.get(`/projects/${pid}/tenders/`)
