import React, { useEffect, useMemo, useState } from 'react'
import type { MockDmContact } from '../../shared/mockDmContacts'

type User = { id: string; username: string }

type ParticipantProfile = MockDmContact

type Conversation = {
  id: string
  type: 'dm_conversation'
  participants: string[]
  participant_profiles?: ParticipantProfile[]
  last_message: {
    id: string
    text: string
    sender_id: string
    media_id: string | null
    created_at: string
  } | null
  updated_at?: string
}

type DmMessage = {
  id: string
  text: string
  sender_id: string
  sender?: ParticipantProfile | null
  created_at: string
  media?: { media_id: string; media_url: string }
}

const DM_API_BASE = import.meta.env.DEV ? 'https://api.twitter.com/2' : '/api/2'
const DM_CACHE_PREFIX = 'dm:conversations:'

type DirectMessagesProps = {
  currentUser: User | null
}

export function DirectMessages({ currentUser }: DirectMessagesProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [showThreadModal, setShowThreadModal] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [directory, setDirectory] = useState<ParticipantProfile[]>([])
  const [newTarget, setNewTarget] = useState('')
  const [newTargetInput, setNewTargetInput] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser) {
      setError(null)
      setConversations([])
      setSelectedConversationId(null)
      setMessages([])
      setDirectory([])
      setShowThreadModal(false)
      setLastSyncedAt(null)
      return
    }
    loadDirectory(currentUser.id)
    const restored = restoreFromCache(currentUser)
    if (!restored) {
      loadConversations(currentUser)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser || !selectedConversationId) return
    loadMessages(selectedConversationId)
  }, [selectedConversationId, currentUser])

  useEffect(() => {
    if (!newTarget) return
    const exists = directory.some((contact) => contact.id === newTarget)
    if (!exists) {
      setNewTarget('')
      setNewTargetInput('')
    }
  }, [directory, newTarget])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 840px)')
    const handleChange = () => setIsCompact(media.matches)
    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!isCompact) {
      setShowThreadModal(false)
    }
  }, [isCompact])

  useEffect(() => {
    if (typeof window === 'undefined') return
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowThreadModal(false)
      }
    }
    if (showThreadModal) {
      window.addEventListener('keydown', handleEsc)
    }
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showThreadModal])

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  )

  const recipients = useMemo(() => {
    if (!currentUser || !activeConversation?.participant_profiles) return []
    return activeConversation.participant_profiles.filter((profile) => profile.id !== currentUser.id)
  }, [activeConversation, currentUser])

  async function loadDirectory(userId: string) {
    setError(null)
    try {
      const r = await fetch(`/api/mock/dm_directory?exclude_id=${encodeURIComponent(userId)}`)
      const data = await r.json()
      setDirectory(data.data || [])
    } catch (err: any) {
      setError(err?.message || 'Unable to load contacts')
    }
  }

  async function loadConversations(user: User, preferredId?: string | null) {
    setLoadingList(true)
    setError(null)
    try {
      const params = new URLSearchParams({ user_id: user.id, username: user.username })
      const r = await fetch(`${DM_API_BASE}/dm_conversations?${params.toString()}`)
      const json = await r.json()
      const list: Conversation[] = json.data || []
      setConversations(list)
      const syncedAt = new Date().toISOString()
      setLastSyncedAt(syncedAt)
      cacheConversations(user.id, list, syncedAt)
      if (list.length === 0) {
        setSelectedConversationId(null)
        setMessages([])
        return null
      } else {
        let nextSelection: string | null = null
        setSelectedConversationId((current) => {
          if (preferredId && list.some((c) => c.id === preferredId)) {
            nextSelection = preferredId
            return preferredId
          }
          if (current && list.some((c) => c.id === current)) {
            nextSelection = current
            return current
          }
          nextSelection = list[0].id
          return list[0].id
        })
        return nextSelection
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load conversations')
    } finally {
      setLoadingList(false)
    }
    return null
  }

  async function loadMessages(conversationId: string) {
    setLoadingThread(true)
    setError(null)
    try {
      const r = await fetch(`${DM_API_BASE}/dm_conversations/${conversationId}/messages`)
      const json = await r.json()
      setMessages(json.data || [])
    } catch (err: any) {
      setError(err?.message || 'Unable to load messages')
    } finally {
      setLoadingThread(false)
    }
  }

  async function handleSend() {
    if (!currentUser || !selectedConversationId) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setError(null)
    try {
      await fetch(`${DM_API_BASE}/dm_conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: currentUser.id,
          message: { text }
        })
      })
      setDraft('')
      await loadMessages(selectedConversationId)
      await loadConversations(currentUser, selectedConversationId)
    } catch (err: any) {
      setError(err?.message || 'Unable to send message')
    } finally {
      setSending(false)
    }
  }

  async function handleCreateConversation() {
    if (!currentUser) return
    let target = newTarget
    if (!target && newTargetInput.trim()) {
      const match = resolveTargetFromInput(newTargetInput)
      if (match) {
        target = match.id
        setNewTarget(match.id)
      }
    }
    const text = newMessage.trim()
    if (!target || !text) return
    setCreating(true)
    setError(null)
    try {
      const r = await fetch(`${DM_API_BASE}/dm_conversations/${target}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: currentUser.id,
          message: { text }
        })
      })
      const data = await r.json()
      const conversationId = data?.data?.conversation_id
      setNewMessage('')
      setNewTarget('')
      const nextSelection = await loadConversations(currentUser, conversationId ?? null)
      const resolvedConversation = conversationId ?? nextSelection
      if (resolvedConversation) {
        if (isCompact) setShowThreadModal(true)
        await loadMessages(resolvedConversation)
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to start conversation')
    } finally {
      setCreating(false)
    }
  }

  async function handleRefresh() {
    if (!currentUser) return
    const nextId = await loadConversations(currentUser, selectedConversationId)
    const resolvedId = nextId ?? selectedConversationId
    if (resolvedId) await loadMessages(resolvedId)
  }

  function handleOpenThread(conversationId: string) {
    setSelectedConversationId(conversationId)
    if (isCompact) {
      setShowThreadModal(true)
    }
  }

  function handleCloseThread() {
    setShowThreadModal(false)
  }
  async function handleModalRefresh(e: React.MouseEvent) {
    e.stopPropagation()
    if (!selectedConversationId) return
    await handleRefresh()
  }

  if (!currentUser) {
    return (
      <div>
        <h3>Direct Messages</h3>
        <p className="text-muted">Login to send DMs with the mock Twitter API.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="dm-header">
        <div>
          <h3>Direct Messages</h3>
          <p className="text-muted">Mocking Twitter/X DM v2 endpoints</p>
          {lastSyncedAt && (
            <p className="text-muted small">Last synced {new Date(lastSyncedAt).toLocaleString()}</p>
          )}
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={handleRefresh}
          disabled={loadingList}
        >
          Refresh
        </button>
      </div>
      {error && <div className="dm-error">{error}</div>}
      <div className="dm-panel">
        <div className="dm-sidebar">
          <div className="dm-new">
            <label htmlFor="dm-target">Start new DM</label>
            <input
              id="dm-target"
              className="input"
              list="dm-recipients"
              placeholder="Type username (e.g. @mock-user)"
              value={newTargetInput}
              onChange={(e) => {
                const value = e.target.value
                setNewTargetInput(value)
                const match = resolveTargetFromInput(value)
                setNewTarget(match?.id ?? '')
              }}
              onBlur={() => {
                const match = resolveTargetFromInput(newTargetInput)
                if (match) {
                  setNewTarget(match.id)
                  setNewTargetInput(`@${match.username}`)
                }
              }}
            />
            <datalist id="dm-recipients">
              {directory.map((contact) => (
                <option key={contact.id} value={`@${contact.username}`}>
                  {contact.display_name}
                </option>
              ))}
            </datalist>
            <textarea
              rows={2}
              placeholder="Say hello..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              onClick={handleCreateConversation}
              disabled={creating || !newMessage.trim() || !newTarget}
            >
              {creating ? 'Sending...' : 'Send DM'}
            </button>
          </div>
          <div className="dm-list">
            {loadingList && conversations.length === 0 ? (
              <p className="meta">Loading conversations...</p>
            ) : (
              conversations.map((conversation) => {
                const recipient = conversation.participant_profiles?.find((p) => p.id !== currentUser.id)
                return (
                  <button
                    type="button"
                    key={conversation.id}
                    className={`dm-convo ${conversation.id === selectedConversationId ? 'active' : ''}`}
                    onClick={() => handleOpenThread(conversation.id)}
                  >
                    <div className="dm-convo-top">
                      <div>
                        <strong>{recipient?.display_name || '@' + (recipient?.username || 'unknown')}</strong>
                        <span className="meta">@{recipient?.username}</span>
                      </div>
                      <span className="meta">
                        {conversation.last_message?.created_at
                          ? new Date(conversation.last_message.created_at).toLocaleTimeString()
                          : ''}
                      </span>
                    </div>
                    <div className="dm-convo-preview">{conversation.last_message?.text || 'No messages yet'}</div>
                  </button>
                )
              })
            )}
          </div>
        </div>
        {!isCompact && (
          <div className="dm-thread">
            {selectedConversationId && activeConversation ? (
              <>
                <div className="dm-thread-header">
                  <div>
                    <strong>{recipients[0]?.display_name || '@' + (recipients[0]?.username || 'dm')}</strong>
                    <div className="meta">@{recipients[0]?.username}</div>
                  </div>
                  <div className="dm-thread-actions">
                    <button type="button" className="btn-link small" onClick={handleRefresh}>
                      Refresh
                    </button>
                  </div>
                </div>
                <div className={`dm-messages ${loadingThread ? 'loading' : ''}`}>
                  {loadingThread ? (
                    <p className="meta">Loading messages...</p>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`dm-message ${message.sender_id === currentUser.id ? 'self' : ''}`}
                      >
                        <div className="dm-bubble">
                          <div>{message.text}</div>
                          <div className="dm-meta">{new Date(message.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="dm-composer">
                  <textarea
                    rows={2}
                    placeholder="Write a message"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button className="btn" type="button" onClick={handleSend} disabled={sending || !draft.trim()}>
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            ) : (
              <div className="dm-empty">
                Select a conversation to open its timeline.
              </div>
            )}
          </div>
        )}
      </div>
      {isCompact && showThreadModal && selectedConversationId && activeConversation && (
        <div className="dm-modal-overlay" onClick={handleCloseThread}>
          <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dm-modal-header">
              <div>
                <strong>{recipients[0]?.display_name || '@' + (recipients[0]?.username || 'dm')}</strong>
                <div className="meta">@{recipients[0]?.username}</div>
              </div>
              <div className="dm-thread-actions">
                <button type="button" className="btn-link small" onClick={handleModalRefresh}>
                  Refresh
                </button>
                <button type="button" className="btn-link" onClick={handleCloseThread}>
                  Close
                </button>
              </div>
            </div>
            <div className={`dm-messages ${loadingThread ? 'loading' : ''}`}>
              {loadingThread ? (
                <p className="meta">Loading messages...</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`dm-message ${message.sender_id === currentUser.id ? 'self' : ''}`}
                  >
                    <div className="dm-bubble">
                      <div>{message.text}</div>
                      <div className="dm-meta">{new Date(message.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="dm-composer">
              <textarea
                rows={2}
                placeholder="Write a message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button className="btn" type="button" onClick={handleSend} disabled={sending || !draft.trim()}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
  function resolveTargetFromInput(value: string) {
    const normalized = value.trim().replace(/^@/, '').toLowerCase()
    if (!normalized) return null
    return directory.find(
      (contact) =>
        contact.username.toLowerCase() === normalized ||
        contact.display_name.toLowerCase() === normalized
    ) ?? null
  }

  function restoreFromCache(user: User) {
    if (typeof window === 'undefined') return false
    const raw = window.localStorage.getItem(`${DM_CACHE_PREFIX}${user.id}`)
    if (!raw) return false
    try {
      const parsed = JSON.parse(raw) as { data?: Conversation[]; lastSyncedAt?: string }
      if (!parsed?.data || parsed.data.length === 0) return false
      setConversations(parsed.data)
      setLastSyncedAt(parsed.lastSyncedAt ?? null)
      setSelectedConversationId(parsed.data[0].id)
      return true
    } catch {
      return false
    }
  }

  function cacheConversations(userId: string, list: Conversation[], syncedAt: string) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      `${DM_CACHE_PREFIX}${userId}`,
      JSON.stringify({ data: list, lastSyncedAt: syncedAt })
    )
  }
