import api from './client'

export const getNotifications = () => api.get('/notifications/')
export const getUnreadCount   = () => api.get('/notifications/unread/')
export const markRead         = (id) => api.post(`/notifications/${id}/read/`)
export const markAllRead          = () => api.post('/notifications/mark-all/')
export const registerDeviceToken  = (token, platform = 'android') =>
  api.post('/notifications/device-token/', { token, platform })
