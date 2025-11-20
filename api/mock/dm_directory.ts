import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserDirectory } from '../_services/dmStore.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const excludeRaw = req.query.exclude_id ?? req.query.excludeId
  const excludeId = Array.isArray(excludeRaw) ? excludeRaw[0] : excludeRaw
  try {
    const directory = await getUserDirectory(excludeId)
    return res.status(200).json({ data: directory })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err?.message || 'Unable to load directory' })
  }
}
