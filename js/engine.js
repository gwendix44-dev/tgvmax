// Moteur TGV MAX : lecture du snapshot, recherche de trajets (correspondances partout en France),
// allers-retours, trains de nuit, gares alternatives et alertes. Pur JS, sans DOM : tourne dans le
// navigateur (Web Worker) comme dans Node (tâche planifiée).
import { km, COORDS, altStations, terAlts, parisTerminal, parisTransfer, PARIS, CLUSTERS, LINKS, fmtTime, pretty } from './stations.js';

export const DAY = 1440;

export const DEFAULTS = {
  home: 'NANTES', earliest: 240, latest: 1439, minConn: 60, maxChanges: 2, maxWait: 360, minStay: 120,
  nearby: 180, useAlts: true, maxTer: 90, altRadiusDest: 45, altOff: {}, allowNight: true,
};
export const cfgOf = (c = {}) => ({ ...DEFAULTS, ...c });

export class Network {
  constructor(snap) {
    this.generated = snap.generated; this.sourceUpdated = snap.sourceUpdated || snap.generated; this.dates = snap.dates; this.stations = snap.stations; this.axes = snap.axes;
    this.sid = new Map(snap.stations.map((s, i) => [s, i]));
    const r = snap.rows, n = r.length / 6;
    const from = snap.stations.map(() => []);
    this.rowSet = new Set();
    this.parisIds = new Set([...PARIS].filter((p) => this.sid.has(p)).map((p) => this.sid.get(p)));
    this.hub = snap.stations.map((_, i) => (this.parisIds.has(i) ? [...this.parisIds] : [i]));
    this.cl = snap.stations.map((_, i) => i); // identifiant de ville (gares équivalentes)
    for (const c of CLUSTERS) { const ids = c.map((x) => this.sid.get(x)).filter((x) => x !== undefined); for (const i of ids) this.cl[i] = ids[0]; }
    this.link = new Map();
    for (const c of CLUSTERS) {
      const ids = c.map((x) => this.sid.get(x)).filter((x) => x !== undefined);
      for (const i of ids) this.hub[i] = [i, ...ids.filter((x) => x !== i)];
      for (const x of ids) for (const y of ids) if (x !== y) { const d = km(this.stations[x], this.stations[y]); const e = d < 1 ? { min: Math.max(5, Math.ceil(d * 15)), how: 'à pied' } : { min: Math.round(15 + d * 0.7), how: 'transport local' }; this.link.set(x * 512 + y, e); }
    }
    for (const [a, b, min, how] of LINKS) {
      const x = this.sid.get(a), y = this.sid.get(b); if (x === undefined || y === undefined) continue;
      this.link.set(x * 512 + y, { min, how }); this.link.set(y * 512 + x, { min, how });
    }
    for (let i = 0; i < n; i++) {
      const b = i * 6, di = r[b], ti = r[b + 1], o = r[b + 2], d = r[b + 3], dep = r[b + 4], arr = r[b + 5];
      const [no, ai] = snap.trains[ti]; const ax = snap.axes[ai];
      const leg = { di, ti, no, ax, o, d, dep, s: di * DAY + dep, e: di * DAY + arr, night: ax === 'IC NUIT' };
      if (this.parisIds.has(o)) leg.ptO = parisTerminal(ax, snap.stations[d], snap.stations[o]);
      if (this.parisIds.has(d)) leg.ptD = parisTerminal(ax, snap.stations[o], snap.stations[d]);
      from[o].push(leg);
      this.rowSet.add(((di * 32768 + ti) * 512 + o) * 512 + d);
    }
    for (const a of from) a.sort((x, y) => x.s - y.s);
    this.from = from;
    this.outDeg = from.map((a) => new Set(a.map((l) => l.d)).size);
  }
  id(name) { return this.sid.get(name); }
  hasRow(di, ti, o, d) { return this.rowSet.has(((di * 32768 + ti) * 512 + o) * 512 + d); }
  name(i) { return this.stations[i]; }
  dayIndex(date) { return this.dates.indexOf(date); }
  weekday(di) { return new Date(this.dates[di] + 'T12:00:00Z').getUTCDay(); }
}

const lowerBound = (arr, s) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].s < s) lo = m + 1; else hi = m; } return lo; };

function reqConn(net, last, next, minConn) {
  if (last.ti === next.ti && last.d === next.o && last.di === next.di) return 0; // même train : on reste à bord
  let r = minConn;
  const lk = last.d !== next.o && net.link.get(last.d * 512 + next.o);
  if (lk) r = lk.min <= 10 ? lk.min + 15 : Math.max(r, lk.min + 30); // gares voisines (à pied) : marge courte ; sinon temps de trajet + 30 min
  if (last.ptD && next.ptO && last.ptD !== next.ptO) r = Math.max(r, parisTransfer(last.ptD, next.ptO) + 30);
  return r;
}

const changesOf = (path) => { let c = 0; for (let i = 1; i < path.length; i++) if (path[i].ti !== path[i - 1].ti || path[i].di !== path[i - 1].di) c++; return c; };

export function finalize(path) {
  const s = path[0].s, e = path[path.length - 1].e;
  return { legs: path, s, e, dur: e - s, changes: changesOf(path), night: path.some((l) => l.night), di: path[0].di };
}

// Recherche multi-critères (type rRAPTOR) : tous les trajets non dominés (départ tard / arrivée tôt / peu de tronçons).
// Les trains directs sont tous conservés (utile pour les alertes sur créneau).
export function search(net, o) {
  const opt = { depFrom: 240, depTo: 1439, maxChanges: 2, minConn: 60, maxWait: 360, earliest: 240, allowNight: true, sameDay: false, maxDur: 40 * 60, dests: null, ...o };
  const base = opt.di * DAY, K = opt.maxChanges + 2, N = net.stations.length;
  const best = Array.from({ length: K + 1 }, () => new Float64Array(N).fill(Infinity));
  const label = Array.from({ length: K + 1 }, () => new Array(N).fill(null));
  const out = [];
  const okLeg = (l) => (l.s % DAY) >= opt.earliest && (opt.allowNight || !l.night);
  const starts = [];
  for (const st of opt.origins) {
    const arr = net.from[st];
    for (let i = lowerBound(arr, base + opt.depFrom); i < arr.length && arr[i].s <= base + opt.depTo; i++) if (okLeg(arr[i])) starts.push(arr[i]);
  }
  starts.sort((a, b) => b.s - a.s);
  const arrOk = (e) => (opt.arrFrom == null || e - base >= opt.arrFrom) && (opt.arrTo == null || e - base <= opt.arrTo);

  for (const start of starts) {
    let marked = [];
    const consider = (k, prefix, leg) => {
      if (opt.sameDay && leg.e >= base + DAY) return;
      if (leg.e - start.s > opt.maxDur) return;
      if (opt.origins.includes(leg.d)) return; // ne repasse pas par une gare de départ (ex. Angers → Nantes)
      if (prefix.some((l) => net.cl[l.o] === net.cl[leg.d])) return; // pas de détour pour revenir dans une ville déjà visitée
      if (prefix.length) {
        let j = prefix.length - 1;
        while (j > 0 && prefix[j].ti === leg.ti && prefix[j].di === leg.di && prefix[j - 1].ti === leg.ti) j--;
        const p0 = prefix[j];
        if (p0.ti === leg.ti && p0.di === leg.di && net.hasRow(leg.di, leg.ti, p0.o, leg.d)) return;
      }
      const path = prefix.concat(leg);
      const improves = leg.e < best[k][leg.d];
      if (k > 1 && !improves) return;
      if ((!opt.dests || opt.dests.has(leg.d)) && arrOk(leg.e)) out.push(finalize(path));
      if (improves) {
        for (let j = k; j <= K; j++) if (leg.e < best[j][leg.d]) best[j][leg.d] = leg.e;
        label[k][leg.d] = path; marked.push(leg.d);
      }
    };
    consider(1, [], start);
    for (let k = 2; k <= K && marked.length; k++) {
      const cur = [...new Set(marked)]; marked = [];
      for (const st of cur) {
        const path = label[k - 1][st];
        if (!path) continue;
        const last = path[path.length - 1];
        if (last.d !== st) continue;
        const ch = changesOf(path);
        for (const h of net.hub[st]) {
          const arr = net.from[h];
          for (let i = lowerBound(arr, last.e); i < arr.length && arr[i].s <= last.e + opt.maxWait; i++) {
            const L = arr[i];
            if (!okLeg(L)) continue;
            const stay = L.ti === last.ti && L.di === last.di && L.o === last.d;
            if (!stay && ch + 1 > opt.maxChanges) continue;
            if (L.s < last.e + reqConn(net, last, L, opt.minConn)) continue;
            consider(k, path, L);
          }
        }
      }
    }
  }
  const seen = new Set(); // même horaire sur deux numéros de train couplés : un seul résultat
  return out.filter((j) => { const k = j.legs.map((l) => `${l.o}>${l.d}@${l.s}-${l.e}`).join('+'); return seen.has(k) ? false : (seen.add(k), true); });
}

// ---------- Gares alternatives ----------
export function resolveStations(net, name, { alts = true, radius = 45, maxTer = 90, off = {}, role = 'dest' } = {}) {
  const id = net.id(name);
  if (id === undefined) return [];
  const res = [{ id, name, access: null }];
  if (!alts) return res;
  // gares du même pôle (Paris/Massy/Roissy…, Nîmes Centre/Pont du Gard…)
  for (const [a, b, min, how] of LINKS) {
    const o = a === name ? b : b === name ? a : null;
    if (o && net.sid.has(o) && !off[o] && !res.some((r) => r.name === o)) res.push({ id: net.id(o), name: o, access: { min, how, km: Math.round(km(name, o)), main: name } });
  }
  const ok = (s) => net.sid.has(s) && !off[s] && !res.some((r) => r.name === s);
  if (role === 'dest') {
    for (const a of altStations(name, radius, net.stations, ok)) res.push({ id: net.id(a.name), name: a.name, access: { min: a.min, how: a.how, km: a.km, main: name } });
  } else {
    // départ : uniquement des gares reliées par un TER direct de durée raisonnable
    for (const a of terAlts(name, maxTer, net.stations, (s) => ok(s) && net.outDeg[net.id(s)] >= 20)) res.push({ id: net.id(a.name), name: a.name, access: { min: a.min, how: a.how, km: a.km, main: name } });
  }
  return res;
}
const accessMap = (arr) => new Map(arr.filter((x) => x.access).map((x) => [x.id, x.access]));

function annotate(j, oAcc, dAcc) {
  j.altFrom = oAcc.get(j.legs[0].o) || null;
  j.altTo = dAcc.get(j.legs[j.legs.length - 1].d) || null;
  return j;
}

// ---------- Destinations depuis une gare ----------
export function destinations(net, o) {
  const cfg = cfgOf(o.cfg);
  const origins = resolveStations(net, o.from, { alts: cfg.useAlts, maxTer: cfg.maxTer, off: cfg.altOff, role: 'origin' });
  const oAcc = accessMap(origins), ids = origins.map((x) => x.id);
  const js = search(net, { origins: ids, di: o.di, depFrom: o.depFrom ?? cfg.earliest, depTo: o.depTo ?? cfg.latest, maxChanges: o.maxChanges ?? cfg.maxChanges,
    minConn: cfg.minConn, maxWait: cfg.maxWait, earliest: cfg.earliest, allowNight: o.allowNight ?? cfg.allowNight, sameDay: !!o.sameDay, arrFrom: o.arrFrom, arrTo: o.arrTo });
  const by = new Map();
  for (const j of js) {
    if (o.maxDur && j.dur > o.maxDur) continue;
    const d = j.legs[j.legs.length - 1].d;
    if (ids.includes(d) || ids.some((i) => net.cl[i] === net.cl[d])) continue;
    j.altFrom = oAcc.get(j.legs[0].o) || null;
    const key = net.cl[d];
    (by.get(key) || by.set(key, []).get(key)).push(j);
  }
  const res = [];
  for (const [, all] of by) {
    // une ville à plusieurs gares (Nîmes Centre / Pont du Gard…) = une seule destination ; on nomme la gare la plus fréquente
    const cnt = new Map(); for (const j of all) { const x = j.legs.at(-1).d; cnt.set(x, (cnt.get(x) || 0) + 1); }
    const d = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const others = [...cnt.keys()].filter((x) => x !== d).map((x) => net.name(x));
    const mainOnly = all.filter((j) => !j.altFrom);
    const list = mainOnly.length ? mainOnly : all;
    const viaAlt = !mainOnly.length;
    list.sort((a, b) => a.s - b.s);
    const fastest = list.reduce((m, j) => (j.dur < m.dur ? j : m), list[0]);
    res.push({ d, name: net.name(d), others, viaAlt, n: list.length, fastest, direct: list.filter((j) => j.changes === 0).length, journeys: list });
  }
  return res.sort((a, b) => a.fastest.dur - b.fastest.dur);
}

// ---------- Trajets d'une gare à une autre (avec alternatives) ----------
export function journeys(net, o) {
  const cfg = cfgOf(o.cfg);
  const origins = resolveStations(net, o.from, { alts: cfg.useAlts, maxTer: cfg.maxTer, off: cfg.altOff, role: 'origin' });
  const dests = resolveStations(net, o.to, { alts: cfg.useAlts, radius: cfg.altRadiusDest, off: cfg.altOff, role: 'dest' });
  const oAcc = accessMap(origins), dAcc = accessMap(dests);
  const near = o.nearby ?? cfg.nearby;
  const w = { depFrom: o.depFrom ?? cfg.earliest, depTo: o.depTo ?? cfg.latest, arrFrom: o.arrFrom, arrTo: o.arrTo };
  const js = search(net, { origins: origins.map((x) => x.id), dests: new Set(dests.map((x) => x.id)), di: o.di,
    depFrom: Math.max(cfg.earliest, w.depFrom - near), depTo: Math.min(DAY - 1, w.depTo + near), arrFrom: w.arrFrom == null ? null : w.arrFrom - near, arrTo: w.arrTo == null ? null : w.arrTo + near,
    maxChanges: o.maxChanges ?? cfg.maxChanges, minConn: cfg.minConn, maxWait: cfg.maxWait, earliest: cfg.earliest, allowNight: o.allowNight ?? cfg.allowNight });
  const base = o.di * DAY;
  return js.map((j) => {
    annotate(j, oAcc, dAcc);
    j.delta = deltaOf(j, base, w);
    j.exactDest = !j.altTo; j.exactOrigin = !j.altFrom;
    return j;
  });
}

function deltaOf(j, base, w) {
  const out = (v, a, b) => (v < a ? a - v : v > b ? v - b : 0);
  if (w.arrFrom != null || w.arrTo != null) return out(j.e - base, w.arrFrom ?? -1e9, w.arrTo ?? 1e9);
  return out(j.s - base, w.depFrom, w.depTo);
}

// ---------- Allers-retours (dans la journée ou avec nuits) ----------
export function roundTrips(net, o) {
  const cfg = cfgOf(o.cfg);
  const plans = roundTripsFrom(net, o, o.from);
  if (!cfg.useAlts || o.noAlts) return plans;
  const seen = new Set(plans.map((p) => p.x));
  for (const a of resolveStations(net, o.from, { alts: true, maxTer: cfg.maxTer, off: cfg.altOff, role: 'origin' }).slice(1)) {
    for (const p of roundTripsFrom(net, o, a.name)) {
      if (seen.has(p.x)) continue;
      for (const it of p.items) { it.altFrom = a.access; it.out.altFrom = a.access; it.back.altTo = a.access; }
      seen.add(p.x); plans.push(p);
    }
  }
  return plans.sort((x, y) => Math.max(...y.items.map((i) => i.stay)) - Math.max(...x.items.map((i) => i.stay)));
}
function roundTripsFrom(net, o, fromName) {
  const cfg = cfgOf(o.cfg), nights = o.nights || 0;
  const home = [{ id: net.id(fromName), name: fromName, access: null }];
  const homeIds = home.map((x) => x.id), homeSet = new Set(homeIds), minStay = o.minStay ?? cfg.minStay;
  const back = o.di + nights, base = o.di * DAY;
  const common = { minConn: cfg.minConn, maxWait: cfg.maxWait, earliest: cfg.earliest, allowNight: o.allowNight ?? cfg.allowNight, maxChanges: o.maxChanges ?? 1 };
  const outs = search(net, { ...common, origins: homeIds, di: o.di, depFrom: o.depFrom ?? cfg.earliest, depTo: o.depTo ?? cfg.latest, sameDay: nights === 0, maxDur: 30 * 60 });
  const byX = new Map();
  const onlyCl = o.to ? net.cl[net.id(o.to)] : null;
  for (const j of outs) {
    const x = j.legs[j.legs.length - 1].d;
    if (onlyCl != null && net.cl[x] !== onlyCl) continue;
    // « nuit + journée » : on part l'après-midi/soir, on arrive le lendemain matin (train de nuit), journée complète sur place
    if (o.nightOut && !(j.e >= base + DAY && j.e <= base + DAY + 13 * 60)) continue;
    if (!homeSet.has(x)) (byX.get(x) || byX.set(x, []).get(x)).push(j);
  }
  const plans = [];
  if (back >= net.dates.length) return plans;
  for (const [x, list] of byX) {
    const eMin = Math.min(...list.map((j) => j.e));
    const rets = search(net, { ...common, origins: [x], dests: homeSet, di: back, depFrom: Math.max(cfg.earliest, o.backFrom ?? 0, eMin + minStay - back * DAY), depTo: o.backTo ?? DAY - 1, sameDay: nights === 0, maxDur: 30 * 60 });
    const combos = [];
    for (const r of rets) {
      let bestOut = null;
      for (const j of list) if (j.e + minStay <= r.s && (!bestOut || j.e > bestOut.e)) bestOut = j;
      if (bestOut) combos.push({ out: bestOut, back: r, stay: r.s - bestOut.e, travel: bestOut.dur + r.dur });
    }
    if (!combos.length) continue;
    const pick = new Map();
    const add = (c) => pick.set(c.out.s + ':' + c.back.s, c);
    add(combos.reduce((m, c) => (c.stay > m.stay ? c : m)));
    add(combos.reduce((m, c) => (c.travel < m.travel ? c : m)));
    const items = [...pick.values()].map((c) => ({ ...c, x, name: net.name(x), nights, altFrom: null }));
    plans.push({ x, name: net.name(x), items });
  }
  return plans.sort((a, b) => Math.max(...b.items.map((i) => i.stay)) - Math.max(...a.items.map((i) => i.stay)));
}

// ---------- Alertes ----------
export function alertDates(net, a) {
  if (a.mode === 'date') { const i = net.dayIndex(a.date); return i < 0 ? [] : [i]; }
  return net.dates.map((_, i) => i).filter((i) => a.weekday === -1 || net.weekday(i) === a.weekday);
}
export function alertStatus(net, a) {
  if (a.mode === 'date') {
    if (a.date < net.dates[0]) return { state: 'past', text: 'Date passée' };
    if (a.date > net.dates.at(-1)) { const d = Math.ceil((Date.parse(a.date) - Date.parse(net.dates.at(-1))) / 86400000); return { state: 'pending', text: `Pas encore ouvert à la réservation (dans ${d} j)` }; }
    return { state: 'live', text: 'En surveillance' };
  }
  return { state: 'live', text: 'En surveillance chaque jour' };
}
export const alertWindow = (a) => (a.timeMode === 'arrive'
  ? { arrFrom: a.to1 ?? (a.to2 - 180), arrTo: a.to2 }
  : { depFrom: a.from1 ?? 240, depTo: a.from2 ?? 1439 });

export function evalAlert(net, a, cfgIn) {
  const cfg = cfgOf(cfgIn), w = alertWindow(a), res = [];
  if (alertStatus(net, a).state === 'past') return res;
  const origins = resolveStations(net, a.from, { alts: !!a.alts && cfg.useAlts, maxTer: cfg.maxTer, off: cfg.altOff, role: 'origin' });
  const dests = resolveStations(net, a.to, { alts: !!a.alts && cfg.useAlts, radius: cfg.altRadiusDest, off: cfg.altOff, role: 'dest' });
  const oAcc = accessMap(origins), dAcc = accessMap(dests), near = a.nearby ?? cfg.nearby;
  for (const di of alertDates(net, a)) {
    const js = search(net, { origins: origins.map((x) => x.id), dests: new Set(dests.map((x) => x.id)), di,
      depFrom: w.depFrom == null ? cfg.earliest : Math.max(cfg.earliest, w.depFrom - near), depTo: w.depTo == null ? DAY - 1 : Math.min(DAY - 1, w.depTo + near),
      arrFrom: w.arrFrom == null ? null : w.arrFrom - near, arrTo: w.arrTo == null ? null : w.arrTo + near,
      maxChanges: a.maxChanges ?? cfg.maxChanges, minConn: cfg.minConn, maxWait: cfg.maxWait, earliest: cfg.earliest, allowNight: cfg.allowNight });
    for (const j of js) { annotate(j, oAcc, dAcc); j.delta = deltaOf(j, di * DAY, w); }
    // La gare demandée prime : une gare proche n'est proposée que si rien d'exact n'existe côté gare principale.
    const mainExact = js.some((j) => j.delta === 0 && !j.altFrom && !j.altTo);
    for (const j of js) {
      if (mainExact && (j.altFrom || j.altTo)) continue;
      res.push({ di, date: net.dates[di], journey: j, exact: j.delta === 0, key: keyOf(net, di, j) });
    }
  }
  return res.sort((x, y) => x.di - y.di || x.journey.s - y.journey.s);
}
export const keyOf = (net, di, j) => `${net.dates[di]}|${j.legs.map((l) => `${l.no}:${l.o}>${l.d}`).join('+')}`;

// ---------- Mise en forme d'un trajet (partagée app / notifications) ----------
export function describe(net, j) {
  const day = (l) => { const dd = Math.floor(l.s / DAY) - j.di; return dd ? ` (+${dd} j)` : ''; };
  return j.legs.map((l, i) => {
    const p = j.legs[i - 1];
    const same = p && p.ti === l.ti && p.di === l.di;
    return `${fmtTime(l.s)} ${pretty(net.name(l.o))} → ${fmtTime(l.e)} ${pretty(net.name(l.d))}${day(l)}${l.night ? ' [nuit]' : ''}${same ? ' [même train]' : ''}`;
  });
}
export const fullDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export { COORDS };

// ---------- Prochaines dates avec une place (quand rien n'existe à la date demandée) ----------
export function nextDates(net, o, max = 7) {
  const out = [];
  for (let di = o.di + 1; di < net.dates.length && out.length < max; di++) {
    const js = journeys(net, { ...o, di, nearby: 0 });
    const ok = js.filter((j) => j.delta === 0);
    if (ok.length) out.push({ date: net.dates[di], n: ok.length, first: ok.reduce((m, j) => (j.s < m.s ? j : m), ok[0]) });
  }
  return out;
}
