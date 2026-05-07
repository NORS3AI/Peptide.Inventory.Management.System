/**
 * Client-side password hashing using Web Crypto PBKDF2-SHA256.
 *
 * IMPORTANT: this is a UX gate for a static SPA. The hash is stored in
 * IndexedDB on the same browser that performs verification, so anyone
 * with dev-tools access can read it. Use a real backend / identity
 * provider for serious security.
 */

const ITERATIONS = 200_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

function bytesToBase64(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function base64ToBytes(b64) {
  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i);
  return out;
}

async function deriveKeyBits(password, saltBytes, iterations = ITERATIONS) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    baseKey,
    KEY_LENGTH_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  if (!password) throw new Error('Password is required');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveKeyBits(password, salt);
  return {
    algorithm: 'pbkdf2-sha256',
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    hash: bytesToBase64(hash),
  };
}

export async function verifyPassword(password, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  const salt = base64ToBytes(stored.salt);
  const iterations = stored.iterations || ITERATIONS;
  const candidate = await deriveKeyBits(password, salt, iterations);
  const expected = base64ToBytes(stored.hash);
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) diff |= candidate[i] ^ expected[i];
  return diff === 0;
}

export function generateUserId() {
  return `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateRoleId() {
  return `role_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
