import api from './client'

export const login = (email, password) =>
  api.post('/auth/login/', { email, password })

export const logout = (refresh) =>
  api.post('/auth/logout/', { refresh })

export const getMe = () => api.get('/auth/me/')
