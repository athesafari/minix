// api/2/users/[id]/tweets.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from '../../../../_supabaseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'User ID required' })

  try {
    const supabase = supabaseFromEnv()

    // 1️⃣ Get all posts from this user
    const { data: posts, error: postError } = await supabase
      .from('posts')
      .select('id, text, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })

    if (postError) throw postError

    // 2️⃣ Get all comments for these posts (bulk)
    const postIds = posts.map((p) => p.id)
    const { data: comments, error: commentError } = await supabase
      .from('comments')
      .select('id, post_id')
      .in('post_id', postIds)

    if (commentError) throw commentError

    // 3️⃣ Count replies per post
    const replyCounts: Record<string, number> = {}
    comments.forEach((c) => {
      replyCounts[c.post_id] = (replyCounts[c.post_id] || 0) + 1
    })

    // 4️⃣ Shape to Twitter-like response
    const response = {
      data: posts.map((p) => ({
        edit_history_tweet_ids: [p.id],
        id: p.id,
        text: p.text,
        created_at: p.created_at,
        conversation_id: p.id,
        public_metrics: {
          retweet_count: 0,
          reply_count: replyCounts[p.id] || 0, // ✅ reply count here
          like_count: 0,
          quote_count: 0,
          bookmark_count: 0,
          impression_count: 0,
        },
      })),
      meta: {
        result_count: posts.length,
        newest_id: posts[0]?.id ?? null,
        oldest_id: posts[posts.length - 1]?.id ?? null,
        next_token: null,
      },
    }

    res.status(200).json(response)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
