import api from './client'

export const fetchConversations = (folder) => {
  const params = {}
  if (folder === 'sent') params.folder = 'sent'
  else if (folder === 'archived') params.folder = 'archived'
  else if (folder === 'announcements') params.type = 'broadcast'
  return api.get('/comms/conversations/', { params }).then(r => r.data?.results ?? r.data ?? [])
}

export const fetchConversationDetail = (id) =>
  api.get(`/comms/conversations/${id}/`).then(r => r.data)

export const fetchUnreadCount = () =>
  api.get('/comms/unread-count/').then(r => r.data?.count ?? r.data?.unread_count ?? 0)

export const fetchActiveUsers = () =>
  api.get('/auth/users/active/', { params: { page_size: 500 } }).then(r => r.data?.results ?? r.data ?? [])

export const sendConversation = (formData) =>
  api.post('/comms/conversations/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

export const sendReply = (conversationId, formData) =>
  api.post(`/comms/conversations/${conversationId}/messages/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

export const archiveConversation = (id) =>
  api.post(`/comms/conversations/${id}/archive/`).then(r => r.data)
