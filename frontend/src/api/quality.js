import axios from 'axios'

const BASE = '/api/v1/quality'

export const getQCDashboard    = (params) => axios.get(`${BASE}/dashboard/`, { params })
export const getInspections    = (params) => axios.get(`${BASE}/inspections/`, { params })
export const createInspection  = (data)   => axios.post(`${BASE}/inspections/`, data)
export const updateInspection  = (id, data) => axios.patch(`${BASE}/inspections/${id}/`, data)
export const deleteInspection  = (id)     => axios.delete(`${BASE}/inspections/${id}/`)

export const getNCRs           = (params) => axios.get(`${BASE}/ncrs/`, { params })
export const createNCR         = (data)   => axios.post(`${BASE}/ncrs/`, data)
export const updateNCR         = (id, data) => axios.patch(`${BASE}/ncrs/${id}/`, data)
export const deleteNCR         = (id)     => axios.delete(`${BASE}/ncrs/${id}/`)

export const getMaterialTests  = (params) => axios.get(`${BASE}/tests/`, { params })
export const createMaterialTest= (data)   => axios.post(`${BASE}/tests/`, data)
export const deleteMaterialTest= (id)     => axios.delete(`${BASE}/tests/${id}/`)

export const getPunchList      = (params) => axios.get(`${BASE}/punch-list/`, { params })
export const createPunchItem   = (data)   => axios.post(`${BASE}/punch-list/`, data)
export const updatePunchItem   = (id, data) => axios.patch(`${BASE}/punch-list/${id}/`, data)
export const deletePunchItem   = (id)     => axios.delete(`${BASE}/punch-list/${id}/`)
