import axios from 'axios'

const BASE = '/api/v1/documents'

export const getDocumentDashboard = (params) => axios.get(`${BASE}/dashboard/`, { params })

export const getDrawings    = (params) => axios.get(`${BASE}/drawings/`, { params })
export const createDrawing  = (data)   => axios.post(`${BASE}/drawings/`, data)
export const updateDrawing  = (id, data) => axios.patch(`${BASE}/drawings/${id}/`, data)
export const deleteDrawing  = (id)     => axios.delete(`${BASE}/drawings/${id}/`)

export const getRFIs        = (params) => axios.get(`${BASE}/rfis/`, { params })
export const createRFI      = (data)   => axios.post(`${BASE}/rfis/`, data)
export const updateRFI      = (id, data) => axios.patch(`${BASE}/rfis/${id}/`, data)
export const deleteRFI      = (id)     => axios.delete(`${BASE}/rfis/${id}/`)

export const getSubmittals      = (params) => axios.get(`${BASE}/submittals/`, { params })
export const createSubmittal    = (data)   => axios.post(`${BASE}/submittals/`, data)
export const updateSubmittal    = (id, data) => axios.patch(`${BASE}/submittals/${id}/`, data)
export const deleteSubmittal    = (id)     => axios.delete(`${BASE}/submittals/${id}/`)
