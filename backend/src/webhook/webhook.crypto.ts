import crypto from 'crypto'
import { config } from '../config'

/**
 * Verifies GitHub's X-Hub-Signature-256 HMAC header.
 * SECURITY: Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyGitHubSignature(payload: Buffer | string | object, signature: string): boolean {
  if (!config.github.webhookSecret || config.github.webhookSecret.length < 8) {
    return false
  }

  let buf: Buffer
  if (Buffer.isBuffer(payload)) {
    buf = payload
  } else if (typeof payload === 'string') {
    buf = Buffer.from(payload, 'utf8')
  } else if (typeof payload === 'object' && payload !== null) {
    buf = Buffer.from(JSON.stringify(payload), 'utf8')
  } else {
    return false
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', config.github.webhookSecret)
    .update(buf)
    .digest('hex')}`

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'))
  } catch {
    return false
  }
}
