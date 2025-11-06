import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from '../../../../_supabaseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const queryParam = req.query.query as string
  if (!queryParam?.startsWith('conversation_id:'))
    return res.status(400).json({ error: 'query must be in format conversation_id:<id>' })

  const conversation_id = queryParam.split(':')[1]
  const supabase = supabaseFromEnv()

  try {
    // 1️⃣ Fetch all comments in this conversation
    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, text, user_id, conversation_id, replied_to, post_id, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // 2️⃣ Get authors
    const authorIds = [...new Set(comments.map(c => c.user_id))]
    const { data: users } = await supabase
      .from('users')
      .select('id, username')
      .in('id', authorIds)

    // 3️⃣ Build tweet-like objects
    const tweetData = comments.map(c => ({
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
        reply_count: comments.filter(r => r.replied_to === c.id).length, // ✅ nested reply count
        like_count: 0,
        quote_count: 0,
        bookmark_count: 0,
        impression_count: 0
      },
      attachments: undefined
    }))

    // 4️⃣ Includes
    const includes = {
      users: users.map(u => ({
        id: u.id,
        name: u.username,
        username: u.username,
        profile_image_url: `https://api.dicebear.com/8.x/identicon/svg?seed=${u.username}`
      })),
      media: [] // (optional, if you want to add later)
    }

    // 5️⃣ Meta
    const meta = {
      newest_id: tweetData[0]?.id ?? null,
      oldest_id: tweetData[tweetData.length - 1]?.id ?? null,
      result_count: tweetData.length
    }

    return res.status(200).json({ data: tweetData, includes, meta })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
