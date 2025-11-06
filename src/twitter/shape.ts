export function toTwitterResponse(posts: any[]) {
  const data = posts.map((p:any) => ({
    edit_history_tweet_ids: [p.id],
    id: p.id,
    public_metrics: {
      retweet_count: 0, reply_count: p.comments?.length || 0,
      like_count: 0, quote_count: 0, bookmark_count: 0, impression_count: 0
    },
    created_at: p.created_at,
    conversation_id: p.id,
    text: p.text
  }))
  return {
    data,
    meta: {
      result_count: data.length,
      newest_id: data[0]?.id || null,
      oldest_id: data[data.length-1]?.id || null,
      next_token: null
    }
  }
}
