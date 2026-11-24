// Tâche planifiée : relit les alertes synchronisées, cherche les nouvelles places MAX et envoie les notifications.
// Variables : SYNC_SECRET (déchiffrement), VAPID_PUBLIC, VAPID_PRIVATE_KEY, GITHUB_REPOSITORY (contact VAPID).
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { Network, evalAlert, describe, fullDate, DAY } from '../js/engine.js';
import { decryptJSON } from '../js/crypto.js';
import { pretty, fmtTime, fmtDur } from '../js/stations.js';
import { VAPID_PUBLIC } from '../js/config.js';

const SECRET = process.env.SYNC_SECRET, PRIV = process.env.VAPID_PRIVATE_KEY;
if (!existsSync('data/subs')) { console.log('Aucun appareil synchronisé : rien à faire.'); process.exit(0); }
if (!SECRET || !PRIV) { console.log('SYNC_SECRET ou VAPID_PRIVATE_KEY manquant : notifications ignorées.'); process.exit(0); }
const webpush = (await import('web-push')).default;
webpush.setVapidDetails(`https://github.com/${process.env.GITHUB_REPOSITORY || 'tgvmax'}`, VAPID_PUBLIC, PRIV);

const net = new Network(JSON.parse(readFileSync('data/max.json', 'utf8')));
mkdirSync('data/state', { recursive: true });
let sent = 0;

for (const f of readdirSync('data/subs').filter((x) => x.endsWith('.json'))) {
  const id = f.replace('.json', '');
  let dev;
  try { dev = await decryptJSON(JSON.parse(readFileSync(`data/subs/${f}`, 'utf8')), SECRET); }
  catch { console.log(`${id} : déchiffrement impossible (code de chiffrement différent ?)`); continue; }
  const stPath = `data/state/${id}.json`;
  const seen = new Set(existsSync(stPath) ? JSON.parse(readFileSync(stPath, 'utf8')).seen : []);
  const nowSeen = [];
  let gone = false;
  for (const a of dev.alerts.filter((x) => x.enabled !== false)) {
    const exact = evalAlert(net, a, dev.cfg).filter((m) => m.exact);
    exact.forEach((m) => { if (seen.has(m.key)) nowSeen.push(m.key); }); // une place n'est « vue » qu'une fois la notification partie
    const fresh = exact.filter((m) => !seen.has(m.key));
    if (!fresh.length || gone) continue;
    const label = a.label || `${pretty(a.from)} → ${pretty(a.to)}`;
    const batch = fresh.slice(0, 4);
    for (const m of batch) {
      const j = m.journey;
      const lines = describe(net, j);
      const extra = [j.altFrom && `Départ depuis une gare proche : +${j.altFrom.min} min (${j.altFrom.how})`, j.altTo && `Arrivée à une gare proche : +${j.altTo.min} min pour rejoindre le centre (${j.altTo.how})`].filter(Boolean);
      const payload = JSON.stringify({
        title: `Place MAX · ${label}`, tag: m.key, url: './', book: 'https://www.sncf-connect.com/',
        body: [`${fullDate(m.date)} · ${fmtTime(j.s)} → ${fmtTime(j.e)} · ${fmtDur(j.dur)} · ${j.changes ? j.changes + ' corr.' : 'direct'}`, ...lines, ...extra].join('\n'),
      });
      try { await webpush.sendNotification(dev.sub, payload); sent++; nowSeen.push(m.key); }
      catch (e) { if ([404, 410].includes(e.statusCode)) { gone = true; break; } console.log(`${id} : échec d'envoi (${e.statusCode || e.message})`); }
    }
    if (!gone && fresh.length > batch.length) {
      try { await webpush.sendNotification(dev.sub, JSON.stringify({ title: `Place MAX · ${label}`, body: `+ ${fresh.length - batch.length} autres places trouvées. Ouvre l’appli pour tout voir.`, url: './' })); sent++; fresh.slice(batch.length).forEach((m) => nowSeen.push(m.key)); } catch {}
    }
  }
  if (gone) { unlinkSync(`data/subs/${f}`); if (existsSync(stPath)) unlinkSync(stPath); console.log(`${id} : abonnement expiré, supprimé.`); continue; }
  writeFileSync(stPath, JSON.stringify({ seen: [...new Set(nowSeen)], at: new Date().toISOString() }));
}
console.log(`${sent} notification(s) envoyée(s).`);
