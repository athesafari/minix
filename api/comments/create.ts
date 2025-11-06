// api/comments/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from '../_supabaseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { post_id, user_id, text, replied_to } = req.body
  if (!post_id || !user_id || !text) return res.status(400).json({ error: 'Missing required fields' })

  const supabase = supabaseFromEnv()

  // 1️⃣ Find conversation_id
  let conversation_id = post_id
  if (replied_to) {
    const { data: parent } = await supabase
      .from('comments')
      .select('conversation_id')
      .eq('id', replied_to)
      .single()
    if (parent?.conversation_id) conversation_id = parent.conversation_id
  }

  // 2️⃣ Insert
  const { data, error } = await supabase
    .from('comments')
    .insert([{ post_id, user_id, text, replied_to, conversation_id }])
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Reply created', comment: data })
}
