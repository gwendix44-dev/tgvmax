// Chiffrement AES-GCM (clé dérivée d'un code secret) : les alertes synchronisées dans le dépôt GitHub
// ne sont pas lisibles publiquement. Fonctionne dans le navigateur et dans Node ≥ 20.
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function keyFrom(secret, salt) {
  const km = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptJSON(obj, secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(secret, salt), enc.encode(JSON.stringify(obj)));
  return { v: 1, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(ct)) };
}
export async function decryptJSON(p, secret) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, await keyFrom(secret, unb64(p.salt)), unb64(p.data));
  return JSON.parse(dec.decode(pt));
}
export const randomSecret = () => b64(crypto.getRandomValues(new Uint8Array(18))).replace(/[+/=]/g, 'x');
