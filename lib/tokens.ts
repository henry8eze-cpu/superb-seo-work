import { createHash, randomBytes } from 'node:crypto'

/** A random URL-safe token and the hash we store. The raw token is only ever emailed. */
export function generateToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

/** Human-friendly booking reference, e.g. "NRW-7KQ3MX". */
export function generateBookingReference() {
  const bytes = randomBytes(6)
  let code = ''
  for (const byte of bytes) code += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]
  return `NRW-${code}`
}
