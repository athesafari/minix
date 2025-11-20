import { http, HttpResponse } from 'msw'
import { toTwitterResponse } from '../twitter/shape'

// We proxy the Twitter GET to our own API so DB is source-of-truth
export const handlers = [
  http.get('https://api.twitter.com/2/users/:id/tweets', async ({ request, params }) => {
    const url = new URL(request.url)
    const userId = params.id as string
    // Fetch posts (optionally filter by user id if stored)
    const r = await fetch('/api/posts?userId=' + encodeURIComponent(userId))
    const data = await r.json()
    const shaped = toTwitterResponse(data.posts || [])
    return HttpResponse.json(shaped, { status: 200 })
  }),

  // For demo: expose current posts via /mock/data (reads from API)
  http.get('/mock/data', async () => {
    const r = await fetch('/api/posts')
    const data = await r.json()
    return HttpResponse.json(data, { status: 200 })
  }),

  // --- DM mock passthroughs ---
  http.get('https://api.twitter.com/2/dm_conversations', async ({ request }) => {
    const url = new URL(request.url)
    const r = await fetch(`/api/2/dm_conversations${url.search}`)
    const data = await r.json()
    return HttpResponse.json(data, { status: r.status })
  }),

  http.get('https://api.twitter.com/2/dm_conversations/:id/messages', async ({ params }) => {
    const id = params.id as string
    const r = await fetch(`/api/2/dm_conversations/${id}/messages`)
    const data = await r.json()
    return HttpResponse.json(data, { status: r.status })
  }),

  http.post('https://api.twitter.com/2/dm_conversations/:id/messages', async ({ request, params }) => {
    const id = params.id as string
    const body = await request.json()
    const r = await fetch(`/api/2/dm_conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await r.json()
    return HttpResponse.json(data, { status: r.status })
  })
]
