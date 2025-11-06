import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from './_supabaseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { postId, username, text } = req.body || {}
  if (!postId || !username || !text) return res.status(400).json({ error: 'postId, username, text required' })

  const sb = supabaseFromEnv()
  const { data: user, error: uerr } = await sb.from('users').select('id').eq('username', username).single()
  if (uerr || !user) return res.status(404).json({ error: 'user not found' })

  const { data, error } = await sb.from('comments').insert([{ post_id: postId, user_id: user.id, text }]).select().single()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ comment: data })
}
