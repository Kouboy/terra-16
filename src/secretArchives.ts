import React, { useEffect, useRef } from 'react';
import {
  CATEGORY_META,
  ElevationGrid,
  ExplorationCategory,
  haversineMeters,
  inferOfficialStateLabel,
  OFFICIAL_STATE_LABEL_META,
  PoiItem,
  sampleElevationMeters,
  UnlockedEntry,
} from './types';

// ============================================================================
// 1. CATALOG OF 8 RARE 16-BIT SECRET ARCHIVE COLLECTIBLES
// ============================================================================

export type SecretCollectibleId =
  | 'sceau_merimee_pourpre'
  | 'fiole_encre_sympathique'
  | 'astrolabe_illustres'
  | 'prisme_jardins_secrets'
  | 'clef_chambre_scellee'
  | 'boussole_argent_voilee'
  | 'plume_cinabre_royal'
  | 'medaillon_terroir_ancien';

export interface SecretCollectibleItem {
  id: SecretCollectibleId;
  name: string;
  subtitle: string;
  rarityLabel: 'Rare · Archive Secrète' | 'Légendaire · Sceau d’État';
  category: ExplorationCategory;
  lore: string;
  motif: 'wax_seal' | 'ink_vial' | 'astrolabe' | 'emerald_prism' | 'cipher_key' | 'silver_compass' | 'cinnabar_quill' | 'terroir_medal';
  palette: {
    base: string;
    main: string;
    bright: string;
    accent: string;
  };
}

export const SECRET_COLLECTIBLES_CATALOG: SecretCollectibleItem[] = [
  {
    id: 'sceau_merimee_pourpre',
    name: 'Sceau Pourpre de Mérimée',
    subtitle: 'Empreinte d’inspecteur des Monuments Historiques (1834)',
    rarityLabel: 'Légendaire · Sceau d’État',
    category: 'histoire',
    lore: 'Coulé dans une cire de laque carmin et d’or fin, ce cachet servait aux premiers inspecteurs itinérants pour signaler les édifices sauvés de l’oubli.',
    motif: 'wax_seal',
    palette: { base: '#450a0a', main: '#be123c', bright: '#fda4af', accent: '#fbbf24' },
  },
  {
    id: 'fiole_encre_sympathique',
    name: 'Fiole d’Encre Sympathique',
    subtitle: 'Élixir gallique révélé à la chaleur d’une lanterne',
    rarityLabel: 'Rare · Archive Secrète',
    category: 'etrange',
    lore: 'Utilisée dans les marges des terriers et cartes d’état-major pour consigner des passages dérobés invisibles à l’œil profane.',
    motif: 'ink_vial',
    palette: { base: '#2e1065', main: '#7e22ce', bright: '#e9d5ff', accent: '#fde047' },
  },
  {
    id: 'astrolabe_illustres',
    name: 'Astrolabe des Maisons Illustres',
    subtitle: 'Sphère de cabinet d’écrivain et de savant',
    rarityLabel: 'Légendaire · Sceau d’État',
    category: 'legende',
    lore: 'Un instrument de poche gravé de devises humanistes qui pointe vers les demeures où naquirent poèmes, découvertes et chefs-d’œuvre.',
    motif: 'astrolabe',
    palette: { base: '#1e1b4b', main: '#6366f1', bright: '#fef08a', accent: '#f472b6' },
  },
  {
    id: 'prisme_jardins_secrets',
    name: 'Prisme d’Émeraude des Jardins',
    subtitle: 'Verre taillé d’orangerie et d’arboretum',
    rarityLabel: 'Rare · Archive Secrète',
    category: 'ecosysteme',
    lore: 'Capte la rosée des parcs clos et décompose la lumière sous les charmilles centenaires des Jardins Remarquables.',
    motif: 'emerald_prism',
    palette: { base: '#064e3b', main: '#10b981', bright: '#a7f3d0', accent: '#fbbf24' },
  },
  {
    id: 'clef_chambre_scellee',
    name: 'Clef Chiffrée des Archives',
    subtitle: 'Panneton à sept crans des dépôts secrets',
    rarityLabel: 'Légendaire · Sceau d’État',
    category: 'histoire',
    lore: 'Son anneau trilobé renferme une bague alphabétique mobile permettant de décoder les cotes confidentielles des chartriers.',
    motif: 'cipher_key',
    palette: { base: '#451a03', main: '#d97706', bright: '#fef3c7', accent: '#c084fc' },
  },
  {
    id: 'boussole_argent_voilee',
    name: 'Boussole d’Argent des Lieux Voilés',
    subtitle: 'Aiguille aimantée aux anomalies topographiques',
    rarityLabel: 'Rare · Archive Secrète',
    category: 'geographie',
    lore: 'Au lieu d’indiquer le seul pôle magnétique, son aiguille frémit à l’approche des résurgences, tertres et belvédères oubliés.',
    motif: 'silver_compass',
    palette: { base: '#0f172a', main: '#0284c7', bright: '#e0f2fe', accent: '#fde047' },
  },
  {
    id: 'plume_cinabre_royal',
    name: 'Plume de Cinabre & Feuille d’Or',
    subtitle: 'Calame d’enlumineur des feuillets secrets',
    rarityLabel: 'Rare · Archive Secrète',
    category: 'legende',
    lore: 'Trempée dans le vermillon broyé, elle sert à parapher les découvertes obtenues par déduction et recoupement sur le terrain.',
    motif: 'cinnabar_quill',
    palette: { base: '#4c0519', main: '#e11d48', bright: '#ffe4e6', accent: '#facc15' },
  },
  {
    id: 'medaillon_terroir_ancien',
    name: 'Médaillon des Savoir-Faire Oubliés',
    subtitle: 'Jeton de corporation d’artisans et vignerons',
    rarityLabel: 'Rare · Archive Secrète',
    category: 'etrange',
    lore: 'Frappé d’un maillet, d’une grappe et d’une roue à aubes, il honore les ateliers, moulins et caves perpétuant les gestes séculaires.',
    motif: 'terroir_medal',
    palette: { base: '#3b1f0e', main: '#b45309', bright: '#fde68a', accent: '#34d399' },
  },
];

export function getSecretCollectibleById(id: SecretCollectibleId): SecretCollectibleItem {
  return SECRET_COLLECTIBLES_CATALOG.find((c) => c.id === id) || SECRET_COLLECTIBLES_CATALOG[0];
}

// ============================================================================
// 2. 16-BIT PIXEL-ART COLLECTIBLE RENDERER
// ============================================================================

export const SecretCollectibleCanvas: React.FC<{
  collectible: SecretCollectibleItem;
  unlocked?: boolean;
  size?: number;
  className?: string;
}> = ({ collectible, unlocked = true, size = 48, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 16);

    const pal = unlocked
      ? collectible.palette
      : { base: '#1e1b18', main: '#44403c', bright: '#78716c', accent: '#57534e' };

    const px = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
    };

    // Crisp dark silhouette backing
    px(2, 2, 12, 12, '#140b06');
    px(3, 1, 10, 14, '#140b06');
    px(1, 3, 14, 10, '#140b06');
    px(2, 3, 12, 10, pal.base);
    px(3, 2, 10, 12, pal.base);

    switch (collectible.motif) {
      case 'wax_seal':
        px(3, 3, 10, 10, pal.main);
        px(4, 2, 8, 12, pal.main);
        px(2, 4, 12, 8, pal.main);
        px(4, 4, 8, 8, pal.base);
        px(5, 5, 6, 6, pal.accent);
        px(6, 4, 4, 1, pal.bright);
        px(7, 6, 2, 4, pal.base);
        px(6, 7, 4, 2, pal.base);
        break;
      case 'ink_vial':
        px(6, 2, 4, 2, pal.accent);
        px(7, 4, 2, 2, pal.bright);
        px(4, 6, 8, 7, pal.main);
        px(5, 7, 6, 5, pal.bright);
        px(6, 8, 4, 3, pal.accent);
        break;
      case 'astrolabe':
        px(4, 3, 8, 10, pal.accent);
        px(5, 4, 6, 8, pal.base);
        px(4, 7, 8, 2, pal.bright);
        px(7, 3, 2, 10, pal.bright);
        px(6, 6, 4, 4, pal.main);
        px(7, 1, 2, 2, pal.accent);
        break;
      case 'emerald_prism':
        px(7, 2, 2, 2, pal.bright);
        px(5, 4, 6, 8, pal.main);
        px(6, 4, 2, 7, pal.bright);
        px(7, 12, 2, 2, pal.accent);
        px(3, 7, 2, 2, pal.accent);
        px(11, 7, 2, 2, pal.accent);
        break;
      case 'cipher_key':
        px(4, 3, 5, 5, pal.accent);
        px(5, 4, 3, 3, pal.base);
        px(8, 5, 5, 2, pal.bright);
        px(10, 7, 1, 3, pal.accent);
        px(12, 7, 1, 4, pal.accent);
        break;
      case 'silver_compass':
        px(3, 3, 10, 10, pal.bright);
        px(4, 4, 8, 8, pal.main);
        px(7, 4, 2, 4, pal.accent);
        px(7, 8, 2, 4, pal.bright);
        px(4, 7, 3, 2, pal.bright);
        px(9, 7, 3, 2, pal.accent);
        break;
      case 'cinnabar_quill':
        px(10, 2, 3, 3, pal.bright);
        px(8, 4, 4, 4, pal.main);
        px(6, 6, 4, 4, pal.main);
        px(5, 9, 3, 3, pal.accent);
        px(3, 11, 2, 3, pal.bright);
        break;
      case 'terroir_medal':
        px(4, 3, 8, 9, pal.main);
        px(5, 4, 6, 7, pal.bright);
        px(6, 5, 4, 5, pal.accent);
        px(6, 12, 2, 3, pal.accent);
        px(9, 12, 2, 3, pal.main);
        break;
    }

    if (unlocked) {
      px(3, 3, 1, 1, '#ffffff');
    }
  }, [collectible, unlocked]);

  return React.createElement('canvas', {
    ref: canvasRef,
    width: 16,
    height: 16,
    style: { width: size, height: size, imageRendering: 'pixelated' },
    className: `pixelated shrink-0 ${className}`,
    'aria-label': collectible.name,
  });
};

// ============================================================================
// 3. TYPES & PERSISTENT STATE FOR SECRET HIDDEN POIS & CLUES
// ============================================================================

export interface SecretClueFragment {
  clueKey: string;
  secretPoiId: string;
  clueIndex: 1 | 2;
  anchorPoiId: string;
  anchorPoiName: string;
  titleFr: string;
  marginaliaTextFr: string;
}

export interface SecretHiddenSite {
  secretPoiId: string;
  poi: PoiItem;
  codenameFr: string;
  archiveCote: string;
  bonusXpTotal: number;
  collectibleId: SecretCollectibleId;
  clues: [SecretClueFragment, SecretClueFragment];
  riddleQuestionFr: string;
  riddleOptionsFr: [string, string, string];
  correctOptionIndex: 0 | 1 | 2;
  decipherLoreFr: string;
}

export interface DiscoveredSecretEntryRecord {
  secretPoiId: string;
  name: string;
  codenameFr: string;
  archiveCote: string;
  category: ExplorationCategory;
  eraLabel: string;
  source: string;
  lat: number;
  lng: number;
  bonusXpAwarded: number;
  collectibleId: SecretCollectibleId;
  decipherLoreFr: string;
  summary: string;
  discoveredAtIso: string;
}

export interface SecretArchivesState {
  collectedClueKeys: string[];
  decipheredSecretIds: string[];
  proximityRevealedSecretIds: string[];
  discoveredSecretRecords: DiscoveredSecretEntryRecord[];
  unlockedCollectibleIds: SecretCollectibleId[];
}

export const SECRET_ARCHIVES_STORAGE_KEY = 'terra16_secret_archives_v1';

export function loadSecretArchivesState(): SecretArchivesState {
  try {
    const raw = localStorage.getItem(SECRET_ARCHIVES_STORAGE_KEY);
    if (!raw) {
      return {
        collectedClueKeys: [],
        decipheredSecretIds: [],
        proximityRevealedSecretIds: [],
        discoveredSecretRecords: [],
        unlockedCollectibleIds: [],
      };
    }
    const parsed = JSON.parse(raw);
    const validCollectibleIds = new Set(SECRET_COLLECTIBLES_CATALOG.map((c) => c.id));
    return {
      collectedClueKeys: Array.isArray(parsed?.collectedClueKeys)
        ? parsed.collectedClueKeys.filter((x: unknown): x is string => typeof x === 'string')
        : [],
      decipheredSecretIds: Array.isArray(parsed?.decipheredSecretIds)
        ? parsed.decipheredSecretIds.filter((x: unknown): x is string => typeof x === 'string')
        : [],
      proximityRevealedSecretIds: Array.isArray(parsed?.proximityRevealedSecretIds)
        ? parsed.proximityRevealedSecretIds.filter((x: unknown): x is string => typeof x === 'string')
        : [],
      discoveredSecretRecords: Array.isArray(parsed?.discoveredSecretRecords)
        ? parsed.discoveredSecretRecords.filter(
            (r: unknown): r is DiscoveredSecretEntryRecord =>
              Boolean(r && typeof r === 'object' && 'secretPoiId' in r && 'name' in r)
          )
        : [],
      unlockedCollectibleIds: Array.isArray(parsed?.unlockedCollectibleIds)
        ? parsed.unlockedCollectibleIds.filter(
            (x: unknown): x is SecretCollectibleId =>
              typeof x === 'string' && validCollectibleIds.has(x as SecretCollectibleId)
          )
        : [],
    };
  } catch {
    return {
      collectedClueKeys: [],
      decipheredSecretIds: [],
      proximityRevealedSecretIds: [],
      discoveredSecretRecords: [],
      unlockedCollectibleIds: [],
    };
  }
}

export function saveSecretArchivesState(state: SecretArchivesState): void {
  try {
    localStorage.setItem(SECRET_ARCHIVES_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota issues
  }
}

// ============================================================================
// 4. DETERMINISTIC GENERATOR OF SECTOR HIDDEN SITES & SYMPATHETIC-INK CLUES
// ============================================================================

function hashString32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function compassBearingInfo(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): { azimuthDeg: number; cardinalFr: string; oppositeCardinalFr: string; sideCardinalFr: string } {
  const dLat = toLat - fromLat;
  const cosLat = Math.max(0.2, Math.cos((fromLat * Math.PI) / 180));
  const dLng = (toLng - fromLng) * cosLat;
  const azimuthDeg = Math.round(((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360);
  const dirs8 = [
    'Nord',
    'Nord-Est',
    'Est',
    'Sud-Est',
    'Sud',
    'Sud-Ouest',
    'Ouest',
    'Nord-Ouest',
  ];
  const idx = Math.round(azimuthDeg / 45) % 8;
  return {
    azimuthDeg,
    cardinalFr: dirs8[idx],
    oppositeCardinalFr: dirs8[(idx + 4) % 8],
    sideCardinalFr: dirs8[(idx + 2) % 8],
  };
}

function chooseCollectibleForPoi(poi: PoiItem, seed: number): SecretCollectibleId {
  const official = inferOfficialStateLabel(poi.source, poi.subType, poi.officialLabel);
  if (official === 'monument_historique') return 'sceau_merimee_pourpre';
  if (official === 'maison_illustres') return 'astrolabe_illustres';
  if (official === 'jardin_remarquable') return 'prisme_jardins_secrets';
  if (official === 'datatourisme') return 'medaillon_terroir_ancien';
  if (poi.isSubterranean || poi.category === 'etrange') return 'fiole_encre_sympathique';
  if (poi.category === 'geographie') return 'boussole_argent_voilee';
  if (poi.category === 'legende') return 'plume_cinabre_royal';
  if (poi.category === 'ecosysteme') return 'prisme_jardins_secrets';
  return SECRET_COLLECTIBLES_CATALOG[seed % SECRET_COLLECTIBLES_CATALOG.length].id;
}

function scoreSecretCandidate(poi: PoiItem): number {
  let score = 0;
  const official = inferOfficialStateLabel(poi.source, poi.subType, poi.officialLabel);
  if (official === 'maison_illustres') score += 45;
  else if (official === 'jardin_remarquable') score += 42;
  else if (official === 'monument_historique') score += 38;
  else if (official === 'musee_de_france') score += 34;
  else if (official === 'datatourisme') score += 28;

  const hay = `${poi.name} ${poi.subType} ${poi.source}`.toLowerCase();
  if (/fontaine|source|lavoir|four|menhir|dolmen|calvaire|chapelle|crypte|cavité|souterrain|ruine|moulin|phare|palissy/.test(hay)) {
    score += 32;
  }
  if (poi.category === 'legende' || poi.category === 'etrange') score += 22;
  if (poi.summary.length >= 160) score += 15;
  score += (hashString32(poi.id) % 19);
  return score;
}

export function deriveSectorSecretSites(params: {
  allPois: PoiItem[];
  elevation: ElevationGrid | null;
  excludedPoiIds?: ReadonlySet<string>;
  alreadyDiscoveredIds?: ReadonlySet<string>;
}): SecretHiddenSite[] {
  const { allPois, elevation, excludedPoiIds, alreadyDiscoveredIds } = params;
  // Work primarily with surface POIs so explorers can reliably find anchors & walk to secrets on surface
  const surfacePool = allPois.filter((p) => !p.isSubterranean);
  if (surfacePool.length < 5) return [];

  const eligibleCandidates = surfacePool
    .filter((p) => !excludedPoiIds?.has(p.id))
    .sort((a, b) => scoreSecretCandidate(b) - scoreSecretCandidate(a));

  const chosenSecrets: PoiItem[] = [];
  const maxSecrets = surfacePool.length >= 11 ? 2 : 1;

  for (const cand of eligibleCandidates) {
    if (chosenSecrets.length >= maxSecrets) break;
    // Keep the two hidden sites well separated (> 420 m apart)
    if (chosenSecrets.some((s) => haversineMeters(s.lat, s.lng, cand.lat, cand.lng) < 420)) {
      continue;
    }
    // Must have at least 2 other POIs within 120m..1800m to act as Clue-Carrying Anchors
    const potentialAnchors = surfacePool.filter(
      (other) =>
        other.id !== cand.id &&
        !chosenSecrets.some((s) => s.id === other.id) &&
        haversineMeters(cand.lat, cand.lng, other.lat, other.lng) >= 85
    );
    if (potentialAnchors.length < 2) continue;
    chosenSecrets.push(cand);
  }

  const secretIdSet = new Set(chosenSecrets.map((s) => s.id));
  const usedAnchorIds = new Set<string>();
  const out: SecretHiddenSite[] = [];

  for (const secretPoi of chosenSecrets) {
    const seed = hashString32(secretPoi.id);
    // Pick 2 nearby non-secret Anchor POIs (preferring ones ~120 m to 950 m away, and if the user already unlocked one, even better—instant reward!)
    const sortedAnchors = surfacePool
      .filter((other) => !secretIdSet.has(other.id) && other.id !== secretPoi.id)
      .map((other) => {
        const d = haversineMeters(secretPoi.lat, secretPoi.lng, other.lat, other.lng);
        const distPenalty = d < 90 ? 900 : Math.abs(d - 380);
        const reusePenalty = usedAnchorIds.has(other.id) ? 450 : 0;
        const unlockedBonus = alreadyDiscoveredIds?.has(other.id) ? -120 : 0;
        return { other, d, rankScore: distPenalty + reusePenalty + unlockedBonus };
      })
      .sort((a, b) => a.rankScore - b.rankScore);

    if (sortedAnchors.length < 2) continue;
    const anchor1 = sortedAnchors[0].other;
    const anchor2 = sortedAnchors[1].other;
    usedAnchorIds.add(anchor1.id);
    usedAnchorIds.add(anchor2.id);

    const dist1Meters = Math.max(30, Math.round(haversineMeters(anchor1.lat, anchor1.lng, secretPoi.lat, secretPoi.lng)));
    const paces1 = Math.round(dist1Meters / 0.75);
    const bearing1 = compassBearingInfo(anchor1.lat, anchor1.lng, secretPoi.lat, secretPoi.lng);

    const altMeters = sampleElevationMeters(elevation, secretPoi.lat, secretPoi.lng);
    const official = inferOfficialStateLabel(secretPoi.source, secretPoi.subType, secretPoi.officialLabel);
    const officialHint = official
      ? OFFICIAL_STATE_LABEL_META[official].shortBadge
      : CATEGORY_META[secretPoi.category].shortLabel;

    const archiveCote = `AS-${((seed % 899) + 100).toString()}-${secretPoi.category.slice(0, 3).toUpperCase()}`;
    const codenames: Record<ExplorationCategory, string[]> = {
      histoire: ['Le Sanctuaire sous Scellés', 'La Pierre aux Chartes', 'Le Témoin Effacé'],
      geographie: ['Le Point Zéro Caché', 'La Résurgence Secrète', 'Le Signal d’Équerre'],
      ecosysteme: ['L’Enclos Botanique Secret', 'Le Refuge Centenaire', 'La Clairière Scellée'],
      etrange: ['La Chambre en Marge', 'L’Anomalie du Cadastre', 'Le Seuil Oublié'],
      legende: ['L’Autel des Murmures', 'La Trace Enchantée', 'Le Lieu-Dit Voilé'],
    };
    const catCodenames = codenames[secretPoi.category] || codenames.histoire;
    const codenameFr = catCodenames[seed % catCodenames.length];

    const clue1: SecretClueFragment = {
      clueKey: `${secretPoi.id}::1`,
      secretPoiId: secretPoi.id,
      clueIndex: 1,
      anchorPoiId: anchor1.id,
      anchorPoiName: anchor1.name,
      titleFr: 'Indice I · Relèvement d’Arpenteur',
      marginaliaTextFr: `« Depuis « ${anchor1.name} », portez vos pas vers le ${bearing1.cardinalFr} (azimut ${bearing1.azimuthDeg}°) sur environ ${dist1Meters} m (~${paces1} pas d’arpenteur) pour approcher ${codenameFr.toLowerCase()}. »`,
    };

    const waterPhrase = secretPoi.nearWaterway
      ? `à proximité des eaux (${secretPoi.waterwayName || 'cours d’eau local'})`
      : altMeters !== null
      ? `aux alentours de la courbe d’altitude ${Math.round(altMeters)} m`
      : `à l’écart des axes principaux`;

    const clue2: SecretClueFragment = {
      clueKey: `${secretPoi.id}::2`,
      secretPoiId: secretPoi.id,
      clueIndex: 2,
      anchorPoiId: anchor2.id,
      anchorPoiName: anchor2.name,
      titleFr: 'Indice II · Sceau des Âges & du Terrain',
      marginaliaTextFr: `« La seconde note marginale précise que ce lieu secret relève du registre « ${officialHint} » (${secretPoi.eraLabel || 'strate ancienne'}), dissimulé ${waterPhrase} : « ${secretPoi.mysteryTitle} ». »`,
    };

    // Build a deterministic 3-choice Cartographic Decipherment Riddle
    const correctAnswer = `Cap au ${bearing1.cardinalFr} depuis « ${anchor1.name.slice(0, 34)} » · ${secretPoi.eraLabel || officialHint}`;
    const wrong1 = `Cap au ${bearing1.oppositeCardinalFr} · Époque Contemporaine industrielle`;
    const wrong2 = `Cap au ${bearing1.sideCardinalFr} · Gisement sous-marin abyssal`;

    const correctOptionIndex = (seed % 3) as 0 | 1 | 2;
    const riddleOptionsFr: [string, string, string] =
      correctOptionIndex === 0
        ? [correctAnswer, wrong1, wrong2]
        : correctOptionIndex === 1
        ? [wrong1, correctAnswer, wrong2]
        : [wrong2, wrong1, correctAnswer];

    const bonusXpTotal = Math.max(320, Math.round(secretPoi.xpReward * 2.4));
    const collectibleId = chooseCollectibleForPoi(secretPoi, seed);

    out.push({
      secretPoiId: secretPoi.id,
      poi: secretPoi,
      codenameFr,
      archiveCote,
      bonusXpTotal,
      collectibleId,
      clues: [clue1, clue2],
      riddleQuestionFr: `D’après les notes à l’encre sympathique du secteur (${archiveCote}), quelle triangulation révèle l’emplacement exact de « ${codenameFr} » ?`,
      riddleOptionsFr,
      correctOptionIndex,
      decipherLoreFr: `En superposant le relèvement au ${bearing1.cardinalFr} (${dist1Meters} m depuis ${anchor1.name}) et la mention « ${secretPoi.mysteryTitle} » (${secretPoi.eraLabel}), l’encre sympathique dévoile un sceau pourpre sur votre carte ! Rendez-vous sur place pour briser le cachet secret.`,
    });
  }

  return out;
}

export function isSecretSiteRevealedOnMap(
  site: SecretHiddenSite,
  state: SecretArchivesState,
  unlockedEntryIds: ReadonlySet<string>
): boolean {
  if (unlockedEntryIds.has(site.secretPoiId)) return true;
  if (state.decipheredSecretIds.includes(site.secretPoiId)) return true;
  if (state.proximityRevealedSecretIds.includes(site.secretPoiId)) return true;
  // Also auto-reveal if the explorer has collected BOTH sympathetic-ink clues!
  const c1 = state.collectedClueKeys.includes(site.clues[0].clueKey) || unlockedEntryIds.has(site.clues[0].anchorPoiId);
  const c2 = state.collectedClueKeys.includes(site.clues[1].clueKey) || unlockedEntryIds.has(site.clues[1].anchorPoiId);
  return c1 && c2;
}

export function getCollectedCluesCountForSite(
  site: SecretHiddenSite,
  state: SecretArchivesState,
  unlockedEntryIds: ReadonlySet<string>
): number {
  let count = 0;
  for (const clue of site.clues) {
    if (state.collectedClueKeys.includes(clue.clueKey) || unlockedEntryIds.has(clue.anchorPoiId)) {
      count += 1;
    }
  }
  return count;
}

export function findSecretClueHostedOnPoi(
  poiId: string,
  sectorSecrets: SecretHiddenSite[]
): { site: SecretHiddenSite; clue: SecretClueFragment } | null {
  for (const site of sectorSecrets) {
    for (const clue of site.clues) {
      if (clue.anchorPoiId === poiId) {
        return { site, clue };
      }
    }
  }
  return null;
}

export function isEntryFromSecretArchive(
  entry: UnlockedEntry,
  state: SecretArchivesState
): boolean {
  if (entry.subType.startsWith('✦ Lieu Caché')) return true;
  return state.discoveredSecretRecords.some((r) => r.secretPoiId === entry.poiId);
}
