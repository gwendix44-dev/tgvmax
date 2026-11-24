// Assistant de discussion : comprend une demande en français (dates, nombre de destinations, aller-retour,
// trains de nuit…) et l'exécute sur les vraies données de disponibilité, avec les mêmes règles que l'appli
// (correspondances ≥ réglage, gares alternatives, trains de nuit). Il n'invente ni train ni place.
import { destinations, journeys, roundTrips, cfgOf, DAY, fullDate } from './engine.js';
import { pretty, norm, km, fmtDur } from './stations.js';

const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const NUMS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
const CITY = {
  paris: 'PARIS (intramuros)', lyon: 'LYON (intramuros)', lille: 'LILLE (intramuros)', marseille: 'MARSEILLE ST CHARLES', nice: 'NICE VILLE', bordeaux: 'BORDEAUX ST JEAN',
  toulouse: 'TOULOUSE MATABIAU', montpellier: 'MONTPELLIER SAINT ROCH', nimes: 'NIMES CENTRE', avignon: 'AVIGNON CENTRE', dijon: 'DIJON VILLE', metz: 'METZ VILLE',
  mulhouse: 'MULHOUSE VILLE', besancon: 'BESANCON VIOTTE', valence: 'VALENCE VILLE', tours: 'TOURS', angers: 'ANGERS SAINT LAUD', poitiers: 'POITIERS', 'la rochelle': 'LA ROCHELLE VILLE',
  'saint nazaire': 'ST NAZAIRE', 'saint malo': 'ST MALO', 'saint brieuc': 'ST BRIEUC', 'saint etienne': 'SAINT ETIENNE CHATEAUCREUX', lourdes: 'LOURDES', bruxelles: 'BRUXELLES MIDI',
  fribourg: 'FREIBURG (BREISGAU) HBF', 'roissy': 'AEROPORT ROISSY CDG 2 TGV', cdg: 'AEROPORT ROISSY CDG 2 TGV', orleans: 'LES AUBRAIS ORLEANS', 'la baule': 'LA BAULE ESCOUBLAC',
};

function stationIndex(net) {
  const idx = new Map();
  for (const s of net.stations) {
    const k = norm(pretty(s).replace(/\(toutes gares\)/, ''));
    if (k) idx.set(k, s);
    const k2 = k.replace(/ (ville|tgv|centre)$/, ''); if (k2.length > 3 && !idx.has(k2)) idx.set(k2, s);
  }
  for (const [k, v] of Object.entries(CITY)) if (net.sid.has(v)) idx.set(k, v);
  return idx;
}

function findStations(t, idx) {
  const found = [];
  for (const [k, s] of idx) {
    let i = t.indexOf(' ' + k + ' ');
    while (i >= 0) { found.push({ k, s, i, end: i + k.length + 2 }); i = t.indexOf(' ' + k + ' ', i + 1); }
  }
  found.sort((a, b) => (b.end - b.i) - (a.end - a.i));
  const kept = [];
  for (const f of found) if (!kept.some((x) => f.i < x.end && f.end > x.i)) kept.push(f);
  return kept.sort((a, b) => a.i - b.i);
}

const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
function parseDate(raw, t, today) {
  let m;
  if ((m = t.match(/ (\d{1,2})(?:er)? (janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/))) {
    const mm = MONTHS.indexOf(m[2]) + 1; let y = +today.slice(0, 4);
    let iso = `${y}-${String(mm).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`; if (iso < today) iso = `${y + 1}${iso.slice(4)}`;
    return iso;
  }
  if ((m = raw.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/))) {
    let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : +today.slice(0, 4);
    let iso = `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`; if (!m[3] && iso < today) iso = `${y + 1}${iso.slice(4)}`;
    return iso;
  }
  if (/ apres demain /.test(t)) return addDays(today, 2);
  if (/ demain /.test(t)) return addDays(today, 1);
  if (/ aujourd hui | ce soir | ce matin /.test(t)) return today;
  const wd = WD.findIndex((d) => t.includes(' ' + d + ' ') || t.includes(' ' + d + 's '));
  if (wd >= 0) { const cur = new Date(today + 'T12:00:00Z').getUTCDay(); let n = (wd - cur + 7) % 7; if (n === 0) n = 7; return addDays(today, n); }
  if (/ week end | weekend /.test(t)) { const cur = new Date(today + 'T12:00:00Z').getUTCDay(); return addDays(today, (6 - cur + 7) % 7 || 7); }
  return null;
}

const draftOf = (from, to, date, j) => ({
  from, to, mode: 'date', date, timeMode: 'depart', from1: Math.max(0, (j.s % DAY) - 30), from2: Math.min(1439, (j.s % DAY) + 30), maxChanges: Math.max(0, j.changes), alts: true,
});

function diverse(list, getName, n, minKm = 60) {
  const out = [];
  for (const it of list) {
    if (out.length >= n) break;
    if (out.some((o) => km(getName(o), getName(it)) < minKm)) continue;
    out.push(it);
  }
  for (const it of list) { if (out.length >= n) break; if (!out.includes(it)) out.push(it); }
  return out;
}

export function answer(net, text, cfgIn, ctx = {}) {
  const cfg = cfgOf(cfgIn), raw = text.toLowerCase(), t = ' ' + norm(text) + ' ';
  const today = ctx.today || new Date().toISOString().slice(0, 10);
  const idx = stationIndex(net);
  const dateIso = parseDate(raw, t, today);
  const nM = t.match(/ (\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix) (?:destinations?|villes?|idees?|propositions?|options?|suggestions?|endroits?|lieux?)/);
  const count = nM ? (NUMS[nM[1]] || +nM[1]) : 3;
  const roundtrip = / aller retour | a r | dans la journee | meme jour | retour le soir | retour dans la journee /.test(t) || /a\/r/.test(raw);
  const nuM = t.match(/ (\d+|une|deux|trois) nuits? /); const nights = nuM && !/ de nuit /.test(t.slice(Math.max(0, nuM.index - 4), nuM.index + 4)) ? (NUMS[nuM[1]] || +nuM[1]) : 0;
  const stayM = t.match(/ (?:au moins|minimum|plus de|mini) (\d+) ?(?:h|heures?)/) || t.match(/ (\d+) ?(?:h|heures?) sur place /);
  const direct = / direct | directs | sans correspondance /.test(t);
  const nightOnly = / trains? de nuit | couchette | dormir dans le train /.test(t);
  const opts = { cfg, maxChanges: direct ? 0 : undefined, minStay: stayM ? +stayM[1] * 60 : undefined };

  // demande de création d'alerte à partir de la dernière proposition
  if (/ alerte /.test(t) && /(cree|creer|ajoute|ajouter|mets|mettre|active|programme|prevenir|previens)/.test(t) && ctx.last) {
    return { text: 'Voici une alerte prête à partir de ma dernière proposition. Vérifie-la puis enregistre-la.', cards: [], draft: ctx.last };
  }

  const st = findStations(t, idx);
  let from = cfg.home, to = null;
  for (const m of st) {
    const before = t.slice(Math.max(0, m.i - 22), m.i);
    if (/(depuis|au depart de|partant de|depart de|de) $/.test(before + ' ') && !/(vers|pour|a|jusqu) $/.test(before + ' ')) from = m.s; else to = m.s;
  }
  if (!st.length && /(destination|ville|ou aller|ou partir|idee)/.test(t) === false && !dateIso && !roundtrip) {
    return { text: 'Dis-moi par exemple : « Donne-moi trois destinations pour le 4 décembre, accessibles en 100 % TGV MAX, aller-retour dans la journée », ou « Nantes → Lyon vendredi, direct ».', cards: [] };
  }
  const date = dateIso || ctx.today && addDays(today, 1);
  if (!net.dates.includes(date)) {
    const where = date < net.dates[0] ? 'est passé' : 'n’est pas encore ouvert à la réservation';
    return { text: `Le ${fullDate(date)} ${where} : les données couvrent du ${fullDate(net.dates[0])} au ${fullDate(net.dates.at(-1))}${to && date > net.dates.at(-1) ? '. Je peux créer une alerte qui surveillera ce jour dès son ouverture.' : '.'}`,
      cards: [], draft: to && date > net.dates.at(-1) ? { from, to, mode: 'date', date, timeMode: 'depart', from1: 240, from2: 1439, maxChanges: 1, alts: true } : null };
  }
  const fromP = pretty(from), dLabel = fullDate(date);
  const filterNight = (js) => (nightOnly ? js.filter((j) => j.night) : js);

  // — Aller-retour
  if (roundtrip || nights) {
    let plans = roundTrips(net, { ...opts, from, date: undefined, di: net.dayIndex(date), nights, allowNight: nights ? true : cfg.allowNight });
    if (nightOnly) plans = plans.filter((p) => p.items.some((i) => i.out.night || i.back.night));
    if (to) plans = plans.filter((p) => p.x === net.id(to) || km(p.name, to) < 15);
    if (nights && !to) plans.sort((a, b) => km(from, b.name) - km(from, a.name));
    plans = to ? plans.slice(0, count) : diverse(plans, (p) => (typeof p === 'string' ? p : p.name), count);
    if (!plans.length) return { text: `Je n'ai trouvé aucun aller-retour ${nights ? `avec ${nights} nuit(s)` : 'dans la journée'} au départ de ${fromP} le ${dLabel} avec des places MAX sur tous les tronçons (correspondances ≥ ${cfg.minConn} min). Les places s'ouvrent jour après jour : je peux réessayer une autre date.`, cards: [] };
    const cards = plans.map((p) => { const it = p.items[0]; return { title: pretty(p.name), plan: it, draft: draftOf(from, p.name, date, it.out) }; });
    return { text: `${cards.length} destination${cards.length > 1 ? 's' : ''} faisable${cards.length > 1 ? 's' : ''} en 100 % TGV MAX, aller-retour ${nights ? `avec ${nights} nuit(s)` : 'dans la journée'}, au départ de ${fromP} le ${dLabel} :`, cards, last: cards[0].draft };
  }

  // — Trajet vers une destination précise
  if (to) {
    let js = filterNight(journeys(net, { cfg, from, to, di: net.dayIndex(date), depFrom: cfg.earliest, depTo: cfg.latest, nearby: 0, maxChanges: opts.maxChanges }));
    js.sort((a, b) => (a.altFrom || a.altTo ? 1 : 0) - (b.altFrom || b.altTo ? 1 : 0) || a.s - b.s);
    js = js.slice(0, count > 3 ? count : 4);
    if (!js.length) return { text: `Aucune place MAX ${fromP} → ${pretty(to)} le ${dLabel} (même avec correspondances et gares proches). Je peux créer une alerte pour être prévenu dès qu'une place s'ouvre.`, cards: [], draft: { from, to, mode: 'date', date, timeMode: 'depart', from1: 240, from2: 1439, maxChanges: 1, alts: true } };
    return { text: `${fromP} → ${pretty(to)}, ${dLabel} : ${js.length} option${js.length > 1 ? 's' : ''} avec places MAX sur chaque tronçon.`, cards: js.map((j) => ({ title: `${fmtDur(j.dur)} · ${j.changes ? j.changes + ' corr.' : 'direct'}`, journeys: [j], draft: draftOf(from, to, date, j) })), last: draftOf(from, to, date, js[0]) };
  }

  // — Destinations en aller simple
  let ds = destinations(net, { ...opts, from, di: net.dayIndex(date) });
  if (nightOnly) ds = ds.map((d) => ({ ...d, journeys: filterNight(d.journeys) })).filter((d) => d.journeys.length);
  ds = ds.filter((d) => d.fastest.dur >= 45).sort((a, b) => b.n - a.n || a.fastest.dur - b.fastest.dur);
  ds = diverse(ds, (d) => d.name, count);
  if (!ds.length) return { text: `Aucune destination avec places MAX au départ de ${fromP} le ${dLabel}.`, cards: [] };
  const cards = ds.map((d) => { const j = nightOnly ? d.journeys[0] : d.fastest; return { title: pretty(d.name), sub: d.viaAlt ? `au départ d'une gare proche` : '', journeys: [j], draft: draftOf(from, d.name, date, j) }; });
  return { text: `${cards.length} destination${cards.length > 1 ? 's' : ''} en aller simple au départ de ${fromP} le ${dLabel} (places MAX sur tous les tronçons) :`, cards, last: cards[0].draft };
}
