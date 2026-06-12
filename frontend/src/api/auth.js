import api from './client'

export const login = (email, password) =>
  api.post('/auth/token/', { email, password })

export const logout = (refresh) =>
  api.post('/auth/token/blacklist/', { refresh })

export const getMe = () => api.get('/auth/me/')
