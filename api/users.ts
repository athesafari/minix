import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from './_supabaseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending:false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ users: data })
}
