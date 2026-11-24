import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Network, destinations, journeys, roundTrips, evalAlert, search, DAY } from '../js/engine.js';
import { answer } from '../js/chat.js';
import { encryptJSON, decryptJSON } from '../js/crypto.js';
import { COORDS, parisTransfer } from '../js/stations.js';

const net = new Network(JSON.parse(readFileSync(new URL('../data/max.json', import.meta.url), 'utf8')));
const di = net.dates.indexOf('2026-12-04') >= 0 ? net.dates.indexOf('2026-12-04') : 8;

test('toutes les gares du jeu de données ont des coordonnées', () => {
  const missing = net.stations.filter((s) => !COORDS[s]);
  assert.deepEqual(missing, []);
});

test('chaque tronçon d’un trajet a une place MAX et chaque correspondance respecte le minimum', () => {
  const ds = destinations(net, { from: 'NANTES', di, cfg: { minConn: 60, maxChanges: 2 } });
  assert.ok(ds.length > 10);
  for (const d of ds) for (const j of d.journeys) {
    j.legs.forEach((l, i) => {
      assert.ok(net.hasRow(l.di, l.ti, l.o, l.d), 'tronçon sans place MAX');
      const p = j.legs[i - 1];
      if (p && !(p.ti === l.ti && p.di === l.di)) assert.ok(l.s - p.e >= 60, `correspondance trop courte (${l.s - p.e} min)`);
      if (p) assert.ok(p.d === l.o || net.cl[p.d] === net.cl[l.o], 'changement de gare hors pôle');
    });
    assert.ok(j.changes <= 2);
  }
});

test('changement de gare à Paris : temps de transfert allongé automatiquement', () => {
  assert.ok(parisTransfer('MP', 'GL') >= 40);
  const js = search(net, { origins: [net.id('NANTES')], di, maxChanges: 2, minConn: 30, depFrom: 240, depTo: 1439 });
  for (const j of js) j.legs.forEach((l, i) => {
    const p = j.legs[i - 1];
    if (p && p.ptD && l.ptO && p.ptD !== l.ptO) assert.ok(l.s - p.e >= parisTransfer(p.ptD, l.ptO) + 30);
  });
});

test('allers-retours dans la journée : 4 tronçons possibles, temps sur place respecté, retour le même jour', () => {
  const plans = roundTrips(net, { from: 'NANTES', di, cfg: { minStay: 180 }, maxChanges: 1 });
  assert.ok(plans.length > 0);
  for (const p of plans) for (const it of p.items) {
    assert.ok(it.stay >= 180);
    assert.ok(it.back.e < (di + 1) * DAY);
  }
});

test('trains de nuit pris en compte et enchaînés avec un train de jour', () => {
  let found = null;
  for (let d = 0; d < net.dates.length && !found; d++) {
    const ds = destinations(net, { from: 'NANTES', di: d, cfg: { maxChanges: 2 } });
    for (const x of ds) for (const j of x.journeys) if (j.night && j.legs.some((l) => !l.night)) { found = j; break; }
  }
  assert.ok(found, 'aucun voyage jour + nuit trouvé');
});

test('heure de départ minimum par défaut : 4 h', () => {
  const ds = destinations(net, { from: 'NANTES', di, cfg: {} });
  for (const d of ds) for (const j of d.journeys) assert.ok(j.legs.every((l) => l.dep >= 240));
});

test('alerte : seul le créneau exact déclenche, les alternatives sont marquées', () => {
  const a = { mode: 'weekday', weekday: -1, from: 'NANTES', to: 'PARIS (intramuros)', alts: false, timeMode: 'depart', from1: 480, from2: 600, maxChanges: 1 };
  const r = evalAlert(net, a, {});
  for (const m of r) {
    const clock = m.journey.s % DAY;
    assert.equal(m.exact, clock >= 480 && clock <= 600);
  }
});

test('alerte en mode « arrivée visée »', () => {
  const a = { mode: 'weekday', weekday: -1, from: 'NANTES', to: 'PARIS (intramuros)', alts: false, timeMode: 'arrive', to1: 600, to2: 780, maxChanges: 1 };
  for (const m of evalAlert(net, a, {})) {
    const clock = m.journey.e % DAY;
    assert.equal(m.exact, clock >= 600 && clock <= 780);
  }
});

test('chat : ne renvoie que de vrais trajets et le dit quand il n’y en a pas', () => {
  const ctx = { today: '2026-11-24' };
  const r = answer(net, 'Donne-moi trois destinations pour le 4 décembre, accessibles en 100 % TGV MAX, aller-retour dans la journée.', {}, ctx);
  assert.ok(r.cards.length > 0 && r.cards.length <= 3);
  for (const c of r.cards) { assert.ok(c.plan.stay >= 120); assert.ok(c.plan.out.legs.every((l) => net.hasRow(l.di, l.ti, l.o, l.d))); }
  const far = answer(net, 'trois destinations pour le 10 mars', {}, ctx);
  assert.equal(far.cards.length, 0);
  assert.match(far.text, /pas encore ouvert/);
});

test('chiffrement des alertes (aller-retour)', async () => {
  const p = await encryptJSON({ a: 1, b: 'é' }, 'secret');
  assert.deepEqual(await decryptJSON(p, 'secret'), { a: 1, b: 'é' });
  await assert.rejects(decryptJSON(p, 'autre'));
});

test('Le Havre / Rouen via Massy TGV → Massy Palaiseau, pas de détour Pont du Gard, prochaines dates', async () => {
  const { journeys, nextDates, cfgOf } = await import('../js/engine.js');
  const cfg = cfgOf({});
  const di = net.dayIndex('2026-11-26');
  const lh = journeys(net, { cfg, from: 'NANTES', to: 'LE HAVRE', di, depFrom: 240, depTo: 1439, nearby: 0, maxChanges: 2 });
  assert.ok(lh.some((j) => j.legs.some((l) => net.name(l.d) === 'MASSY TGV') && j.legs.some((l) => net.name(l.o) === 'MASSY PALAISEAU')));
  const nm = journeys(net, { cfg, from: 'NANTES', to: 'NIMES CENTRE', di, depFrom: 240, depTo: 1439, nearby: 0, maxChanges: 2 });
  for (const j of nm) assert.ok(!j.legs.slice(0, -1).some((l) => /NIMES/.test(net.name(l.o))), 'pas de détour par Nîmes');
  assert.ok(nextDates(net, { cfg, from: 'LILLE (intramuros)', to: 'BORDEAUX ST JEAN', di: 0, depFrom: 240, depTo: 1439 }).length > 0);
});

test('gares de secours au départ : uniquement des TER directs ≤ durée max ; pôle Île-de-France regroupé', async () => {
  const { resolveStations } = await import('../js/engine.js');
  const names = (n, o) => resolveStations(net, n, { role: 'origin', maxTer: 90, ...o }).map((r) => r.name);
  assert.ok(!names('ANGERS SAINT LAUD').includes('RENNES') && !names('ANGERS SAINT LAUD').includes('POITIERS'));
  assert.ok(names('NANTES').includes('ANGERS SAINT LAUD'));
  assert.ok(!names('NANTES', { maxTer: 30 }).includes('ANGERS SAINT LAUD'));
  const paris = resolveStations(net, 'PARIS (intramuros)', { role: 'dest' }).map((r) => r.name);
  for (const s of ['MASSY TGV', 'MASSY PALAISEAU', 'MARNE LA VALLEE CHESSY', 'AEROPORT ROISSY CDG 2 TGV']) assert.ok(paris.includes(s), s);
});

test('A/R « nuit + journée » : départ la veille, arrivée le lendemain matin, retour vers midi J+2', () => {
  const di = net.dayIndex(net.dates[4]);
  const r = roundTrips(net, { cfg: {}, from: 'PARIS (intramuros)', di, nights: 2, nightOut: true, depFrom: 720, depTo: 1439, backFrom: 660, backTo: 870, minStay: 240, maxChanges: 1 });
  for (const p of r) for (const it of p.items) {
    assert.ok(it.out.e >= (di + 1) * DAY && it.out.e <= (di + 1) * DAY + 13 * 60, 'arrivée le lendemain matin');
    const t = it.back.s - (di + 2) * DAY; assert.ok(t >= 660 && t <= 870, 'retour entre 11h et 14h30');
  }
});
test('A/R vers une destination précise', () => {
  const r = roundTrips(net, { cfg: {}, from: 'NANTES', to: 'PARIS (intramuros)', di: net.dayIndex(net.dates[4]), nights: 0, minStay: 240, maxChanges: 1 });
  assert.ok(r.length >= 1);
});
