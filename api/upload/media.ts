import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createMediaEntry } from '../_services/dmStore.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const filenameRaw = req.body?.filename ?? req.body?.fileName
  const filename = typeof filenameRaw === 'string' ? filenameRaw : undefined
  try {
    const media = await createMediaEntry(filename)
    return res.status(201).json({ data: media })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err?.message || 'Unable to upload media' })
  }
}
