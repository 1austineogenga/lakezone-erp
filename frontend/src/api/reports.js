import api from './axios'

const BASE = '/reports'

export const getForemanDailyReports  = (p) => api.get(`${BASE}/foreman/daily/`, { params: p })
export const createForemanDailyReport = (d) => api.post(`${BASE}/foreman/daily/`, d)
export const getForemanDailyReport   = (id) => api.get(`${BASE}/foreman/daily/${id}/`)
export const updateForemanDailyReport = (id, d) => api.patch(`${BASE}/foreman/daily/${id}/`, d)

export const getForemanWeeklyReports  = (p) => api.get(`${BASE}/foreman/weekly/`, { params: p })
export const createForemanWeeklyReport = (d) => api.post(`${BASE}/foreman/weekly/`, d)
export const getForemanWeeklyReport   = (id) => api.get(`${BASE}/foreman/weekly/${id}/`)
export const updateForemanWeeklyReport = (id, d) => api.patch(`${BASE}/foreman/weekly/${id}/`, d)

export const getSurveyorDailyReports  = (p) => api.get(`${BASE}/surveyor/daily/`, { params: p })
export const createSurveyorDailyReport = (d) => api.post(`${BASE}/surveyor/daily/`, d)
export const getSurveyorDailyReport   = (id) => api.get(`${BASE}/surveyor/daily/${id}/`)
export const updateSurveyorDailyReport = (id, d) => api.patch(`${BASE}/surveyor/daily/${id}/`, d)

export const getSurveyorWeeklyReports  = (p) => api.get(`${BASE}/surveyor/weekly/`, { params: p })
export const createSurveyorWeeklyReport = (d) => api.post(`${BASE}/surveyor/weekly/`, d)
export const getSurveyorWeeklyReport   = (id) => api.get(`${BASE}/surveyor/weekly/${id}/`)
export const updateSurveyorWeeklyReport = (id, d) => api.patch(`${BASE}/surveyor/weekly/${id}/`, d)

export const getMachineDailyReports  = (p) => api.get(`${BASE}/machine/daily/`, { params: p })
export const createMachineDailyReport = (d) => api.post(`${BASE}/machine/daily/`, d)
export const getMachineDailyReport   = (id) => api.get(`${BASE}/machine/daily/${id}/`)
export const updateMachineDailyReport = (id, d) => api.patch(`${BASE}/machine/daily/${id}/`, d)

export const getMachineWeeklyReports  = (p) => api.get(`${BASE}/machine/weekly/`, { params: p })
export const createMachineWeeklyReport = (d) => api.post(`${BASE}/machine/weekly/`, d)
export const getMachineWeeklyReport   = (id) => api.get(`${BASE}/machine/weekly/${id}/`)
export const updateMachineWeeklyReport = (id, d) => api.patch(`${BASE}/machine/weekly/${id}/`, d)
