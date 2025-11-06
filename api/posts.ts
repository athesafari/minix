import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from './_supabaseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = supabaseFromEnv()

  if (req.method === 'GET') {
    const userId = req.query.userId as string | undefined
    let query = supabase
      .from('posts')
      .select(
        'id, text, created_at, user_id, users(username), comments(id, text, created_at, replied_to, users(username))'
      )
      .order('created_at', { ascending: false })
    if (userId) {
      query = query.eq('user_id', userId)
    }
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    const posts = (data || []).map((p:any) => ({
      id: p.id, text: p.text, created_at: p.created_at,
      username: p.users?.username || 'unknown',
      comments: (p.comments || []).map((c:any)=>({
        id:c.id,
        text:c.text,
        created_at:c.created_at,
        replied_to:c.replied_to ?? null,
        username:c.users?.username || 'unknown'
      }))
    }))
    return res.json({ posts })
  }

  if (req.method === 'POST') {
    const { username, text } = req.body || {}
    if (!username || !text) return res.status(400).json({ error: 'username and text required' })

    const sb = supabase
    const { data: user, error: uerr } = await sb.from('users').select('id').eq('username', username).single()
    if (uerr || !user) return res.status(404).json({ error: 'user not found' })

    const { data, error } = await sb.from('posts').insert([{ user_id: user.id, text }]).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ post: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
