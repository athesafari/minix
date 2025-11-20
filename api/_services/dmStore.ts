import { randomUUID } from 'node:crypto'
import { supabaseFromEnv } from '../_supabaseClient.js'
import { MOCK_DM_CONTACTS } from '../../shared/mockDmContacts.js'

type SupabaseClientInstance = ReturnType<typeof supabaseFromEnv>

type SendPayload = { text?: string; media_id?: string | null }

type ConversationRow = {
  id: string
  created_at: string
  last_activity_at: string | null
  last_message_id: string | null
}

type ParticipantProfile = (typeof MOCK_DM_CONTACTS)[number]

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  media_id: string | null
  created_at: string
}

const CONTACT_LOOKUP = new Map(MOCK_DM_CONTACTS.map((contact) => [contact.username, contact]))

const DEFAULT_TITLE = 'Beta Tester'
const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/notionists/svg?seed='
const BOT_USERNAME = 'dm-bot'

function buildProfile(user: { id: string; username: string }): ParticipantProfile {
  const meta = CONTACT_LOOKUP.get(user.username)
  return {
    id: user.id,
    username: user.username,
    display_name: meta?.display_name ?? user.username,
    title: meta?.title ?? DEFAULT_TITLE,
    avatar_url: meta?.avatar_url ?? `${DEFAULT_AVATAR}${encodeURIComponent(user.username)}`
  }
}

async function ensureDirectoryUsers(supabase: SupabaseClientInstance) {
  if (MOCK_DM_CONTACTS.length === 0) return
  const usernames = MOCK_DM_CONTACTS.map((contact) => contact.username)
  const { data: existing, error } = await supabase
    .from('users')
    .select('username')
    .in('username', usernames)
  if (error) throw error
  const existingSet = new Set(existing?.map((row) => row.username))
  const missing = MOCK_DM_CONTACTS.filter((contact) => !existingSet.has(contact.username))
  if (missing.length === 0) return
  const payload = missing.map((contact) => ({ id: contact.id, username: contact.username }))
  const { error: insertError } = await supabase.from('users').insert(payload)
  if (insertError && insertError.code !== '23505') throw insertError
}

async function ensureUserExists(supabase: SupabaseClientInstance, userId: string, username?: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (data) return data
  if (!username) throw new Error('USER_NOT_FOUND')
  const { data: inserted, error: createError } = await supabase
    .from('users')
    .insert([{ id: userId, username }])
    .select('id, username')
    .single()
  if (createError) throw createError
  return inserted
}

async function ensureWelcomeThread(supabase: SupabaseClientInstance, userId: string) {
  const { data: existing, error } = await supabase
    .from('dm_participants')
    .select('conversation_id')
    .eq('user_id', userId)
    .limit(1)
  if (error) throw error
  if (existing && existing.length > 0) return

  const botContact = CONTACT_LOOKUP.get(BOT_USERNAME)
  if (!botContact) return

  const createdAt = new Date().toISOString()
  const { data: conversation, error: conversationErr } = await supabase
    .from('dm_conversations')
    .insert([{ id: randomUUID(), last_activity_at: createdAt }])
    .select('id')
    .single()
  if (conversationErr) throw conversationErr

  const { error: participantErr } = await supabase.from('dm_participants').insert([
    { conversation_id: conversation.id, user_id: userId },
    { conversation_id: conversation.id, user_id: botContact.id }
  ])
  if (participantErr) throw participantErr

  const { data: welcomeMessage, error: messageErr } = await supabase
    .from('dm_messages')
    .insert([
      {
        id: randomUUID(),
        conversation_id: conversation.id,
        sender_id: botContact.id,
        text: 'Hi! I am a mock DM bot. Send me anything to see the persisted response.',
        media_id: null
      }
    ])
    .select()
    .single()
  if (messageErr) throw messageErr

  await supabase
    .from('dm_conversations')
    .update({ last_message_id: welcomeMessage.id, last_activity_at: welcomeMessage.created_at })
    .eq('id', conversation.id)
}

function shapeMessage(row: MessageRow, profiles: Map<string, ParticipantProfile>, mediaMap: Map<string, { id: string; media_url: string }>) {
  return {
    id: row.id,
    text: row.text,
    sender_id: row.sender_id,
    sender: profiles.get(row.sender_id) ?? null,
    created_at: row.created_at,
    media: row.media_id ? mediaMap.get(row.media_id) || undefined : undefined
  }
}

async function fetchProfiles(supabase: SupabaseClientInstance, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ParticipantProfile>()
  const uniqueIds = Array.from(new Set(userIds))
  const { data, error } = await supabase
    .from('users')
    .select('id, username')
    .in('id', uniqueIds)
  if (error) throw error
  const map = new Map<string, ParticipantProfile>()
  for (const row of data || []) {
    map.set(row.id, buildProfile(row))
  }
  return map
}

async function fetchMediaMap(supabase: SupabaseClientInstance, mediaIds: string[]) {
  if (mediaIds.length === 0) return new Map<string, { id: string; media_url: string }>()
  const unique = Array.from(new Set(mediaIds))
  const { data, error } = await supabase
    .from('dm_media')
    .select('id, media_url')
    .in('id', unique)
  if (error) throw error
  const map = new Map<string, { id: string; media_url: string }>()
  for (const row of data || []) {
    map.set(row.id, { id: row.id, media_url: row.media_url })
  }
  return map
}

export async function listConversationsForUser(userId: string, username?: string) {
  const supabase = supabaseFromEnv()
  await ensureDirectoryUsers(supabase)
  await ensureUserExists(supabase, userId, username)
  await ensureWelcomeThread(supabase, userId)

  const { data: participantRows, error } = await supabase
    .from('dm_participants')
    .select('conversation_id')
    .eq('user_id', userId)
  if (error) throw error
  if (!participantRows || participantRows.length === 0) return []

  const conversationIds = participantRows.map((row) => row.conversation_id)
  const { data: conversations, error: conversationErr } = await supabase
    .from('dm_conversations')
    .select('id, created_at, last_activity_at, last_message_id')
    .in('id', conversationIds)
    .order('last_activity_at', { ascending: false })
  if (conversationErr) throw conversationErr

  const { data: participants, error: participantsErr } = await supabase
    .from('dm_participants')
    .select('conversation_id, user_id, users(id, username)')
    .in('conversation_id', conversationIds)
  if (participantsErr) throw participantsErr

  const lastMessageConversations = conversations?.map((c) => c.id) || []
  const { data: lastMessagesRows, error: lastMessagesErr } = await supabase
    .from('dm_messages')
    .select('id, conversation_id, sender_id, text, media_id, created_at')
    .in('conversation_id', lastMessageConversations)
    .order('created_at', { ascending: false })
  if (lastMessagesErr) throw lastMessagesErr

  const lastMessageMap = new Map<string, MessageRow>()
  for (const row of lastMessagesRows || []) {
    if (!lastMessageMap.has(row.conversation_id)) {
      lastMessageMap.set(row.conversation_id, row)
    }
  }

  const profilesByConversation = new Map<string, ParticipantProfile[]>()
  const participantIdMap = new Map<string, string[]>()
  for (const row of participants || []) {
    const user = row.users as { id: string; username: string } | null
    if (!user) continue
    const existing = profilesByConversation.get(row.conversation_id) || []
    existing.push(buildProfile(user))
    profilesByConversation.set(row.conversation_id, existing)
    const ids = participantIdMap.get(row.conversation_id) || []
    ids.push(row.user_id)
    participantIdMap.set(row.conversation_id, ids)
  }

  return (conversations || []).map((conv) => {
    const lastMessage = lastMessageMap.get(conv.id)
    return {
      id: conv.id,
      type: 'dm_conversation' as const,
      participants: participantIdMap.get(conv.id) || [],
      participant_profiles: profilesByConversation.get(conv.id) || [],
      last_message: lastMessage
        ? {
            id: lastMessage.id,
            text: lastMessage.text,
            sender_id: lastMessage.sender_id,
            media_id: lastMessage.media_id,
            created_at: lastMessage.created_at
          }
        : null,
      updated_at: conv.last_activity_at ?? conv.created_at
    }
  })
}

export async function getConversation(conversationId: string) {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase
    .from('dm_conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listMessages(conversationId: string) {
  const supabase = supabaseFromEnv()
  const { data: conversation, error: conversationErr } = await supabase
    .from('dm_conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle()
  if (conversationErr) throw conversationErr
  if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')

  const { data: messages, error } = await supabase
    .from('dm_messages')
    .select('id, conversation_id, sender_id, text, media_id, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const senderIds = (messages || []).map((row) => row.sender_id)
  const mediaIds = (messages || [])
    .map((row) => row.media_id)
    .filter((value): value is string => Boolean(value))
  const [profiles, mediaMap] = await Promise.all([
    fetchProfiles(supabase, senderIds),
    fetchMediaMap(supabase, mediaIds)
  ])

  return (messages || []).map((row) => shapeMessage(row, profiles, mediaMap))
}

async function insertMessage(
  supabase: SupabaseClientInstance,
  conversationId: string,
  senderId: string,
  payload: SendPayload
) {
  const textPayload = (payload.text ?? '').trim()
  const messageBody = textPayload.length > 0 ? textPayload : ''
  const insertPayload = {
    id: randomUUID(),
    conversation_id: conversationId,
    sender_id: senderId,
    text: messageBody,
    media_id: payload.media_id ?? null
  }
  const { data: message, error } = await supabase
    .from('dm_messages')
    .insert([insertPayload])
    .select()
    .single()
  if (error) throw error
  await supabase
    .from('dm_conversations')
    .update({ last_message_id: message.id, last_activity_at: message.created_at })
    .eq('id', conversationId)
  return message
}

async function assertSenderInConversation(
  supabase: SupabaseClientInstance,
  conversationId: string,
  senderId: string
) {
  const { data, error } = await supabase
    .from('dm_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', senderId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('SENDER_NOT_IN_CONVERSATION')
}

export async function sendMessageToConversation(conversationId: string, senderId: string, payload: SendPayload) {
  const supabase = supabaseFromEnv()
  const { data: conversation, error } = await supabase
    .from('dm_conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle()
  if (error) throw error
  if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')

  await assertSenderInConversation(supabase, conversationId, senderId)
  const message = await insertMessage(supabase, conversationId, senderId, payload)
  return { conversationId, message }
}

async function findExistingConversation(
  supabase: SupabaseClientInstance,
  senderId: string,
  participantId: string
) {
  const { data: senderConversations, error } = await supabase
    .from('dm_participants')
    .select('conversation_id')
    .eq('user_id', senderId)
  if (error) throw error
  if (!senderConversations || senderConversations.length === 0) return null
  const ids = senderConversations.map((row) => row.conversation_id)
  const { data: overlapping, error: overlapErr } = await supabase
    .from('dm_participants')
    .select('conversation_id')
    .eq('user_id', participantId)
    .in('conversation_id', ids)
    .limit(1)
  if (overlapErr) throw overlapErr
  return overlapping && overlapping.length > 0 ? overlapping[0].conversation_id : null
}

export async function sendMessageToParticipant(senderId: string, participantId: string, payload: SendPayload) {
  const supabase = supabaseFromEnv()
  await ensureDirectoryUsers(supabase)
  const { data: participant, error: participantErr } = await supabase
    .from('users')
    .select('id')
    .eq('id', participantId)
    .maybeSingle()
  if (participantErr) throw participantErr
  if (!participant) throw new Error('PARTICIPANT_NOT_FOUND')

  let conversationId = await findExistingConversation(supabase, senderId, participantId)
  if (!conversationId) {
    const createdAt = new Date().toISOString()
    const { data: conversation, error: createConversationError } = await supabase
      .from('dm_conversations')
      .insert([{ id: randomUUID(), last_activity_at: createdAt }])
      .select('id')
      .single()
    if (createConversationError) throw createConversationError
    conversationId = conversation.id
    const { error: addParticipantsErr } = await supabase.from('dm_participants').insert([
      { conversation_id: conversationId, user_id: senderId },
      { conversation_id: conversationId, user_id: participantId }
    ])
    if (addParticipantsErr) throw addParticipantsErr
  }

  const message = await insertMessage(supabase, conversationId, senderId, payload)
  return { conversationId, message }
}

export async function getUserDirectory(excludeId?: string) {
  const supabase = supabaseFromEnv()
  await ensureDirectoryUsers(supabase)
  const { data, error } = await supabase
    .from('users')
    .select('id, username')
    .order('created_at', { ascending: true })
  if (error) throw error

  const filtered = (data || []).filter((row) => (excludeId ? row.id !== excludeId : true))
  const contacts = filtered.map((row) => buildProfile(row))
  contacts.sort((a, b) => {
    const aIsMock = CONTACT_LOOKUP.has(a.username)
    const bIsMock = CONTACT_LOOKUP.has(b.username)
    if (aIsMock && !bIsMock) return -1
    if (!aIsMock && bIsMock) return 1
    return a.display_name.localeCompare(b.display_name)
  })
  return contacts
}

export async function createMediaEntry(filename?: string) {
  const supabase = supabaseFromEnv()
  const mediaId = randomUUID()
  const mediaUrl = `https://mock.api/media/${mediaId}${filename ? `/${encodeURIComponent(filename)}` : ''}`
  const { data, error } = await supabase
    .from('dm_media')
    .insert([{ id: mediaId, filename: filename ?? null, media_url: mediaUrl }])
    .select('id, media_url, created_at')
    .single()
  if (error) throw error
  return { media_id: data.id, media_url: data.media_url, uploaded_at: data.created_at }
}

export async function getMedia(mediaId: string) {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase
    .from('dm_media')
    .select('id, media_url')
    .eq('id', mediaId)
    .maybeSingle()
  if (error) throw error
  return data ? { media_id: data.id, media_url: data.media_url } : null
}
