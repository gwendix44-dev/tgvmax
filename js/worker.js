// Calculs lourds hors du fil principal : chargement du snapshot, recherches, alertes, chat.
import { Network, destinations, journeys, nextDates, roundTrips, evalAlert, alertStatus, DAY } from './engine.js';
import { answer } from './chat.js';

let net = null;
const ops = {
  async init({ url }) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Données indisponibles (HTTP ${res.status})`);
    net = new Network(await res.json());
    return { generated: net.generated, sourceUpdated: net.sourceUpdated, dates: net.dates, stations: net.stations, outDeg: net.outDeg };
  },
  destinations: (a) => destinations(net, { ...a, di: net.dayIndex(a.date) }),
  journeys: (a) => journeys(net, { ...a, di: net.dayIndex(a.date) }),
  nextDates: (a) => nextDates(net, { ...a, di: net.dayIndex(a.date) }),
  nextRt(a) {
    const out = [], di0 = net.dayIndex(a.date);
    for (let di = di0 + 1; di < net.dates.length && out.length < 7; di++) {
      const plans = roundTrips(net, { ...a, di }).filter((p) => !a.only || p.items.some((i) => !i.altFrom));
      const items = plans.flatMap((p) => p.items).filter((i) => !a.only || !i.altFrom);
      if (items.length) out.push({ date: net.dates[di], n: items.length, first: items[0].out });
    }
    return out;
  },
  roundTrips: (a) => roundTrips(net, { ...a, di: net.dayIndex(a.date) }),
  alerts({ alerts, cfg }) {
    return alerts.map((al) => {
      const status = alertStatus(net, al);
      const matches = status.state === 'past' ? [] : evalAlert(net, al, cfg);
      return { id: al.id, status, matches };
    });
  },
  chat: (a) => answer(net, a.text, a.cfg, a.ctx),
};
self.onmessage = async (e) => {
  const { id, op, args } = e.data;
  try { self.postMessage({ id, ok: true, r: await ops[op](args) }); }
  catch (err) { self.postMessage({ id, ok: false, error: String(err && err.message || err) }); }
};
