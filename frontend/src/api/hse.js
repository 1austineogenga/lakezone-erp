import axios from 'axios'

const BASE = '/api/v1/hse'

export const getHSEDashboard  = (params) => axios.get(`${BASE}/dashboard/`, { params })
export const getIncidents      = (params) => axios.get(`${BASE}/incidents/`, { params })
export const createIncident    = (data)   => axios.post(`${BASE}/incidents/`, data)
export const updateIncident    = (id, data) => axios.patch(`${BASE}/incidents/${id}/`, data)
export const deleteIncident    = (id)     => axios.delete(`${BASE}/incidents/${id}/`)

export const getToolboxTalks   = (params) => axios.get(`${BASE}/toolbox-talks/`, { params })
export const createToolboxTalk = (data)   => axios.post(`${BASE}/toolbox-talks/`, data)
export const updateToolboxTalk = (id, data) => axios.patch(`${BASE}/toolbox-talks/${id}/`, data)
export const deleteToolboxTalk = (id)     => axios.delete(`${BASE}/toolbox-talks/${id}/`)

export const getInductions     = (params) => axios.get(`${BASE}/inductions/`, { params })
export const createInduction   = (data)   => axios.post(`${BASE}/inductions/`, data)
export const updateInduction   = (id, data) => axios.patch(`${BASE}/inductions/${id}/`, data)
export const deleteInduction   = (id)     => axios.delete(`${BASE}/inductions/${id}/`)

export const getPPEIssuances   = (params) => axios.get(`${BASE}/ppe/`, { params })
export const createPPEIssuance = (data)   => axios.post(`${BASE}/ppe/`, data)
export const deletePPEIssuance = (id)     => axios.delete(`${BASE}/ppe/${id}/`)
