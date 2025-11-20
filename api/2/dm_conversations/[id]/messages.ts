import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getConversation,
  listMessages,
  sendMessageToConversation,
  sendMessageToParticipant,
  getMedia
} from '../../../_services/dmStore.js'

function extractBodyPayload(body: any) {
  if (!body) return { text: '', media_id: null }
  const nested = body.message ?? {}
  const text =
    typeof nested.text === 'string'
      ? nested.text
      : typeof body.text === 'string'
        ? body.text
        : ''
  const mediaId =
    (typeof nested.media_id === 'string' && nested.media_id) ||
    (typeof nested.media?.media_id === 'string' && nested.media.media_id) ||
    (typeof body.media_id === 'string' && body.media_id) ||
    null
  return { text, media_id: mediaId }
}

async function buildSendResponse(conversationId: string, message: { id: string; text: string; media_id: string | null; sender_id: string }) {
  const media = message.media_id ? await getMedia(message.media_id) : null
  return {
    data: {
      dm_event_id: message.id,
      conversation_id: conversationId,
      message: {
        id: message.id,
        text: message.text,
        media: media ?? undefined,
        sender_id: message.sender_id
      }
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawId = req.query.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (!id) return res.status(400).json({ error: 'Conversation or participant id is required' })

  if (req.method === 'GET') {
    try {
      const conversation = await getConversation(id)
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
      const data = await listMessages(id)
      return res.status(200).json({ data })
    } catch (err: any) {
      const status = err?.message === 'CONVERSATION_NOT_FOUND' ? 404 : 500
      return res.status(status).json({ error: err?.message || 'Unable to load messages' })
    }
  }

  if (req.method === 'POST') {
    const senderRaw = req.body?.sender_id ?? req.body?.senderId
    const senderId = typeof senderRaw === 'string' ? senderRaw : ''
    if (!senderId) return res.status(400).json({ error: 'sender_id is required' })

    const payload = extractBodyPayload(req.body)
    if (!payload.text.trim() && !payload.media_id) {
      return res.status(400).json({ error: 'text or media_id is required' })
    }

    try {
      const conversation = await getConversation(id)
      if (conversation) {
        const { conversationId, message } = await sendMessageToConversation(id, senderId, payload)
        const response = await buildSendResponse(conversationId, message)
        return res.status(201).json(response)
      }
    } catch (err: any) {
      if (err?.message === 'SENDER_NOT_IN_CONVERSATION') {
        return res.status(403).json({ error: 'Sender is not part of this conversation' })
      }
      if (err?.message !== 'CONVERSATION_NOT_FOUND') {
        console.error(err)
        return res.status(500).json({ error: err?.message || 'Unable to send message' })
      }
    }

    try {
      const { conversationId, message } = await sendMessageToParticipant(senderId, id, payload)
      const response = await buildSendResponse(conversationId, message)
      return res.status(201).json(response)
    } catch (err: any) {
      const status = err?.message === 'PARTICIPANT_NOT_FOUND' ? 404 : 500
      return res.status(status).json({ error: err?.message || 'Unable to start conversation' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
