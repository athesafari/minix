import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseFromEnv } from '../../_supabaseClient.js'

const PROBLEM_TYPE = 'https://api.twitter.com/2/problems'
const REPLY_SETTING_MAP = new Map([
  ['everyone', 'everyone'],
  ['mentionedusers', 'mentionedUsers'],
  ['mentioned_users', 'mentionedUsers'],
  ['following', 'following']
])

type TweetRow = {
  id: string
  text: string
  created_at: string
  user_id: string
  conversation_id?: string | null
  post_id?: string
  replied_to?: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res
      .status(405)
      .json(errorPayload(405, 'Only POST is supported for /2/tweets', 'Method Not Allowed'))
  }

  const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, any> : {}
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return res.status(400).json(errorPayload(400, 'text is required', 'Invalid Request'))
  }

  const supabase = supabaseFromEnv()

  try {
    const resolvedUser = await resolveUserId(supabase, req, body)
    if (!resolvedUser) {
      return res.status(400).json(
        errorPayload(
          400,
          'user_id (or username) is required. Provide user_id, author_id, username, or a Bearer token that contains a user id.',
          'Invalid Request'
        )
      )
    }

    const replySettings = normalizeReplySettings(body.reply_settings)
    const attachments = buildAttachments(body.media)
    const replyTarget = parseReplyTarget(body.reply)

    let createdTweet: TweetRow & { conversation_id: string }
    let referencedTweets: { type: 'replied_to'; id: string }[] | undefined

    if (replyTarget) {
      const replyResult = await createReplyTweet({
        supabase,
        text,
        userId: resolvedUser,
        inReplyTo: replyTarget
      })
      if (replyResult.status === 'not_found') {
        return res.status(404).json(
          errorPayload(404, `Tweet ${replyTarget} not found`, 'Resource Not Found')
        )
      }
      createdTweet = replyResult.record
      referencedTweets = [{ type: 'replied_to', id: replyTarget }]
    } else {
      const insert = await supabase
        .from('posts')
        .insert([{ user_id: resolvedUser, text }])
        .select('id, text, user_id, created_at')
        .single()

      if (insert.error || !insert.data) throw insert.error
      createdTweet = {
        ...insert.data,
        conversation_id: insert.data.id
      }
    }

    const data = {
      edit_history_tweet_ids: [createdTweet.id],
      id: createdTweet.id,
      text: createdTweet.text,
      author_id: createdTweet.user_id,
      conversation_id: createdTweet.conversation_id,
      created_at: createdTweet.created_at,
      reply_settings: replySettings,
      public_metrics: {
        retweet_count: 0,
        reply_count: 0,
        like_count: 0,
        quote_count: 0,
        bookmark_count: 0,
        impression_count: 0
      },
      ...(attachments ? { attachments } : {}),
      ...(referencedTweets ? { referenced_tweets: referencedTweets } : {})
    }

    return res.status(201).json({ data, errors: [] })
  } catch (err: any) {
    console.error(err)
    return res
      .status(500)
      .json(errorPayload(500, err.message || 'Unexpected error', 'Internal Error'))
  }
}

function errorPayload(status: number, detail: string, title: string) {
  return {
    data: null,
    errors: [
      {
        detail,
        status,
        title,
        type: PROBLEM_TYPE
      }
    ]
  }
}

function normalizeReplySettings(value: unknown): 'everyone' | 'mentionedUsers' | 'following' {
  if (typeof value !== 'string') return 'everyone'
  const canonical = REPLY_SETTING_MAP.get(value.trim().toLowerCase())
  if (canonical) return canonical as 'everyone' | 'mentionedUsers' | 'following'
  return 'everyone'
}

function buildAttachments(media: unknown) {
  if (!media || typeof media !== 'object') return undefined
  const mediaIds = Array.isArray((media as any).media_ids)
    ? (media as any).media_ids
    : null
  if (!mediaIds) return undefined
  const media_keys = mediaIds
    .map((id: unknown) => (typeof id === 'string' ? id.trim() : ''))
    .filter((id: string) => id.length > 0)
  return media_keys.length > 0 ? { media_keys } : undefined
}

function parseReplyTarget(reply: unknown) {
  if (!reply || typeof reply !== 'object') return ''
  const id = (reply as any).in_reply_to_tweet_id
  return typeof id === 'string' ? id.trim() : ''
}

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

async function resolveUserId(supabase: ReturnType<typeof supabaseFromEnv>, req: VercelRequest, body: Record<string, any>) {
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const possibleId = pickFirstString(
    body.user_id,
    body.userId,
    body.author_id,
    body.authorId,
    headerValue(req.headers['x-user-id']),
    headerValue(req.headers['x-userid']),
    authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
  )
  if (possibleId) return possibleId

  const username = pickFirstString(
    body.username,
    body.screen_name,
    headerValue(req.headers['x-username']),
    headerValue(req.headers['x-screen-name'])
  )

  if (!username) return null
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
  }
  return ''
}

async function createReplyTweet({
  supabase,
  text,
  userId,
  inReplyTo
}: {
  supabase: ReturnType<typeof supabaseFromEnv>
  text: string
  userId: string
  inReplyTo: string
}) {
  const postLookup = await supabase
    .from('posts')
    .select('id')
    .eq('id', inReplyTo)
    .maybeSingle()
  if (postLookup.error) throw postLookup.error

  if (postLookup.data) {
    const insert = await supabase
      .from('comments')
      .insert([{ post_id: postLookup.data.id, user_id: userId, text, replied_to: null, conversation_id: postLookup.data.id }])
      .select('id, text, user_id, post_id, conversation_id, created_at')
      .single()
    if (insert.error || !insert.data) throw insert.error
    return {
      status: 'ok' as const,
      record: {
        ...insert.data,
        conversation_id: insert.data.conversation_id ?? postLookup.data.id
      }
    }
  }

  const commentLookup = await supabase
    .from('comments')
    .select('id, post_id, conversation_id')
    .eq('id', inReplyTo)
    .maybeSingle()
  if (commentLookup.error) throw commentLookup.error

  if (!commentLookup.data) {
    return { status: 'not_found' as const }
  }

  const conversationId = commentLookup.data.conversation_id || commentLookup.data.post_id
  const insert = await supabase
    .from('comments')
    .insert([{
      post_id: commentLookup.data.post_id,
      user_id: userId,
      text,
      replied_to: commentLookup.data.id,
      conversation_id: conversationId
    }])
    .select('id, text, user_id, post_id, conversation_id, created_at, replied_to')
    .single()

  if (insert.error || !insert.data) throw insert.error
  return {
    status: 'ok' as const,
    record: {
      ...insert.data,
      conversation_id: insert.data.conversation_id ?? conversationId
    }
  }
}
