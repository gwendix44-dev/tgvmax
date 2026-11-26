// Application TGV MAX : vues, état local (aucun compte), appels au worker de calcul.
import { h, icon, toast, openSheet, pickStation, dateStrip, journeyCard } from './ui.js';
import { pretty, fmtTime, fmtDur, COORDS, OUTLINE, km, TER } from './stations.js';
import { DEFAULTS } from './engine.js';
import { enablePush, pushState, syncToRepo, repoGuess } from './sync.js';
import { randomSecret } from './crypto.js';

// ---------- État persistant (localStorage) ----------
const KEY = 'tgvmax:v1';
const uid = () => Math.random().toString(36).slice(2, 10);
const loadS = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const S = { alerts: [], favs: { places: [], routes: [] }, history: [], seen: {}, gh: { repo: repoGuess(), token: '', secret: '' }, lastSync: null, syncErr: null, unread: 0, ...loadS() };
S.settings = { ...DEFAULTS, ...(S.settings || {}) }; S.deviceId ||= uid() + uid();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

// ---------- Exécution (non persistant) ----------
const R = { tab: 'trip', meta: null, err: null, alertRes: {}, push: 'off', chat: [], lastDraft: null, sub: null };
const D = { date: null, mode: 'one', depFrom: null, depTo: null, maxChanges: null, maxDur: 0, night: true, view: 'list', res: null, loading: false, err: null, from: null, tok: 0 };
const T = { from: null, to: null, date: null, tmode: 'depart', t1: null, t2: null, maxChanges: null, sort: 'time', res: null, loading: false, err: null, tok: 0 };

const worker = new Worker('js/worker.js', { type: 'module' });
const pend = new Map(); let seq = 0;
worker.onmessage = (e) => { const p = pend.get(e.data.id); if (!p) return; pend.delete(e.data.id); e.data.ok ? p.res(e.data.r) : p.rej(new Error(e.data.error)); };
const rpc = (op, args) => new Promise((res, rej) => { const id = ++seq; pend.set(id, { res, rej }); worker.postMessage({ id, op, args }); });

const parisNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
};
const toMin = (v) => { const [a, b] = v.split(':').map(Number); return a * 60 + b; };
const toHM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fmtDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtShort = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const name = (s) => pretty(s);
const stale = () => R.meta && Date.now() - Date.parse(R.meta.sourceUpdated || R.meta.generated) > 36 * 3600e3;

// ---------- Squelette ----------
const app = document.getElementById('app');
const TABS = [['trip', 'Trajets', 'route'], ['dest', 'Destinations', 'map'], ['alerts', 'Alertes', 'bell'], ['chat', 'Assistant', 'chat'], ['more', 'Plus', 'more']];
function render() {
  const top = h('header', { class: 'top' }, h('h1', {}, 'TGV MAX'), R.meta && h('span', { class: 'fresh' + (stale() ? ' stale' : '') },
    `Données SNCF du ${new Date(R.meta.sourceUpdated || R.meta.generated).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${stale() ? ' · mise à jour en retard' : ''}`));
  const main = h('main');
  if (R.meta && !S.settings.homeSet && !R.err) { app.replaceChildren(top, welcome()); return; }
  if (R.err) main.append(h('div', { class: 'card' }, h('b', {}, 'Données indisponibles'), h('p', { class: 'muted' }, R.err), h('button', { class: 'btn primary', onclick: boot }, 'Réessayer')));
  else if (!R.meta) main.append(h('div', { class: 'empty' }, h('span', { class: 'spin' }), ' Chargement des places MAX…'));
  else main.append(({ dest: viewDest, trip: viewTrip, alerts: viewAlerts, chat: viewChat, more: viewMore })[R.tab]());
  const nav = h('nav', { class: 'tabs' }, TABS.map(([k, l, ic]) => h('button', { class: R.tab === k ? 'on' : '', onclick: () => go(k) }, icon(ic), l, k === 'alerts' && S.unread > 0 && h('span', { class: 'badge' }, S.unread))));
  const st = main.scrollTop;
  app.replaceChildren(top, main, nav);
  if (R.keepScroll) main.scrollTop = R.keepScroll; else if (R.tab === 'chat') main.scrollTop = main.scrollHeight;
  R.keepScroll = 0; void st;
}
function go(tab) { R.tab = tab; if (tab === 'alerts' && S.unread) { S.unread = 0; save(); } render(); }
const rerender = () => { const m = document.querySelector('main'); R.keepScroll = m ? m.scrollTop : 0; render(); };

// ---------- Écran d'accueil : ville de départ ----------
function welcome() {
  const choose = (st) => { S.settings.home = st; S.settings.homeSet = true; D.from = null; T.from = null; D.res = null; T.res = null; save(); render(); };
  const quick = ['NANTES', 'RENNES', 'ANGERS SAINT LAUD', 'PARIS (intramuros)', 'LYON (intramuros)', 'BORDEAUX ST JEAN', 'LILLE (intramuros)', 'TOULOUSE MATABIAU', 'MARSEILLE ST CHARLES', 'STRASBOURG', 'MONTPELLIER SAINT ROCH', 'NICE VILLE'].filter((x) => R.meta.stations.includes(x));
  return h('main', {}, h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, 'Bienvenue 👋'),
    h('p', {}, 'Où habites-tu ? Ta gare de départ sert de référence : l’appli cherche d’abord les places MAX au départ de cette gare. Des gares de secours (TER direct de 1 h 30 maximum) ne sont proposées qu’à défaut.'),
    h('div', { class: 'chips', style: 'flex-wrap:wrap;gap:8px;margin:10px 0' }, quick.map((x) => h('button', { class: 'btn', onclick: () => choose(x) }, name(x)))),
    h('button', { class: 'btn primary', onclick: () => pickFrom(S.settings.home, choose) }, 'Autre gare…'),
    h('p', { class: 'tiny muted' }, 'Tu pourras la changer à tout moment dans Plus → Réglages.')));
}

// ---------- Source des données ----------
const PLANNER = 'https://www.maxjeune-tgvinoui.sncf/sncf-connect/max-planner';
const sourceNote = () => h('div', { class: 'tiny muted', style: 'margin:10px 2px' }, 'Données officielles MAX JEUNE de la SNCF, publiées une fois par jour en début de matinée. Des places sont ajoutées ou prises ensuite dans la journée et les OUIGO n’y figurent pas : la liste peut différer de SNCF Connect, qui est en temps réel. Avant de réserver, vérifie dans le ', h('a', { href: PLANNER, target: '_blank', rel: 'noopener' }, 'Max Planner'), '.');

// ---------- Aides communes ----------
const pickFrom = (cur, cb) => pickStation(R.meta.stations.filter((_, i) => R.meta.outDeg[i] > 0), R.meta.outDeg.filter((d) => d > 0), cur, cb, 'Gare de départ');
const pickAny = (cur, cb, t) => pickStation(R.meta.stations, R.meta.outDeg, cur, cb, t);
const field = (label, ...c) => h('label', { class: 'field' }, label, ...c);
const timeIn = (val, on) => h('input', { type: 'time', value: toHM(val), onchange: (e) => e.target.value && on(toMin(e.target.value)) });
const picker = (lab, val, on) => h('button', { class: 'picker', onclick: on }, h('span', { class: 'lab' }, lab), h('span', { class: 'val' }, val));
const sel = (opts, val, on) => h('select', { class: 'sel', onchange: (e) => on(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(val) }, l)));
const chip = (t, c = '') => h('span', { class: 'chip ' + c }, t);
const effFrom = (date, v) => { const n = parisNow(); return date === n.date ? Math.max(v, n.min + 10) : v; };
const firstDate = () => { const n = parisNow().date; return R.meta.dates.includes(n) ? n : (R.meta.dates.find((d) => d >= n) || R.meta.dates[0]); };
const chgOpts = [[0, 'Direct'], [1, '1 corr. max'], [2, '2 corr. max'], [3, '3 corr. max']];
const favHas = (kind, v) => (kind === 'place' ? S.favs.places.includes(v) : S.favs.routes.some((r) => r.from === v.from && r.to === v.to));
function toggleFav(kind, v) {
  if (kind === 'place') S.favs.places = favHas('place', v) ? S.favs.places.filter((x) => x !== v) : [...S.favs.places, v];
  else S.favs.routes = favHas('route', v) ? S.favs.routes.filter((r) => !(r.from === v.from && r.to === v.to)) : [...S.favs.routes, v];
  save();
}
const alertBtn = (draft) => h('button', { class: 'btn sm', onclick: () => alertForm(null, draft) }, 'Créer une alerte');

// ---------- Destinations ----------
function viewDest() {
  D.date ||= firstDate(); D.from ||= S.settings.home; D.depFrom ??= S.settings.earliest; D.depTo ??= S.settings.latest; D.maxChanges ??= S.settings.maxChanges;
  const MODES = [['one', 'Aller simple'], ['rt', 'A/R journée'], ['rt1', 'A/R 1 nuit'], ['rt2', 'A/R 2 nuits'], ['rtn', 'Nuit + journée']];
  D.minStay ??= S.settings.minStay; D.only ??= true;
  const el = h('div', {},
    h('div', { class: 'row' }, h('div', { class: 'grow' }, picker('Départ', name(D.from), () => pickFrom(D.from, (s) => { D.from = s; runDest(); }))),
      h('button', { class: 'btn', onclick: () => { D.from = S.settings.home; runDest(); } }, name(S.settings.home))),
    h('div', { class: 'sp' }),
    h('div', { class: 'seg' }, MODES.map(([k, l]) => h('button', { class: D.mode === k ? 'on' : '', onclick: () => { D.mode = k; runDest(); } }, l))),
    dateStrip(R.meta.dates, D.date, (d) => { D.date = d; runDest(); }),
    h('div', { class: 'card flat' },
      h('div', { class: 'row wrap' },
        field('Départ dès', timeIn(D.depFrom, (v) => { D.depFrom = v; runDest(); })), field('Départ avant', timeIn(D.depTo, (v) => { D.depTo = v; runDest(); })),
        field('Correspondances', sel(chgOpts, D.maxChanges, (v) => { D.maxChanges = +v; runDest(); })),
        field('Durée max', sel([[0, 'Toutes'], [120, '2 h'], [180, '3 h'], [240, '4 h'], [360, '6 h'], [480, '8 h']], D.maxDur, (v) => { D.maxDur = +v; rerender(); }))),
      D.mode === 'rtn' && h('div', { class: 'small muted', style: 'margin-top:8px' }, 'Départ le soir en train de nuit, journée sur place, retour en train de nuit le soir même, de retour chez toi le lendemain avant 14 h 30. Aucune nuit d’hôtel.'),
      D.mode !== 'one' && D.mode !== 'rtn' && h('div', { class: 'row wrap', style: 'margin-top:8px' }, field('Temps min. sur place', sel(STAY, D.minStay, (v) => { D.minStay = +v; runDest(); }))),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'small grow' }, `Départ uniquement de ${name(D.from)}`), h('input', { type: 'checkbox', class: 'switch', checked: D.only, onchange: (e) => { D.only = e.target.checked; D.showAlt = false; rerender(); } })),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'small grow' }, 'Inclure les trains de nuit'), h('input', { type: 'checkbox', class: 'switch', checked: D.night, onchange: (e) => { D.night = e.target.checked; runDest(); } }))),
    h('div', { class: 'row', style: 'margin:6px 0' }, h('div', { class: 'seg grow' }, [['list', 'Liste'], ['map', 'Carte']].map(([k, l]) => h('button', { class: D.view === k ? 'on' : '', onclick: () => { D.view = k; rerender(); } }, l)))),
    destResults());
  if (!D.res && !D.loading && !D.err) setTimeout(runDest, 0);
  return el;
}
const STAY = [[60, '1 h'], [120, '2 h'], [180, '3 h'], [240, '4 h'], [360, '6 h'], [480, '8 h']];
// Paramètres des modes aller-retour (nuit + journée : départ la veille en train de nuit, retour le lendemain midi)
const rtOpts = (mode, minStay) => (mode === 'rtn' ? { nights: 1, nightOut: true, depFrom: 720, backFrom: 960, allowNight: true, minStay: 360 }
  : { nights: { rt: 0, rt1: 1, rt2: 2 }[mode], minStay });
async function runDest() {
  const tok = ++D.tok; D.loading = true; D.err = null; rerender();
  try {
    const base = { from: D.from, date: D.date, cfg: S.settings, depFrom: effFrom(D.date, D.depFrom), depTo: D.depTo, allowNight: D.night };
    const r = D.mode === 'one' ? await rpc('destinations', { ...base, maxChanges: D.maxChanges, maxDur: D.maxDur || undefined })
      : await rpc('roundTrips', { ...base, ...rtOpts(D.mode, D.minStay), maxChanges: Math.min(D.maxChanges, 2) });
    if (tok !== D.tok) return; D.res = r;
  } catch (e) { if (tok !== D.tok) return; D.err = e.message; }
  D.loading = false; rerender();
}
function destResults() {
  if (D.loading) return h('div', { class: 'empty' }, h('span', { class: 'spin' }), ' Recherche en cours…');
  if (D.err) return h('div', { class: 'card' }, D.err);
  let res = D.res || [];
  if (D.mode !== 'one' && D.maxDur) res = res.filter((p) => p.items.some((i) => i.out.dur <= D.maxDur && i.back.dur <= D.maxDur));
  if (!res.length) return h('div', { class: 'empty' }, D.mode === 'one' ? 'Aucune place MAX à cette date avec ces critères.' : 'Aucun aller-retour avec places MAX sur tous les tronçons. Essaie une autre date, plus de correspondances ou un temps sur place plus court (Plus → Réglages).');
  const info = h('div', { class: 'small muted', style: 'margin:2px 2px 6px' }, `${res.length} destination${res.length > 1 ? 's' : ''} · ${fmtDay(D.date)}`);
  if (D.view === 'map') return [info, mapView(D.only && !D.showAlt ? res.filter((r) => (D.mode === 'one' ? !r.viaAlt : !r.items.every((i) => i.altFrom))) : res)];
  const seeBtn = (n, on) => h('div', { class: 'banner' }, h('span', {}, `${n} autre${n > 1 ? 's' : ''} destination${n > 1 ? 's' : ''} disponible${n > 1 ? 's' : ''} depuis d’autres gares. `), h('a', { href: '#', onclick: (e) => { e.preventDefault(); D.showAlt = true; rerender(); } }, on));
  if (D.mode !== 'one') {
    const isAlt = (p) => p.items.every((i) => i.altFrom), main = res.filter((p) => !isAlt(p)), alt = res.filter(isAlt);
    if (!D.only) return [info, ...res.map(rtRow), sourceNote()];
    return [info, ...(main.length ? main.map(rtRow) : [h('div', { class: 'empty' }, `Aucun aller-retour au départ de ${name(D.from)} avec ces critères.`)]),
      alt.length > 0 && !D.showAlt && seeBtn(alt.length, 'Voir'), ...(D.showAlt ? [h('h2', {}, `Depuis d’autres gares · ${alt.length}`), ...alt.map(rtRow)] : []), sourceNote()];
  }
  const main = res.filter((r) => !r.viaAlt), alt = res.filter((r) => r.viaAlt);
  if (D.only) return [info, main.length ? h('h2', {}, `Depuis ${name(D.from)} · ${main.length}`) : h('div', { class: 'empty' }, `Aucune place MAX au départ de ${name(D.from)} ce jour-là.`), ...main.map(destRow),
    alt.length > 0 && !D.showAlt && seeBtn(alt.length, 'Voir'),
    ...(D.showAlt ? [h('h2', {}, `Depuis d’autres gares · ${alt.length}`), ...alt.map(destRow)] : []), sourceNote()];
  const altName = alt.length ? name(R.meta.stations[alt[0].fastest.legs[0].o]) : '';
  return [info, main.length > 0 && h('h2', {}, `Depuis ${name(D.from)} · ${main.length}`), ...main.map(destRow),
    alt.length > 0 && h('h2', {}, `Pas de place depuis ${name(D.from)} — au départ d’une gare proche · ${alt.length}`),
    alt.length > 0 && h('div', { class: 'tiny muted', style: 'margin:0 2px 6px' }, `Ces destinations n’ont aucun train MAX au départ de ${name(D.from)} ce jour-là, mais en ont depuis ${altName} ou une autre gare accessible en TER direct (trajet jusqu’à la gare indiqué sur chaque fiche).`),
    ...alt.map(destRow), sourceNote()];
}
function destRow(r) {
  const f = r.fastest;
  return h('button', { class: 'item', onclick: () => destSheet(r) },
    h('div', { class: 'row' }, h('div', { class: 't grow' }, name(r.name)), h('span', { class: 'muted small times' }, fmtDur(f.dur))),
    r.others?.length > 0 && h('div', { class: 's' }, `ou ${r.others.map(name).join(', ')}`),
    h('div', { class: 's' }, `${fmtTime(f.s)} → ${fmtTime(f.e)}${r.n > 1 ? ` · ${r.n} horaires` : ''}`),
    h('div', { class: 'chips' }, f.changes ? chip(`${f.changes} corr.`, 'warn') : chip('Direct', 'ok'), r.journeys.some((j) => j.night) && chip('Nuit', 'night'), r.viaAlt && chip(`Depuis ${name(R.meta.stations[f.legs[0].o])}`, 'gray'),
      favHas('place', r.name) && chip('★ Favori', 'gray')));
}
function rtRow(p) {
  const it = p.items.reduce((m, i) => (i.stay > m.stay ? i : m), p.items[0]);
  const ch = it.out.changes + it.back.changes;
  return h('button', { class: 'item', onclick: () => rtSheet(p) },
    h('div', { class: 'row' }, h('div', { class: 't grow' }, name(p.name)), h('span', { class: 'chip ok' }, `${fmtDur(it.stay)} sur place`)),
    h('div', { class: 's' }, `Aller ${fmtTime(it.out.s)} → ${fmtTime(it.out.e)} · Retour ${fmtTime(it.back.s)} → ${fmtTime(it.back.e)}`),
    h('div', { class: 'chips' }, chip(ch ? `${ch} corr. au total` : 'Tout en direct', ch ? 'warn' : 'ok'), (it.out.night || it.back.night) && chip('Nuit', 'night'), it.plan === 'rtn' ? chip('Journée sur place · 0 hébergement', 'gray') : it.nights > 0 && chip(`${it.nights} nuit${it.nights > 1 ? 's' : ''} sur place`, 'gray'), it.altFrom && chip('Gare de départ proche', 'gray')));
}
const dedupeJ = (list) => list;
function destSheet(r) {
  const star = h('button', { class: 'btn sm', onclick: () => { toggleFav('place', r.name); star.textContent = favHas('place', r.name) ? '★ Favori' : '☆ Favori'; } }, favHas('place', r.name) ? '★ Favori' : '☆ Favori');
  const draft = (j) => ({ from: D.from, to: r.name, mode: 'date', date: D.date, timeMode: 'depart', from1: Math.max(0, (j.s % 1440) - 30), from2: Math.min(1439, (j.s % 1440) + 30), maxChanges: j.changes, alts: true });
  openSheet(name(r.name), [h('div', { class: 'row', style: 'margin:0 0 4px' }, h('span', { class: 'muted small grow' }, `${fmtDay(D.date)} · ${r.n} option${r.n > 1 ? 's' : ''}`), star,
    h('button', { class: 'btn sm', onclick: () => { T.from = D.from; T.to = r.name; T.date = D.date; T.res = null; R.tab = 'trip'; document.querySelector('.backdrop')?.remove(); render(); } }, 'Voir dans Trajets')),
  ...dedupeJ(r.journeys).slice(0, 30).map((j) => journeyCard(j, R.meta, { actions: [alertBtn(draft(j))] }))]);
}
function rtSheet(p) {
  const kids = [h('div', { class: 'muted small', style: 'margin-bottom:6px' }, `${fmtDay(D.date)} · retour ${p.items[0].plan === 'rtn' ? 'en train de nuit le soir même' : p.items[0].nights ? `après ${p.items[0].nights} nuit(s)` : 'le soir même'}`)];
  p.items.forEach((it, i) => {
    kids.push(h('h2', {}, i === 0 ? 'Plus de temps sur place' : 'Le plus rapide'), h('div', { class: 'row wrap' }, chip(`${fmtDur(it.stay)} sur place`, 'ok'), chip(`${fmtDur(it.travel)} de train au total`, 'gray')),
      journeyCard(it.out, R.meta, { title: 'Aller', actions: [alertBtn({ from: D.from, to: p.name, mode: 'date', date: D.date, timeMode: 'depart', from1: Math.max(0, (it.out.s % 1440) - 30), from2: Math.min(1439, (it.out.s % 1440) + 30), maxChanges: it.out.changes, alts: true })] }),
      journeyCard(it.back, R.meta, { title: 'Retour' }));
  });
  openSheet(name(p.name), kids);
}

// Carte vectorielle légère (aucun fond de carte externe)
function mapView(res) {
  const NS = 'http://www.w3.org/2000/svg', k = 54.9;
  const X = (lon) => (lon + 5.2) * 0.688 * k + 20, Y = (lat) => (51.4 - lat) * k + 20;
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'map');
  const vb = { x: 0, y: 0, w: 600, h: 600 }; const setVB = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); setVB();
  const mk = (t, a, txt) => { const e = document.createElementNS(NS, t); for (const [x, v] of Object.entries(a)) e.setAttribute(x, v); if (txt) e.textContent = txt; return e; };
  svg.append(mk('polygon', { class: 'land', points: OUTLINE.map(([la, lo]) => `${X(lo)},${Y(la)}`).join(' ') }));
  const durOf = (r) => (D.mode === 'one' ? r.fastest.dur : Math.max(...r.items.map((i) => i.out.dur)));
  const pts = res.filter((r) => COORDS[r.name]); const ds = pts.map(durOf), lo = Math.min(...ds), hi = Math.max(...ds);
  const top = new Set([...pts].sort((a, b) => (b.n || b.items?.length || 1) - (a.n || a.items?.length || 1)).slice(0, 40).map((r) => r.name));
  const labels = [], placed = [];
  const home = COORDS[D.from];
  if (home) { svg.append(mk('circle', { cx: X(home[1]), cy: Y(home[0]), r: 8, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 })); labels.push(mk('text', { x: X(home[1]) + 10, y: Y(home[0]) + 4 }, name(D.from))); }
  for (const r of pts) {
    const c = COORDS[r.name], t = hi > lo ? (durOf(r) - lo) / (hi - lo) : 0;
    const dot = mk('circle', { class: 'pt', cx: X(c[1]), cy: Y(c[0]), r: 6, fill: `hsl(${Math.round(140 * (1 - t))} 70% 42%)` });
    dot.addEventListener('click', () => (D.mode === 'one' ? destSheet(r) : rtSheet(r)));
    svg.append(dot);
    const px = X(c[1]), py = Y(c[0]);
    if (top.has(r.name) && !placed.some(([qx, qy]) => Math.abs(qx - px) < 62 && Math.abs(qy - py) < 13) && placed.length < 14) { placed.push([px, py]); labels.push(mk('text', { x: px + 8, y: py + 3 }, name(r.name))); }
  }
  labels.forEach((l) => svg.append(l));
  let drag = null;
  svg.addEventListener('pointerdown', (e) => { if (e.target.tagName === 'circle') return; drag = { x: e.clientX, y: e.clientY }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove', (e) => { if (!drag) return; const sc = vb.w / svg.clientWidth; vb.x -= (e.clientX - drag.x) * sc; vb.y -= (e.clientY - drag.y) * sc; drag = { x: e.clientX, y: e.clientY }; setVB(); });
  svg.addEventListener('pointerup', () => { drag = null; });
  const zoom = (f) => { const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2; vb.w = Math.min(600, Math.max(80, vb.w * f)); vb.h = vb.w; vb.x = cx - vb.w / 2; vb.y = cy - vb.h / 2; setVB(); };
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });
  return h('div', {}, svg,
    h('div', { class: 'row', style: 'margin:6px 0' }, h('div', { class: 'legend grow' }, fmtDur(lo), h('i'), fmtDur(hi)), h('button', { class: 'btn sm', onclick: () => zoom(0.7) }, '＋'), h('button', { class: 'btn sm', onclick: () => zoom(1.4) }, '－')),
    h('div', { class: 'tiny muted' }, 'Couleur = durée du trajet. Touche un point pour voir les horaires.'));
}

// ---------- Trajets (de A à B) ----------
function viewTrip() {
  T.date ||= firstDate(); T.from ||= S.settings.home; T.to ||= 'PARIS (intramuros)'; T.t1 ??= S.settings.earliest; T.t2 ??= 780; T.only ??= true; T.maxChanges ??= S.settings.maxChanges;
  const arrive = T.tmode === 'arrive';
  const route = { from: T.from, to: T.to };
  const el = h('div', {},
    h('div', { class: 'row' }, h('div', { class: 'grow' }, picker('Départ', name(T.from), () => pickFrom(T.from, (s) => { T.from = s; runTrip(); }))),
      h('button', { class: 'btn', onclick: () => { [T.from, T.to] = [T.to, T.from]; runTrip(); }, 'aria-label': 'Inverser' }, icon('swap')),
      h('div', { class: 'grow' }, picker('Arrivée', name(T.to), () => pickAny(T.to, (s) => { T.to = s; runTrip(); }, 'Gare d’arrivée')))),
    h('div', { class: 'seg', style: 'margin-top:8px' }, [['one', 'Aller simple'], ['rt', 'A/R journée'], ['rt1', 'A/R 1 nuit'], ['rtn', 'Nuit + journée']].map(([k, l]) => h('button', { class: (T.rt || 'one') === k ? 'on' : '', onclick: () => { T.rt = k; runTrip(); } }, l))),
    (T.rt || 'one') !== 'one' && T.rt !== 'rtn' && h('div', { class: 'row', style: 'margin-top:6px' }, field('Temps min. sur place', sel(STAY, T.minStay ?? S.settings.minStay, (v) => { T.minStay = +v; runTrip(); }))),
    T.rt === 'rtn' && h('div', { class: 'small muted', style: 'margin:6px 2px' }, 'Départ le soir en train de nuit, journée sur place, retour en train de nuit le soir même, de retour chez toi le lendemain avant 14 h 30. Aucune nuit d’hôtel. La date choisie est celle du départ.'),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'small grow' }, `Départ uniquement de ${name(T.from)}`), h('input', { type: 'checkbox', class: 'switch', checked: T.only, onchange: (e) => { T.only = e.target.checked; T.showAlt = false; rerender(); } })),
    dateStrip(R.meta.dates, T.date, (d) => { T.date = d; runTrip(); }),
    h('div', { class: 'card flat' },
      h('div', { class: 'seg' }, [['depart', 'Je pars entre'], ['arrive', 'Je veux arriver entre']].map(([k, l]) => h('button', { class: T.tmode === k ? 'on' : '', onclick: () => { T.tmode = k; if (k === 'arrive' && T.t2 < 300) T.t2 = 780; runTrip(); } }, l))),
      h('div', { class: 'row wrap', style: 'margin-top:10px' }, field(arrive ? 'Pas avant' : 'Départ dès', timeIn(arrive ? (T.a1 ?? Math.max(0, T.t2 - 180)) : T.t1, (v) => { if (arrive) T.a1 = v; else T.t1 = v; runTrip(); })),
        field(arrive ? 'Au plus tard' : 'Départ avant', timeIn(T.t2, (v) => { T.t2 = v; if (arrive) T.a1 = null; runTrip(); })), field('Correspondances', sel(chgOpts, T.maxChanges, (v) => { T.maxChanges = +v; runTrip(); })))),
    h('div', { class: 'row', style: 'margin:6px 0' }, h('div', { class: 'seg grow' }, [['time', 'Par heure'], ['dur', 'Plus rapide'], ['chg', 'Moins de corr.']].map(([k, l]) => h('button', { class: T.sort === k ? 'on' : '', onclick: () => { T.sort = k; rerender(); } }, l))),
      h('button', { class: 'btn', onclick: () => { toggleFav('route', route); rerender(); }, 'aria-label': 'Favori' }, favHas('route', route) ? '★' : '☆')),
    tripResults());
  if (!T.res && !T.loading && !T.err) setTimeout(runTrip, 0);
  return el;
}
async function runTrip() {
  const tok = ++T.tok; T.loading = true; T.err = null; rerender();
  try {
    const arrive = T.tmode === 'arrive';
    const a = { from: T.from, to: T.to, date: T.date, cfg: S.settings, maxChanges: T.maxChanges, nearby: S.settings.nearby };
    if (arrive) { a.arrFrom = T.a1 ?? Math.max(0, T.t2 - 180); a.arrTo = T.t2; a.depFrom = S.settings.earliest; a.depTo = 1439; } else { a.depFrom = effFrom(T.date, T.t1); a.depTo = T.t2; }
    if (T.rt && T.rt !== 'one') {
      const rr = await rpc('roundTrips', { from: T.from, to: T.to, date: T.date, cfg: S.settings, maxChanges: Math.min(T.maxChanges, 2), depFrom: a.depFrom, depTo: arrive ? 1439 : T.t2, ...rtOpts(T.rt, T.minStay ?? S.settings.minStay) });
      if (tok !== T.tok) return; T.rtres = rr; T.res = []; T.next = null; T.loading = false; rerender();
      if (!rr.some((p) => p.items.some((i) => !T.only || !i.altFrom))) { const o = { from: T.from, to: T.to, date: T.date, cfg: S.settings, maxChanges: Math.min(T.maxChanges, 2), depFrom: S.settings.earliest, depTo: 1439, only: T.only, ...rtOpts(T.rt, T.minStay ?? S.settings.minStay) }; rpc('nextRt', o).then((n) => { if (tok === T.tok) { T.next = n; rerender(); } }).catch(() => {}); }
      return;
    }
    const r = await rpc('journeys', a); if (tok !== T.tok) return; T.res = r; T.next = null;
    if (!r.some((j) => j.delta === 0)) { rpc('nextDates', { ...a, depFrom: arrive ? S.settings.earliest : T.t1, nearby: 0 }).then((n) => { if (tok === T.tok) { T.next = n; rerender(); } }).catch(() => {}); }
  } catch (e) { if (tok !== T.tok) return; T.err = e.message; }
  T.loading = false; rerender();
}
function tripResults() {
  const nextBox = () => (T.next === null ? h('div', { class: 'small muted', style: 'margin:6px 0' }, h('span', { class: 'spin' }), ' Recherche des prochaines dates…')
    : h('div', { class: 'card flat' }, h('div', { class: 'small', style: 'margin-bottom:6px' }, T.next && T.next.length ? 'Prochaines dates avec des places MAX :' : 'Aucune place MAX sur les jours déjà ouverts à la réservation.'),
      ...(T.next || []).map((n) => h('button', { class: 'item', onclick: () => { T.date = n.date; runTrip(); } }, h('div', { class: 't' }, fmtDay(n.date)), h('div', { class: 's' }, `${n.n} trajet${n.n > 1 ? 's' : ''} · dès ${fmtTime(n.first.s)} → ${fmtTime(n.first.e)}`)))));
  const seeLink = (n) => h('div', { class: 'banner' }, h('span', {}, `${n} trajet${n > 1 ? 's' : ''} disponible${n > 1 ? 's' : ''} depuis ou vers d’autres gares. `), h('a', { href: '#', onclick: (e) => { e.preventDefault(); T.showAlt = true; rerender(); } }, 'Voir'));
  if (T.loading) return h('div', { class: 'empty' }, h('span', { class: 'spin' }), ' Recherche en cours…');
  if (T.err) return h('div', { class: 'card' }, T.err);
  if (T.rt && T.rt !== 'one') {
    const plans = T.rtres || [];
    const all = plans.flatMap((p) => p.items).sort((x, y) => y.stay - x.stay);
    const its = T.only && !T.showAlt ? all.filter((i) => !i.altFrom) : all, hid = all.length - its.length;
    if (!its.length) return [h('div', { class: 'empty' }, 'Aucun aller-retour avec places MAX sur tous les tronçons à cette date.'), hid > 0 && seeLink(hid), nextBox()];
    return [h('div', { class: 'small muted', style: 'margin:2px 2px 6px' }, `${name(T.from)} ⇄ ${name(T.to)} · ${fmtDay(T.date)} · ${its.length} option${its.length > 1 ? 's' : ''}`),
      ...its.slice(0, 12).map((it) => h('div', { class: 'card flat' }, h('div', { class: 'row wrap' }, chip(`${fmtDur(it.stay)} sur place`, 'ok'), chip(`${fmtDur(it.travel)} de train`, 'gray'), (it.out.night || it.back.night) && chip('Nuit', 'night')),
        journeyCard(it.out, R.meta, { title: 'Aller' }), journeyCard(it.back, R.meta, { title: 'Retour' }))), hid > 0 && seeLink(hid), sourceNote()];
  }
  let js = T.res || [];
  const isAlt = (j) => j.altFrom || j.altTo;
  const hideAlt = T.only && !T.showAlt, hiddenN = hideAlt ? js.filter(isAlt).length : 0;
  if (hideAlt) js = js.filter((j) => !isAlt(j));
  const cmp = { time: (a, b) => a.s - b.s, dur: (a, b) => a.dur - b.dur || a.s - b.s, chg: (a, b) => a.changes - b.changes || a.s - b.s }[T.sort];
  const exact = js.filter((j) => j.delta === 0 && !isAlt(j)).sort(cmp), alt = js.filter((j) => j.delta === 0 && isAlt(j)).sort(cmp), near = js.filter((j) => j.delta > 0).sort((a, b) => a.delta - b.delta || a.s - b.s);
  const draft = { from: T.from, to: T.to, mode: 'date', date: T.date, timeMode: T.tmode, from1: T.t1, from2: T.t2, to1: T.a1 ?? Math.max(0, T.t2 - 180), to2: T.t2, maxChanges: T.maxChanges, alts: true };
  const out = [];
  out.push(h('div', { class: 'row', style: 'margin:2px 0 4px' }, h('span', { class: 'small muted grow' }, `${name(T.from)} → ${name(T.to)} · ${fmtDay(T.date)}`), alertBtn(draft)));
  if (!js.length && hiddenN) { out.push(h('div', { class: 'empty' }, `Aucune place MAX au départ de ${name(T.from)} sur ce créneau.`), seeLink(hiddenN), nextBox()); return out; }
  if (!js.length) { out.push(h('div', { class: 'empty' }, 'Aucune place MAX, même avec correspondances, gares proches et ±' + fmtDur(S.settings.nearby) + '. Crée une alerte pour être prévenu dès qu’une place s’ouvre.'), nextBox()); return out; }
  if (exact.length) out.push(h('h2', {}, `Dans ton créneau · ${exact.length}`), ...exact.slice(0, 25).map((j) => journeyCard(j, R.meta)));
  else out.push(h('div', { class: 'banner warn' }, 'Rien dans ton créneau exact.'), nextBox());
  if (hiddenN && exact.length) out.push(seeLink(hiddenN));
  if (alt.length) out.push(h('h2', {}, `Depuis / vers une gare proche · ${alt.length}`), ...alt.slice(0, 12).map((j) => journeyCard(j, R.meta)));
  if (near.length) out.push(h('h2', {}, `Alternatives proches (± ${fmtDur(S.settings.nearby)}) · ${near.length}`), ...near.slice(0, 12).map((j) => journeyCard(j, R.meta, { dim: true })));
  out.push(sourceNote());
  return out;
}

// ---------- Alertes ----------
const dayText = (a) => (a.mode === 'date' ? fmtShort(a.date) : a.weekday === -1 ? 'tous les jours' : `chaque ${WD[a.weekday]}`);
const slotText = (a) => (a.timeMode === 'arrive' ? `arrivée ${fmtTime(a.to1 ?? a.to2 - 180)}–${fmtTime(a.to2)}` : `départ ${fmtTime(a.from1)}–${fmtTime(a.from2)}`);
function viewAlerts() {
  const el = h('div', {}, h('div', { class: 'row', style: 'margin:6px 0' }, h('div', { class: 'grow small muted' }, 'Les alertes ne se déclenchent que dans le créneau choisi, à chaque mise à jour du jeu de données SNCF.'), h('button', { class: 'btn primary', onclick: () => alertForm() }, '+ Alerte')));
  if (R.push !== 'on') el.append(h('div', { class: 'banner warn' }, 'Notifications en arrière-plan non activées. ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); go('more'); } }, 'Les activer dans Plus')));
  if (!S.alerts.length) el.append(h('div', { class: 'empty' }, 'Aucune alerte. Exemple : Nantes → Paris, le vendredi, départ entre 8 h et 10 h.'));
  S.alerts.forEach((a) => {
    const r = R.alertRes[a.id], exact = (r?.matches || []).filter((m) => m.exact), near = (r?.matches || []).filter((m) => !m.exact);
    const sw = h('input', { type: 'checkbox', class: 'switch', checked: a.enabled, onchange: (e) => { a.enabled = e.target.checked; save(); afterAlerts(); }, onclick: (e) => e.stopPropagation() });
    el.append(h('div', { class: 'item', style: 'cursor:pointer', onclick: () => alertSheet(a) },
      h('div', { class: 'row' }, h('div', { class: 't grow' }, a.label || `${name(a.from)} → ${name(a.to)}`), sw),
      h('div', { class: 's' }, `${name(a.from)} → ${name(a.to)} · ${dayText(a)} · ${slotText(a)}`),
      h('div', { class: 'chips' }, !a.enabled ? chip('En pause', 'gray') : r ? (exact.length ? chip(`${exact.length} place${exact.length > 1 ? 's' : ''} MAX maintenant`, 'ok') : chip(r.status.text, r.status.state === 'pending' ? 'warn' : '')) : chip('Calcul…'),
        a.enabled && !exact.length && near.length > 0 && chip(`${near.length} proche${near.length > 1 ? 's' : ''}`, 'gray'), a.maxChanges ? chip(`≤ ${a.maxChanges} corr.`, 'gray') : chip('Direct', 'gray'), a.alts && chip('Gares proches', 'gray'))));
  });
  if (S.history.length) {
    el.append(h('h2', {}, 'Historique des places trouvées'));
    S.history.slice(0, 30).forEach((x) => el.append(h('div', { class: 'card flat' }, h('div', { class: 'row' }, h('b', { class: 'grow small' }, x.label), h('span', { class: 'tiny muted' }, new Date(x.at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))), h('div', { class: 'small' }, x.text))));
    el.append(h('button', { class: 'btn ghost sm', onclick: () => { S.history = []; save(); rerender(); } }, 'Vider l’historique'));
  }
  return el;
}
function alertSheet(a) {
  const r = R.alertRes[a.id], ms = r?.matches || [];
  const exact = ms.filter((m) => m.exact), near = ms.filter((m) => !m.exact).sort((x, y) => x.journey.delta - y.journey.delta);
  const sh = openSheet(a.label || `${name(a.from)} → ${name(a.to)}`, [
    h('div', { class: 'row wrap', style: 'margin-bottom:6px' }, h('span', { class: 'muted small grow' }, `${dayText(a)} · ${slotText(a)}`), h('button', { class: 'btn sm', onclick: () => { sh.close(); alertForm(a); } }, 'Modifier'),
      h('button', { class: 'btn sm danger', onclick: () => { if (confirm('Supprimer cette alerte ?')) { S.alerts = S.alerts.filter((x) => x.id !== a.id); save(); sh.close(); afterAlerts(); } } }, 'Supprimer')),
    r && h('div', { class: 'banner' + (exact.length ? '' : ' warn') }, exact.length ? `${exact.length} place(s) MAX dans le créneau.` : r.status.text),
    ...exact.slice(0, 12).flatMap((m) => [h('div', { class: 'small muted' }, fmtShort(m.date)), journeyCard(m.journey, R.meta)]),
    near.length > 0 && h('h2', {}, `Alternatives proches (± ${fmtDur(a.nearby ?? S.settings.nearby)}) — sans notification`),
    ...near.slice(0, 8).flatMap((m) => [h('div', { class: 'small muted' }, fmtShort(m.date)), journeyCard(m.journey, R.meta, { dim: true })])]);
}
function alertForm(existing, prefill) {
  const a = { id: uid(), enabled: true, label: '', from: S.settings.home, to: 'PARIS (intramuros)', mode: 'weekday', weekday: 5, date: R.meta.dates[1] || R.meta.dates[0], timeMode: 'depart', from1: 480, from2: 600, to1: null, to2: 780, maxChanges: 1, alts: true, ...existing, ...prefill };
  if (prefill && !prefill.label && !existing) a.id = uid();
  const body = h('div');
  const draw = () => {
    const arrive = a.timeMode === 'arrive';
    body.replaceChildren(...[
      h('div', { class: 'row' }, h('div', { class: 'grow' }, picker('Départ', name(a.from), () => pickFrom(a.from, (s) => { a.from = s; draw(); }))), h('div', { class: 'grow' }, picker('Arrivée', name(a.to), () => pickAny(a.to, (s) => { a.to = s; draw(); }, 'Gare d’arrivée')))),
      h('div', { class: 'sp' }),
      field('Jour', sel([['d', 'Une date précise'], ...WD.map((d, i) => [i, `Chaque ${d}`]), [-1, 'Tous les jours']], a.mode === 'date' ? 'd' : a.weekday, (v) => { if (v === 'd') a.mode = 'date'; else { a.mode = 'weekday'; a.weekday = +v; } draw(); })),
      a.mode === 'date' && field('Date', h('input', { type: 'date', value: a.date, min: R.meta.dates[0], onchange: (e) => { a.date = e.target.value; } })),
      h('div', { class: 'sp' }),
      h('div', { class: 'seg' }, [['depart', 'Plage de départ'], ['arrive', 'Heure d’arrivée visée']].map(([k, l]) => h('button', { class: a.timeMode === k ? 'on' : '', onclick: () => { a.timeMode = k; draw(); } }, l))),
      h('div', { class: 'row wrap', style: 'margin-top:8px' },
        field(arrive ? 'Arrivée dès' : 'Départ dès', timeIn(arrive ? (a.to1 ?? Math.max(0, a.to2 - 180)) : a.from1, (v) => { if (arrive) a.to1 = v; else a.from1 = v; })),
        field(arrive ? 'Arrivée au plus tard' : 'Départ avant', timeIn(arrive ? a.to2 : a.from2, (v) => { if (arrive) a.to2 = v; else a.from2 = v; }))),
      h('div', { class: 'sp' }),
      field('Correspondances', sel(chgOpts, a.maxChanges, (v) => { a.maxChanges = +v; })),
      h('div', { class: 'row', style: 'margin:10px 0' }, h('span', { class: 'small grow' }, 'Inclure les gares proches (Massy, Rennes, Angers…)'), h('input', { type: 'checkbox', class: 'switch', checked: a.alts, onchange: (e) => { a.alts = e.target.checked; } })),
      field('Nom (facultatif)', h('input', { type: 'text', value: a.label, placeholder: `${name(a.from)} → ${name(a.to)}`, oninput: (e) => { a.label = e.target.value; } })),
      h('p', { class: 'tiny muted' }, 'La notification ne part que pour le créneau exact. Les trains proches (± ' + fmtDur(S.settings.nearby) + ') s’affichent dans l’appli sans te déranger.'),
      h('button', { class: 'btn primary block', onclick: () => {
        if (a.mode === 'date' && !a.date) return toast('Choisis une date');
        if (a.timeMode === 'depart' && a.from1 > a.from2) return toast('Plage de départ incohérente');
        if (a.timeMode === 'arrive') { a.to1 ??= Math.max(0, a.to2 - 180); if (a.to1 > a.to2) return toast('Plage d’arrivée incohérente'); }
        const i = S.alerts.findIndex((x) => x.id === a.id); if (i >= 0) S.alerts[i] = a; else S.alerts.unshift(a);
        delete S.seen[a.id]; save(); sh.close(); afterAlerts(); go('alerts'); toast('Alerte enregistrée');
      } }, 'Enregistrer l’alerte')].filter(Boolean));
  };
  const sh = openSheet(existing ? 'Modifier l’alerte' : 'Nouvelle alerte', body); draw();
}
async function afterAlerts() { await refreshAlerts(); syncSoon(); rerender(); }
async function refreshAlerts() {
  const live = S.alerts.filter((a) => a.enabled);
  if (!R.meta) return;
  try {
    const out = await rpc('alerts', { alerts: live, cfg: S.settings });
    R.alertRes = Object.fromEntries(out.map((o) => [o.id, o]));
    let fresh = 0;
    for (const o of out) {
      const a = S.alerts.find((x) => x.id === o.id), keys = o.matches.filter((m) => m.exact).map((m) => m.key), prev = S.seen[o.id];
      if (prev) for (const m of o.matches.filter((m) => m.exact && !prev.includes(m.key)).slice(0, 5)) {
        const j = m.journey; fresh++;
        S.history.unshift({ at: new Date().toISOString(), id: o.id, key: m.key, label: a.label || `${name(a.from)} → ${name(a.to)}`, text: `${fmtShort(m.date)} · ${fmtTime(j.s)} → ${fmtTime(j.e)} · ${j.changes ? j.changes + ' corr.' : 'direct'}` });
      }
      S.seen[o.id] = keys;
    }
    S.history = S.history.slice(0, 100);
    if (fresh && R.tab !== 'alerts') S.unread += fresh;
    save();
  } catch (e) { console.warn(e); }
}

// ---------- Assistant ----------
const SUGGEST = ['Donne-moi trois destinations pour le 4 décembre, accessibles en 100 % TGV MAX, aller-retour dans la journée.', 'Nantes vers Lyon demain, direct.', 'Un aller-retour avec une nuit ce week-end.', 'Trois destinations en train de nuit après-demain.'];
function viewChat() {
  const el = h('div', { class: 'chat' });
  if (!R.chat.length) el.append(h('div', { class: 'card flat' }, h('b', {}, 'Dis-moi où tu veux aller.'), h('p', { class: 'small muted', style: 'margin:4px 0 0' }, 'Je cherche dans les vraies places MAX (correspondances ≥ ' + fmtDur(S.settings.minConn) + ', gares proches, trains de nuit). Je n’invente aucun train : s’il n’y a rien, je te le dis.')),
    h('div', { class: 'suggest' }, SUGGEST.map((s) => h('button', { onclick: () => ask(s) }, s))));
  R.chat.forEach((m) => {
    if (m.who === 'me') return el.append(h('div', { class: 'msg me' }, m.text));
    const box = h('div', { class: 'msg bot' }, m.pending ? [h('span', { class: 'spin' }), ' Je regarde les places…'] : m.text);
    (m.cards || []).forEach((c) => {
      box.append(h('div', { class: 'row', style: 'margin:12px 0 2px' }, h('b', { class: 'grow' }, c.title), c.plan && chip(`${fmtDur(c.plan.stay)} sur place`, 'ok')));
      if (c.sub) box.append(h('div', { class: 'tiny muted' }, c.sub));
      if (c.plan) { box.append(journeyCard(c.plan.out, R.meta, { title: 'Aller' }), journeyCard(c.plan.back, R.meta, { title: 'Retour' })); }
      else (c.journeys || []).forEach((j) => box.append(journeyCard(j, R.meta)));
      if (c.draft) box.append(h('div', { style: 'margin-top:4px' }, alertBtn(c.draft)));
    });
    if (m.draft) box.append(h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn primary', onclick: () => alertForm(null, m.draft) }, 'Voir / enregistrer l’alerte')));
    el.append(box);
  });
  const inp = h('input', { type: 'text', placeholder: 'Ex. : trois destinations pour demain, A/R dans la journée', enterkeyhint: 'send', onkeydown: (e) => { if (e.key === 'Enter' && inp.value.trim()) { const t = inp.value; inp.value = ''; ask(t); } } });
  el.append(h('div', { class: 'chatbar' }, inp, h('button', { class: 'btn primary', onclick: () => { if (inp.value.trim()) { const t = inp.value; inp.value = ''; ask(t); } } }, 'Envoyer')));
  return el;
}
async function ask(text) {
  R.chat.push({ who: 'me', text }); const m = { who: 'bot', pending: true }; R.chat.push(m); rerender();
  try {
    const r = await rpc('chat', { text, cfg: S.settings, ctx: { today: parisNow().date, last: R.lastDraft } });
    Object.assign(m, r, { pending: false }); if (r.last) R.lastDraft = r.last;
  } catch (e) { Object.assign(m, { pending: false, text: 'Désolé, je n’ai pas pu traiter cette demande : ' + e.message }); }
  rerender();
}

// ---------- Plus : favoris, réglages, notifications ----------
function viewMore() {
  const st = S.settings, set = (k, v) => { st[k] = v; save(); D.res = null; T.res = null; syncSoon(); };
  const el = h('div');
  el.append(h('h2', {}, 'Favoris'));
  if (!S.favs.places.length && !S.favs.routes.length) el.append(h('div', { class: 'card flat small muted' }, 'Touche ☆ dans une fiche destination ou dans Trajets pour enregistrer une ville ou un trajet.'));
  S.favs.places.forEach((p) => el.append(h('div', { class: 'item row', style: 'cursor:pointer', onclick: () => { T.from = st.home; T.to = p; T.res = null; go('trip'); } }, h('span', { class: 'grow t' }, name(p)), h('button', { class: 'btn sm ghost', onclick: (e) => { e.stopPropagation(); toggleFav('place', p); rerender(); } }, 'Retirer'))));
  S.favs.routes.forEach((r) => el.append(h('div', { class: 'item row', style: 'cursor:pointer', onclick: () => { T.from = r.from; T.to = r.to; T.res = null; go('trip'); } }, h('span', { class: 'grow t' }, `${name(r.from)} → ${name(r.to)}`), h('button', { class: 'btn sm ghost', onclick: (e) => { e.stopPropagation(); toggleFav('route', r); rerender(); } }, 'Retirer'))));

  el.append(h('h2', {}, 'Réglages de recherche'),
    h('div', { class: 'card' },
      h('div', { class: 'row wrap' }, h('div', { class: 'grow' }, picker('Gare de départ par défaut', name(st.home), () => pickFrom(st.home, (s) => { set('home', s); D.from = null; T.from = null; rerender(); }))), field('Départ le plus tôt', timeIn(st.earliest, (v) => set('earliest', v)))),
      h('div', { class: 'sp' }),
      h('div', { class: 'row wrap' }, field('Correspondance min.', sel([[30, '30 min'], [45, '45 min'], [60, '1 h'], [75, '1 h 15'], [90, '1 h 30'], [120, '2 h']], st.minConn, (v) => set('minConn', +v))),
        field('Corr. max', sel(chgOpts.slice(0, 4), st.maxChanges, (v) => { set('maxChanges', +v); D.maxChanges = null; T.maxChanges = null; })),
        field('Attente max', sel([[120, '2 h'], [240, '4 h'], [360, '6 h'], [600, '10 h']], st.maxWait, (v) => set('maxWait', +v)))),
      h('div', { class: 'sp' }),
      h('div', { class: 'row wrap' }, field('Temps min. sur place (A/R)', sel([[60, '1 h'], [120, '2 h'], [180, '3 h'], [240, '4 h'], [360, '6 h']], st.minStay, (v) => set('minStay', +v))),
        field('Alternatives proches', sel([[60, '± 1 h'], [120, '± 2 h'], [180, '± 3 h'], [240, '± 4 h']], st.nearby, (v) => set('nearby', +v)))),
      h('p', { class: 'tiny muted' }, 'Le temps de correspondance s’allonge automatiquement lors d’un changement de gare à Paris (gare déduite de la ligne).')));

  const terOf = (home) => TER.filter(([x, y]) => (x === home || y === home) && R.meta.stations.includes(x === home ? y : x)).map(([x, y, m]) => [x === home ? y : x, m]).sort((p, q) => p[1] - q[1]);
  const alts = terOf(st.home);
  el.append(h('h2', {}, 'Gares alternatives'),
    h('div', { class: 'card' },
      h('div', { class: 'row' }, h('span', { class: 'grow small' }, 'Élargir aux gares proches (départ et arrivée)'), h('input', { type: 'checkbox', class: 'switch', checked: st.useAlts, onchange: (e) => { set('useAlts', e.target.checked); rerender(); } })),
      st.useAlts && [h('div', { class: 'sp' }), h('div', { class: 'row wrap' },
        field('TER direct max. au départ', sel([[45, '45 min'], [60, '1 h'], [90, '1 h 30'], [120, '2 h']], st.maxTer, (v) => { set('maxTer', +v); rerender(); })),
        field('Rayon à l’arrivée', sel([[25, '25 km'], [45, '45 km'], [80, '80 km']], st.altRadiusDest, (v) => set('altRadiusDest', +v)))),
      h('div', { class: 'small muted', style: 'margin:10px 0 2px' }, alts.length ? `Gares de départ de secours depuis ${name(st.home)} (TER direct, durées estimées) :` : `Aucun TER direct connu depuis ${name(st.home)} : seule cette gare est utilisée.`),
      ...alts.map(([s, m]) => h('div', { class: 'row', style: 'padding:6px 0' + (m > st.maxTer ? ';opacity:.45' : '') }, h('span', { class: 'grow small' }, `${name(s)} · ≈ ${fmtDur(m)}${m > st.maxTer ? ' (au-delà du maximum)' : ''}`), h('input', { type: 'checkbox', class: 'switch', checked: !st.altOff[s], onchange: (e) => { const o = { ...st.altOff }; if (e.target.checked) delete o[s]; else o[s] = 1; set('altOff', o); } })))]));

  el.append(h('h2', {}, 'Notifications'), notifCard());
  el.append(h('h2', {}, 'Données'), h('div', { class: 'card small' },
    h('div', {}, `Jeu de données SNCF « tgvmax » · ${R.meta.dates[0]} → ${R.meta.dates.at(-1)} · ${R.meta.stations.length} gares.`),
    h('div', { class: 'muted', style: 'margin-top:6px' }, 'Mise à jour une fois par jour en début de matinée : ce n’est pas du temps réel, les alertes se déclenchent à chaque nouvelle mise à jour. L’appli ne réserve rien : la réservation se fait sur SNCF Connect.'),
    h('div', { class: 'muted', style: 'margin-top:6px' }, 'Les temps pour rejoindre une gare proche et la gare parisienne de chaque ligne sont des estimations.'),
    h('button', { class: 'btn sm', style: 'margin-top:8px', onclick: async () => { R.meta = null; D.res = T.res = null; rerender(); await boot(); } }, 'Recharger les données')));
  return el;
}
function notifCard() {
  const gh = S.gh, card = h('div', { class: 'card' });
  const stateTxt = { on: 'Activées sur cet appareil', off: 'Non activées', denied: 'Refusées dans les réglages du navigateur', unsupported: 'Non disponibles ici (installe l’appli sur l’écran d’accueil)' }[R.push];
  card.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', {}, 'Alertes en arrière-plan'), h('div', { class: 'small muted' }, stateTxt)),
    R.push !== 'on' && R.push !== 'unsupported' && R.push !== 'denied' && h('button', { class: 'btn primary', onclick: async () => { try { R.sub = await enablePush(); R.push = 'on'; toast('Notifications activées'); syncSoon(); } catch (e) { toast(e.message); } rerender(); } }, 'Activer')));
  card.append(h('p', { class: 'tiny muted' }, 'Aucun compte ni service tiers : les alertes (chiffrées) sont déposées dans ton dépôt GitHub, qu’une tâche planifiée relit après chaque mise à jour des données SNCF, puis le navigateur de ton téléphone affiche la notification.'));
  const sec = () => { gh.secret ||= randomSecret(); save(); return gh.secret; };
  card.append(h('div', { class: 'row wrap' }, field('Dépôt GitHub (compte/nom)', h('input', { value: gh.repo, placeholder: 'moncompte/tgvmax', onchange: (e) => { gh.repo = e.target.value.trim(); save(); } })),
    field('Jeton GitHub (Contents : lecture/écriture)', h('input', { type: 'password', value: gh.token, placeholder: 'github_pat_…', onchange: (e) => { gh.token = e.target.value.trim(); save(); } }))));
  card.append(h('div', { class: 'sp' }), field('Code de chiffrement — à copier tel quel dans le secret du dépôt SYNC_SECRET', h('div', { class: 'row' }, h('code', { class: 'k grow' }, gh.secret || 'à générer'),
    h('button', { class: 'btn sm', onclick: () => { sec(); rerender(); } }, gh.secret ? 'Régénérer' : 'Générer'), gh.secret && h('button', { class: 'btn sm', onclick: () => navigator.clipboard.writeText(gh.secret).then(() => toast('Code copié')) }, 'Copier'))));
  card.append(h('div', { class: 'row', style: 'margin-top:10px' }, h('div', { class: 'grow tiny ' + (S.syncErr ? '' : 'muted'), style: S.syncErr ? 'color:var(--danger)' : '' }, S.syncErr || (S.lastSync ? `Synchronisé le ${new Date(S.lastSync).toLocaleString('fr-FR')}` : 'Pas encore synchronisé')),
    h('button', { class: 'btn', onclick: async () => { await syncNow(true); rerender(); } }, 'Synchroniser maintenant')));
  return card;
}
let syncTimer;
const syncSoon = () => { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false).then(() => R.tab === 'more' && rerender()), 1200); };
async function syncNow(manual) {
  const { repo, token, secret } = S.gh;
  if (!repo || !token || !secret) { if (manual) { S.syncErr = 'Renseigne le dépôt, le jeton et génère le code de chiffrement.'; save(); } return; }
  try {
    const reg = await navigator.serviceWorker.ready; const sub = (await reg.pushManager.getSubscription())?.toJSON();
    if (!sub) throw new Error('Active d’abord les notifications sur cet appareil.');
    const c = S.settings, cfg = { home: c.home, earliest: c.earliest, latest: c.latest, minConn: c.minConn, maxChanges: c.maxChanges, maxWait: c.maxWait, nearby: c.nearby, useAlts: c.useAlts, maxTer: c.maxTer, altRadiusDest: c.altRadiusDest, altOff: c.altOff, allowNight: c.allowNight };
    await syncToRepo({ repo, token, secret, deviceId: S.deviceId, sub, alerts: S.alerts, cfg });
    S.lastSync = new Date().toISOString(); S.syncErr = null; if (manual) toast('Alertes synchronisées');
  } catch (e) { S.syncErr = e.message; }
  save();
}

// ---------- Démarrage ----------
async function boot() {
  R.err = null; render();
  try {
    R.meta = await rpc('init', { url: new URL('data/max.json', location.href).href });
    try { R.push = await pushState(); } catch { R.push = 'unsupported'; }
    render(); await refreshAlerts(); rerender();
  } catch (e) { R.err = e.message; render(); }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
document.addEventListener('visibilitychange', () => { if (!document.hidden && R.meta) refreshAlerts().then(() => R.tab === 'alerts' && rerender()); });
boot();
