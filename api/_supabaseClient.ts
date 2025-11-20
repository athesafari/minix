import { createClient } from '@supabase/supabase-js'
import { randomFillSync, webcrypto } from 'node:crypto'

const runtimeCrypto =
  (globalThis.crypto as Crypto | undefined) ??
  (webcrypto as Crypto | undefined) ??
  ({} as Crypto)

if (typeof runtimeCrypto.getRandomValues !== 'function') {
  runtimeCrypto.getRandomValues = ((view: ArrayBufferView) => randomFillSync(view)) as Crypto['getRandomValues']
}

if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
  ;(globalThis as typeof globalThis & { crypto: Crypto }).crypto = runtimeCrypto
}

export function supabaseFromEnv() {
  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  }
  const client = createClient(url, anon, { auth: { persistSession: false } })
  return client
}
