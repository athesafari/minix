const crypto = require('node:crypto')
const { randomFillSync, webcrypto } = crypto

const globalCrypto = globalThis.crypto || webcrypto || {}
if (typeof globalCrypto.getRandomValues !== 'function') {
  globalCrypto.getRandomValues = (view) => randomFillSync(view)
}

if (!globalThis.crypto) {
  globalThis.crypto = globalCrypto
}

if (typeof crypto.getRandomValues !== 'function') {
  crypto.getRandomValues = (view) => randomFillSync(view)
}
