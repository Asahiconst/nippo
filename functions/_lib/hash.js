// パスワードハッシュ化（PBKDF2-SHA256 / Web Crypto）。Workers・Node両方で動作。
const ITERATIONS = 100000;

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256
  );
  return `${toHex(salt)}:${toHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || stored.indexOf(':') === -1) return false;
  const [saltHex, hashHex] = stored.split(':');
  const salt = fromHex(saltHex);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256
  );
  return toHex(bits) === hashHex;
}

export function newToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}
