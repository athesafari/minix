import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from './_supabaseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { username } = req.body || {}
  if (!username) return res.status(400).json({ error: 'username required' })

  const supabase = supabaseFromEnv()
  // ensure user existsdfdf
  const { data: existing, error: e1 } = await supabase.from('users').select('*').eq('username', username).limit(1)
  if (e1) return res.status(500).json({ error: e1.message })
  if (existing && existing.length > 0) return res.json({ user: existing[0] })

  const { data, error } = await supabase.from('users').insert([{ username }]).select().single()
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ user: data })
}
