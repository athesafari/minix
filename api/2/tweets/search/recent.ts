import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from '../../../_supabaseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const queryParam = req.query.query as string
  if (!queryParam?.startsWith('conversation_id:')) {
    return res.status(400).json({ error: 'query must be in format conversation_id:<id>' })
  }

  const conversationId = queryParam.split(':')[1]
  const supabase = supabaseFromEnv()

  try {
    // 1️⃣ fetch all replies under this conversation
    const { data: comments, error } = await supabase
      .from('comments_with_rel')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // 2️⃣ gather author IDs
    const authorIds = [...new Set(comments.map(c => c.user_id))]
    const { data: users } = await supabase
      .from('users')
      .select('id, username')
      .in('id', authorIds)

    // 3️⃣ transform into Twitter-like response
    const response = {
      data: comments.map((c: any) => ({
        id: c.id,
        text: c.text,
        author_id: c.user_id,
        conversation_id: c.conversation_id,
        created_at: c.created_at,
        edit_history_tweet_ids: [c.id],
        referenced_tweets: [
          { type: 'replied_to', id: c.replied_to ?? c.post_id }
        ],
        public_metrics: {
          retweet_count: 0,
          reply_count: 0,
          like_count: 0,
          quote_count: 0,
          bookmark_count: 0,
          impression_count: 0
        }
      })),
      includes: {
        users: users?.map(u => ({
          id: u.id,
          username: u.username,
          name: u.username,
          profile_image_url: `https://api.dicebear.com/8.x/identicon/svg?seed=${u.username}`
        })) ?? []
      },
      meta: {
        result_count: comments.length,
        newest_id: comments[0]?.id ?? null,
        oldest_id: comments[comments.length - 1]?.id ?? null
      }
    }

    return res.status(200).json(response)
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
