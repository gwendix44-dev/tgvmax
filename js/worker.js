// Calculs lourds hors du fil principal : chargement du snapshot, recherches, alertes, chat.
import { Network, destinations, journeys, roundTrips, evalAlert, alertStatus, DAY } from './engine.js';
import { answer } from './chat.js';

let net = null;
const ops = {
  async init({ url }) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Données indisponibles (HTTP ${res.status})`);
    net = new Network(await res.json());
    return { generated: net.generated, dates: net.dates, stations: net.stations, outDeg: net.outDeg };
  },
  destinations: (a) => destinations(net, { ...a, di: net.dayIndex(a.date) }),
  journeys: (a) => journeys(net, { ...a, di: net.dayIndex(a.date) }),
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
