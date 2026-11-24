// Briques d'interface : création de nœuds, feuilles, sélecteur de gare, carte de trajet.
import { pretty, norm, fmtTime, fmtDur, PARIS_LABEL, parisTransfer, LINKS } from './stations.js';

const DAY = 1440;
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}

const ICONS = {
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21h4"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  swap: '<path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4"/>',
};
export const icon = (n) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = ICONS[n]; return s; };

export function toast(msg) {
  const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), 2600);
}

export function openSheet(title, content, onClose) {
  let done = false;
  const close = () => { if (done) return; done = true; bd.remove(); onClose && onClose(); };
  const bd = h('div', { class: 'backdrop', onclick: (e) => { if (e.target === bd) close(); } },
    h('div', { class: 'sheet' }, h('header', {}, h('h3', {}, title), h('button', { class: 'x', onclick: close, 'aria-label': 'Fermer' }, '×')), h('div', { class: 'body' }, content)));
  document.body.append(bd);
  return { close, body: bd.querySelector('.body') };
}

export function pickStation(stations, outDeg, current, onPick, title = 'Choisir une gare') {
  const input = h('input', { type: 'search', placeholder: 'Rechercher une gare ou une ville…', autofocus: true, style: 'width:100%;margin:2px 0 8px;padding:11px 14px;border-radius:12px;border:1px solid var(--line);background:var(--card)' });
  const list = h('div', { class: 'list-sel' });
  const all = stations.map((s, i) => ({ s, k: norm(pretty(s)), deg: outDeg[i] })).sort((a, b) => b.deg - a.deg);
  const sheet = openSheet(title, [input, list]);
  const draw = () => {
    const q = norm(input.value);
    const m = (q ? all.filter((x) => x.k.includes(q)) : all.slice(0, 40)).slice(0, 60);
    list.replaceChildren(...m.map((x) => h('button', { onclick: () => { onPick(x.s); sheet.close(); } }, pretty(x.s) + (x.s.includes('(intramuros)') ? ' (toutes gares)' : ''), x.s === current ? ' ✓' : '')));
    if (!m.length) list.append(h('div', { class: 'empty' }, 'Aucune gare trouvée'));
  };
  input.addEventListener('input', draw); draw(); setTimeout(() => input.focus(), 60);
}

export function dateStrip(dates, selected, onPick) {
  const el = h('div', { class: 'dates' });
  dates.forEach((d) => {
    const dt = new Date(d + 'T12:00:00Z'), wd = dt.getUTCDay();
    const b = h('button', { class: (d === selected ? 'on ' : '') + (wd === 0 || wd === 6 ? 'we' : ''), onclick: () => onPick(d) },
      h('span', {}, dt.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')), h('b', {}, dt.getUTCDate()), h('span', {}, dt.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', '')));
    el.append(b);
    if (d === selected) setTimeout(() => b.scrollIntoView({ inline: 'center', block: 'nearest' }), 0);
  });
  return el;
}

const AXE = { 'IC ARO': 'Intercités', 'IC NUIT': 'Intercités de nuit', ATLANTIQUE: 'Atlantique', 'SUD EST': 'Sud-Est', NORD: 'Nord', EST: 'Est', INTERNATIONAL: 'International' };
const stName = (name, pt) => (pt ? `Paris ${PARIS_LABEL[pt]}` : pretty(name));
export const bookUrl = 'https://www.sncf-connect.com/';

export function copyText(j, meta) {
  const nm = (i) => meta.stations[i];
  const lines = j.legs.map((l, i) => {
    const prevSame = i > 0 && j.legs[i - 1].ti === l.ti && j.legs[i - 1].di === l.di;
    return prevSame ? null : `${fmtTime(l.s).replace(':', 'h')}-${stName(nm(l.o), l.ptO)}`;
  }).filter(Boolean);
  const last = j.legs[j.legs.length - 1];
  lines.push(`${fmtTime(last.e)}-${stName(nm(last.d), last.ptD)}`);
  return lines.join('\n');
}

const moon = () => h('span', { class: 'chip night' }, icon('moon'), 'Nuit');
export function journeyCard(j, meta, { dim = false, actions = [], title = '' } = {}) {
  const nm = (i) => meta.stations[i];
  const dayOf = (m) => Math.floor(m / DAY) - j.di;
  const dd = (m) => (dayOf(m) ? ` +${dayOf(m)} j` : '');
  const head = h('div', { class: 'jhead' },
    title && h('span', { class: 'chip gray' }, title),
    h('span', { class: 'big' }, `${fmtTime(j.s)} → ${fmtTime(j.e)}${dd(j.e)}`),
    h('span', { class: 'muted small' }, fmtDur(j.dur)),
    h('span', { class: 'chip ' + (j.changes ? 'warn' : 'ok') }, j.changes ? `${j.changes} corr.` : 'Direct'),
    j.night && moon(),
    j.delta > 0 && h('span', { class: 'chip warn' }, `${fmtDur(j.delta)} d’écart`));
  const body = [];
  j.legs.forEach((l, i) => {
    const p = j.legs[i - 1];
    if (p) {
      const gap = l.s - p.e, same = p.ti === l.ti && p.di === l.di;
      if (same) body.push(h('div', { class: 'conn stay' }, `Même train — reste à bord à ${pretty(nm(l.o))} (2 réservations MAX)`));
      else {
        const sc = p.ptD && l.ptO && p.ptD !== l.ptO;
        const lk = p.d !== l.o && LINKS.find(([a, b]) => (nm(p.d) === a && nm(l.o) === b) || (nm(p.d) === b && nm(l.o) === a));
        body.push(h('div', { class: 'conn' }, lk ? `Correspondance ${fmtDur(gap)} · changement de gare : ${pretty(nm(p.d))} → ${pretty(nm(l.o))} (≈ ${lk[2]} min en ${lk[3]}, hors MAX)` : sc ? `Correspondance ${fmtDur(gap)} · changement de gare : ${PARIS_LABEL[p.ptD]} → ${PARIS_LABEL[l.ptO]} (≈ ${parisTransfer(p.ptD, l.ptO)} min de trajet)` : `Correspondance ${fmtDur(gap)} à ${pretty(nm(l.o))}`));
      }
    }
    const sameAsPrev = p && p.ti === l.ti && p.di === l.di;
    body.push(h('div', { class: 'leg' },
      h('span', { class: 'tm' }, fmtTime(l.s), dayOf(l.s) > 0 && h('sup', { class: 'muted' }, `+${dayOf(l.s)}`)), h('span', { class: 'st' }, stName(nm(l.o), l.ptO)),
      h('span', { class: 'tm muted' }, fmtTime(l.e), dayOf(l.e) > 0 && h('sup', {}, `+${dayOf(l.e)}`)), h('span', { class: 'st' }, stName(nm(l.d), l.ptD)),
      h('span', { class: 'meta' }, h('span', {}, `${AXE[l.ax] || l.ax} · train ${l.no}`), h('span', { class: 'chip ok' }, 'Place MAX ✓'), l.night && moon(), sameAsPrev && h('span', { class: 'chip gray' }, 'même train'))));
  });
  const notes = [];
  if (j.altFrom) notes.push(`Départ depuis ${pretty(nm(j.legs[0].o))} : prévoir ≈ ${fmtDur(j.altFrom.min)} depuis ${pretty(j.altFrom.main)} (${j.altFrom.how}, hors MAX, estimation).`);
  if (j.altTo) notes.push(`Arrivée à ${pretty(nm(j.legs.at(-1).d))} : ≈ ${fmtDur(j.altTo.min)} de plus pour rejoindre ${pretty(j.altTo.main)} (${j.altTo.how}, hors MAX, estimation).`);
  const foot = h('div', { class: 'jfoot' },
    h('a', { class: 'btn primary sm', href: bookUrl, target: '_blank', rel: 'noopener', style: 'text-decoration:none' }, 'Réserver sur SNCF Connect'),
    h('button', { class: 'btn sm', onclick: async () => { try { await navigator.clipboard.writeText(copyText(j, meta)); toast('Trajet copié'); } catch { toast('Copie impossible'); } } }, 'Copier'),
    ...actions);
  return h('div', { class: 'jcard' + (dim ? ' dim' : '') }, head, body, notes.map((n) => h('div', { class: 'jnote' }, n)), foot);
}
export { stName };
