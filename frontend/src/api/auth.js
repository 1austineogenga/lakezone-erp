import api from './client'

export const login = (email, password) =>
  api.post('/auth/login/', { email, password })

export const logout = (refresh) =>
  api.post('/auth/logout/', { refresh })

export const getMe = () => api.get('/auth/me/')

export const changePassword = (old_password, new_password) =>
  api.post('/auth/change-password/', { old_password, new_password })

export const getMDDashboard = () => api.get('/auth/md-dashboard/')

export const resetAllPasswords = () => api.post('/auth/reset-all-passwords/')
