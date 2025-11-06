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
  })
]
