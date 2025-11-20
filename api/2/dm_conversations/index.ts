import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listConversationsForUser } from '../../_services/dmStore.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const rawUserId = req.query.user_id ?? req.query.userId
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
  if (!userId) return res.status(400).json({ error: 'user_id query param required' })

  const rawUsername = req.query.username ?? req.query.user_name
  const username = Array.isArray(rawUsername) ? rawUsername[0] : rawUsername

  try {
    const conversations = await listConversationsForUser(userId, username)
    return res.status(200).json({ data: conversations })
  } catch (err: any) {
    console.error(err)
    const status = err?.message === 'USER_NOT_FOUND' ? 404 : 500
    const message = err?.message || 'Unable to load conversations'
    return res.status(status).json({ error: message })
  }
}
