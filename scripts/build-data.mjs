// Télécharge le jeu de données SNCF « tgvmax » et le compacte en data/max.json.
// Usage : node scripts/build-data.mjs [--input export.json] [--out data/max.json]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const API = 'https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax';
const URL_EXPORT = `${API}/exports/json?select=date,train_no,axe,origine,destination,heure_depart,heure_arrivee&where=${encodeURIComponent('od_happy_card="OUI"')}`;

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const input = arg('--input');
const out = arg('--out', 'data/max.json');

const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

let raw;
if (input) raw = JSON.parse(readFileSync(input, 'utf8'));
else {
  const res = await fetch(URL_EXPORT, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Export SNCF : HTTP ${res.status}`);
  raw = await res.json();
}
if (!Array.isArray(raw) || raw.length < 1000) throw new Error(`Jeu de données suspect (${raw?.length} lignes) : abandon`);

const dates = [...new Set(raw.map((r) => r.date))].sort();
const dIdx = new Map(dates.map((d, i) => [d, i]));
const stations = [...new Set(raw.flatMap((r) => [r.origine, r.destination]))].sort();
const sIdx = new Map(stations.map((s, i) => [s, i]));
const axes = [...new Set(raw.map((r) => r.axe))].sort();
const aIdx = new Map(axes.map((a, i) => [a, i]));
const trains = []; const tIdx = new Map();
const rows = []; const seen = new Set();

for (const r of raw) {
  const tk = `${r.train_no}|${r.axe}`;
  let ti = tIdx.get(tk);
  if (ti === undefined) { ti = trains.length; tIdx.set(tk, ti); trains.push([r.train_no, aIdx.get(r.axe)]); }
  const dep = hm(r.heure_depart); let arr = hm(r.heure_arrivee);
  if (arr <= dep) arr += 1440; // arrivée le lendemain (trains de nuit, etc.)
  const row = [dIdx.get(r.date), ti, sIdx.get(r.origine), sIdx.get(r.destination), dep, arr];
  const key = row.join(',');
  if (seen.has(key)) continue;
  seen.add(key); rows.push(row);
}
rows.sort((a, b) => a[0] - b[0] || a[4] - b[4] || a[1] - b[1]);

const snap = { v: 1, generated: new Date().toISOString(), source: 'data.sncf.com/tgvmax', dates, stations, axes, trains, rows: rows.flat() };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(snap));
console.log(`OK ${rows.length} places MAX, ${stations.length} gares, ${dates.length} jours (${dates[0]} → ${dates.at(-1)}) → ${out}`);
