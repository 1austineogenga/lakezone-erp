import axios from 'axios'

const BASE = '/api/v1/deployment'

export const getDeploymentDashboard = (params) => axios.get(`${BASE}/dashboard/`, { params })

export const getLabourDeployments    = (params) => axios.get(`${BASE}/labour/`, { params })
export const createLabourDeployment  = (data)   => axios.post(`${BASE}/labour/`, data)
export const updateLabourDeployment  = (id, data) => axios.patch(`${BASE}/labour/${id}/`, data)
export const deleteLabourDeployment  = (id)     => axios.delete(`${BASE}/labour/${id}/`)

export const getEquipmentDeployments   = (params) => axios.get(`${BASE}/equipment/`, { params })
export const createEquipmentDeployment = (data)   => axios.post(`${BASE}/equipment/`, data)
export const updateEquipmentDeployment = (id, data) => axios.patch(`${BASE}/equipment/${id}/`, data)
export const deleteEquipmentDeployment = (id)     => axios.delete(`${BASE}/equipment/${id}/`)
