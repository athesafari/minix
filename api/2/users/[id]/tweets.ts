// api/2/users/[id]/tweets.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from '../../../_supabaseClient.js'  // ⚠️ Note the .js (for Node 22 ESM)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'User ID required' })

  try {
    const supabase = supabaseFromEnv()

    // Fetch posts from your miniX DB
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return res.status(500).json({ error: error.message })
    }

    // Transform DB data into Twitter API shape
    const response = {
      data: posts.map((p: any) => ({
        edit_history_tweet_ids: [p.id],
        id: p.id,
        text: p.text,
        created_at: p.created_at,
        conversation_id: p.id,
        public_metrics: {
          retweet_count: 0,
          reply_count: 0,
          like_count: p.likes ?? 0,
          quote_count: 0,
          bookmark_count: 0,
          impression_count: p.views ?? 0,
        },
      })),
      meta: {
        result_count: posts.length,
        newest_id: posts[0]?.id || null,
        oldest_id: posts[posts.length - 1]?.id || null,
        next_token: null,
      },
    }

    return res.status(200).json(response)
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
