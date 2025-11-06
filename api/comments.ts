// api/comments/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from './_supabaseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = supabaseFromEnv()

  if (req.method === 'GET') {
    const postIdQuery = req.query.post_id
    const postId = Array.isArray(postIdQuery) ? postIdQuery[0] : postIdQuery
    if (!postId || typeof postId !== 'string')
      return res.status(400).json({ error: 'post_id query param required' })

    const { data, error } = await supabase
      .from('comments_with_rel')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const body = req.body ?? {}
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const postId =
      (typeof body.postId === 'string' && body.postId.trim()) ||
      (typeof body.post_id === 'string' && body.post_id.trim()) ||
      ''
    if (!postId) return res.status(400).json({ error: 'postId required' })
    if (!text) return res.status(400).json({ error: 'text required' })

    let userId =
      (typeof body.userId === 'string' && body.userId.trim()) ||
      (typeof body.user_id === 'string' && body.user_id.trim()) ||
      ''

    if (!userId && typeof body.username === 'string' && body.username.trim()) {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id')
        .eq('username', body.username.trim())
        .single()
      if (userErr || !user) return res.status(404).json({ error: 'user not found' })
      userId = user.id
    }

    if (!userId) return res.status(400).json({ error: 'userId or username required' })

    const rawRepliedTo = body.replied_to ?? body.repliedTo
    const normalizedRepliedTo =
      typeof rawRepliedTo === 'string' && rawRepliedTo.trim().length > 0
        ? rawRepliedTo
        : null

    let conversation_id = postId
    if (normalizedRepliedTo) {
      const { data: parent } = await supabase
        .from('comments')
        .select('conversation_id')
        .eq('id', normalizedRepliedTo)
        .single()
      if (parent?.conversation_id) conversation_id = parent.conversation_id
    }

    const { data, error } = await supabase
      .from('comments')
      .insert([{ post_id: postId, user_id: userId, text, replied_to: normalizedRepliedTo, conversation_id }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ comment: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
