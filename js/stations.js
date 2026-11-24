// Référentiel des gares : coordonnées (approximatives), noms lisibles, gares alternatives.
// Partagé entre l'appli (navigateur) et les scripts serveur (Node).

export const COORDS = {
  'AEROPORT ROISSY CDG 2 TGV': [49.0045, 2.571], 'AGDE': [43.3115, 3.472], 'AGEN': [44.207, 0.62], 'AIME LA PLAGNE': [45.556, 6.656],
  'AIX EN PROVENCE TGV': [43.455, 5.317], 'AIX LES BAINS LE REVARD': [45.689, 5.908], 'ALBERTVILLE': [45.675, 6.392],
  'ANGERS SAINT LAUD': [47.464, -0.557], 'ANGOULEME': [45.65, 0.165], 'ANNECY': [45.902, 6.121], 'ANNEMASSE': [46.192, 6.237],
  'ANTIBES': [43.583, 7.117], 'ARCACHON': [44.66, -1.169], 'ARGELES SUR MER': [42.546, 3.025], 'ARGENTON SUR CREUSE': [46.59, 1.52],
  'ARLES': [43.677, 4.631], 'ARRAS': [50.286, 2.781], 'AURAY': [47.667, -2.983], 'AVIGNON CENTRE': [43.942, 4.806],
  'AVIGNON TGV': [43.922, 4.786], 'BANYULS SUR MER': [42.483, 3.128], 'BAR LE DUC': [48.774, 5.161], 'BAYONNE': [43.496, -1.472],
  'BEAUNE': [47.023, 4.835], 'BELFORT MONTBELIARD TGV': [47.586, 6.904], 'BELLEGARDE SUR VALSERINE GARE': [46.108, 5.827],
  'BESANCON FRANCHE COMTE TGV': [47.307, 5.954], 'BESANCON VIOTTE': [47.247, 6.023], 'BETHUNE': [50.53, 2.635], 'BEZIERS': [43.341, 3.213],
  'BIARRITZ': [43.457, -1.546], 'BIGANOS FACTURE': [44.641, -0.978], 'BORDEAUX ST JEAN': [44.826, -0.556], 'BOULOGNE VILLE': [50.726, 1.607],
  'BOURG EN BRESSE': [46.207, 5.215], 'BOURG SAINT MAURICE': [45.618, 6.771], 'BREST': [48.387, -4.479], 'BRIANCON': [44.899, 6.639],
  'BRIVE LA GAILLARDE': [45.159, 1.533], 'BRUXELLES MIDI': [50.836, 4.336], 'CAHORS': [44.448, 1.44], 'CALAIS FRETHUN': [50.9, 1.8],
  'CANNES': [43.553, 7.019], 'CARCASSONNE': [43.219, 2.351], 'CAUSSADE(TARN ET GARONNE)': [44.16, 1.538], 'CERBERE': [42.443, 3.165],
  'CHALON SUR SAONE': [46.781, 4.843], 'CHALONS EN CHAMPAGNE': [48.955, 4.372], 'CHAMBERY CHALLES LES EAUX': [45.57, 5.919],
  'CHAMPAGNE ARDENNE TGV': [49.213, 4.024], 'CHARLEVILLE MEZIERES': [49.769, 4.722], 'CHATEAUROUX': [46.816, 1.702],
  'CHATELLERAULT': [46.814, 0.541], 'CHORGES': [44.546, 6.274], 'CLERMONT FERRAND': [45.779, 3.099], 'CLUSES (HAUTE SAVOIE)': [46.062, 6.58],
  'COLLIOURE': [42.526, 3.083], 'COLMAR': [48.071, 7.347], 'CREST': [44.73, 5.023], 'CROIX WASQUEHAL': [50.671, 3.156], 'DAX': [43.705, -1.053],
  'DIE': [44.754, 5.37], 'DIJON VILLE': [47.323, 5.027], 'DOL DE BRETAGNE': [48.548, -1.75], 'DOLE VILLE': [47.092, 5.495], 'DOUAI': [50.373, 3.078],
  'DUNKERQUE': [51.033, 2.372], 'ELNE': [42.6, 2.971], 'EMBRUN': [44.564, 6.495], 'EPINAL': [48.18, 6.447], 'ETAPLES   LE TOUQUET': [50.519, 1.641],
  'EVIAN LES BAINS': [46.4, 6.589], 'FRASNE': [46.86, 6.159], 'FREIBURG (BREISGAU) HBF': [47.997, 7.842], 'FUTUROSCOPE': [46.669, 0.368],
  'GAP': [44.559, 6.082], 'GOURDON': [44.735, 1.379], 'GRENOBLE': [45.191, 5.714], 'GUINGAMP': [48.56, -3.15], 'HAZEBROUCK': [50.724, 2.537],
  'HENDAYE': [43.359, -1.774], 'HYERES': [43.122, 6.128], 'ISSOUDUN': [46.95, 1.993], "L'ARGENTIERE LES ECRINS": [44.787, 6.556],
  'LA BAULE ESCOUBLAC': [47.287, -2.393], 'LA ROCHE SUR YON': [46.676, -1.427], 'LA ROCHELLE VILLE': [46.152, -1.145], 'LA SOUTERRAINE': [46.236, 1.487],
  'LA TESTE': [44.632, -1.145], 'LAHR SCHWARZW': [48.339, 7.868], 'LAMBALLE': [48.469, -2.519], 'LANDERNEAU': [48.45, -4.248], 'LANDRY': [45.564, 6.764],
  'LANNION': [48.733, -3.456], 'LAVAL': [48.074, -0.769], 'LE CREUSOT MONTCEAU MONTCHANIN': [46.765, 4.478], 'LE CROISIC': [47.293, -2.511],
  'LE HAVRE': [49.493, 0.123], 'LE MANS': [48.006, 0.192], 'LE POULIGUEN': [47.274, -2.429], 'LENS': [50.426, 2.827], 'LES ARCS DRAGUIGNAN': [43.465, 6.48],
  'LES AUBRAIS ORLEANS': [47.926, 1.905], "LES SABLES D'OLONNE": [46.493, -1.781], 'LIBOURNE': [44.914, -0.24], 'LILLE (intramuros)': [50.637, 3.07],
  'LIMOGES BENEDICTINS': [45.835, 1.268], 'LORIENT': [47.748, -3.366], 'LORRAINE TGV': [48.953, 6.131], 'LOURDES': [43.095, -0.045],
  'LUNEVILLE': [48.59, 6.496], 'LUXEMBOURG': [49.6, 6.134], 'LYON (intramuros)': [45.76, 4.859], 'LYON ST EXUPERY TGV.': [45.72, 5.077],
  'MACON LOCHE TGV': [46.301, 4.777], 'MACON VILLE': [46.307, 4.833], 'MANTES LA JOLIE': [48.989, 1.704], 'MARMANDE': [44.5, 0.166],
  'MARNE LA VALLEE CHESSY': [48.87, 2.782], 'MARSEILLE BLANCARDE': [43.305, 5.402], 'MARSEILLE ST CHARLES': [43.303, 5.38], 'MASSY PALAISEAU': [48.726, 2.258],
  'MASSY TGV': [48.725, 2.262], 'METZ VILLE': [49.11, 6.177], 'MEUSE TGV': [48.973, 5.263], 'MIRAMAS': [43.584, 5.001], 'MODANE': [45.198, 6.664],
  'MONTAUBAN VILLE BOURBON': [44.013, 1.341], 'MONTBARD': [47.621, 4.337], 'MONTDAUPHIN GUILLESTRE': [44.671, 6.643], 'MONTELIMAR GARE SNCF': [44.558, 4.749],
  'MONTPELLIER SAINT ROCH': [43.605, 3.88], 'MONTPELLIER SUD DE FRANCE': [43.578, 3.929], 'MORLAIX': [48.576, -3.828], 'MOUCHARD': [46.974, 5.794],
  'MOULINS SUR ALLIER': [46.559, 3.326], 'MOUTIERS SALINS BRIDES LES BAINS': [45.486, 6.534], 'MULHOUSE VILLE': [47.742, 7.343], 'NANCY': [48.69, 6.174],
  'NANTES': [47.217, -1.542], 'NARBONNE': [43.182, 3.001], 'NEVERS': [46.986, 3.162], 'NICE VILLE': [43.704, 7.262], 'NIMES CENTRE': [43.832, 4.365],
  'NIMES PONT DU GARD': [43.755, 4.466], 'NIORT': [46.324, -0.454], 'NURIEUX GARE': [46.186, 5.596], 'OFFENBURG': [48.474, 7.948], 'ORANGE': [44.137, 4.808],
  'ORTHEZ': [43.489, -0.771], 'PARIS (intramuros)': [48.8566, 2.3522], 'PARIS MONTPARNASSE VAUGIRARD': [48.841, 2.319], 'PAU': [43.3, -0.372],
  'PERPIGNAN': [42.696, 2.879], 'PLOUARET TREGOR': [48.615, -3.462], 'POITIERS': [46.583, 0.333], 'PORNICHET': [47.265, -2.341], 'PORT VENDRES VILLE': [42.519, 3.106],
  'QUIMPER': [47.992, -4.097], 'QUIMPERLE': [47.873, -3.551], 'RANG DU FLIERS VERTON BERCK': [50.404, 1.612], 'REDON': [47.653, -2.085], 'REIMS': [49.259, 4.025],
  'REMIREMONT': [48.017, 6.59], 'RENNES': [48.103, -1.672], 'RETHEL': [49.517, 4.369], 'RINGSHEIM EUROPA PARK': [48.268, 7.719], 'RIOM CHATEL GUYON': [45.895, 3.115],
  'ROSPORDEN': [47.961, -3.834], 'ROUBAIX': [50.693, 3.174], 'ROUEN RIVE DROITE': [49.445, 1.093], 'SABLE SUR SARTHE': [47.84, -0.333], 'SAINT AVRE LA CHAMBRE': [45.391, 6.358],
  'SAINT ETIENNE CHATEAUCREUX': [45.443, 4.401], 'SALLANCHES COMBLOUX MEGEVE': [45.937, 6.631], 'SARREBOURG': [48.734, 7.054], 'SAUMUR': [47.257, -0.074],
  'SAVERNE': [48.744, 7.362], 'SEDAN': [49.7, 4.94], 'SELESTAT': [48.26, 7.451], 'SETE': [43.405, 3.698], 'SOUILLAC': [44.894, 1.478], 'ST BRIEUC': [48.512, -2.76],
  'ST DIE': [48.286, 6.948], 'ST GERVAIS LES BAINS LE FAYET': [45.907, 6.7], 'ST JEAN DE LUZ CIBOURE': [43.383, -1.659], 'ST JEAN DE MAURIENNE ARVAN': [45.276, 6.345],
  'ST MAIXENT (DEUX SEVRES)': [46.41, -0.21], 'ST MALO': [48.642, -2.009], 'ST MICHEL VALLOIRE': [45.216, 6.47], 'ST NAZAIRE': [47.281, -2.212],
  'ST PIERRE DES CORPS': [47.386, 0.726], 'ST RAPHAEL VALESCURE': [43.422, 6.77], 'ST VINCENT DE TYROSSE': [43.664, -1.305], 'STRASBOURG': [48.585, 7.734],
  'SURGERES': [46.107, -0.754], 'TARBES': [43.237, 0.066], 'TGV HAUTE PICARDIE': [49.859, 2.83], 'THIONVILLE': [49.359, 6.166], 'THONON LES BAINS': [46.372, 6.476],
  'TOULON': [43.128, 5.93], 'TOULOUSE MATABIAU': [43.611, 1.454], 'TOURCOING': [50.722, 3.159], 'TOURS': [47.389, 0.693], 'UZERCHE': [45.423, 1.564],
  'VALENCE TGV AUVERGNE RHONE ALPES': [44.991, 4.978], 'VALENCE VILLE': [44.932, 4.891], 'VALENCIENNES': [50.357, 3.528], 'VANNES': [47.663, -2.751],
  'VENDOME VILLIERS SUR LOIR': [47.819, 1.071], 'VERSAILLES CHANTIERS': [48.796, 2.135], 'VEYNES DEVOLUY': [44.533, 5.817], 'VICHY': [46.122, 3.423],
  'VIERZON': [47.226, 2.072], 'VITRE': [48.123, -1.21], 'VITRY LE FRANCOIS': [48.726, 4.584], 'SAINT GERMAIN DES FOSSES': [46.204, 3.435],
};

// Contour très simplifié de la France métropolitaine [lat, lon] pour la carte (sans fond de carte externe).
export const OUTLINE = [
  [51.09, 2.55], [50.75, 3.15], [50.35, 3.7], [50.2, 4.15], [50.13, 4.83], [49.65, 5.05], [49.52, 5.8], [49.45, 6.37], [49.2, 6.9], [49.05, 8.2],
  [48.6, 7.8], [47.6, 7.6], [47.5, 7.0], [46.45, 6.1], [46.2, 6.1], [46.4, 6.9], [45.9, 7.05], [45.15, 7.05], [44.1, 7.65], [43.78, 7.52], [43.55, 7.0],
  [43.1, 6.4], [43.05, 5.9], [43.25, 5.35], [43.4, 4.9], [43.35, 4.55], [43.5, 4.1], [43.38, 3.7], [43.0, 3.1], [42.45, 3.17], [42.5, 2.5], [42.45, 1.6],
  [42.8, 0.7], [43.0, -0.2], [43.3, -1.78], [43.5, -1.55], [44.5, -1.25], [45.6, -1.05], [46.15, -1.2], [46.5, -1.8], [47.0, -2.1], [47.3, -2.5],
  [47.55, -3.15], [47.7, -3.4], [47.8, -4.3], [48.0, -4.7], [48.4, -4.8], [48.65, -4.3], [48.7, -3.9], [48.8, -3.1], [48.65, -2.0], [48.8, -1.55],
  [49.4, -1.85], [49.7, -1.9], [49.65, -1.2], [49.35, -1.1], [49.35, -0.2], [49.45, 0.1], [49.8, 0.45], [49.93, 1.08], [50.2, 1.6], [50.7, 1.6], [50.95, 1.85],
];

const SMALL = new Set(['sur', 'de', 'des', 'du', 'la', 'le', 'les', 'en', 'et', 'aux', 'lès', 'l']);
const ACCENTS = {
  Chalons: 'Châlons', Bethune: 'Béthune', Beziers: 'Béziers', Sete: 'Sète', Nimes: 'Nîmes', Macon: 'Mâcon', Chambery: 'Chambéry', Chateauroux: 'Châteauroux',
  Chatellerault: 'Châtellerault', Besancon: 'Besançon', Montelimar: 'Montélimar', Hyeres: 'Hyères', Etaples: 'Étaples', Evian: 'Évian', Epinal: 'Épinal',
  Orleans: 'Orléans', Vendome: 'Vendôme', Cerbere: 'Cerbère', Argeles: 'Argelès', Quimperle: 'Quimperlé', Briancon: 'Briançon', Argentiere: 'Argentière',
  Luneville: 'Lunéville', Selestat: 'Sélestat', Etienne: 'Étienne', Frethun: 'Fréthun', Mezieres: 'Mézières', Benedictins: 'Bénédictins', Rhone: 'Rhône',
  Vallee: 'Vallée', Aeroport: 'Aéroport', Garonne: 'Garonne', Aime: 'Aimé', Bellegarde: 'Bellegarde', Franche: 'Franche', Comte: 'Comté', Rene: 'René',
  Nuriuex: 'Nurieux', Sevres: 'Sèvres', Louis: 'Louis', Exupery: 'Exupéry', Grace: 'Grâce', Chatel: 'Châtel', Chateaucreux: 'Châteaucreux', Montbeliard: 'Montbéliard',
  Revard: 'Revard', Megeve: 'Megève', Valescure: 'Valescure', Haute: 'Haute', Francois: 'François', Dauphin: 'Dauphin', Brides: 'Brides', Savoie: 'Savoie',
};
const SPECIAL = {
  'PARIS (intramuros)': 'Paris', 'LYON (intramuros)': 'Lyon', 'LILLE (intramuros)': 'Lille',
  'CAUSSADE(TARN ET GARONNE)': 'Caussade', 'CLUSES (HAUTE SAVOIE)': 'Cluses', 'ST MAIXENT (DEUX SEVRES)': 'Saint-Maixent-l’École',
  'ETAPLES   LE TOUQUET': 'Étaples – Le Touquet', 'LYON ST EXUPERY TGV.': 'Lyon Saint-Exupéry TGV', 'AEROPORT ROISSY CDG 2 TGV': 'Roissy CDG 2 TGV',
  'ST PIERRE DES CORPS': 'Saint-Pierre-des-Corps', 'FREIBURG (BREISGAU) HBF': 'Fribourg-en-Brisgau', 'LAHR SCHWARZW': 'Lahr', 'MARNE LA VALLEE CHESSY': 'Marne-la-Vallée Chessy',
  'BORDEAUX ST JEAN': 'Bordeaux Saint-Jean', 'MONTPELLIER SAINT ROCH': 'Montpellier Saint-Roch', 'MONTPELLIER SUD DE FRANCE': 'Montpellier Sud de France',
  'MARSEILLE ST CHARLES': 'Marseille Saint-Charles', 'TOULOUSE MATABIAU': 'Toulouse Matabiau', 'NICE VILLE': 'Nice Ville', 'BRUXELLES MIDI': 'Bruxelles-Midi',
  'RINGSHEIM EUROPA PARK': 'Europa-Park (Ringsheim)', "L'ARGENTIERE LES ECRINS": 'L’Argentière-les-Écrins', 'LA ROCHELLE VILLE': 'La Rochelle',
  'LES SABLES D\'OLONNE': 'Les Sables-d’Olonne', 'LE CREUSOT MONTCEAU MONTCHANIN': 'Le Creusot – Montchanin TGV',
};

export function pretty(name) {
  if (SPECIAL[name]) return SPECIAL[name];
  const words = name.toLowerCase().replace(/\./g, '').split(/\s+/).filter(Boolean).map((w, i) => {
    if (w === 'st') return 'Saint'; if (w === 'ste') return 'Sainte';
    if (i > 0 && SMALL.has(w)) return w;
    const c = w.charAt(0).toUpperCase() + w.slice(1);
    return ACCENTS[c] || c;
  });
  return words.join(' ').replace(/^Saint (?=[A-ZÉ])/, 'Saint-').replace(/\bTgv\b/g, 'TGV');
}

export const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function km(a, b) {
  const A = COORDS[a], B = COORDS[b]; if (!A || !B) return Infinity;
  const r = Math.PI / 180, dLat = (B[0] - A[0]) * r, dLon = (B[1] - A[1]) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(A[0] * r) * Math.cos(B[0] * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}

// Temps (min) pour rejoindre la gare principale depuis une gare alternative (estimations, hors MAX : TER/RER/métro).
const ACCESS = {
  'PARIS (intramuros)|MASSY TGV': [35, 'RER B/C'], 'PARIS (intramuros)|MASSY PALAISEAU': [35, 'RER B'], 'PARIS (intramuros)|MARNE LA VALLEE CHESSY': [40, 'RER A'],
  'PARIS (intramuros)|AEROPORT ROISSY CDG 2 TGV': [50, 'RER B'], 'PARIS (intramuros)|VERSAILLES CHANTIERS': [25, 'train'], 'PARIS (intramuros)|PARIS MONTPARNASSE VAUGIRARD': [10, 'métro'],
  'NANTES|RENNES': [80, 'TER'], 'NANTES|ANGERS SAINT LAUD': [50, 'TER'], 'NANTES|LA ROCHE SUR YON': [50, 'TER'], 'NANTES|ST NAZAIRE': [40, 'TER'],
};
export function access(main, alt) {
  const k = ACCESS[`${main}|${alt}`] || ACCESS[`${alt}|${main}`];
  if (k) return { min: k[0], how: k[1], km: Math.round(km(main, alt)) };
  const d = km(main, alt);
  return { min: Math.round(15 + d * 0.7), how: 'train/transport local', km: Math.round(d) };
}

// Gares alternatives autour d'une gare (rayon en km), triées par distance.
export function altStations(name, radius, universe, filter = () => true) {
  const out = [];
  for (const s of universe) {
    if (s === name || !COORDS[s] || !filter(s)) continue;
    const d = km(name, s);
    if (d <= radius) out.push({ name: s, ...access(name, s) });
  }
  return out.sort((a, b) => a.km - b.km);
}

// Gares de Paris : le jeu SNCF les regroupe en « PARIS (intramuros) » ; on déduit la gare depuis la ligne.
export const PARIS = new Set(['PARIS (intramuros)', 'PARIS MONTPARNASSE VAUGIRARD']);
export const PARIS_LABEL = { MP: 'Montparnasse', GL: 'Gare de Lyon', GN: 'Gare du Nord', GE: 'Gare de l’Est', AU: 'Austerlitz', BY: 'Bercy' };
const AXE_TERM = { ATLANTIQUE: 'MP', NORD: 'GN', EST: 'GE', 'SUD EST': 'GL', 'IC NUIT': 'AU', 'IC ARO': 'AU', INTERNATIONAL: 'GL' };
const BERCY = new Set(['NEVERS', 'MOULINS SUR ALLIER', 'VICHY', 'RIOM CHATEL GUYON', 'CLERMONT FERRAND', 'SAINT GERMAIN DES FOSSES']);
const PAIR = { MPGL: 50, MPGN: 45, MPGE: 45, MPAU: 40, MPBY: 50, GLGN: 45, GLGE: 45, GLAU: 25, GLBY: 15, GNGE: 15, GNAU: 35, GNBY: 40, GEAU: 35, GEBY: 40, AUBY: 20 };
export function parisTerminal(axe, otherEnd, parisName) {
  if (parisName === 'PARIS MONTPARNASSE VAUGIRARD') return 'MP';
  if (BERCY.has(otherEnd) && axe !== 'IC NUIT') return 'BY';
  return AXE_TERM[axe] || 'GL';
}
export function parisTransfer(a, b) {
  if (a === b) return 0;
  return PAIR[a + b] ?? PAIR[b + a] ?? 45;
}

export const fmtTime = (m) => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + 'h' + String(m % 60).padStart(2, '0'); };
export const fmtDur = (m) => { const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${String(r).padStart(2, '0')}` : `${r} min`; };

// Gares d'une même ville : atteindre l'une ou l'autre revient au même (jamais d'aller-retour entre elles).
export const CLUSTERS = [
  ['NIMES CENTRE', 'NIMES PONT DU GARD'], ['LYON (intramuros)', 'LYON ST EXUPERY TGV.'], ['MONTPELLIER SAINT ROCH', 'MONTPELLIER SUD DE FRANCE'],
  ['AVIGNON CENTRE', 'AVIGNON TGV'], ['VALENCE VILLE', 'VALENCE TGV AUVERGNE RHONE ALPES'], ['MACON VILLE', 'MACON LOCHE TGV'],
  ['BESANCON VIOTTE', 'BESANCON FRANCHE COMTE TGV'], ['MARSEILLE ST CHARLES', 'MARSEILLE BLANCARDE'], ['PARIS (intramuros)', 'PARIS MONTPARNASSE VAUGIRARD'],
];
// Changements de gare possibles en correspondance (minutes de trajet hors MAX).
export const LINKS = [['MASSY TGV', 'MASSY PALAISEAU', 25, 'RER B/C']];
