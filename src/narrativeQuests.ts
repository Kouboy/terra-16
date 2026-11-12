import {
  BedrockInfo,
  ElevationGrid,
  ExplorationCategory,
  haversineMeters,
  PoiItem,
  sampleElevationMeters,
  TrophyId,
} from './types';

export type NarrativeActPhase = 'debut' | 'milieu' | 'fin';

export interface NarrativeQuestStage {
  actNumber: 1 | 2 | 3;
  phase: NarrativeActPhase;
  phaseLabelFr: 'Acte I · Début' | 'Acte II · Milieu' | 'Acte III · Dénouement';
  poiId: string;
  poiName: string;
  mysteryTitle: string;
  category: ExplorationCategory;
  eraLabel: string;
  lat: number;
  lng: number;
  isSubterranean: boolean;
  reachRadiusMeters: number;
  clueTitleFr: string;
  clueFr: string;
  loreChapterTitleFr: string;
  loreParagraphFr: string;
  xpStageReward: number;
}

export interface NarrativeQuestRewardPreview {
  xpFinaleBonus: number;
  trophyId: TrophyId;
  trophyLabelFr: string;
  cosmeticSummaryFr: string;
  familiarSummaryFr: string;
}

export interface NarrativeQuest {
  id: string;
  slotKey: 'chronique_pierres' | 'pacte_ondes' | 'murmures_vivant';
  title: string;
  subtitle: string;
  epistemicDisclaimerFr: string;
  focusCategory: ExplorationCategory;
  localityLabel: string;
  totalRouteMeters: number;
  prologueFr: string;
  epilogueFr: string;
  stages: [NarrativeQuestStage, NarrativeQuestStage, NarrativeQuestStage];
  rewardPreview: NarrativeQuestRewardPreview;
}

export interface NarrativeProgressState {
  actsSealedByQuestId: Record<string, number>;
  completedQuestIds: string[];
  activeQuestId: string | null;
}

export const NARRATIVE_PROGRESS_STORAGE_KEY = 'terra16_narrative_progress_v1';

export function loadNarrativeProgress(): NarrativeProgressState {
  try {
    const raw = localStorage.getItem(NARRATIVE_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return { actsSealedByQuestId: {}, completedQuestIds: [], activeQuestId: null };
    }
    const parsed = JSON.parse(raw);
    const actsSealedByQuestId: Record<string, number> = {};
    if (parsed && typeof parsed.actsSealedByQuestId === 'object' && parsed.actsSealedByQuestId !== null) {
      for (const [k, v] of Object.entries(parsed.actsSealedByQuestId)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          actsSealedByQuestId[k] = Math.max(0, Math.min(3, Math.floor(v)));
        }
      }
    }
    const completedQuestIds = Array.isArray(parsed?.completedQuestIds)
      ? parsed.completedQuestIds.filter((x: unknown): x is string => typeof x === 'string')
      : [];
    const activeQuestId =
      typeof parsed?.activeQuestId === 'string' && parsed.activeQuestId.length > 0
        ? parsed.activeQuestId
        : null;
    return { actsSealedByQuestId, completedQuestIds, activeQuestId };
  } catch {
    return { actsSealedByQuestId: {}, completedQuestIds: [], activeQuestId: null };
  }
}

export function saveNarrativeProgress(state: NarrativeProgressState): void {
  try {
    localStorage.setItem(NARRATIVE_PROGRESS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function compassDirectionFr(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const dLat = toLat - fromLat;
  const dLng = (toLng - fromLng) * Math.cos(((fromLat + toLat) * 0.5 * Math.PI) / 180);
  const angleDeg = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
  const dirs = [
    'le nord',
    'le nord-est',
    'l’est',
    'le sud-est',
    'le sud',
    'le sud-ouest',
    'l’ouest',
    'le nord-ouest',
  ];
  return dirs[Math.round(angleDeg / 45) % 8];
}

function approxStepDistanceFr(meters: number): string {
  if (meters < 120) return `à une centaine de mètres à vol d’oiseau`;
  const rounded = Math.round(meters / 50) * 50;
  return `à environ ${rounded} m à vol d’oiseau`;
}

function sanitizeKeyPart(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
}

/**
 * Filters out unsafe, inaccessible or private sites from narrative walking quests.
 * Never guides explorers toward dangerous pits, non-touristic chasms, or private grounds.
 */
function isSafeAccessibleCandidate(p: PoiItem): boolean {
  if (p.isSubterranean) {
    const subL = (p.subType || '').toLowerCase();
    const isTouristic =
      subL.includes('aménagé') ||
      subL.includes('visite') ||
      subL.includes('touristique') ||
      subL.includes('grotte ornée');
    if (!isTouristic) return false;
  }
  if (p.safetyNotice) {
    const snL = p.safetyNotice.toLowerCase();
    if (
      snL.includes('danger') ||
      snL.includes('interdit') ||
      snL.includes('privé') ||
      snL.includes('pénétration interdite') ||
      snL.includes('gouffre') ||
      snL.includes('éboulis') ||
      snL.includes('abrupt') ||
      snL.includes('chute') ||
      snL.includes('escalade')
    ) {
      return false;
    }
  }
  const nameL = (p.name || '').toLowerCase();
  const subL = (p.subType || '').toLowerCase();
  if (nameL.includes('propriété privée') || subL.includes('privé')) {
    return false;
  }
  return true;
}

/**
 * Picks an interconnected trio of distinct POIs prioritizing shared `relatedPoiIds`,
 * shared waterways, walkable intermediate distances (50m - 900m), and thematic coherence.
 */
function pickInterconnectedTrio(
  candidates: PoiItem[],
  fallbackPool: PoiItem[],
  usedStartIds: Set<string>
): [PoiItem, PoiItem, PoiItem] | null {
  const safeCandidates = candidates.filter(isSafeAccessibleCandidate);
  const safeFallback = fallbackPool.filter(isSafeAccessibleCandidate);

  const mergedMap = new Map<string, PoiItem>();
  for (const p of safeCandidates) mergedMap.set(p.id, p);
  if (mergedMap.size < 3) {
    for (const p of safeFallback) {
      mergedMap.set(p.id, p);
      if (mergedMap.size >= 14) break;
    }
  }
  const pool = Array.from(mergedMap.values());
  if (pool.length < 3) return null;

  // Choose Act I (start) preferring candidates not yet used as start
  const preferredStarts = safeCandidates.filter((p) => !usedStartIds.has(p.id));
  const act1 =
    preferredStarts[0] ||
    pool.find((p) => !usedStartIds.has(p.id)) ||
    pool[0];
  usedStartIds.add(act1.id);

  const scoreNext = (from: PoiItem, cand: PoiItem, excludeIds: Set<string>): number => {
    if (excludeIds.has(cand.id)) return -1e9;
    const dist = haversineMeters(from.lat, from.lng, cand.lat, cand.lng);
    // RoadMap Lot 4: Strict accessible pedestrian bounds (50m - 900m per leg)
    if (dist < 50 || dist > 900) return -1e9;

    let score = 0;
    // Ideal narrative walk leg: 75m to 650m
    if (dist >= 75 && dist <= 650) score += 60;
    else score += 25;

    if (from.relatedPoiIds.includes(cand.id) || cand.relatedPoiIds.includes(from.id)) {
      score += 60;
    }
    if (from.waterwayName && cand.waterwayName && from.waterwayName === cand.waterwayName) {
      score += 40;
    }
    if (candidates.some((c) => c.id === cand.id)) {
      score += 35;
    }
    if (cand.category === from.category) {
      score += 25;
    }
    if (cand.eraLabel && from.eraLabel && cand.eraLabel !== from.eraLabel) {
      score += 15; // rich temporal progression
    }
    return score;
  };

  const used = new Set<string>([act1.id]);
  let act2: PoiItem | null = null;
  let bestScore2 = -1e9;
  for (const cand of pool) {
    const s = scoreNext(act1, cand, used);
    if (s > bestScore2) {
      bestScore2 = s;
      act2 = cand;
    }
  }
  // Require accessible and thematically relevant intermediate link (minimum score 30)
  if (!act2 || bestScore2 < 30) return null;
  used.add(act2.id);

  let act3: PoiItem | null = null;
  let bestScore3 = -1e9;
  for (const cand of pool) {
    const s = scoreNext(act2, cand, used);
    if (s > bestScore3) {
      bestScore3 = s;
      act3 = cand;
    }
  }
  // Require accessible and thematically relevant final link (minimum score 30)
  if (!act3 || bestScore3 < 30) return null;

  // Maximum cumulative pedestrian route: 1750m (~20-25 min stroll)
  const leg12 = haversineMeters(act1.lat, act1.lng, act2.lat, act2.lng);
  const leg23 = haversineMeters(act2.lat, act2.lng, act3.lat, act3.lng);
  if (leg12 + leg23 > 1750) return null;

  return [act1, act2, act3];
}

function cleanSnippet(summary: string, fallback: string): string {
  const trimmed = (summary || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return fallback;
  return trimmed.length > 210 ? `${trimmed.slice(0, 207).trimEnd()}…` : trimmed;
}

/**
 * Generates up to 3 sequential 3-Act Narrative Quests anchored on the sector's real POIs,
 * bedrock geology, elevation, and waterways.
 */
export function generateSectorNarrativeQuests(params: {
  sectorCenter: { lat: number; lng: number };
  surfacePois: PoiItem[];
  subterraneanPois: PoiItem[];
  bedrock: BedrockInfo | null;
  elevation?: ElevationGrid | null;
  localityLabel: string;
}): NarrativeQuest[] {
  const {
    sectorCenter,
    surfacePois,
    subterraneanPois,
    bedrock,
    elevation,
    localityLabel,
  } = params;

  const allPois: PoiItem[] = [...surfacePois, ...subterraneanPois];
  if (allPois.length < 3) return [];

  const sectorKey = `${Math.round(sectorCenter.lat * 200)}_${Math.round(sectorCenter.lng * 200)}`;
  const placeName = localityLabel?.trim() || 'cette contrée';
  const litho = bedrock?.lithology ? bedrock.lithology.toLowerCase() : 'roche ancienne';
  const periodLabel = bedrock?.period || 'temps géologiques anciens';

  const usedStartIds = new Set<string>();
  const quests: NarrativeQuest[] = [];

  // --------------------------------------------------------------------------
  // TRILOGIE 1: La Chronique des Trois Sceaux (Histoire & Souterrains)
  // --------------------------------------------------------------------------
  const histCandidates = allPois.filter(
    (p) => p.category === 'histoire' || p.category === 'etrange' || p.relatedPoiIds.length > 0
  );
  const trio1 = pickInterconnectedTrio(histCandidates, allPois, usedStartIds);
  if (trio1) {
    const [p1, p2, p3] = trio1;
    const leg12 = Math.round(haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng));
    const leg23 = Math.round(haversineMeters(p2.lat, p2.lng, p3.lat, p3.lng));
    const dirCenterTo1 = compassDirectionFr(sectorCenter.lat, sectorCenter.lng, p1.lat, p1.lng);
    const dir1To2 = compassDirectionFr(p1.lat, p1.lng, p2.lat, p2.lng);
    const dir2To3 = compassDirectionFr(p2.lat, p2.lng, p3.lat, p3.lng);

    quests.push({
      id: `nq_${sectorKey}_pierres_${sanitizeKeyPart(p1.id)}`,
      slotKey: 'chronique_pierres',
      title: `Le Fil des Bâtisseurs de ${placeName}`,
      subtitle: `Itinéraire Thématique Facultatif · 3 témoins (~${Math.round((leg12 + leg23) / 50) * 50} m à vol d’oiseau)`,
      epistemicDisclaimerFr:
        'Parcours thématique entièrement facultatif composé par votre Grimoire : les trois lieux sont réels et documentés, mais les distances indiquées sont estimées à vol d’oiseau. Adaptez toujours votre trajet aux voies et sentiers publics réellement praticables, sans jamais forcer un passage dangereux ni franchir de clôture privée. Vous pouvez interrompre ou abandonner cet itinéraire à tout moment sans aucune pénalité.',
      focusCategory: 'histoire',
      localityLabel: placeName,
      totalRouteMeters: leg12 + leg23,
      prologueFr: `Votre Grimoire associe trois témoins patrimoniaux de ${placeName} pour composer une proposition de promenade thématique sur le socle de ${litho}. Les lieux sont tous réels et documentés : cheminez librement selon les sentiers praticables pour en explorer les correspondances architecturales.`,
      epilogueFr: `Les trois témoins de ${placeName} sont désormais visités ! De « ${p1.name} » jusqu’à « ${p3.name} » en passant par « ${p2.name} », vous avez relié à pied les fondations de ${litho} aux œuvres humaines locales. Votre carnet s’enrichit de cette trilogie d’arpentage.`,
      rewardPreview: {
        xpFinaleBonus: 180,
        trophyId: 'tisserand_recits',
        trophyLabelFr: 'Trophée « Tisserand des Récits »',
        cosmeticSummaryFr: 'Laurier d’Or des Trois Actes & Calame Scellé',
        familiarSummaryFr: 'Petit Cerf Blanc des Légendes',
      },
      stages: [
        {
          actNumber: 1,
          phase: 'debut',
          phaseLabelFr: 'Acte I · Début',
          poiId: p1.id,
          poiName: p1.name,
          mysteryTitle: p1.mysteryTitle || 'Premier Jalon du Serment',
          category: p1.category,
          eraLabel: p1.eraLabel,
          lat: p1.lat,
          lng: p1.lng,
          isSubterranean: Boolean(p1.isSubterranean),
          reachRadiusMeters: Math.max(55, p1.unlockRadiusMeters || 55),
          clueTitleFr: 'Indice d’Ouverture — La Première Pierre',
          clueFr: `Portez vos pas vers ${dirCenterTo1} du secteur pour trouver ce témoin (${p1.subType || p1.eraLabel})${p1.isSubterranean ? ' dissimulé en strate souterraine' : ''}. C’est ici que s’ouvre le premier feuillet du manuscrit.`,
          loreChapterTitleFr: `Acte I révélé — Les Fondations à « ${p1.name} »`,
          loreParagraphFr: `Au pied de « ${p1.name} » (${p1.eraLabel}), une marque d’arpenteur renvoie aux strates anciennes : ${cleanSnippet(p1.summary, 'ce jalon garde l’empreinte des premiers bâtisseurs locaux.')} Dans la marge du parchemin, une flèche désigne la halte médiane vers ${dir1To2}.`,
          xpStageReward: 45,
        },
        {
          actNumber: 2,
          phase: 'milieu',
          phaseLabelFr: 'Acte II · Milieu',
          poiId: p2.id,
          poiName: p2.name,
          mysteryTitle: p2.mysteryTitle || 'Le Nœud Médian',
          category: p2.category,
          eraLabel: p2.eraLabel,
          lat: p2.lat,
          lng: p2.lng,
          isSubterranean: Boolean(p2.isSubterranean),
          reachRadiusMeters: Math.max(55, p2.unlockRadiusMeters || 55),
          clueTitleFr: 'Indice du Milieu — Le Relais des Époques',
          clueFr: `Depuis « ${p1.name} », marchez vers ${dir1To2} (${approxStepDistanceFr(leg12)}) jusqu’au repère suivant (${p2.subType || p2.eraLabel})${p2.nearWaterway && p2.waterwayName ? ` non loin de ${p2.waterwayName}` : ''}.`,
          loreChapterTitleFr: `Acte II révélé — La Croisée de « ${p2.name} »`,
          loreParagraphFr: `Le récit se noue ici, à « ${p2.name} » : ${cleanSnippet(p2.summary, 'les générations y ont transmis les savoirs du terroir.')} En reliant ce lieu à « ${p1.name} », le parchemin dévoile l’orientation ultime : cap sur ${dir2To3} pour sceller le dénouement.`,
          xpStageReward: 55,
        },
        {
          actNumber: 3,
          phase: 'fin',
          phaseLabelFr: 'Acte III · Dénouement',
          poiId: p3.id,
          poiName: p3.name,
          mysteryTitle: p3.mysteryTitle || 'La Clef de Voûte',
          category: p3.category,
          eraLabel: p3.eraLabel,
          lat: p3.lat,
          lng: p3.lng,
          isSubterranean: Boolean(p3.isSubterranean),
          reachRadiusMeters: Math.max(55, p3.unlockRadiusMeters || 55),
          clueTitleFr: 'Indice Final — La Clef de Voûte',
          clueFr: `Quittez « ${p2.name} » en direction de ${dir2To3} (${approxStepDistanceFr(leg23)}) pour atteindre le troisième et dernier jalon (${p3.subType || p3.eraLabel}) où s’achève la chronique.`,
          loreChapterTitleFr: `Acte III révélé — Le Dénouement à « ${p3.name} »`,
          loreParagraphFr: `Devant « ${p3.name} » (${p3.eraLabel}), la trilogie prend tout son sens : ${cleanSnippet(p3.summary, 'ce dernier témoin couronne la mémoire du secteur.')} Les trois étapes forment désormais un récit complet gravé dans votre Grimoire.`,
          xpStageReward: 80,
        },
      ],
    });
  }

  // --------------------------------------------------------------------------
  // TRILOGIE 2: Le Pacte du Socle et de l'Onde (Géologie, Reliefs & Cours d'eau)
  // --------------------------------------------------------------------------
  const geoWaterCandidates = allPois.filter(
    (p) => p.category === 'geographie' || p.nearWaterway
  );
  const trio2 = pickInterconnectedTrio(geoWaterCandidates, allPois, usedStartIds);
  if (trio2 && (!trio1 || trio2[0].id !== trio1[0].id || trio2[2].id !== trio1[2].id)) {
    const [p1, p2, p3] = trio2;
    const alt1 = sampleElevationMeters(elevation, p1.lat, p1.lng);
    const alt3 = sampleElevationMeters(elevation, p3.lat, p3.lng);
    const leg12 = Math.round(haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng));
    const leg23 = Math.round(haversineMeters(p2.lat, p2.lng, p3.lat, p3.lng));
    const dir1To2 = compassDirectionFr(p1.lat, p1.lng, p2.lat, p2.lng);
    const dir2To3 = compassDirectionFr(p2.lat, p2.lng, p3.lat, p3.lng);
    const waterThread =
      p1.waterwayName || p2.waterwayName || p3.waterwayName || 'les veines d’eau du vallon';

    quests.push({
      id: `nq_${sectorKey}_ondes_${sanitizeKeyPart(p1.id)}`,
      slotKey: 'pacte_ondes',
      title: `Le Dialogue du Socle et de l’Onde`,
      subtitle: `Itinéraire Géographique Facultatif · 3 stations (~${Math.round((leg12 + leg23) / 50) * 50} m à vol d’oiseau)`,
      epistemicDisclaimerFr:
        'Parcours géographique entièrement facultatif composé par votre Grimoire : rapprochement topographique libre pour lire les pentes et l’écoulement. Les distances sont estimées à vol d’oiseau ; suivez toujours les chemins publics praticables sans vous exposer à des pentes raides ni pénétrer sur un terrain privé. Vous pouvez abandonner ou suspendre cette marche à tout moment sans pénalité.',
      focusCategory: 'geographie',
      localityLabel: placeName,
      totalRouteMeters: leg12 + leg23,
      prologueFr: `Votre Grimoire rapproche trois stations topographiques pour donner à observer la roche (${litho}), la pente et la course de ${waterThread}. Suivez librement ces trois points le long des chemins publics pour lire comment le socle géologique et l’eau façonnent le relief.`,
      epilogueFr: `Du point d’éveil${alt1 !== null ? ` (${Math.round(alt1)} m d’altitude)` : ''} jusqu’au terme${alt3 !== null ? ` (${Math.round(alt3)} m)` : ''}, vous avez parcouru le dialogue entre le socle minéral et ${waterThread}. La Guilde de Géologie salue votre lecture du terrain !`,
      rewardPreview: {
        xpFinaleBonus: 180,
        trophyId: 'maitre_chroniques',
        trophyLabelFr: 'Progression vers « Maître des Chroniques » & « Manteau Enluminé »',
        cosmeticSummaryFr: 'Manteau Enluminé des Récits (à 2 récits complétés)',
        familiarSummaryFr: 'Petit Cerf Blanc des Légendes',
      },
      stages: [
        {
          actNumber: 1,
          phase: 'debut',
          phaseLabelFr: 'Acte I · Début',
          poiId: p1.id,
          poiName: p1.name,
          mysteryTitle: p1.mysteryTitle || 'La Source du Relief',
          category: p1.category,
          eraLabel: p1.eraLabel,
          lat: p1.lat,
          lng: p1.lng,
          isSubterranean: Boolean(p1.isSubterranean),
          reachRadiusMeters: Math.max(55, p1.unlockRadiusMeters || 55),
          clueTitleFr: 'Indice d’Ouverture — L’Empreinte Minérale',
          clueFr: `Ralliez le premier point d’observation (${p1.subType || 'repère du terrain'})${alt1 !== null ? ` situé vers ${Math.round(alt1)} m d’altitude` : ''} pour entamer la lecture du relief.`,
          loreChapterTitleFr: `Acte I révélé — L’Assise de « ${p1.name} »`,
          loreParagraphFr: `À « ${p1.name} », le substrat de ${litho} issu du ${periodLabel} révèle comment le relief commande les écoulements : ${cleanSnippet(p1.summary, 'premier point d’ancrage entre la pierre et le ciel.')} Poursuivez vers ${dir1To2} pour suivre la ligne de partage.`,
          xpStageReward: 45,
        },
        {
          actNumber: 2,
          phase: 'milieu',
          phaseLabelFr: 'Acte II · Milieu',
          poiId: p2.id,
          poiName: p2.name,
          mysteryTitle: p2.mysteryTitle || 'Le Passage des Eaux',
          category: p2.category,
          eraLabel: p2.eraLabel,
          lat: p2.lat,
          lng: p2.lng,
          isSubterranean: Boolean(p2.isSubterranean),
          reachRadiusMeters: Math.max(55, p2.unlockRadiusMeters || 55),
          clueTitleFr: 'Indice du Milieu — Le Fil Topographique',
          clueFr: `Depuis « ${p1.name} », progressez vers ${dir1To2} (${approxStepDistanceFr(leg12)}) afin d’atteindre la station médiane (${p2.subType || p2.eraLabel}).`,
          loreChapterTitleFr: `Acte II révélé — Le Seuil de « ${p2.name} »`,
          loreParagraphFr: `À mi-parcours, « ${p2.name} » témoigne de l’adaptation humaine aux pentes et à ${waterThread} : ${cleanSnippet(p2.summary, 'un jalon charnière du paysage local.')} Une dernière marche vers ${dir2To3} vous conduira à l’aboutissement du tracé.`,
          xpStageReward: 55,
        },
        {
          actNumber: 3,
          phase: 'fin',
          phaseLabelFr: 'Acte III · Dénouement',
          poiId: p3.id,
          poiName: p3.name,
          mysteryTitle: p3.mysteryTitle || 'L’Horizon Scellé',
          category: p3.category,
          eraLabel: p3.eraLabel,
          lat: p3.lat,
          lng: p3.lng,
          isSubterranean: Boolean(p3.isSubterranean),
          reachRadiusMeters: Math.max(55, p3.unlockRadiusMeters || 55),
          clueTitleFr: 'Indice Final — L’Aboutissement du Socle',
          clueFr: `Depuis « ${p2.name} », gagnez vers ${dir2To3} (${approxStepDistanceFr(leg23)}) le dernier site (${p3.subType || p3.eraLabel}) qui referme la lecture géomorphologique.`,
          loreChapterTitleFr: `Acte III révélé — La Synthèse à « ${p3.name} »`,
          loreParagraphFr: `En touchant au but devant « ${p3.name} », la carte mentale s’éclaire : ${cleanSnippet(p3.summary, 'ce point referme l’arc naturel et humain du secteur.')} Le Pacte du Socle et de l’Onde est scellé.`,
          xpStageReward: 80,
        },
      ],
    });
  }

  // --------------------------------------------------------------------------
  // TRILOGIE 3: Les Murmures du Vivant & des Légendes (Écosystème & Légendes)
  // --------------------------------------------------------------------------
  const mythEcoCandidates = allPois.filter(
    (p) => p.category === 'ecosysteme' || p.category === 'legende' || p.category === 'etrange'
  );
  const trio3 = pickInterconnectedTrio(mythEcoCandidates, allPois, usedStartIds);
  if (
    trio3 &&
    !quests.some((q) => q.stages[0].poiId === trio3[0].id && q.stages[2].poiId === trio3[2].id)
  ) {
    const [p1, p2, p3] = trio3;
    const leg12 = Math.round(haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng));
    const leg23 = Math.round(haversineMeters(p2.lat, p2.lng, p3.lat, p3.lng));
    const dir1To2 = compassDirectionFr(p1.lat, p1.lng, p2.lat, p2.lng);
    const dir2To3 = compassDirectionFr(p2.lat, p2.lng, p3.lat, p3.lng);

    quests.push({
      id: `nq_${sectorKey}_murmures_${sanitizeKeyPart(p1.id)}`,
      slotKey: 'murmures_vivant',
      title: `Les Murmures de la Futaie & des Contes`,
      subtitle: `Itinéraire Écologique & Légendaire Facultatif · 3 haltes (~${Math.round((leg12 + leg23) / 50) * 50} m à vol d’oiseau)`,
      epistemicDisclaimerFr:
        'Parcours sensible entièrement facultatif composé par votre Grimoire : rapprochement évocateur entre refuges naturels et mémoire populaire locale. Les distances sont indicatives (à vol d’oiseau) : progressez sur les sentiers publics balisés, dans le respect de la faune et de la flore, sans franchir de clôture. Vous pouvez abandonner cet itinéraire à tout moment sans aucune pénalité.',
      focusCategory: p1.category === 'legende' ? 'legende' : 'ecosysteme',
      localityLabel: placeName,
      totalRouteMeters: leg12 + leg23,
      prologueFr: `Votre Grimoire compose une boucle contemplative facultative reliant les refuges du vivant et les lieux chargés de contes à ${placeName}. Une promenade sensible pour observer la flore, guetter les petits habitants des bois et redécouvrir le folklore du terroir.`,
      epilogueFr: `Les trois murmures de ${placeName} se répondent enfin ! En reliant dans l’ordre « ${p1.name} », « ${p2.name} » et « ${p3.name} », vous avez accordé votre pas à l’observation naturaliste et à l’imaginaire poétique du pays.`,
      rewardPreview: {
        xpFinaleBonus: 180,
        trophyId: 'maitre_chroniques',
        trophyLabelFr: 'Trophée d’Obsidienne « Maître des Chroniques » (à 3 récits)',
        cosmeticSummaryFr: 'Laurier d’Or, Calame Scellé & Manteau Enluminé',
        familiarSummaryFr: 'Petit Cerf Blanc des Légendes',
      },
      stages: [
        {
          actNumber: 1,
          phase: 'debut',
          phaseLabelFr: 'Acte I · Début',
          poiId: p1.id,
          poiName: p1.name,
          mysteryTitle: p1.mysteryTitle || 'L’Orée du Conte',
          category: p1.category,
          eraLabel: p1.eraLabel,
          lat: p1.lat,
          lng: p1.lng,
          isSubterranean: Boolean(p1.isSubterranean),
          reachRadiusMeters: Math.max(55, p1.unlockRadiusMeters || 55),
          clueTitleFr: 'Indice d’Ouverture — L’Éveil du Sentier',
          clueFr: `Rejoignez d’abord l’orée du récit (${p1.subType || p1.eraLabel}) où affleure la première trace entre nature et mémoire.`,
          loreChapterTitleFr: `Acte I révélé — Premier Souffle à « ${p1.name} »`,
          loreParagraphFr: `Près de « ${p1.name} », le bruissement du vent livre le premier verset : ${cleanSnippet(p1.summary, 'un refuge précieux où veille l’esprit du lieu.')} Une empreinte dorée pointe désormais vers ${dir1To2}.`,
          xpStageReward: 45,
        },
        {
          actNumber: 2,
          phase: 'milieu',
          phaseLabelFr: 'Acte II · Milieu',
          poiId: p2.id,
          poiName: p2.name,
          mysteryTitle: p2.mysteryTitle || 'Le Cœur Secret',
          category: p2.category,
          eraLabel: p2.eraLabel,
          lat: p2.lat,
          lng: p2.lng,
          isSubterranean: Boolean(p2.isSubterranean),
          reachRadiusMeters: Math.max(55, p2.unlockRadiusMeters || 55),
          clueTitleFr: 'Indice du Milieu — La Piste Dorée',
          clueFr: `Depuis « ${p1.name} », suivez la piste vers ${dir1To2} (${approxStepDistanceFr(leg12)}) jusqu’à la halte centrale (${p2.subType || p2.eraLabel}).`,
          loreChapterTitleFr: `Acte II révélé — Le Nœud de « ${p2.name} »`,
          loreParagraphFr: `À « ${p2.name} », le conte s’approfondit : ${cleanSnippet(p2.summary, 'les récits d’autrefois et le vivant s’y entrelacent.')} Le dernier indice vous invite à marcher vers ${dir2To3}.`,
          xpStageReward: 55,
        },
        {
          actNumber: 3,
          phase: 'fin',
          phaseLabelFr: 'Acte III · Dénouement',
          poiId: p3.id,
          poiName: p3.name,
          mysteryTitle: p3.mysteryTitle || 'La Clairière du Dénouement',
          category: p3.category,
          eraLabel: p3.eraLabel,
          lat: p3.lat,
          lng: p3.lng,
          isSubterranean: Boolean(p3.isSubterranean),
          reachRadiusMeters: Math.max(55, p3.unlockRadiusMeters || 55),
          clueTitleFr: 'Indice Final — Le Dernier Murmure',
          clueFr: `Cap vers ${dir2To3} depuis « ${p2.name} » (${approxStepDistanceFr(leg23)}) pour atteindre le sanctuaire final (${p3.subType || p3.eraLabel}) et clore l’histoire.`,
          loreChapterTitleFr: `Acte III révélé — L’Épilogue de « ${p3.name} »`,
          loreParagraphFr: `Devant « ${p3.name} », la légende s’accomplit : ${cleanSnippet(p3.summary, 'ultime refuge où la mémoire du secteur demeure vivante.')} Le récit des trois haltes brille désormais d’une encre inaltérable.`,
          xpStageReward: 80,
        },
      ],
    });
  }

  return quests;
}

export function getSealedActsCount(
  state: NarrativeProgressState,
  questId: string
): 0 | 1 | 2 | 3 {
  if (state.completedQuestIds.includes(questId)) return 3;
  const raw = state.actsSealedByQuestId[questId] || 0;
  return Math.max(0, Math.min(3, Math.floor(raw))) as 0 | 1 | 2 | 3;
}
