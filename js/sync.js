// Notifications en arrière-plan sans service tiers : abonnement push du navigateur + alertes chiffrées
// déposées dans le dépôt GitHub (data/subs/). La tâche planifiée GitHub Actions les relit après chaque mise à jour.
import { VAPID_PUBLIC } from './config.js';
import { encryptJSON } from './crypto.js';

const urlB64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };

export async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Notifications non prises en charge ici : installe d’abord l’appli sur l’écran d’accueil.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Autorisation de notifications refusée.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(VAPID_PUBLIC) }));
  return sub.toJSON();
}
export const pushState = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
};

export function repoGuess() {
  const h = location.hostname, seg = location.pathname.split('/')[1];
  return h.endsWith('.github.io') && seg ? `${h.split('.')[0]}/${seg}` : '';
}

const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
export async function syncToRepo({ repo, token, secret, deviceId, sub, alerts, cfg }) {
  if (!repo || !token || !secret) throw new Error('Renseigne le dépôt, le jeton GitHub et le code de chiffrement.');
  const body = await encryptJSON({ sub, alerts, cfg, at: new Date().toISOString() }, secret);
  const url = `https://api.github.com/repos/${repo}/contents/data/subs/${deviceId}.json`;
  const H = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const cur = await fetch(url, { headers: H });
  const sha = cur.ok ? (await cur.json()).sha : undefined;
  if (!cur.ok && cur.status !== 404) throw new Error(`GitHub : HTTP ${cur.status} (jeton ou dépôt incorrect ?)`);
  const put = await fetch(url, { method: 'PUT', headers: H, body: JSON.stringify({ message: 'Synchronisation des alertes', content: b64(JSON.stringify(body)), sha }) });
  if (!put.ok) throw new Error(`GitHub : HTTP ${put.status} — le jeton doit avoir le droit « Contents : lecture et écriture » sur ce dépôt.`);
}
