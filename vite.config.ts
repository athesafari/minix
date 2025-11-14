import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { randomFillSync, webcrypto } from 'node:crypto'

// Ensure crypto.getRandomValues exists when Vite runs under bare Node (needed by dependencies).
const runtimeCrypto = (globalThis.crypto as Crypto | undefined) ?? (webcrypto as Crypto | undefined) ?? ({} as Crypto)
if (typeof runtimeCrypto.getRandomValues !== 'function') {
  runtimeCrypto.getRandomValues = ((view: ArrayBufferView) => randomFillSync(view)) as Crypto['getRandomValues']
}
if (!globalThis.crypto) {
  ;(globalThis as typeof globalThis & { crypto: Crypto }).crypto = runtimeCrypto
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
