import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { config } from '../config'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12   // 96-bit IV — recommended for GCM
const TAG_BYTES = 16  // 128-bit auth tag — GCM default

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * The encryption key is taken from `config.auth.encryptionKey` (32-byte Buffer
 * derived from the ENCRYPTION_KEY env var).
 *
 * A fresh random IV is generated for every call, so encrypting the same value
 * twice produces different ciphertext — this is by design.
 *
 * @param plaintext - The string to encrypt (e.g. a GitHub access token)
 * @returns `"<iv_hex>:<authTag_hex>:<ciphertext_hex>"`
 *
 * @example
 * const enc = encrypt('gho_abc123')
 * // "a1b2c3...:d4e5f6...:789abc..."
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, config.auth.encryptionKey, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

/**
 * Decrypts a value produced by {@link encrypt}.
 *
 * @param encryptedValue - `"<iv_hex>:<authTag_hex>:<ciphertext_hex>"`
 * @returns The original plaintext string
 * @throws If the value is malformed or the auth tag doesn't match (tampering)
 */
export function decrypt(encryptedValue: string): string {
  const parts = encryptedValue.split(':')

  if (parts.length !== 3) {
    throw new Error('[crypto] Encrypted value has invalid format')
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string]

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error('[crypto] Encrypted value components have incorrect length')
  }

  const decipher = createDecipheriv(ALGORITHM, config.auth.encryptionKey, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
