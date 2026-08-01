import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import useAuthStore from '../../store/authStore'
import {
  fetchConversations,
  fetchConversationDetail,
  fetchActiveUsers,
  sendConversation,
  sendReply,
  archiveConversation,
} from '../../api/comms'
import {
  PencilSquareIcon,
  InboxIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  ArchiveBoxIcon,
  XMarkIcon,
  PaperClipIcon,
  PrinterIcon,
  ArchiveBoxArrowDownIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline'

// ── Roles allowed to send broadcasts ──────────────────────────────────────────
const BROADCAST_ROLES = new Set(['system_admin', 'md', 'managing_director', 'hr', 'admin', 'finance', 'site_manager', 'admin_officer'])

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase() || '?'
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: '2-digit' })
}

function formatDatetime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Avatar circle ─────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md' }) {
  const sizeMap = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' }
  return (
    <div className={`${sizeMap[size]} rounded-full bg-brand-red flex items-center justify-center text-white font-semibold shrink-0`}>
      {initials(name)}
    </div>
  )
}

// ── Conversation type badge ───────────────────────────────────────────────────
function TypeBadge({ type }) {
  const map = {
    direct: { label: 'Direct', cls: 'bg-blue-100 text-blue-700' },
    group: { label: 'Group', cls: 'bg-purple-100 text-purple-700' },
    broadcast: { label: 'Broadcast', cls: 'bg-amber-100 text-amber-700' },
  }
  const { label, cls } = map[type] ?? { label: type, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${cls}`}>{label}</span>
}

// ── Conversation list item ────────────────────────────────────────────────────
function ConversationItem({ conv, active, onClick }) {
  const isUnread = conv.is_unread
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        active ? 'bg-red-50 border-l-2 border-l-brand-red' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="relative mt-0.5">
          <Avatar name={conv.sender_name ?? conv.created_by_name ?? ''} size="sm" />
          {isUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-red border border-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={`text-xs truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
              {conv.sender_name ?? conv.created_by_name ?? 'Unknown'}
            </span>
            <span className="text-[10px] text-gray-400 shrink-0">{formatTime(conv.last_message_at ?? conv.created_at)}</span>
          </div>
          <p className={`text-xs truncate mt-0.5 ${isUnread ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>
            {conv.subject}
          </p>
          <p className="text-[11px] text-gray-400 truncate mt-0.5">{conv.body_snippet ?? conv.last_message_snippet ?? ''}</p>
        </div>
      </div>
    </button>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ folder }) {
  const msgMap = {
    inbox: { icon: InboxIcon, text: 'Your inbox is empty' },
    announcements: { icon: MegaphoneIcon, text: 'No announcements' },
    sent: { icon: PaperAirplaneIcon, text: 'No sent messages' },
    archived: { icon: ArchiveBoxIcon, text: 'Nothing archived' },
  }
  const { icon: Icon, text } = msgMap[folder] ?? msgMap.inbox
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
      <Icon className="h-12 w-12" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

// ── No thread selected ────────────────────────────────────────────────────────
function NoThreadSelected() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
      <InboxIcon className="h-14 w-14" />
      <p className="text-base">Select a message to read</p>
    </div>
  )
}

// ── Compose modal / panel ─────────────────────────────────────────────────────
function ComposePanel({ onClose, user }) {
  const qc = useQueryClient()
  const canBroadcast = BROADCAST_ROLES.has(user?.role)
  const isSiteManager = user?.role === 'site_manager'

  const [type, setType] = useState('direct')
  const [recipients, setRecipients] = useState([])
  const [recipientSearch, setRecipientSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState([])
  const [broadcastScope, setBroadcastScope] = useState('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const fileRef = useRef()

  const { data: activeUsers = [] } = useQuery({
    queryKey: ['active-users'],
    queryFn: fetchActiveUsers,
    staleTime: 60_000,
  })

  const filteredUsers = activeUsers.filter(u => u.id !== user?.id)

  const addRecipient = (u) => {
    setRecipients(prev => [...prev, u])
  }

  const removeRecipient = (id) => setRecipients(prev => prev.filter(r => r.id !== id))

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...picked])
    e.target.value = ''
  }

  const sendMut = useMutation({
    mutationFn: (fd) => sendConversation(fd),
    onSuccess: () => {
      toast.success('Message sent')
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
      onClose()
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to send message')
    },
  })

  const handleSend = () => {
    if (!subject.trim()) { toast.error('Subject is required'); return }
    if (!body.trim()) { toast.error('Body is required'); return }
    if (type !== 'broadcast' && recipients.length === 0) { toast.error('Select at least one recipient'); return }

    const fd = new FormData()
    fd.append('conversation_type', type)
    fd.append('subject', subject.trim())
    fd.append('body', body.trim())
    if (type === 'broadcast') {
      fd.append('broadcast_scope', isSiteManager ? broadcastScope : 'all')
    } else {
      recipients.forEach(r => fd.append('recipient_ids', r.id))
    }
    files.forEach(f => fd.append('attachments', f))
    sendMut.mutate(fd)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
        <h2 className="text-base font-semibold text-gray-800">New Message</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <div className="flex gap-2 flex-wrap">
            {['direct', 'group', ...(canBroadcast ? ['broadcast'] : [])].map(t => (
              <button
                key={t}
                onClick={() => { setType(t); setRecipients([]); setRecipientSearch(''); setDropdownOpen(false) }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  type === t
                    ? 'bg-brand-red text-white border-brand-red'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400'
                }`}
              >
                {t === 'direct' ? 'Direct Message' : t === 'group' ? 'Group Message' : 'Broadcast'}
              </button>
            ))}
          </div>
        </div>

        {/* Broadcast scope (site_manager only) */}
        {type === 'broadcast' && isSiteManager && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Broadcast Scope</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="broadcastScope"
                  value="operations"
                  checked={broadcastScope === 'operations'}
                  onChange={() => setBroadcastScope('operations')}
                  className="accent-brand-red"
                />
                Operations Department Only
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="broadcastScope"
                  value="all"
                  checked={broadcastScope === 'all'}
                  onChange={() => setBroadcastScope('all')}
                  className="accent-brand-red"
                />
                All Users
              </label>
            </div>
          </div>
        )}

        {/* Broadcast scope (non site_manager broadcast) */}
        {type === 'broadcast' && !isSiteManager && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            This broadcast will be sent to <strong>All Users</strong>.
          </div>
        )}

        {/* Recipients */}
        {type !== 'broadcast' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {type === 'direct' ? 'Recipient' : 'Recipients'}
            </label>

            {/* Direct: single-select native dropdown */}
            {type === 'direct' && (
              <div className="relative">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Search users..."
                  value={recipientSearch}
                  onChange={e => { setRecipientSearch(e.target.value); setDropdownOpen(true) }}
                  onFocus={() => setDropdownOpen(true)}
                />
                {/* Selected chip */}
                {recipients.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <Avatar name={recipients[0].full_name ?? recipients[0].username} size="sm" />
                    <span className="flex-1 text-sm text-red-700 font-medium">{recipients[0].full_name ?? recipients[0].username}</span>
                    <button onClick={() => { setRecipients([]); setRecipientSearch('') }} className="text-red-400 hover:text-red-700">
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {dropdownOpen && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {filteredUsers.filter(u => !recipients.find(r => r.id === u.id)).filter(u =>
                      (u.full_name ?? u.username ?? '').toLowerCase().includes(recipientSearch.toLowerCase())
                    ).map(u => (
                      <button
                        key={u.id}
                        onMouseDown={e => { e.preventDefault(); setRecipients([u]); setRecipientSearch(''); setDropdownOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Avatar name={u.full_name ?? u.username} size="sm" />
                        <div>
                          <div className="font-medium text-gray-800">{u.full_name ?? u.username}</div>
                          {u.role_display && <div className="text-xs text-gray-400">{u.role_display}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Group: multi-select with search + checkboxes */}
            {type === 'group' && (
              <div>
                {/* Selected chips */}
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {recipients.map(r => (
                      <span key={r.id} className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-xs rounded-full px-2 py-0.5">
                        {r.full_name ?? r.username}
                        <button onClick={() => removeRecipient(r.id)} className="hover:text-red-900">
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  {/* Search within list */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <input
                      type="text"
                      className="w-full text-sm outline-none placeholder-gray-400"
                      placeholder="Search users..."
                      value={recipientSearch}
                      onChange={e => setRecipientSearch(e.target.value)}
                    />
                  </div>
                  {/* Scrollable user list with checkboxes */}
                  <div className="max-h-48 overflow-y-auto">
                    {activeUsers.filter(u =>
                      u.id !== user?.id &&
                      (u.full_name ?? u.username ?? '').toLowerCase().includes(recipientSearch.toLowerCase())
                    ).map(u => {
                      const checked = !!recipients.find(r => r.id === u.id)
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => checked ? removeRecipient(u.id) : addRecipient(u)}
                            className="accent-brand-red h-4 w-4 rounded"
                          />
                          <Avatar name={u.full_name ?? u.username} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{u.full_name ?? u.username}</div>
                            {u.role_display && <div className="text-xs text-gray-400">{u.role_display}</div>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
          <input
            type="text"
            className={inputCls}
            placeholder="Subject..."
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={6}
            placeholder="Write your message..."
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </div>

        {/* Attachments */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-600">Attachments</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 text-xs text-brand-red hover:underline"
            >
              <PaperClipIcon className="h-3.5 w-3.5" />
              Attach files
            </button>
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} />
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
                  <span className="truncate text-gray-700">{f.name}</span>
                  <button
                    onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                    className="ml-2 text-gray-400 hover:text-red-600"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          disabled={sendMut.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-red rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
          {sendMut.isPending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ── Thread view ───────────────────────────────────────────────────────────────
function ThreadView({ conversationId, folder, onBack }) {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [replyBody, setReplyBody] = useState('')
  const [replyFiles, setReplyFiles] = useState([])
  const fileRef = useRef()
  const threadRef = useRef()

  const { data: thread, isLoading } = useQuery({
    queryKey: ['conversation-detail', conversationId],
    queryFn: () => fetchConversationDetail(conversationId),
    enabled: !!conversationId,
  })

  const replyMut = useMutation({
    mutationFn: (fd) => sendReply(conversationId, fd),
    onSuccess: () => {
      toast.success('Reply sent')
      setReplyBody('')
      setReplyFiles([])
      qc.invalidateQueries({ queryKey: ['conversation-detail', conversationId] })
      qc.invalidateQueries({ queryKey: ['conversations', folder] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
    onError: (err) => toast.error(err?.response?.data?.detail ?? 'Failed to send reply'),
  })

  const archiveMut = useMutation({
    mutationFn: () => archiveConversation(conversationId),
    onSuccess: () => {
      toast.success('Archived')
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
    onError: () => toast.error('Failed to archive'),
  })

  const handleReplyFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    setReplyFiles(prev => [...prev, ...picked])
    e.target.value = ''
  }

  const handleReply = () => {
    if (!replyBody.trim()) { toast.error('Reply cannot be empty'); return }
    const fd = new FormData()
    fd.append('body', replyBody.trim())
    replyFiles.forEach(f => fd.append('attachments', f))
    replyMut.mutate(fd)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-red border-t-transparent" />
      </div>
    )
  }

  if (!thread) return null

  const messages = thread.messages ?? []
  const isReplyDisabled = thread.is_reply_disabled ?? false
  const lastMsg = messages[messages.length - 1]
  const seenBy = lastMsg?.read_by ?? lastMsg?.seen_by ?? []

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-start justify-between px-5 py-3 border-b border-gray-200 shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile back button */}
          <button onClick={onBack} className="lg:hidden p-1 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-gray-900 truncate">{thread.subject}</h2>
              <TypeBadge type={thread.conversation_type ?? thread.type} />
              {thread.is_reply_disabled && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Replies disabled</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {(thread.participants ?? []).map(p => p.full_name ?? p.name ?? p.username).join(', ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            Print
          </button>
          {folder !== 'archived' && (
            <button
              onClick={() => archiveMut.mutate()}
              disabled={archiveMut.isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ArchiveBoxArrowDownIcon className="h-3.5 w-3.5" />
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5 print:overflow-visible thread-print-area">
        {messages.map((msg, idx) => {
          const isOwn = msg.sender === user?.id || msg.sender_id === user?.id
          const isLast = idx === messages.length - 1
          return (
            <div key={msg.id ?? idx} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <Avatar name={msg.sender_name ?? ''} size="md" />
              <div className={`flex-1 max-w-prose ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-800">{msg.sender_name ?? 'Unknown'}</span>
                  <span className="text-[10px] text-gray-400">{formatDatetime(msg.sent_at ?? msg.created_at)}</span>
                </div>
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isOwn
                    ? 'bg-brand-red text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                </div>
                {/* Attachments */}
                {(msg.attachments ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {msg.attachments.map((att, ai) => (
                      <a
                        key={ai}
                        href={att.url ?? att.file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 border border-blue-100 rounded-lg px-2 py-1"
                      >
                        <PaperClipIcon className="h-3 w-3" />
                        {att.filename ?? att.name ?? `File ${ai + 1}`}
                      </a>
                    ))}
                  </div>
                )}
                {/* Read receipts on last message */}
                {isLast && seenBy.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Seen by {seenBy.map(s => s.full_name ?? s.name ?? s).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Reply box */}
      {!isReplyDisabled && (
        <div className="px-5 py-3 border-t border-gray-200 shrink-0 space-y-2">
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder="Write a reply…"
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
          />
          {replyFiles.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {replyFiles.map((f, i) => (
                <li key={i} className="flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <button onClick={() => setReplyFiles(p => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-red"
            >
              <PaperClipIcon className="h-4 w-4" />
              Attach
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleReplyFiles} />
            <button
              onClick={handleReply}
              disabled={replyMut.isPending}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-brand-red rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {replyMut.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CommunicationsPage() {
  const user = useAuthStore(s => s.user)
  const { folder = 'inbox' } = useParams()
  const [selectedId, setSelectedId] = useState(null)
  const [composing, setComposing] = useState(false)
  // Mobile: show list or thread
  const [mobileView, setMobileView] = useState('list') // 'list' | 'thread' | 'compose'

  // Reset selection when folder changes
  useEffect(() => {
    setSelectedId(null)
    setComposing(false)
    setMobileView('list')
  }, [folder])

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', folder],
    queryFn: () => fetchConversations(folder),
    refetchInterval: 30_000,
  })

  const handleSelectConversation = (id) => {
    setSelectedId(id)
    setComposing(false)
    setMobileView('thread')
  }

  const handleCompose = () => {
    setComposing(true)
    setSelectedId(null)
    setMobileView('compose')
  }

  const handleBack = () => {
    setMobileView('list')
    setComposing(false)
    setSelectedId(null)
  }

  // Right panel content
  let rightContent
  if (composing) {
    rightContent = <ComposePanel onClose={() => { setComposing(false); setMobileView('list') }} user={user} />
  } else if (selectedId) {
    rightContent = <ThreadView conversationId={selectedId} folder={folder} onBack={handleBack} />
  } else {
    rightContent = <NoThreadSelected />
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .thread-print-area { display: block !important; overflow: visible !important; }
          .comms-shell { display: block !important; }
          .comms-shell > * { display: none !important; }
          .comms-right-panel { display: block !important; }
          .comms-right-panel > *:not(.thread-print-area-wrapper) { display: none !important; }
        }
      `}</style>

      <div className="comms-shell flex h-[calc(100vh-10rem)] min-h-0 -mx-4 lg:-mx-6 -mt-4 lg:-mt-6 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">

        {/* ── Left panel: compose + conversation list ── */}
        <div className={`
          w-full lg:w-80 lg:flex flex-col border-r border-gray-200 shrink-0 bg-white
          ${mobileView === 'list' ? 'flex' : 'hidden lg:flex'}
        `}>
          {/* Compose button */}
          <div className="p-3 border-b border-gray-200 shrink-0">
            <button
              onClick={handleCompose}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-red text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              <PencilSquareIcon className="h-4 w-4" />
              New Message
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-red border-t-transparent" />
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState folder={folder} />
            ) : (
              conversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  active={selectedId === conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className={`
          comms-right-panel flex-1 min-w-0 flex flex-col bg-white
          ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'}
        `}>
          {rightContent}
        </div>
      </div>
    </>
  )
}
