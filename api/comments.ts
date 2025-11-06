// api/comments/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from './_supabaseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { post_id } = req.query
  const supabase = supabaseFromEnv()

  const { data, error } = await supabase
    .from('comments_with_rel')
    .select('*')
    .eq('post_id', post_id)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}
