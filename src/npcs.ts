import React, { useEffect, useRef } from 'react';
import {
  BedrockInfo,
  EffectiveTimeOfDay,
  ElevationGrid,
  PoiItem,
  RumorLead,
  SubterraneanFeature,
  TerrainFeature,
  WeatherInfo,
  haversineMeters,
  resolveEffectiveTimeOfDay,
  sampleElevationMeters,
} from './types';

export type NpcKind =
  | 'citadin'
  | 'villageois'
  | 'erudit'
  | 'colporteur'
  | 'randonneur'
  | 'puisatier'
  | 'renard'
  | 'cerf'
  | 'chouette'
  | 'abeille'
  | 'papillon'
  | 'lucane'
  | 'luciole'
  | 'grenouille'
  | 'libellule'
  | 'martin_pecheur'
  | 'chamois'
  | 'chauve_souris'
  | 'salamandre';

export type NpcVoiceKind = 'human_low' | 'human_mid' | 'human_bright' | 'bird' | 'beast' | 'insect' | 'amphibian';

export interface WorldNpc {
  id: string;
  kind: NpcKind;
  voice: NpcVoiceKind;
  isHuman: boolean;
  isSubterranean: boolean;
  name: string;
  roleLabel: string;
  habitatLabel: string;
  lat: number;
  lng: number;
  facing: 'left' | 'right';
  seed: number;
  dialogues: string[];
}

// Tile & settlement constants matching PixelMapCanvas topological grids
const T_MEADOW = 0;
const T_RESIDENTIAL = 1;
const T_FARMLAND = 2;
const T_PARK = 3;
const T_FOREST = 4;
const T_PLAZA = 5;
const T_WATER = 6;
const T_PATH = 7;
const T_STREET = 8;
const T_MAIN_ROAD = 9;
const T_STEPS = 10;
const T_RAIL = 11;
const T_BUILDING = 12;
const T_PIER = 13;
const T_INDUSTRIAL = 14;
const T_COMMERCIAL = 15;
const T_CEMETERY = 16;
const T_SAND = 17;
const T_SCRUB = 18;
const T_WETLAND = 19;
const T_SCREE = 20;

const SETTLE_RURAL = 0;
const SETTLE_CITY_CENTER = 1;
const SETTLE_SUBURB = 2;
const SETTLE_VILLAGE = 3;
const SETTLE_HAMLET = 4;

const D_ROCK = 0;
const D_GALLERY = 1;
const D_METRO_RAIL = 2;
const D_SUB_WATER = 3;
const D_CELLAR = 4;
const D_QUARRY_HALL = 5;
const D_NATURAL_CAVERN = 6;
const D_CRYPT = 7;
const D_STAIRS = 8;
const D_CULVERT = 9;
const D_AQUEDUCT = 10;
const D_FAULT_VEIN = 11;

function npcHash(a: number, b: number): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

const HUMAN_FIRST_NAMES = [
  'Anselme',
  'Clémence',
  'Gaspard',
  'Léonie',
  'Théophile',
  'Marguerite',
  'Bastien',
  'Solange',
  'Octave',
  'garance',
  'Corentin',
  'Adélaïde',
  'Cyprien',
  'Mélusine',
  'Valentin',
  'Héloïse',
].map((n) => n.charAt(0).toUpperCase() + n.slice(1));

// ============================================================================
// FRENCH LINGUISTIC & NARRATIVE HELPERS (Natural Articles, Toponyms & Digest)
// ============================================================================

function stripTechnicalNoise(raw: string): string {
  return raw
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/\([^)]*(?:PA\d{4,}|IA\d{4,}|BSS|IDF\w+|BRGM|Mérimée|Palissy|ZNIEFF|INPN|Q\d{3,})[^)]*\)/gi, '')
    .replace(/Classé\/inscrit aux Monuments Historiques[^.]*\./gi, '')
    .replace(/Lieu répertorié dans le graphe patrimonial Wikidata\.?/gi, '')
    .replace(/recensé dans l’inventaire collaboratif du patrimoine[^.]*\./gi, '')
    .replace(/cavité souterraine répertoriée par le BRGM[^.]*\./gi, '')
    .replace(/forage ou puits d’observation hydrogéologique[^.]*\./gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSpokenPlaceName(raw: string): string {
  let s = raw
    .replace(/^Plaque\s*:\s*/i, '')
    .replace(/^Ancienne carrière souterraine\s*[—-]\s*/i, 'les anciennes carrières ')
    .replace(/^Cavité karstique naturelle \/ aven\s*[—-]\s*/i, 'la cavité ')
    .replace(/^Ouvrage souterrain[^\w—-]*[—-]\s*/i, '')
    .replace(/^Percée souterraine\s*:\s*/i, '')
    .replace(/^Cours souterrain\s*:\s*/i, '')
    .replace(/\s*\([A-Z]{2,}\d[\w-]*\)\s*$/g, '')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 68) {
    const cut = s.slice(0, 66);
    const sp = cut.lastIndexOf(' ');
    s = `${sp > 28 ? cut.slice(0, sp) : cut}…`;
  }
  return s;
}

/**
 * Formats a French river/waterway name after "de" -> "de la Seine", "du Rhône", "de l’Oise"
 */
function deWaterwayFr(rawName: string): string {
  const n = cleanSpokenPlaceName(rawName);
  if (!n) return 'de la rivière';
  if (/^la\s+/i.test(n)) return `de la ${n.slice(3)}`;
  if (/^le\s+/i.test(n)) return `du ${n.slice(3)}`;
  if (/^les\s+/i.test(n)) return `des ${n.slice(4)}`;
  if (/^l['’]/i.test(n)) return `de l’${n.slice(2)}`;
  if (/^[aeiouyéèêëîïôùûh]/i.test(n)) return `de l’${n}`;
  if (/^(canal|ruisseau|fleuve|rhône|rhin|doubs|lot|tarn|cher|loir|gard|var|gers)\b/i.test(n)) {
    return `du ${n}`;
  }
  return `de la ${n}`;
}

/**
 * Formats a French street, square, wood, park or monument naturally after a directional preposition
 * ("sur la place...", "dans la rue...", "du côté de l’église...", "vers le château...")
 */
function versLieuFr(rawName: string): string {
  const n = cleanSpokenPlaceName(rawName);
  if (!n) return 'ce lieu';
  const low = n.toLowerCase();
  if (/^(la |le |les |l['’]|un |une )/.test(low)) {
    return n.charAt(0).toLowerCase() + n.slice(1);
  }
  if (/^(place|esplanade|parvis)\b/i.test(n)) return `la ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
  if (/^(rue|ruelle|avenue|allée|impasse|voie|route|chaussée)\b/i.test(n)) {
    return `la ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
  }
  if (/^(pont|quai|boulevard|chemin|sentier|square|parc|jardin|bois|château|manoir|moulin|musée|théâtre|marché|lavoir|phare|port|fort|couvent|monastère|prieuré|palais|temple|dolmen|menhir|tumulus|viaduc)\b/i.test(n)) {
    return `le ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
  }
  if (/^(église|abbaye|chapelle|cathédrale|basilique|halle|tour|fontaine|porte|citadelle|villa|maison|gare|forêt|grotte|carrière|crypte)\b/i.test(n)) {
    const startsVowel = /^[aeiouyéèêëîïôùûh]/i.test(n);
    return startsVowel
      ? `l’${n.charAt(0).toLowerCase()}${n.slice(1)}`
      : `la ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
  }
  if (/^(arènes|halles|thermes|ruines|remparts|jardins|quais)\b/i.test(n)) {
    return `les ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
  }
  return `« ${n} »`;
}

function surVoieOuPlaceFr(rawName: string): string {
  const n = cleanSpokenPlaceName(rawName);
  if (!n) return 'par ici';
  if (/^(place|esplanade|parvis)\b/i.test(n)) return `sur la ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
  if (/^(rue|ruelle|avenue|allée|impasse|route)\b/i.test(n)) return `dans la ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
  if (/^(quai|pont|boulevard|chemin|sentier|square|cours)\b/i.test(n)) return `le long du ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
  return `du côté de ${versLieuFr(n)}`;
}

function humanizeGeologicalPeriod(raw: string): string {
  const s = raw.trim();
  const map: Array<[RegExp, string]> = [
    [/upper cretaceous/i, 'Crétacé supérieur'],
    [/lower cretaceous/i, 'Crétacé inférieur'],
    [/cretaceous/i, 'Crétacé'],
    [/upper jurassic/i, 'Jurassique supérieur'],
    [/middle jurassic/i, 'Jurassique moyen'],
    [/lower jurassic/i, 'Jurassique inférieur'],
    [/jurassic/i, 'Jurassique'],
    [/triassic/i, 'Trias'],
    [/permian/i, 'Permien'],
    [/carboniferous/i, 'Carbonifère'],
    [/devonian/i, 'Dévonien'],
    [/silurian/i, 'Silurien'],
    [/ordovician/i, 'Ordovicien'],
    [/cambrian/i, 'Cambrien'],
    [/lutetian/i, 'Lutétien'],
    [/bartonian/i, 'Bartonien'],
    [/priabonian/i, 'Priabonien'],
    [/ypresian/i, 'Yprésien'],
    [/stampian|rupelian/i, 'Stampien (Oligocène)'],
    [/eocene/i, 'Éocène'],
    [/oligocene/i, 'Oligocène'],
    [/paleocene/i, 'Paléocène'],
    [/miocene/i, 'Miocène'],
    [/pliocene/i, 'Pliocène'],
    [/pleistocene/i, 'Pléistocène'],
    [/holocene/i, 'Holocène'],
    [/quaternary/i, 'Quaternaire'],
    [/neogene/i, 'Néogène'],
    [/paleogene/i, 'Paléogène'],
    [/cenozoic/i, 'Cénozoïque'],
    [/mesozoic/i, 'Mésozoïque'],
    [/paleozoic/i, 'Paléozoïque'],
    [/precambrian|proterozoic|archean/i, 'Précambrien'],
  ];
  for (const [re, fr] of map) {
    if (re.test(s)) return fr;
  }
  return s;
}

function humanizeAgeSpan(ageRangeMa: string): string {
  const nums = ageRangeMa.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return '';
  if (/holoc[èe]ne|11\s*700/i.test(ageRangeMa)) return 'depuis la fin des grandes glaciations';
  const a = Math.round(Number(nums[0]));
  if (!Number.isFinite(a) || a <= 0) return '';
  if (a >= 250) return `il y a près de ${Math.round(a / 10) * 10} millions d’années`;
  if (a >= 20) return `il y a environ ${Math.round(a / 5) * 5} millions d’années`;
  return `il y a quelque ${a} millions d’années`;
}

function humanizeLithology(raw: string): string {
  const low = raw.toLowerCase();
  if (/calcaire/.test(low) && /marne/.test(low)) return 'de bancs calcaires et de marnes';
  if (/calcaire/.test(low)) return 'de pierre calcaire';
  if (/craie/.test(low)) return 'de craie blanche';
  if (/granit/.test(low) || /gneiss/.test(low)) return 'de vieux granite cristallin';
  if (/schist/.test(low)) return 'de schiste feuilleté';
  if (/gr[èe]s/.test(low)) return 'de grès et de sables anciens';
  if (/basalt|volcan/.test(low)) return 'de roche volcanique sombre';
  if (/alluvion|gravier|sable/.test(low)) return 'd’alluvions, de sables et de galets charriés par les eaux';
  if (/argile|marne/.test(low)) return 'd’argiles et de marnes';
  return `de ${low.split(/[,;]/)[0].trim() || 'roche ancienne'}`;
}

/**
 * Extracts a clean, conversational historical/ecological detail from a POI summary without robotic headers.
 */
function extractConversationalFact(poi: PoiItem, maxLen = 155): string {
  let s = stripTechnicalNoise(poi.summary);
  if (!s) return '';

  // Remove leading repetition of the POI title ("Église Saint-Pierre — " or "Église Saint-Pierre est...")
  const cleanTitle = cleanSpokenPlaceName(poi.name);
  if (cleanTitle.length >= 4) {
    const escaped = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`^${escaped}\\s*(?:[—–:-]|,\\s*)\\s*`, 'i'), '');
  }

  // Reject purely generic fallback lines so we can use richer bespoke lines instead
  if (
    /^observation souterraine du socle|^architecture souterraine maçonnée|^écoulement souterrain dissimulé|^ancienne excavation souterraine/i.test(
      s
    )
  ) {
    return '';
  }

  const firstSent = s.match(/^.{24,165}?[.!?](?=\s|$)/);
  let picked = firstSent ? firstSent[0].trim() : s;
  if (picked.length > maxLen) {
    const cut = picked.slice(0, maxLen - 1);
    const sp = cut.lastIndexOf(' ');
    picked = `${(sp > 55 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, '')}…`;
  } else if (!/[.!?…]$/.test(picked)) {
    picked = `${picked}.`;
  }
  return picked;
}

function getSeasonLabelFr(): { season: 'spring' | 'summer' | 'autumn' | 'winter'; label: string } {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return { season: 'spring', label: 'printemps' };
  if (m >= 5 && m <= 7) return { season: 'summer', label: 'été' };
  if (m >= 8 && m <= 10) return { season: 'autumn', label: 'automne' };
  return { season: 'winter', label: 'hiver' };
}

function cardinalDirectionFr(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const dLat = toLat - fromLat;
  const dLng = (toLng - fromLng) * Math.cos((fromLat * Math.PI) / 180);
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  const norm = (angle + 360) % 360;
  if (norm < 22.5 || norm >= 337.5) return 'vers le nord';
  if (norm < 67.5) return 'vers le nord-est';
  if (norm < 112.5) return 'côté est';
  if (norm < 157.5) return 'vers le sud-est';
  if (norm < 202.5) return 'plein sud';
  if (norm < 247.5) return 'vers le sud-ouest';
  if (norm < 292.5) return 'côté ouest';
  return 'vers le nord-ouest';
}

function spokenWalkDistanceFr(
  distMeters: number,
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  seed: number
): string {
  const dir = cardinalDirectionFr(fromLat, fromLng, toLat, toLng);
  if (distMeters <= 85) {
    return seed % 2 === 0 ? `à deux pas d’ici, ${dir}` : `tout près d’ici, ${dir}`;
  }
  if (distMeters <= 210) {
    return seed % 2 === 0 ? `à quelques minutes à pied ${dir}` : `au bout du chemin, ${dir}`;
  }
  if (distMeters <= 480) {
    return `en marchant un peu ${dir}`;
  }
  return `un peu plus loin ${dir}`;
}

export function isNpcActiveInConditions(
  kind: NpcKind,
  isSubterranean: boolean,
  effectiveTime: EffectiveTimeOfDay,
  weather: WeatherInfo | null | undefined
): boolean {
  if (isSubterranean) return true;
  const cond = weather?.condition || 'clear';
  const isWetOrSnowy = cond === 'rain' || cond === 'storm' || cond === 'snow';

  // Bees and butterflies shelter during precipitation and at night
  if (kind === 'abeille' || kind === 'papillon') {
    if (isWetOrSnowy || effectiveTime === 'night') return false;
    return true;
  }
  // Dragonflies shelter at night and during storms/snow
  if (kind === 'libellule') {
    if (effectiveTime === 'night' || cond === 'storm' || cond === 'snow') return false;
    return true;
  }
  // Fireflies glow exclusively at dusk and night (when not storming or snowing)
  if (kind === 'luciole') {
    if (cond === 'storm' || cond === 'snow') return false;
    return effectiveTime === 'dusk' || effectiveTime === 'night';
  }
  return true;
}

function spokenWeatherMoodFr(
  weather: WeatherInfo | null | undefined,
  effectiveTime: EffectiveTimeOfDay,
  seasonLabel: string,
  seed: number
): string {
  const cond = weather?.condition || 'clear';
  const hasTemp = Boolean(weather);
  const tempSuffix = hasTemp ? ` (${Math.round(weather!.tempC)}°C)` : '';

  if (cond === 'storm') {
    return effectiveTime === 'night' || effectiveTime === 'dusk'
      ? `Quel ciel d’orage ce soir${tempSuffix} ! Le tonnerre roule au loin et pas un insecte ne s’aventure dehors`
      : `Le ciel est lourd d’orage${tempSuffix}, le vent fait claquer les volets et pousse tout le monde sous les auvents`;
  }
  if (cond === 'rain') {
    if (effectiveTime === 'dusk' || effectiveTime === 'night') {
      return `Sous cette averse du soir${tempSuffix}, les pavés reflètent les lanternes et seules les rainettes semblent à la fête`;
    }
    return seed % 2 === 0
      ? `Sacrée averse aujourd’hui${tempSuffix} ! Abeilles et papillons se sont mis à l’abri sous les feuilles, pendant que l’odeur de terre mouillée remonte`
      : `Sous cette pluie fine${tempSuffix}, les pierres luisent comme des miroirs et les jardins boivent enfin à longs traits`;
  }
  if (cond === 'snow') {
    return `Avec ces flocons${tempSuffix}, tout le paysage semble feutré comme dans une gravure d’hiver`;
  }
  if (cond === 'fog') {
    return effectiveTime === 'dusk' || effectiveTime === 'night'
      ? `La brume du soir${tempSuffix} enveloppe les toits d’un halo laiteux, on avance presque à l’oreille`
      : `Cette brume${tempSuffix} estompe les lointains et donne aux vieilles pierres un air de légende`;
  }

  // Clear / cloudy circadian atmosphere
  if (effectiveTime === 'night') {
    return seed % 2 === 0
      ? `La nuit est bien installée${tempSuffix} : les ruelles retrouvent leur silence, tandis que chouettes, renards et lucioles s’animent près des haies`
      : `À la tombée complète de la nuit${tempSuffix}, on marche volontiers à la lanterne en écoutant bruire les grands arbres`;
  }
  if (effectiveTime === 'dusk') {
    return seed % 2 === 0
      ? `Le soir tombe doucement${tempSuffix} : la lumière cuivrée s’attarde sur les façades et les premières lucioles pointent dans l’herbe`
      : `Voici le crépuscule${tempSuffix}, l’heure entre chien et loup où les oiseaux du jour cèdent la place aux renards et aux hulottes`;
  }
  if (effectiveTime === 'dawn') {
    return `La fraîcheur de l’aube${tempSuffix} perle encore sur les talus pendant que le pays s’éveille tranquillement`;
  }

  if (!weather) {
    const bySeason: Record<string, string> = {
      printemps: 'L’air du printemps fait du bien aux vieilles pierres',
      été: 'On cherche volontiers un peu d’ombre le long des murs cet été',
      automne: 'La lumière d’automne dore joliment les toits du pays',
      hiver: 'L’air vif d’hiver rend les horizons étonnamment nets',
    };
    return bySeason[seasonLabel] || 'Il fait bon prendre le temps de flâner par ici';
  }

  const t = Math.round(weather.tempC);
  if (cond === 'cloudy') {
    return seed % 2 === 0
      ? `Même sous les nuages (${t}°C), la lumière reste douce pour arpenter le coin`
      : `Le ciel est couvert (${t}°C), mais c’est le meilleur temps pour marcher sans se presser`;
  }
  return t >= 23
    ? `Le soleil chauffe bien les façades aujourd’hui (${t}°C), les talus bourdonnent d’abeilles et de papillons`
    : `Quel beau temps clair (${t}°C) pour lever le nez vers les frontons et les cimes d’arbres`;
}

export interface SpawnWorldNpcsParams {
  grid: Uint8Array;
  dungeonGrid: Uint8Array;
  settlementGrid: Uint8Array;
  elevGrid: Float32Array | null;
  elevMin: number;
  elevSpan: number;
  gridSize: number;
  originWx: number;
  originWy: number;
  tileMeters: number;
  cosRef: number;
  centerLat: number;
  centerLng: number;
  pois: PoiItem[];
  subterraneanPois?: PoiItem[];
  terrain: TerrainFeature[];
  subterranean: SubterraneanFeature[];
  bedrock: BedrockInfo | null;
  elevation: ElevationGrid | null | undefined;
  weather: WeatherInfo | null | undefined;
  effectiveTime?: EffectiveTimeOfDay;
}

interface RegionalContext {
  waterNames: string[];
  forestNames: string[];
  parkNames: string[];
  roadNames: string[];
  plazaNames: string[];
  poisHistoire: PoiItem[];
  poisGeographie: PoiItem[];
  poisLegende: PoiItem[];
  poisEtrange: PoiItem[];
  poisEcosysteme: PoiItem[];
  cavities: SubterraneanFeature[];
  bedrock: BedrockInfo | null;
  elevation: ElevationGrid | null | undefined;
  weather: WeatherInfo | null | undefined;
  effectiveTime: EffectiveTimeOfDay;
  seasonLabel: string;
}

function buildRegionalContext(params: SpawnWorldNpcsParams): RegionalContext {
  const uniqNames = (kinds: TerrainFeature['kind'][], minLen = 3): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of params.terrain) {
      if (!kinds.includes(f.kind)) continue;
      const n = (f.name || '').trim();
      if (n.length < minLen || seen.has(n.toLowerCase())) continue;
      seen.add(n.toLowerCase());
      out.push(n);
      if (out.length >= 12) break;
    }
    return out;
  };

  return {
    waterNames: uniqNames(['water', 'waterway']),
    forestNames: uniqNames(['forest']),
    parkNames: uniqNames(['park']),
    roadNames: uniqNames(['major_road', 'minor_road', 'path']),
    plazaNames: uniqNames(['plaza']),
    poisHistoire: params.pois.filter((p) => p.category === 'histoire' && !p.isSubterranean),
    poisGeographie: params.pois.filter((p) => p.category === 'geographie' && !p.isSubterranean),
    poisLegende: params.pois.filter((p) => p.category === 'legende' && !p.isSubterranean),
    poisEtrange: params.pois.filter((p) => p.category === 'etrange' || p.isSubterranean),
    poisEcosysteme: params.pois.filter((p) => p.category === 'ecosysteme' && !p.isSubterranean),
    cavities: params.subterranean.filter((s) => s.points.length > 0),
    bedrock: params.bedrock,
    elevation: params.elevation,
    weather: params.weather,
    effectiveTime: params.effectiveTime ?? resolveEffectiveTimeOfDay('auto', params.weather),
    seasonLabel: getSeasonLabelFr().label,
  };
}

function findNearestPoi(
  list: PoiItem[],
  lat: number,
  lng: number,
  skipIndex = 0,
  excludeId?: string
): { poi: PoiItem; dist: number } | null {
  const filtered = excludeId ? list.filter((p) => p.id !== excludeId) : list;
  if (filtered.length === 0) return null;
  const ranked = filtered
    .map((poi) => ({ poi, dist: Math.round(haversineMeters(lat, lng, poi.lat, poi.lng)) }))
    .sort((a, b) => a.dist - b.dist);
  return ranked[Math.min(skipIndex, ranked.length - 1)] || null;
}

function buildNpcMetadata(kind: NpcKind, seed: number): {
  isHuman: boolean;
  voice: NpcVoiceKind;
  name: string;
  roleLabel: string;
  habitatLabel: string;
} {
  const firstName = HUMAN_FIRST_NAMES[seed % HUMAN_FIRST_NAMES.length];
  switch (kind) {
    case 'citadin':
      return {
        isHuman: true,
        voice: seed % 2 === 0 ? 'human_mid' : 'human_bright',
        name: `${firstName}, du quartier`,
        roleLabel: 'Habitant & flâneur',
        habitatLabel: 'Places & rues pavées',
      };
    case 'villageois':
      return {
        isHuman: true,
        voice: 'human_mid',
        name: `${firstName}, gens du bourg`,
        roleLabel: 'Mémoire du pays',
        habitatLabel: 'Bourg & venelles anciennes',
      };
    case 'erudit':
      return {
        isHuman: true,
        voice: 'human_low',
        name: `Maître ${firstName}`,
        roleLabel: 'Historien & géologue amateur',
        habitatLabel: 'Parvis & vieilles pierres',
      };
    case 'colporteur':
      return {
        isHuman: true,
        voice: 'human_low',
        name: `${firstName} le Colporteur`,
        roleLabel: 'Marchand itinérant',
        habitatLabel: 'Carrefours & ponts',
      };
    case 'randonneur':
      return {
        isHuman: true,
        voice: 'human_bright',
        name: `${firstName}, marcheur`,
        roleLabel: 'Arpenteur des chemins',
        habitatLabel: 'Sentiers, berges & coteaux',
      };
    case 'puisatier':
      return {
        isHuman: true,
        voice: 'human_low',
        name: `${firstName} le Carrier`,
        roleLabel: 'Puisatier & connaisseur du sous-sol',
        habitatLabel: 'Galeries, caves & carrières',
      };
    case 'renard':
      return {
        isHuman: false,
        voice: 'beast',
        name: 'Renard roux',
        roleLabel: 'Carnet naturaliste · Mammifère',
        habitatLabel: 'Lisières, haies & sous-bois',
      };
    case 'cerf':
      return {
        isHuman: false,
        voice: 'beast',
        name: 'Chevreuil des futaies',
        roleLabel: 'Carnet naturaliste · Cervidé',
        habitatLabel: 'Orées de bois & clairières',
      };
    case 'chouette':
      return {
        isHuman: false,
        voice: 'bird',
        name: 'Chouette hulotte',
        roleLabel: 'Carnet naturaliste · Rapace nocturne',
        habitatLabel: 'Vieux arbres & parcs anciens',
      };
    case 'abeille':
      return {
        isHuman: false,
        voice: 'insect',
        name: 'Abeille butineuse',
        roleLabel: 'Carnet naturaliste · Pollinisateur',
        habitatLabel: 'Prairies fleuries & vergers',
      };
    case 'papillon':
      return {
        isHuman: false,
        voice: 'insect',
        name: 'Flambé des coteaux',
        roleLabel: 'Carnet naturaliste · Lépidoptère',
        habitatLabel: 'Pelouses ensoleillées & talus',
      };
    case 'lucane':
      return {
        isHuman: false,
        voice: 'insect',
        name: 'Lucane cerf-volant',
        roleLabel: 'Carnet naturaliste · Coléoptère',
        habitatLabel: 'Vieux chênes & bois moussus',
      };
    case 'luciole':
      return {
        isHuman: false,
        voice: 'insect',
        name: 'Luciole des prés',
        roleLabel: 'Carnet naturaliste · Bioluminescent',
        habitatLabel: 'Prairies fraîches & haies au crépuscule',
      };
    case 'grenouille':
      return {
        isHuman: false,
        voice: 'amphibian',
        name: 'Rainette verte',
        roleLabel: 'Carnet naturaliste · Amphibien',
        habitatLabel: 'Berges calmes & roselières',
      };
    case 'libellule':
      return {
        isHuman: false,
        voice: 'insect',
        name: 'Caloptéryx éclatant',
        roleLabel: 'Carnet naturaliste · Odonate',
        habitatLabel: 'Eaux vives & joncs',
      };
    case 'martin_pecheur':
      return {
        isHuman: false,
        voice: 'bird',
        name: 'Martin-pêcheur d’Europe',
        roleLabel: 'Carnet naturaliste · Oiseau rivulaire',
        habitatLabel: 'Rivières claires & berges',
      };
    case 'chamois':
      return {
        isHuman: false,
        voice: 'beast',
        name: 'Chamois des crêtes',
        roleLabel: 'Carnet naturaliste · Faune d’altitude',
        habitatLabel: 'Corniches & versants rocheux',
      };
    case 'chauve_souris':
      return {
        isHuman: false,
        voice: 'bird',
        name: 'Petit Rhinolophe',
        roleLabel: 'Carnet naturaliste · Chiroptère',
        habitatLabel: 'Voûtes & cavités tempérées',
      };
    case 'salamandre':
      return {
        isHuman: false,
        voice: 'amphibian',
        name: 'Salamandre tachetée',
        roleLabel: 'Carnet naturaliste · Urodèle',
        habitatLabel: 'Parois humides & suintements',
      };
  }
}

/**
 * Crafts a coherent, characterful 3-part conversation (for humans) or 3-part literary naturalist
 * field observation (for animals & insects), weaving authentic local places, rivers, relief,
 * weather, and geology naturally into idiomatic French prose.
 */
function buildRegionalTriviaDialogues(
  kind: NpcKind,
  isHuman: boolean,
  lat: number,
  lng: number,
  seed: number,
  allPois: PoiItem[],
  ctx: RegionalContext
): string[] {
  const altM = sampleElevationMeters(ctx.elevation, lat, lng);
  const elevSpan = ctx.elevation ? Math.round(ctx.elevation.maxMeters - ctx.elevation.minMeters) : 0;
  const waterRaw = ctx.waterNames.length > 0 ? ctx.waterNames[seed % ctx.waterNames.length] : '';
  const forestOrParkRaw =
    ctx.forestNames.length > 0
      ? ctx.forestNames[seed % ctx.forestNames.length]
      : ctx.parkNames.length > 0
      ? ctx.parkNames[seed % ctx.parkNames.length]
      : '';
  const roadOrPlazaRaw =
    ctx.plazaNames.length > 0
      ? ctx.plazaNames[seed % ctx.plazaNames.length]
      : ctx.roadNames.length > 0
      ? ctx.roadNames[seed % ctx.roadNames.length]
      : '';

  const surfacePoisOnly = allPois.filter((p) => !p.isSubterranean);
  const nearestHist = findNearestPoi(ctx.poisHistoire, lat, lng, seed % 2);
  const nearestLeg = findNearestPoi(ctx.poisLegende, lat, lng, 0);
  const nearestEco = findNearestPoi(ctx.poisEcosysteme, lat, lng, 0);
  const nearestGeo = findNearestPoi(ctx.poisGeographie, lat, lng, 0);
  const nearestSub = findNearestPoi(ctx.poisEtrange, lat, lng, 0);
  const nearestSurfAny = findNearestPoi(surfacePoisOnly, lat, lng, 0);

  const primaryPoi = nearestHist || nearestLeg || nearestSurfAny || nearestGeo;
  const secondaryPoi = findNearestPoi(
    surfacePoisOnly,
    lat,
    lng,
    0,
    primaryPoi?.poi.id
  );

  const periodFr = ctx.bedrock ? humanizeGeologicalPeriod(ctx.bedrock.period) : '';
  const ageSpanFr = ctx.bedrock ? humanizeAgeSpan(ctx.bedrock.ageRangeMa) : '';
  const lithoFr = ctx.bedrock ? humanizeLithology(ctx.bedrock.lithology) : '';
  const weatherOpening = spokenWeatherMoodFr(
    ctx.weather,
    ctx.effectiveTime,
    ctx.seasonLabel,
    seed
  );

  if (isHuman) {
    // ========================================================================
    // HUMAN CONVERSATIONS: Coherent 3-beat dialogue in distinct voices!
    // ========================================================================
    if (kind === 'puisatier') {
      const cav = ctx.cavities.length > 0 ? ctx.cavities[seed % ctx.cavities.length] : null;
      const cavName = cav ? cleanSpokenPlaceName(cav.name) : nearestSub ? cleanSpokenPlaceName(nearestSub.poi.name) : '';
      const beat1 = ctx.bedrock
        ? `Baissez un peu la tête sous la voûte, l’ami ! Ici, à l’abri du vent de la surface, on marche directement dans la masse ${lithoFr} déposée au ${periodFr}${ageSpanFr ? `, ${ageSpanFr}` : ''}.`
        : `Bienvenue sous les pavés ! Dès qu’on descend de quelques marches, le bruit d’en haut s’éteint et l’air garde la même fraîcheur été comme hiver.`;

      const beat2 = cavName
        ? `Toute cette galerie fait partie d’un vieux réseau souterrain : non loin d’ici s’ouvrent les assises de « ${cavName} ». Les anciens carriers savaient lire chaque fissure de la pierre pour éviter les poches d’eau.`
        : waterRaw
        ? `Vous entendez ce léger goutte-à-goutte ? Ce sont les infiltrations qui descendent lentement vers le lit ${deWaterwayFr(waterRaw)} juste au-dessus de nos têtes.`
        : `Ces caves et galeries ont servi tour à tour de carrières à bâtir, de celliers tempérés et de passages discrets sous les fondations des plus vieux édifices.`;

      const beat3 =
        altM !== null
          ? `Faites tout de même attention où vous posez les bottes sur la dalle humide. En surface, le terrain est à près de ${Math.round(altM)} mètres d’altitude, alors les eaux de pluie finissent toujours par chercher leur chemin jusqu’ici !`
          : `Gardez votre lanterne bien haute près des piliers de taille : dès qu’un escalier de pierre se présente, il vous ramènera droit vers une place ou un monument du dessus.`;

      return [beat1, beat2, beat3];
    }

    if (kind === 'erudit') {
      const p1 = nearestHist || primaryPoi;
      const p1Fact = p1 ? extractConversationalFact(p1.poi, 150) : '';
      const skyNote =
        ctx.weather?.condition === 'rain' ||
        ctx.weather?.condition === 'storm' ||
        ctx.effectiveTime === 'dusk' ||
        ctx.effectiveTime === 'night'
          ? `${weatherOpening}. `
          : '';
      const beat1 = p1
        ? `Bonjour, voyageur ! ${skyNote}Je prenais justement quelques notes ${roadOrPlazaRaw ? `${surVoieOuPlaceFr(roadOrPlazaRaw)} ` : ''}en observant les alentours. Regardez ${spokenWalkDistanceFr(p1.dist, lat, lng, p1.poi.lat, p1.poi.lng, seed)} : c’est là que se dresse ${versLieuFr(p1.poi.name)}.`
        : `Bonjour à vous ! ${weatherOpening}. C’est un plaisir de croiser quelqu’un qui prend encore le temps de lire le paysage autrement qu’au pas de course.`;

      const beat2 =
        p1 && p1Fact
          ? `Ce lieu raconte toute une page d’histoire locale : ${p1Fact.charAt(0).toLowerCase()}${p1Fact.slice(1)} Et dire que la pierre même de nos fondations remonte${periodFr ? ` au ${periodFr}` : ' à des millions d’années'}${lithoFr ? `, taillée dans un socle ${lithoFr}` : ''} !`
          : ctx.bedrock
          ? `Quand on gratte un peu sous l’histoire humaine, le vertige prend vite : tout ce terroir repose sur un socle ${lithoFr} formé au ${periodFr}${ageSpanFr ? `, ${ageSpanFr}` : ''}. C’est cette roche qui a donné leur teinte aux vieux murs du pays.`
          : `Chaque façade ici porte la trace de plusieurs époques superposées, depuis le tracé ancien des chemins jusqu’aux pierres de réemploi dans les soubassements.`;

      const loreTarget = nearestLeg || secondaryPoi;
      const loreFact = loreTarget ? extractConversationalFact(loreTarget.poi, 135) : '';
      const beat3 = loreTarget
        ? `Si vous aimez les récits un peu plus secrets, poussez votre marche ${spokenWalkDistanceFr(loreTarget.dist, lat, lng, loreTarget.poi.lat, loreTarget.poi.lng, seed + 1)} jusqu’à ${versLieuFr(loreTarget.poi.name)}. ${loreFact || 'On y sent encore très bien la mémoire ancienne du quartier.'}`
        : waterRaw
        ? `Avant de repartir, allez donc jeter un œil du côté des berges ${deWaterwayFr(waterRaw)} : c’est autour de l’eau que les tout premiers bourgs se sont fixés ici.`
        : `Bonne exploration à vous ! Gardez l’œil ouvert aux angles des vieilles rues, les plus beaux détails se cachent souvent juste au-dessus des portes.`;

      return [beat1, beat2, beat3];
    }

    if (kind === 'villageois') {
      const beat1 = roadOrPlazaRaw
        ? `Bien le bonjour ! ${weatherOpening}. On voit rarement des promeneurs flâner aussi tranquillement ${surVoieOuPlaceFr(roadOrPlazaRaw)}.`
        : `Bien le bonjour ! ${weatherOpening}. Prenez votre temps, le pays ne livre ses petites histoires qu’à ceux qui marchent à leur rythme.`;

      const memTarget = nearestLeg || nearestHist || primaryPoi;
      const memFact = memTarget ? extractConversationalFact(memTarget.poi, 145) : '';
      const beat2 = memTarget
        ? `Chez nous, tout le monde connaît ${versLieuFr(memTarget.poi.name)}, ${spokenWalkDistanceFr(memTarget.dist, lat, lng, memTarget.poi.lat, memTarget.poi.lng, seed)}. ${
            memFact
              ? `Les anciens rappellent volontiers ce détail : ${memFact.charAt(0).toLowerCase()}${memFact.slice(1)}`
              : `C’est un repère qui veille sur le coin depuis bien des générations.`
          }`
        : ctx.bedrock
        ? `Regardez la couleur des murets et des cours : tout vient de notre sous-sol fait ${lithoFr}, hérité du ${periodFr}. Ça donne son caractère aux jardins comme aux chemins creux.`
        : `Ici, chaque sentier suivait autrefois la limite des vieux clos, des vergers et des terres communes du bourg.`;

      const beat3 = waterRaw
        ? `Et si vous cherchez un coin paisible pour souffler, descendez donc vers le fil ${deWaterwayFr(waterRaw)} : en ${ctx.seasonLabel}, la fraîcheur de l’eau attire autant les oiseaux que les promeneurs.`
        : forestOrParkRaw
        ? `En continuant votre tour, passez donc près de ${versLieuFr(forestOrParkRaw)} : l’ombre des grands arbres y est superbe en cette saison.`
        : secondaryPoi
        ? `En filant ${spokenWalkDistanceFr(secondaryPoi.dist, lat, lng, secondaryPoi.poi.lat, secondaryPoi.poi.lng, seed + 2)}, vous tomberez aussi sur ${versLieuFr(secondaryPoi.poi.name)}, ça vaut largement le détour !`
        : `Bonne route à travers nos ruelles, et n’hésitez pas à pousser jusqu’aux petits chemins derrière les maisons !`;

      return [beat1, beat2, beat3];
    }

    if (kind === 'colporteur') {
      const slopeComment =
        elevSpan >= 28
          ? `Avec près de ${elevSpan} mètres de dénivelé dans le secteur, mes mollets s’en souviennent à chaque tournée !`
          : waterRaw
          ? `Tant qu’on suit la vallée ${deWaterwayFr(waterRaw)} et ses vieux ponts, la route roule toute seule.`
          : `Les chaussées du coin ont vu passer bien des charrettes et des voyageurs avant nous.`;

      const beat1 = `Salutations sur le chemin ! ${weatherOpening}. ${slopeComment}`;

      const stopPoi = primaryPoi;
      const stopFact = stopPoi ? extractConversationalFact(stopPoi.poi, 145) : '';
      const beat2 = stopPoi
        ? `Quand je fais halte par ici, je m’oriente toujours grâce à ${versLieuFr(stopPoi.poi.name)}, ${spokenWalkDistanceFr(stopPoi.dist, lat, lng, stopPoi.poi.lat, stopPoi.poi.lng, seed)}. ${
            stopFact || 'On raconte toujours mille choses intéressantes à son sujet au comptoir.'
          }`
        : `À force de battre les carrefours, on apprend à lire le pays : la largeur des grands axes trahit souvent d’anciennes routes de foire ou d’octroi.`;

      const tipPoi = secondaryPoi || nearestSub;
      const beat3 = tipPoi
        ? `Un petit tuyau de marchand avant de reprendre ma balle : jetez un coup d’œil ${spokenWalkDistanceFr(tipPoi.dist, lat, lng, tipPoi.poi.lat, tipPoi.poi.lng, seed + 1)}, du côté de ${versLieuFr(tipPoi.poi.name)}. Peu de gens pensent à s’y arrêter !`
        : ctx.cavities.length > 0
        ? `Soit dit entre nous, le sous-sol du coin cache aussi d’anciennes caves et galeries… Si vous trouvez une volée de marches en pierre, jetez-y un œil !`
        : `Allez, bon vent à vous ! Que vos semelles vous portent vers de belles trouvailles.`;

      return [beat1, beat2, beat3];
    }

    if (kind === 'randonneur') {
      const altPhrase =
        altM !== null
          ? `Ma boussole indique environ ${Math.round(altM)} mètres d’altitude ici${
              elevSpan >= 20 ? `, avec de belles pentes tout autour (${elevSpan} m d’écart sur le secteur)` : ''
            }.`
          : `Le sentier est vraiment agréable à suivre aujourd’hui.`;
      const beat1 = `Bonjour ! ${weatherOpening}. ${altPhrase}`;

      const natTarget = nearestEco || nearestGeo || primaryPoi;
      const natFact = natTarget ? extractConversationalFact(natTarget.poi, 145) : '';
      const beat2 = forestOrParkRaw && waterRaw
        ? `J’aime beaucoup cet endroit où les frondaisons de ${versLieuFr(forestOrParkRaw)} répondent à la fraîcheur ${deWaterwayFr(waterRaw)}. ${
            natTarget ? `D’ailleurs, ${spokenWalkDistanceFr(natTarget.dist, lat, lng, natTarget.poi.lat, natTarget.poi.lng, seed)}, on croise ${versLieuFr(natTarget.poi.name)}.` : ''
          }`
        : natTarget
        ? `Je viens justement de passer non loin de ${versLieuFr(natTarget.poi.name)}, ${spokenWalkDistanceFr(natTarget.dist, lat, lng, natTarget.poi.lat, natTarget.poi.lng, seed)}. ${
            natFact || 'Le cadre vaut vraiment qu’on prenne cinq minutes pour observer les lieux.'
          }`
        : `En quittant un peu le bitume pour les chemins de terre et les lisières, on découvre tout de suite les oiseaux et les vieux arbres du coin.`;

      const beat3 = ctx.bedrock
        ? `Sous la semelle, on sent tout de suite ce terrain ${lithoFr} hérité du ${periodFr} : il façonne aussi bien le dessin des coteaux que les fleurs sauvages des talus. Bonne marche à vous !`
        : `Si vous continuez sur les petits sentiers, ouvrez l’œil aux lisières et près de l’eau, la faune locale n’est jamais bien loin. Bonne balade !`;

      return [beat1, beat2, beat3];
    }

    // Default Human: 'citadin' (lively neighborhood local)
    const beat1 = roadOrPlazaRaw
      ? `Tiens, bonjour ! ${weatherOpening}. J’adore flâner ${surVoieOuPlaceFr(roadOrPlazaRaw)} à cette heure-ci, on y sent vraiment l’âme du quartier.`
      : `Tiens, bonjour ! ${weatherOpening}. Vous explorez le quartier le nez au vent ? C’est encore la meilleure façon de le découvrir.`;

    const hoodPoi = primaryPoi;
    const hoodFact = hoodPoi ? extractConversationalFact(hoodPoi.poi, 145) : '';
    const beat2 = hoodPoi
      ? `Si vous ne connaissez pas encore bien le coin, passez voir ${versLieuFr(hoodPoi.poi.name)}, ${spokenWalkDistanceFr(hoodPoi.dist, lat, lng, hoodPoi.poi.lat, hoodPoi.poi.lng, seed)}. ${
          hoodFact
            ? `${hoodFact}`
            : `Même nous qui passons devant tous les jours, on finit toujours par y remarquer un détail nouveau.`
        }`
      : waterRaw
      ? `Tout le quartier vit au rythme ${deWaterwayFr(waterRaw)} : dès qu’un rayon de lumière perce, tout le monde finit par rejoindre les quais et les ponts.`
      : `Ce que j’aime ici, c’est le contraste entre les grandes façades alignées et le calme soudain des petites cours intérieures.`;

    const nextStop = secondaryPoi;
    const beat3 =
      forestOrParkRaw && waterRaw
        ? `Pour prolonger la promenade, je vous conseille de filer ensuite entre ${versLieuFr(forestOrParkRaw)} et les abords ${deWaterwayFr(waterRaw)} — c’est la respiration verte de tout le secteur !`
        : nextStop
        ? `Et tant que vous êtes dans les parages, poussez donc ${spokenWalkDistanceFr(nextStop.dist, lat, lng, nextStop.poi.lat, nextStop.poi.lng, seed + 1)} jusqu’à ${versLieuFr(nextStop.poi.name)}, la balade en vaut vraiment la peine.`
        : forestOrParkRaw
        ? `Quand vous voudrez faire une pause au vert, filez du côté de ${versLieuFr(forestOrParkRaw)}, c’est le refuge préféré des habitués du coin.`
        : `Bonne promenade à vous ! Flânez sans hâte, chaque détour de rue réserve une petite surprise ici.`;

    return [beat1, beat2, beat3];
  }

  // ==========================================================================
  // FAUNA & INSECTS: Literary Naturalist Field Notes (Carnet d'observation)
  // Zero robotic GPS coordinates — pure sensory behavior + regional ecology!
  // ==========================================================================
  const ecoFact = nearestEco ? extractConversationalFact(nearestEco.poi, 140) : '';
  const ecoName = nearestEco ? cleanSpokenPlaceName(nearestEco.poi.name) : '';
  const woodLabel = forestOrParkRaw ? versLieuFr(forestOrParkRaw) : 'les bosquets et haies vives des environs';
  const waterPhrase = waterRaw ? deWaterwayFr(waterRaw) : 'du cours d’eau tout proche';

  if (kind === 'martin_pecheur' || kind === 'libellule' || kind === 'grenouille') {
    const gesture =
      kind === 'martin_pecheur'
        ? `Posé comme un éclat turquoise sur une branche basse, le martin-pêcheur fixe le moindre frémissement de l’eau avant de plonger d’un trait vif.`
        : kind === 'libellule'
        ? `Ses ailes aux reflets métalliques battent en silence au-dessus des herbes humides, frôlant la surface avant de revenir se percher sur un jonc.`
        : `Immobile au bord des lentilles d’eau, la rainette gonfle doucement sa gorge puis s’éclipse d’un bond discret au moindre bruit de pas.`;

    const beat2 = waterRaw
      ? `Sa présence témoigne de la vitalité écologique des berges ${waterPhrase} : roseaux, graviers oxygénés et insectes aquatiques y forment une véritable oasis tout au long de la vallée.`
      : `Observer cette espèce ici révèle la richesse des zones humides et des rus discrets qui irriguent le creux du vallon.`;

    const beat3 = ecoName
      ? `Les naturalistes suivent d’ailleurs de près ce corridor vivant autour de « ${ecoName} »${ecoFact ? ` — ${ecoFact.charAt(0).toLowerCase()}${ecoFact.slice(1)}` : '.'}`
      : ctx.weather
      ? `En cet ${ctx.seasonLabel} (${ctx.weather.labelFr.toLowerCase()}, ${Math.round(ctx.weather.tempC)}°C), l’humidité fraîche des rives lui offre un abri précieux au cœur du territoire.`
      : `En cet ${ctx.seasonLabel}, ces rives ombragées servent de refuge essentiel à toute la petite faune amphibie et rivulaire.`;

    return [gesture, beat2, beat3];
  }

  if (kind === 'chauve_souris' || kind === 'salamandre') {
    const cav = ctx.cavities.length > 0 ? ctx.cavities[seed % ctx.cavities.length] : null;
    const cavLabel = cav ? cleanSpokenPlaceName(cav.name) : '';
    const gesture =
      kind === 'chauve_souris'
        ? `Suspendu sous une aspérité de la voûte, le petit rhinolophe s’enveloppe dans ses ailes fines, à peine trahi par un léger frémissement d’oreilles.`
        : `Sa robe noire tachée d’or luit doucement à la lueur de la lanterne tandis qu’elle longe, d’un pas paisible, le pied humide de la paroi.`;

    const beat2 = cavLabel
      ? `Les galeries tranquilles proches de « ${cavLabel} » lui offrent exactement ce qu’elle recherche : une obscurité calme et une humidité constante, loin du gel comme des fortes chaleurs.`
      : `Ces cavités et caves anciennes constituent un refuge souterrain irremplaçable où la température varie à peine d’une saison à l’autre.`;

    const beat3 = ctx.bedrock
      ? `Creusée dans un massif ${lithoFr} datant du ${periodFr}, la roche laisse perler une eau claire riche en minéraux qui entretient la vie discrète du sous-sol.`
      : `Mieux vaut l’observer sans bruit ni geste brusque : le calme absolu de ces voûtes est la clé de sa survie.`;

    return [gesture, beat2, beat3];
  }

  if (kind === 'abeille' || kind === 'papillon') {
    const gesture =
      kind === 'abeille'
        ? `Les pattes alourdies d’un pollen ocre vif, l’ouvrière passe méthodiquement d’une corolle à l’autre dans un bourdonnement régulier.`
        : `Le papillon plane en souples zigzags au-dessus des herbes hautes, profitant du moindre abri du vent pour ouvrir ses ailes au jour.`;

    const beat2 = ctx.bedrock
      ? `Ici, le sol né d’un substrat ${lithoFr} (${periodFr}) sélectionne une flore champêtre bien particulière, riche en plantes mellifères dont dépendent tous les pollinisateurs du secteur.`
      : `Entre prairies ouvertes, jardins et talus fleuris, cette mosaïque végétale forme un relais vital pour les insectes butineurs de la région.`;

    const beat3 = ecoName
      ? `Ce cortège floristique s’épanouit tout particulièrement aux abords de « ${ecoName} »${ecoFact ? ` : ${ecoFact.charAt(0).toLowerCase()}${ecoFact.slice(1)}` : '.'}`
      : forestOrParkRaw
      ? `La proximité de ${woodLabel} leur assure à la fois des lisières ensoleillées pour butiner et des haies abritées dès que le vent fraîchit.`
      : `Par ce temps de ${ctx.seasonLabel}${ctx.weather ? ` (${Math.round(ctx.weather.tempC)}°C)` : ''}, chaque talus non fauché devient un petit sanctuaire de biodiversité.`;

    return [gesture, beat2, beat3];
  }

  if (kind === 'chamois') {
    const gesture = `Campé avec une aisance souveraine sur le ressaut pierreux, le chamois hume le vent montant avant de gravir trois dalles d’une détente sèche.`;
    const beat2 =
      altM !== null && ctx.elevation
        ? `À près de ${Math.round(altM)} mètres d’altitude — dans un relief local qui grimpe jusqu’à ${Math.round(ctx.elevation.maxMeters)} mètres — ces pentes dégagées lui offrent une vue imprenable sur toute la vallée.`
        : `Les versants escarpés et les corniches rocheuses de la contrée constituent son terrain de prédilection loin de l’agitation des fonds de vallée.`;
    const beat3 = ctx.bedrock
      ? `Sous ses sabots souples affleure la roche vive ${lithoFr} (${periodFr}), sculptée par des millénaires d’érosion, de gel et de ruissellement.`
      : `En ${ctx.seasonLabel}, il alterne entre les vires ensoleillées du matin et le couvert des bois plus bas lorsque le ciel se couvre.`;
    return [gesture, beat2, beat3];
  }

  if (kind === 'luciole') {
    const gesture = `Une minuscule braise vert-doré s’allume entre deux brins d’herbe fraîche, décrit une courbe silencieuse au ras du talus, puis palpite doucement dans la pénombre.`;
    const beat2 = waterRaw
      ? `Dès le crépuscule, l’humidité douce qui remonte ${waterPhrase} et les talus épargnés par l’éclairage violent offrent aux lampyres un havre nocturne précieux.`
      : `Sensible aux nuits calmes et aux prairies non fauchées, la luciole révèle les recoins où l’obscurité naturelle et la rosée du soir sont encore préservées.`;
    const beat3 = ctx.bedrock
      ? `Sur ce terroir au sous-sol ${lithoFr} (${periodFr}), murets de pierre sèche, mousses et herbes hautes abritent les escargots et larves dont dépend son cycle discret.`
      : ecoName
      ? `Sa lueur paisible prolonge de nuit la richesse écologique observée autour de « ${ecoName} ».`
      : `À cette heure feutrée, quelques éclats bioluminescents suffisent à transformer une simple haie en lisière féerique.`;
    return [gesture, beat2, beat3];
  }

  // Woodland & Hedge Fauna: 'renard', 'cerf', 'chouette', 'lucane'
  const isNocturnalPhase = ctx.effectiveTime === 'dusk' || ctx.effectiveTime === 'night';
  const woodlandGesture: Record<string, string> = {
    renard: isNocturnalPhase
      ? `Enhardi par la pénombre du soir, le renard trottine à découvert le long de la haie, prunelles luisantes et oreilles dressées au moindre froissement d’herbe.`
      : `À demi fondu dans les teintes rousses des fourrés, le renard s’arrête un instant, museau au vent et regard d’ambre vif, avant de filer sans un bruit le long de la haie.`,
    cerf: `À l’orée exacte entre l’ombre des troncs et l’herbe claire, le chevreuil dresse ses oreilles attentives, prêt à regagner le couvert d’un bond léger.`,
    chouette: isNocturnalPhase
      ? `Éveillée par la tombée du jour, la chouette hulotte lance un hululement flûté depuis sa haute branche avant de glisser d’un vol parfaitement silencieux au-dessus de la clairière.`
      : `Blottie contre l’écorce crevassée d’une haute branche, la chouette hulotte cligne lentement ses grands yeux sombres en attendant le crépuscule.`,
    lucane: `Cramponné à l’écorce moussue d’un vieux tronc, le grand coléoptère déploie ses mandibules brunes semblables à des ramures miniatures.`,
  };
  const beat1 = woodlandGesture[kind] || woodlandGesture.renard;

  const beat2 = forestOrParkRaw
    ? `Le couvert arboré de ${woodLabel} joue ici un rôle de refuge et de corridor écologique précieux, reliant les vieux arbres aux prairies voisines.`
    : `La présence de cette espèce signe un équilibre préservé entre vieux arbres, lisières buissonnantes et clairières tranquilles.`;

  const beat3 = ecoName
    ? `Cette richesse naturelle fait écho au patrimoine vivant recensé près de « ${ecoName} »${ecoFact ? ` — ${ecoFact.charAt(0).toLowerCase()}${ecoFact.slice(1)}` : '.'}`
    : waterRaw
    ? `Non loin de là, l’humidité fraîche ${waterPhrase} complète cet habitat en offrant points d’eau et fraîcheur en ${ctx.seasonLabel}.`
    : ctx.bedrock
    ? `Enracinés sur un substrat ${lithoFr} issu du ${periodFr}, les bois et taillis des environs gardent encore le visage sauvage de l’ancien terroir.`
    : `En ${ctx.seasonLabel}, c’est aux heures calmes et le long des lisières peu fréquentées que cette faune sauvage se laisse le mieux deviner.`;

  return [beat1, beat2, beat3];
}

/**
 * Deterministically populates the 16-bit sector with habitat-coherent Humans, Animals & Insects
 * using FIXED WORLD-COORDINATE MACRO-BLOCKS (`bWx, bWy`).
 *
 * Why world-locked macro-blocks?
 * - Every block's focal winner depends ONLY on absolute world tile coordinates `(wx, wy)` and local terrain,
 *   NEVER on `playerLat`, `playerLng`, orsequential global greedy caps!
 * - Consequently, NPCs NEVER pop in, vanish, or swap places as you walk across the map!
 */
export function spawnWorldNpcs(params: SpawnWorldNpcsParams): WorldNpc[] {
  const {
    grid,
    dungeonGrid,
    settlementGrid,
    elevGrid,
    elevMin,
    elevSpan,
    gridSize,
    originWx,
    originWy,
    tileMeters,
    cosRef,
    pois,
    subterraneanPois = [],
  } = params;

  const allTriviaPois = subterraneanPois.length > 0 ? [...pois, ...subterraneanPois] : pois;
  const ctx = buildRegionalContext({ ...params, pois: allTriviaPois });
  const spawned: WorldNpc[] = [];

  const isTooCloseToPois = (lat: number, lng: number, sub: boolean): boolean => {
    const checkPois = sub ? subterraneanPois : pois;
    for (const p of checkPois) {
      if (haversineMeters(lat, lng, p.lat, p.lng) < 16) return true;
    }
    return false;
  };

  const countNearbyTile = (gx: number, gy: number, radius: number, matchFn: (t: number) => boolean): number => {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx < 1 || nx >= gridSize - 1 || ny < 1 || ny >= gridSize - 1) continue;
        if (matchFn(grid[ny * gridSize + nx])) count++;
      }
    }
    return count;
  };

  const isRoadTile = (t: number): boolean =>
    t === T_STREET || t === T_MAIN_ROAD || t === T_PATH || t === T_STEPS || t === T_PLAZA;

  // Low-frequency 2D spatial modulation in pure world coordinates (creates quiet zones vs lively pockets)
  const organicPocketDensity = (wx: number, wy: number): number => {
    const w1 = Math.sin(wx * 0.073 + wy * 0.059);
    const w2 = Math.cos(wx * 0.041 - wy * 0.083);
    const w3 = Math.sin((wx + wy) * 0.029);
    return (w1 + w2 + w3 * 0.7) / 2.7;
  };

  const evaluateSurfaceFocalTile = (
    gx: number,
    gy: number,
    wx: number,
    wy: number,
    h: number
  ): { kind: NpcKind; score: number; allowsCompanion: boolean } | null => {
    const idx = gy * gridSize + gx;
    const t = grid[idx];
    if (t === T_WATER || t === T_BUILDING || t === T_RAIL) return null;

    const pocket = organicPocketDensity(wx, wy);
    if (pocket < -0.12 && t !== T_PLAZA && t !== T_PIER) return null;

    const settle = settlementGrid[idx];
    const localElev = elevGrid ? elevGrid[idx] : 0;
    const isHighSlopeOrCrest =
      elevGrid !== null &&
      ((elevSpan >= 18 && localElev >= elevMin + elevSpan * 0.68) || localElev >= 340);

    const waterNear1 = countNearbyTile(gx, gy, 1, (nt) => nt === T_WATER);
    const waterNear2 = waterNear1 > 0 ? waterNear1 : countNearbyTile(gx, gy, 2, (nt) => nt === T_WATER);
    const bldgAdj = countNearbyTile(gx, gy, 1, (nt) => nt === T_BUILDING);
    const roadOrtho =
      (isRoadTile(grid[(gy - 1) * gridSize + gx]) ? 1 : 0) +
      (isRoadTile(grid[(gy + 1) * gridSize + gx]) ? 1 : 0) +
      (isRoadTile(grid[gy * gridSize + (gx - 1)]) ? 1 : 0) +
      (isRoadTile(grid[gy * gridSize + (gx + 1)]) ? 1 : 0);

    const hashBonus = (h % 29) * 0.35 + pocket * 14;
    const cond = ctx.weather?.condition || 'clear';
    const isWetOrSnowy = cond === 'rain' || cond === 'storm' || cond === 'snow';
    const isRainOrFog = cond === 'rain' || cond === 'fog';
    const isDuskOrNight = ctx.effectiveTime === 'dusk' || ctx.effectiveTime === 'night';
    const isNight = ctx.effectiveTime === 'night';
    const canPollinate = !isWetOrSnowy && !isNight;
    const canFirefly = isDuskOrNight && cond !== 'storm' && cond !== 'snow';

    if (t === T_PLAZA) {
      const pick = h % 4;
      const kind: NpcKind = pick === 0 ? 'erudit' : pick === 1 ? 'colporteur' : 'citadin';
      return { kind, score: 92 + hashBonus, allowsCompanion: !isNight };
    }
    if (t === T_PIER) {
      const kind: NpcKind =
        isNight
          ? h % 2 === 0
            ? 'chouette'
            : 'grenouille'
          : h % 2 === 0
          ? 'martin_pecheur'
          : 'randonneur';
      return { kind, score: 88 + hashBonus, allowsCompanion: false };
    }
    if (t === T_COMMERCIAL && roadOrtho >= 1) {
      const kind: NpcKind = h % 3 === 0 ? 'colporteur' : 'citadin';
      return { kind, score: 78 + hashBonus, allowsCompanion: !isNight };
    }

    if (t === T_STREET || t === T_MAIN_ROAD) {
      const isCrossroad = roadOrtho >= 3;
      const isBridgeSide = waterNear1 > 0;
      const isVillageDoorway =
        (settle === SETTLE_VILLAGE || settle === SETTLE_HAMLET) && bldgAdj >= 1 && h % 4 === 0;
      if (!isCrossroad && !isBridgeSide && !isVillageDoorway && h % 11 !== 0) {
        return null;
      }
      const focalBoost = isBridgeSide ? 24 : isCrossroad ? 20 : isVillageDoorway ? 16 : 0;
      if (settle === SETTLE_CITY_CENTER || settle === SETTLE_SUBURB) {
        const uPick = h % 5;
        const kind: NpcKind = uPick === 0 ? 'erudit' : uPick === 1 ? 'colporteur' : 'citadin';
        return { kind, score: 58 + focalBoost + hashBonus, allowsCompanion: isCrossroad && !isNight };
      }
      if (settle === SETTLE_VILLAGE || settle === SETTLE_HAMLET) {
        if (isNight && h % 3 === 0) {
          return {
            kind: h % 2 === 0 ? 'chouette' : 'renard',
            score: 64 + focalBoost + hashBonus,
            allowsCompanion: false,
          };
        }
        const kind: NpcKind = h % 3 === 0 ? 'colporteur' : 'villageois';
        return { kind, score: 62 + focalBoost + hashBonus, allowsCompanion: isVillageDoorway && !isNight };
      }
      if (isDuskOrNight && h % 2 === 0) {
        return {
          kind: canFirefly && h % 4 === 0 ? 'luciole' : 'renard',
          score: 58 + focalBoost + hashBonus,
          allowsCompanion: false,
        };
      }
      const kind: NpcKind = h % 2 === 0 ? 'colporteur' : 'randonneur';
      return { kind, score: 52 + focalBoost + hashBonus, allowsCompanion: false };
    }

    if (t === T_PATH || t === T_STEPS) {
      if (waterNear2 > 0) {
        const kind: NpcKind = isRainOrFog
          ? (h >>> 3) % 2 === 0
            ? 'grenouille'
            : 'martin_pecheur'
          : isDuskOrNight
          ? canFirefly && (h >>> 3) % 2 === 0
            ? 'luciole'
            : 'grenouille'
          : (h >>> 3) % 3 === 0
          ? 'randonneur'
          : (h >>> 4) % 2 === 0
          ? 'martin_pecheur'
          : 'libellule';
        return { kind, score: 80 + hashBonus, allowsCompanion: kind === 'luciole' };
      }
      if (roadOrtho >= 3 || isHighSlopeOrCrest || h % 6 === 0) {
        const kind: NpcKind =
          isHighSlopeOrCrest && h % 2 === 0
            ? 'chamois'
            : isDuskOrNight && h % 3 === 0
            ? 'renard'
            : 'randonneur';
        return { kind, score: 64 + hashBonus, allowsCompanion: false };
      }
      return null;
    }

    if (waterNear1 > 0) {
      if (isDuskOrNight) {
        const nPick = (h >>> 4) % 3;
        const kind: NpcKind =
          nPick === 0 ? 'grenouille' : canFirefly && nPick === 1 ? 'luciole' : 'chouette';
        return { kind, score: 84 + hashBonus, allowsCompanion: kind !== 'chouette' };
      }
      if (isWetOrSnowy) {
        const kind: NpcKind = (h >>> 4) % 3 === 0 ? 'martin_pecheur' : 'grenouille';
        return { kind, score: 84 + hashBonus, allowsCompanion: kind === 'grenouille' };
      }
      const rPick = (h >>> 4) % 3;
      const kind: NpcKind = rPick === 0 ? 'grenouille' : rPick === 1 ? 'libellule' : 'martin_pecheur';
      return { kind, score: 82 + hashBonus, allowsCompanion: rPick !== 2 };
    }

    if (t === T_FOREST) {
      const openNeighbors = countNearbyTile(
        gx,
        gy,
        1,
        (nt) => nt === T_MEADOW || nt === T_PATH || nt === T_FARMLAND || nt === T_PARK
      );
      if (openNeighbors === 0 && h % (isDuskOrNight ? 6 : 9) !== 0) return null;
      const fPick = (h >>> 5) % 5;
      let kind: NpcKind;
      if (isDuskOrNight) {
        kind =
          fPick === 0 || fPick === 1
            ? 'chouette'
            : fPick === 2
            ? 'renard'
            : fPick === 3 && canFirefly
            ? 'luciole'
            : 'cerf';
      } else if (!canPollinate) {
        kind =
          fPick === 0
            ? 'cerf'
            : fPick === 1 || fPick === 4
            ? 'renard'
            : fPick === 2
            ? 'chouette'
            : 'lucane';
      } else {
        kind =
          fPick === 0
            ? 'cerf'
            : fPick === 1
            ? 'renard'
            : fPick === 2
            ? 'chouette'
            : fPick === 3
            ? 'lucane'
            : 'papillon';
      }
      return {
        kind,
        score: (openNeighbors > 0 ? 74 : 50) + (isDuskOrNight ? 6 : 0) + hashBonus,
        allowsCompanion: kind === 'cerf' || kind === 'papillon' || kind === 'luciole',
      };
    }

    if (t === T_PARK) {
      if (h % 3 !== 0) return null;
      const pPick = (h >>> 5) % 4;
      let kind: NpcKind;
      if (isDuskOrNight) {
        kind =
          pPick === 0 && canFirefly
            ? 'luciole'
            : pPick === 1
            ? 'chouette'
            : pPick === 2
            ? 'renard'
            : 'citadin';
      } else if (!canPollinate) {
        kind = pPick === 0 ? 'grenouille' : pPick === 1 ? 'chouette' : 'citadin';
      } else {
        kind =
          pPick === 0 ? 'papillon' : pPick === 1 ? 'abeille' : pPick === 2 ? 'chouette' : 'citadin';
      }
      return {
        kind,
        score: 70 + hashBonus,
        allowsCompanion: kind === 'luciole' || kind === 'papillon' || kind === 'abeille',
      };
    }
    if (t === T_CEMETERY && h % 3 === 0) {
      const kind: NpcKind = isDuskOrNight
        ? canFirefly && h % 3 === 0
          ? 'luciole'
          : 'chouette'
        : h % 2 === 0
        ? 'erudit'
        : 'chouette';
      return { kind, score: 68 + (isDuskOrNight ? 8 : 0) + hashBonus, allowsCompanion: false };
    }
    if (t === T_FARMLAND) {
      if (h % (isDuskOrNight ? 4 : 5) !== 0) return null;
      const aPick = (h >>> 5) % 4;
      let kind: NpcKind;
      if (isDuskOrNight) {
        kind =
          aPick === 0 || aPick === 1
            ? canFirefly
              ? 'luciole'
              : 'renard'
            : aPick === 2
            ? 'renard'
            : 'chouette';
      } else if (!canPollinate) {
        kind = aPick <= 1 ? 'renard' : aPick === 2 ? 'grenouille' : 'villageois';
      } else {
        kind =
          aPick === 0 ? 'abeille' : aPick === 1 ? 'papillon' : aPick === 2 ? 'renard' : 'villageois';
      }
      return {
        kind,
        score: 61 + hashBonus,
        allowsCompanion: kind === 'abeille' || kind === 'papillon' || kind === 'luciole',
      };
    }
    if (t === T_RESIDENTIAL) {
      if (bldgAdj === 0 || h % 6 !== 0) return null;
      let kind: NpcKind;
      if (isDuskOrNight) {
        kind =
          settle === SETTLE_CITY_CENTER || settle === SETTLE_SUBURB
            ? (h >>> 4) % 3 === 0
              ? 'chouette'
              : 'citadin'
            : (h >>> 4) % 3 === 0 && canFirefly
            ? 'luciole'
            : (h >>> 4) % 3 === 1
            ? 'renard'
            : 'villageois';
      } else if (!canPollinate) {
        kind = settle === SETTLE_CITY_CENTER || settle === SETTLE_SUBURB ? 'citadin' : 'villageois';
      } else {
        kind =
          settle === SETTLE_CITY_CENTER || settle === SETTLE_SUBURB
            ? (h >>> 4) % 3 === 0
              ? 'papillon'
              : 'citadin'
            : (h >>> 4) % 3 === 0
            ? 'abeille'
            : 'villageois';
      }
      return { kind, score: 56 + hashBonus, allowsCompanion: false };
    }
    if (t === T_WETLAND) {
      if (h % 3 !== 0) return null;
      const wPick = (h >>> 5) % 4;
      const kind: NpcKind = isDuskOrNight
        ? canFirefly && wPick <= 1
          ? 'luciole'
          : 'grenouille'
        : wPick === 0
        ? 'martin_pecheur'
        : wPick === 1 && canPollinate
        ? 'libellule'
        : 'grenouille';
      return {
        kind,
        score: 79 + hashBonus,
        allowsCompanion: kind === 'grenouille' || kind === 'libellule' || kind === 'luciole',
      };
    }

    if (t === T_SCREE) {
      if (h % 4 !== 0) return null;
      const kind: NpcKind = (h >>> 4) % 3 === 0 ? 'randonneur' : 'chamois';
      return { kind, score: 80 + hashBonus, allowsCompanion: kind === 'chamois' };
    }

    if (t === T_SAND) {
      if (h % 5 !== 0) return null;
      const sPick = (h >>> 4) % 3;
      const kind: NpcKind = sPick === 0 ? 'martin_pecheur' : sPick === 1 ? 'colporteur' : 'randonneur';
      return { kind, score: 68 + hashBonus, allowsCompanion: kind === 'martin_pecheur' };
    }

    if (t === T_MEADOW || t === T_SCRUB) {
      if (isHighSlopeOrCrest && h % 3 === 0) {
        return {
          kind: (h >>> 4) % 3 === 0 ? 'randonneur' : 'chamois',
          score: 76 + hashBonus,
          allowsCompanion: true,
        };
      }
      if (h % (isDuskOrNight ? 5 : 7) !== 0) return null;
      const mPick = (h >>> 6) % 5;
      let kind: NpcKind;
      if (isDuskOrNight) {
        kind =
          (mPick === 0 || mPick === 1) && canFirefly
            ? 'luciole'
            : mPick === 2
            ? 'renard'
            : mPick === 3
            ? 'chouette'
            : 'cerf';
      } else if (!canPollinate) {
        kind =
          mPick === 0
            ? isRainOrFog
              ? 'grenouille'
              : 'lucane'
            : mPick === 1 || mPick === 2
            ? 'renard'
            : mPick === 3
            ? 'cerf'
            : 'lucane';
      } else {
        kind =
          mPick === 0
            ? 'papillon'
            : mPick === 1
            ? 'abeille'
            : mPick === 2
            ? 'renard'
            : mPick === 3
            ? t === T_SCRUB
              ? 'randonneur'
              : 'cerf'
            : 'lucane';
      }
      return {
        kind,
        score: 60 + (t === T_SCRUB ? 5 : 0) + (isDuskOrNight ? 6 : 0) + hashBonus,
        allowsCompanion: kind === 'papillon' || kind === 'abeille' || kind === 'luciole',
      };
    }

    return null;
  };

  const evaluateSubterraneanFocalTile = (
    gx: number,
    gy: number,
    wx: number,
    wy: number,
    h: number
  ): { kind: NpcKind; score: number } | null => {
    const dt = dungeonGrid[gy * gridSize + gx];
    if (dt === D_ROCK) return null;
    const pocket = organicPocketDensity(wx + 37, wy - 19);
    const hashBonus = (h % 19) * 0.4 + pocket * 12;

    if (dt === D_CRYPT) {
      const cPick = (h >>> 3) % 3;
      const kind: NpcKind = cPick === 0 ? 'erudit' : cPick === 1 ? 'puisatier' : 'chauve_souris';
      return { kind, score: 90 + hashBonus };
    }
    if (dt === D_NATURAL_CAVERN || dt === D_FAULT_VEIN) {
      const kind: NpcKind = (h >>> 4) % 2 === 0 ? 'chauve_souris' : 'salamandre';
      return { kind, score: 86 + hashBonus };
    }
    if (dt === D_SUB_WATER || dt === D_CULVERT || dt === D_AQUEDUCT) {
      const kind: NpcKind = dt === D_AQUEDUCT && h % 3 === 0 ? 'puisatier' : 'salamandre';
      return { kind, score: 87 + hashBonus };
    }
    if (dt === D_QUARRY_HALL || dt === D_STAIRS) {
      const kind: NpcKind = (h >>> 4) % 2 === 0 ? 'puisatier' : 'chauve_souris';
      return { kind, score: 82 + hashBonus };
    }
    if (dt === D_CELLAR && h % 4 === 0) {
      return { kind: (h >>> 4) % 2 === 0 ? 'puisatier' : 'chauve_souris', score: 66 + hashBonus };
    }
    if ((dt === D_GALLERY || dt === D_METRO_RAIL) && pocket > 0.05 && h % 7 === 0) {
      const gPick = (h >>> 4) % 3;
      const kind: NpcKind = gPick === 0 ? 'puisatier' : gPick === 1 ? 'chauve_souris' : 'salamandre';
      return { kind, score: 54 + hashBonus };
    }
    return null;
  };

  const worldTileToJitteredLatLng = (wx: number, wy: number, h: number): { lat: number; lng: number } => {
    const jx = (((h >>> 2) % 65) - 32) / 100;
    const jy = (((h >>> 9) % 65) - 32) / 100;
    const lat = -((wy + 0.5 + jy) * tileMeters) / 110540;
    const lng = ((wx + 0.5 + jx) * tileMeters) / (111320 * cosRef);
    return { lat, lng };
  };

  const pushNpc = (
    idPrefix: string,
    wx: number,
    wy: number,
    kind: NpcKind,
    sub: boolean,
    lat: number,
    lng: number,
    h: number
  ) => {
    const meta = buildNpcMetadata(kind, (h >>> 3) + (sub ? 11 : 0));
    const dialogues = buildRegionalTriviaDialogues(
      kind,
      meta.isHuman,
      lat,
      lng,
      (h >>> 3) + (sub ? 11 : 0),
      allTriviaPois,
      ctx
    );
    spawned.push({
      id: `${idPrefix}_${wx}_${wy}`,
      kind,
      voice: meta.voice,
      isHuman: meta.isHuman,
      isSubterranean: sub,
      name: meta.name,
      roleLabel: meta.roleLabel,
      habitatLabel: meta.habitatLabel,
      lat,
      lng,
      facing: (h & 1) === 0 ? 'right' : 'left',
      seed: h,
      dialogues,
    });
  };

  // ==========================================================================
  // 1. SURFACE WORLD-LOCKED MACRO-BLOCKS (~175m x 175m in absolute world tiles)
  // Each block independently picks at most 1 focal encounter inside its interior
  // margin -> 100% invariant to player movement & chunk boundaries!
  // ==========================================================================
  const surfBlockTiles = Math.max(10, Math.round(175 / Math.max(4, tileMeters)));
  const surfMargin = Math.max(2, Math.floor(surfBlockTiles * 0.22));
  const minBwx = Math.ceil((originWx + 6) / surfBlockTiles);
  const maxBwx = Math.floor((originWx + gridSize - 7) / surfBlockTiles) - 1;
  const minBwy = Math.ceil((originWy + 6) / surfBlockTiles);
  const maxBwy = Math.floor((originWy + gridSize - 7) / surfBlockTiles) - 1;

  for (let bwy = minBwy; bwy <= maxBwy; bwy++) {
    for (let bwx = minBwx; bwx <= maxBwx; bwx++) {
      const blockHash = npcHash(bwx * 131 + 7, bwy * 197 - 19);
      // Leave ~42% of world macro-blocks completely quiet so the world has organic empty stretches!
      if (blockHash % 100 < 42) continue;

      let bestCand: {
        wx: number;
        wy: number;
        gx: number;
        gy: number;
        h: number;
        lat: number;
        lng: number;
        kind: NpcKind;
        score: number;
        allowsCompanion: boolean;
      } | null = null;

      const startWx = bwx * surfBlockTiles + surfMargin;
      const endWx = (bwx + 1) * surfBlockTiles - 1 - surfMargin;
      const startWy = bwy * surfBlockTiles + surfMargin;
      const endWy = (bwy + 1) * surfBlockTiles - 1 - surfMargin;

      for (let wy = startWy; wy <= endWy; wy += 2) {
        const gy = wy - originWy;
        if (gy < 5 || gy >= gridSize - 5) continue;
        const rowParity = (wy * 3) & 1;
        for (let wx = startWx + rowParity; wx <= endWx; wx += 2) {
          const gx = wx - originWx;
          if (gx < 5 || gx >= gridSize - 5) continue;
          const h = npcHash(wx, wy);
          const ev = evaluateSurfaceFocalTile(gx, gy, wx, wy, h);
          if (!ev) continue;
          if (bestCand && ev.score < bestCand.score) continue;

          const { lat, lng } = worldTileToJitteredLatLng(wx, wy, h);
          if (isTooCloseToPois(lat, lng, false)) continue;

          if (!bestCand || ev.score > bestCand.score || h < bestCand.h) {
            bestCand = {
              wx,
              wy,
              gx,
              gy,
              h,
              lat,
              lng,
              kind: ev.kind,
              score: ev.score,
              allowsCompanion: ev.allowsCompanion,
            };
          }
        }
      }

      if (!bestCand) continue;
      pushNpc('npc_surf', bestCand.wx, bestCand.wy, bestCand.kind, false, bestCand.lat, bestCand.lng, bestCand.h);

      // Occasional organic duo (~24% on plazas, village greens, parks, or sunny meadows)
      if (bestCand.allowsCompanion && (bestCand.h >>> 7) % 100 < 24) {
        const radiusTiles = Math.max(2, Math.round(17 / Math.max(4, tileMeters)));
        for (let step = 0; step < 6; step++) {
          const angle = (((bestCand.h >>> 4) + step * 60) % 360) * (Math.PI / 180);
          const cwx = bestCand.wx + Math.round(Math.cos(angle) * radiusTiles);
          const cwy = bestCand.wy + Math.round(Math.sin(angle) * radiusTiles);
          const cgx = cwx - originWx;
          const cgy = cwy - originWy;
          if (cgx < 5 || cgx >= gridSize - 5 || cgy < 5 || cgy >= gridSize - 5) continue;
          const ch = npcHash(cwx + 7, cwy - 13);
          const compEval = evaluateSurfaceFocalTile(cgx, cgy, cwx, cwy, ch);
          if (!compEval) continue;
          const { lat: cLat, lng: cLng } = worldTileToJitteredLatLng(cwx, cwy, ch);
          const pairDist = haversineMeters(bestCand.lat, bestCand.lng, cLat, cLng);
          if (pairDist < 12 || pairDist > 28) continue;
          if (isTooCloseToPois(cLat, cLng, false)) continue;
          pushNpc('npc_surf_duo', cwx, cwy, compEval.kind, false, cLat, cLng, ch);
          break;
        }
      }
    }
  }

  // ==========================================================================
  // 2. SUBTERRANEAN WORLD-LOCKED MACRO-BLOCKS (~185m x 185m)
  // ==========================================================================
  const subBlockTiles = Math.max(10, Math.round(185 / Math.max(4, tileMeters)));
  const subMargin = Math.max(2, Math.floor(subBlockTiles * 0.2));
  const minSubBwx = Math.ceil((originWx + 6) / subBlockTiles);
  const maxSubBwx = Math.floor((originWx + gridSize - 7) / subBlockTiles) - 1;
  const minSubBwy = Math.ceil((originWy + 6) / subBlockTiles);
  const maxSubBwy = Math.floor((originWy + gridSize - 7) / subBlockTiles) - 1;

  for (let bwy = minSubBwy; bwy <= maxSubBwy; bwy++) {
    for (let bwx = minSubBwx; bwx <= maxSubBwx; bwx++) {
      const blockHash = npcHash(bwx * 163 - 23, bwy * 211 + 41);
      if (blockHash % 100 < 36) continue;

      let bestSub: {
        wx: number;
        wy: number;
        h: number;
        lat: number;
        lng: number;
        kind: NpcKind;
        score: number;
      } | null = null;

      const startWx = bwx * subBlockTiles + subMargin;
      const endWx = (bwx + 1) * subBlockTiles - 1 - subMargin;
      const startWy = bwy * subBlockTiles + subMargin;
      const endWy = (bwy + 1) * subBlockTiles - 1 - subMargin;

      for (let wy = startWy; wy <= endWy; wy += 2) {
        const gy = wy - originWy;
        if (gy < 5 || gy >= gridSize - 5) continue;
        const rowParity = (wy * 5) & 1;
        for (let wx = startWx + rowParity; wx <= endWx; wx += 2) {
          const gx = wx - originWx;
          if (gx < 5 || gx >= gridSize - 5) continue;
          const hSub = npcHash(wx + 19, wy - 31);
          const ev = evaluateSubterraneanFocalTile(gx, gy, wx, wy, hSub);
          if (!ev) continue;
          if (bestSub && ev.score < bestSub.score) continue;

          const { lat, lng } = worldTileToJitteredLatLng(wx, wy, hSub);
          if (isTooCloseToPois(lat, lng, true)) continue;

          if (!bestSub || ev.score > bestSub.score || hSub < bestSub.h) {
            bestSub = { wx, wy, h: hSub, lat, lng, kind: ev.kind, score: ev.score };
          }
        }
      }

      if (bestSub) {
        pushNpc('npc_sub', bestSub.wx, bestSub.wy, bestSub.kind, true, bestSub.lat, bestSub.lng, bestSub.h);
      }
    }
  }

  return spawned;
}

/**
 * Gentle, deterministic 16-bit micro-wander / flutter offset in virtual pixels so NPCs visibly live on the map
 * while remaining anchored to their true habitat tile.
 */
export function getNpcAnimatedOffsetPx(
  npc: WorldNpc,
  animTick: number
): { dx: number; dy: number; facing: 'left' | 'right' } {
  const t = animTick + (npc.seed % 29);
  if (
    npc.kind === 'papillon' ||
    npc.kind === 'abeille' ||
    npc.kind === 'luciole' ||
    npc.kind === 'libellule' ||
    npc.kind === 'chauve_souris'
  ) {
    const cycle = Math.floor(t / 2) % 8;
    const dxTable = [0, 2, 3, 2, 0, -2, -3, -2];
    const dyTable = [0, -1, 0, 1, 0, -1, 0, 1];
    const dx = dxTable[cycle];
    return {
      dx,
      dy: dyTable[cycle],
      facing: dx > 0 ? 'right' : dx < 0 ? 'left' : npc.facing,
    };
  }
  // Humans & ground animals occasionally take a small 1-2px pace & look around
  const slowPhase = Math.floor(t / 8) % 6;
  const dx = slowPhase === 1 || slowPhase === 2 ? 2 : slowPhase === 4 ? -1 : 0;
  const facing: 'left' | 'right' =
    slowPhase === 1 ? 'right' : slowPhase === 4 ? 'left' : npc.facing;
  return { dx, dy: 0, facing };
}

// ============================================================================
// CRISP 16-BIT PIXEL ART RENDERER FOR HUMANS, ANIMALS & INSECTS
// ============================================================================
export interface DrawNpcSpriteOptions {
  cx: number;
  cy: number;
  scale: number;
  npc: WorldNpc;
  animTick: number;
  showSpeechBubble?: boolean;
  isSelected?: boolean;
}

const NPC_ATLAS_VW = 32;
const NPC_ATLAS_VH = 28;
const NPC_ATLAS_ANCHOR_X = 16;
const NPC_ATLAS_ANCHOR_Y = 22;
const MAX_NPC_SPRITE_CACHE = 192;
const npcSpriteAtlasCache = new Map<string, HTMLCanvasElement>();

function getOrBuildNpcBodySprite(
  npc: WorldNpc,
  scale: number,
  phase: number,
  bob: number,
  wingUp: boolean,
  isSelected: boolean
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  const variantSig = npc.isHuman
    ? `${bob}_${npc.seed % 4}_${(npc.seed >>> 3) % 5}_${npc.kind === 'citadin' ? npc.seed & 4 : 0}`
    : `${phase}_${wingUp ? 1 : 0}`;
  const key = `${npc.kind}|${scale}|${npc.facing}|${isSelected ? 1 : 0}|${variantSig}`;

  const hit = npcSpriteAtlasCache.get(key);
  if (hit) {
    npcSpriteAtlasCache.delete(key);
    npcSpriteAtlasCache.set(key, hit);
    return hit;
  }

  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(NPC_ATLAS_VW * scale));
  off.height = Math.max(1, Math.round(NPC_ATLAS_VH * scale));
  const octx = off.getContext('2d');
  if (!octx) return null;
  octx.imageSmoothingEnabled = false;

  const flip = npc.facing === 'left' ? -1 : 1;
  const px = (dx: number, dy: number, w: number, h: number, color: string) => {
    const rx = flip === 1 ? dx : -dx - w + 1;
    octx.fillStyle = color;
    octx.fillRect(
      Math.round((NPC_ATLAS_ANCHOR_X + rx) * scale),
      Math.round((NPC_ATLAS_ANCHOR_Y + dy) * scale),
      Math.max(1, Math.round(w * scale)),
      Math.max(1, Math.round(h * scale))
    );
  };

  if (isSelected) {
    px(-7, -1, 15, 4, '#fde047');
    px(-6, 0, 13, 2, '#f59e0b');
  } else {
    px(-5, 0, 11, 2, 'rgba(20, 11, 5, 0.36)');
  }

  const out = '#140b05';

  if (npc.isHuman) {
    const skinTones = ['#fed7aa', '#eab676', '#f5ce9b', '#d19566'];
    const skin = skinTones[npc.seed % skinTones.length];
    const hairColors = ['#451a03', '#78350f', '#1e293b', '#92400e', '#d6d3d1'];
    const hair = hairColors[(npc.seed >>> 3) % hairColors.length];

    let coatMain = '#2563eb';
    let coatLight = '#60a5fa';
    let hatColor: string | null = null;
    if (npc.kind === 'citadin') {
      coatMain = (npc.seed & 4) === 0 ? '#1d4ed8' : '#7f1d1d';
      coatLight = (npc.seed & 4) === 0 ? '#60a5fa' : '#f87171';
      hatColor = '#1e293b';
    } else if (npc.kind === 'villageois') {
      coatMain = '#15803d';
      coatLight = '#4ade80';
      hatColor = '#d97706';
    } else if (npc.kind === 'erudit') {
      coatMain = '#581c87';
      coatLight = '#c084fc';
      hatColor = '#78350f';
    } else if (npc.kind === 'colporteur') {
      coatMain = '#9a3412';
      coatLight = '#fb923c';
      hatColor = '#b45309';
    } else if (npc.kind === 'randonneur') {
      coatMain = '#0f766e';
      coatLight = '#2dd4bf';
      hatColor = '#ca8a04';
    } else if (npc.kind === 'puisatier') {
      coatMain = '#57534e';
      coatLight = '#a8a29e';
      hatColor = '#f59e0b';
    }

    px(-4, -3, 4, 3, out);
    px(1, -3, 4, 3, out);
    px(-3, -3, 2, 2, '#451a03');
    px(2, -3, 2, 2, '#451a03');

    if (npc.kind === 'colporteur' || npc.kind === 'randonneur') {
      px(-7, -11 + bob, 4, 7, out);
      px(-6, -10 + bob, 3, 5, '#92400e');
      px(-6, -10 + bob, 2, 2, '#d97706');
    }

    px(-5, -10 + bob, 11, 8, out);
    px(-4, -9 + bob, 9, 6, coatMain);
    px(-3, -9 + bob, 4, 4, coatLight);
    px(-4, -5 + bob, 9, 1, '#291509');
    px(0, -5 + bob, 2, 1, '#fde047');

    px(-5, -17 + bob, 11, 8, out);
    px(-4, -16 + bob, 9, 6, skin);
    px(-4, -16 + bob, 9, 2, hair);
    px(-4, -14 + bob, 2, 3, hair);
    px(0, -13 + bob, 1, 2, out);
    px(3, -13 + bob, 1, 2, out);

    if (hatColor) {
      px(-6, -18 + bob, 13, 2, out);
      px(-5, -19 + bob, 11, 2, hatColor);
      if (npc.kind === 'puisatier') {
        px(2, -19 + bob, 2, 2, '#fef08a');
      }
    }

    if (npc.kind === 'randonneur' || npc.kind === 'colporteur') {
      px(5, -13 + bob, 2, 12, '#78350f');
      px(5, -13 + bob, 1, 11, '#d97706');
    } else if (npc.kind === 'erudit') {
      px(4, -8 + bob, 4, 4, '#140b05');
      px(5, -7 + bob, 2, 2, '#fef3c7');
    } else if (npc.kind === 'puisatier') {
      px(5, -7 + bob, 3, 4, '#f59e0b');
      px(6, -6 + bob, 1, 2, '#fef08a');
    }
  } else {
    switch (npc.kind) {
      case 'renard': {
        const tailY = phase % 2 === 0 ? 0 : -1;
        px(-9, -6 + tailY, 6, 4, out);
        px(-8, -5 + tailY, 4, 2, '#ea580c');
        px(-9, -5 + tailY, 2, 2, '#ffffff');
        px(-4, -7, 10, 6, out);
        px(-3, -6, 8, 4, '#ea580c');
        px(-3, -6, 6, 2, '#fb923c');
        px(-3, -2, 2, 2, out);
        px(3, -2, 2, 2, out);
        px(2, -11 + bob, 7, 6, out);
        px(3, -10 + bob, 5, 4, '#ea580c');
        px(4, -7 + bob, 4, 2, '#ffffff');
        px(3, -13 + bob, 2, 2, '#9a3412');
        px(6, -13 + bob, 2, 2, '#9a3412');
        px(6, -9 + bob, 1, 1, out);
        px(8, -8 + bob, 1, 1, out);
        break;
      }
      case 'cerf': {
        px(-5, -9, 11, 7, out);
        px(-4, -8, 9, 5, '#b45309');
        px(-3, -8, 6, 2, '#d97706');
        px(-5, -7, 2, 2, '#fef3c7');
        px(-4, -2, 2, 2, out);
        px(3, -2, 2, 2, out);
        px(3, -14 + bob, 6, 7, out);
        px(4, -13 + bob, 4, 5, '#b45309');
        px(6, -12 + bob, 1, 1, out);
        px(3, -17 + bob, 2, 3, '#fde68a');
        px(6, -17 + bob, 2, 3, '#fde68a');
        px(2, -16 + bob, 6, 1, '#fde68a');
        break;
      }
      case 'chamois': {
        px(-5, -9, 11, 7, out);
        px(-4, -8, 9, 5, '#78350f');
        px(-3, -8, 6, 2, '#a16207');
        px(-4, -2, 2, 2, out);
        px(3, -2, 2, 2, out);
        px(3, -14 + bob, 6, 6, out);
        px(4, -13 + bob, 4, 4, '#fef3c7');
        px(5, -12 + bob, 2, 2, '#291509');
        px(4, -17 + bob, 1, 3, out);
        px(6, -17 + bob, 1, 3, out);
        px(3, -17 + bob, 2, 1, out);
        break;
      }
      case 'chouette': {
        px(-4, -11 + bob, 9, 10, out);
        px(-3, -10 + bob, 7, 8, '#78350f');
        px(-2, -6 + bob, 5, 4, '#fde68a');
        px(-1, -5 + bob, 1, 2, '#92400e');
        px(1, -5 + bob, 1, 2, '#92400e');
        px(-2, -9 + bob, 2, 2, '#fef08a');
        px(1, -9 + bob, 2, 2, '#fef08a');
        px(-1, -8 + bob, 1, 1, out);
        px(2, -8 + bob, 1, 1, out);
        px(0, -7 + bob, 1, 1, '#f59e0b');
        break;
      }
      case 'martin_pecheur': {
        px(-5, -9 + bob, 9, 8, out);
        px(-4, -8 + bob, 6, 6, '#0284c7');
        px(-4, -8 + bob, 4, 3, '#38bdf8');
        px(-1, -6 + bob, 4, 4, '#ea580c');
        px(2, -8 + bob, 1, 1, '#ffffff');
        px(1, -8 + bob, 1, 1, out);
        px(4, -7 + bob, 4, 2, out);
        break;
      }
      case 'abeille': {
        const hoverY = wingUp ? -6 : -5;
        px(-4, hoverY - 4, 9, 6, out);
        px(-3, hoverY - 3, 7, 4, '#facc15');
        px(-1, hoverY - 3, 2, 4, out);
        px(2, hoverY - 3, 1, 4, out);
        const wy = wingUp ? hoverY - 7 : hoverY - 5;
        px(-2, wy, 5, 3, '#e0f2fe');
        px(-1, wy, 3, 2, '#ffffff');
        break;
      }
      case 'papillon': {
        const hoverY = wingUp ? -7 : -5;
        if (wingUp) {
          px(-6, hoverY - 6, 13, 8, out);
          px(-5, hoverY - 5, 5, 6, '#fef08a');
          px(1, hoverY - 5, 5, 6, '#fef08a');
          px(-4, hoverY - 4, 2, 4, '#ca8a04');
          px(3, hoverY - 4, 2, 4, '#ca8a04');
          px(-3, hoverY - 1, 2, 1, '#2563eb');
          px(2, hoverY - 1, 2, 1, '#2563eb');
        } else {
          px(-4, hoverY - 4, 9, 5, out);
          px(-3, hoverY - 3, 7, 3, '#fde047');
        }
        px(0, hoverY - 5, 1, 6, out);
        break;
      }
      case 'lucane': {
        px(-5, -7, 9, 6, out);
        px(-4, -6, 7, 4, '#7f1d1d');
        px(-3, -5, 4, 2, '#b91c1c');
        px(4, -7, 4, 2, '#450a0a');
        px(6, -8, 2, 1, '#450a0a');
        px(4, -4, 4, 2, '#450a0a');
        break;
      }
      case 'luciole': {
        const hoverY = wingUp ? -7 : -6;
        const pulseBright = phase % 2 === 0;
        // Soft bioluminescent halo behind tail
        px(-6, hoverY - 4, 6, 5, pulseBright ? 'rgba(190, 242, 100, 0.45)' : 'rgba(253, 224, 71, 0.28)');
        // Dark pronotum & elytra + glowing lime-gold lantern abdomen
        px(-5, hoverY - 3, 9, 4, out);
        px(-4, hoverY - 2, 4, 2, pulseBright ? '#bef264' : '#a3e635');
        if (pulseBright) {
          px(-3, hoverY - 2, 2, 1, '#ffffff');
        }
        px(0, hoverY - 2, 3, 2, '#3f3f46');
        px(2, hoverY - 3, 2, 2, '#b45309');
        const wy = wingUp ? hoverY - 5 : hoverY - 4;
        px(-1, wy, 4, 2, '#e2e8f0');
        break;
      }
      case 'grenouille': {
        const hop = phase === 3 ? -2 : 0;
        px(-4, -7 + hop, 9, 6, out);
        px(-3, -6 + hop, 7, 4, '#16a34a');
        px(-2, -6 + hop, 5, 2, '#4ade80');
        px(-1, -3 + hop, 5, 1, '#fef08a');
        px(-2, -8 + hop, 2, 2, '#fde047');
        px(2, -8 + hop, 2, 2, '#fde047');
        px(-1, -8 + hop, 1, 1, out);
        px(3, -8 + hop, 1, 1, out);
        break;
      }
      case 'libellule': {
        const hoverY = wingUp ? -7 : -6;
        px(-6, hoverY - 2, 12, 3, out);
        px(-5, hoverY - 1, 10, 1, '#06b6d4');
        px(3, hoverY - 2, 2, 2, '#22d3ee');
        const wSpan = wingUp ? 4 : 2;
        px(-1, hoverY - 1 - wSpan, 4, wSpan, '#bae6fd');
        px(-1, hoverY + 1, 4, wSpan, '#bae6fd');
        break;
      }
      case 'chauve_souris': {
        const hoverY = wingUp ? -9 : -7;
        if (wingUp) {
          px(-7, hoverY - 4, 15, 6, out);
          px(-6, hoverY - 3, 5, 3, '#4c1d95');
          px(2, hoverY - 3, 5, 3, '#4c1d95');
        } else {
          px(-5, hoverY - 2, 11, 5, out);
          px(-4, hoverY - 1, 9, 3, '#4c1d95');
        }
        px(-2, hoverY - 4, 5, 5, '#2e1065');
        px(-1, hoverY - 3, 1, 1, '#fde047');
        px(1, hoverY - 3, 1, 1, '#fde047');
        break;
      }
      case 'salamandre': {
        px(-7, -5, 14, 5, out);
        px(-6, -4, 12, 3, '#18181b');
        px(-4, -4, 2, 2, '#facc15');
        px(0, -3, 2, 2, '#facc15');
        px(3, -4, 2, 2, '#facc15');
        px(5, -3, 1, 1, '#fef08a');
        break;
      }
    }
  }

  while (npcSpriteAtlasCache.size >= MAX_NPC_SPRITE_CACHE) {
    const oldest = npcSpriteAtlasCache.keys().next().value;
    if (oldest === undefined) break;
    npcSpriteAtlasCache.delete(oldest);
  }
  npcSpriteAtlasCache.set(key, off);
  return off;
}

export function drawNpcSprite16Bit(
  ctx: CanvasRenderingContext2D,
  opts: DrawNpcSpriteOptions
): void {
  const { cx, cy, scale, npc, animTick, showSpeechBubble = false, isSelected = false } = opts;
  const phase = (Math.floor(animTick / 3) + (npc.seed % 7)) % 4;
  const bob = phase % 2 === 0 ? 0 : -1;
  const wingUp = animTick % 2 === 0;
  const out = '#140b05';

  const cachedSprite = getOrBuildNpcBodySprite(npc, scale, phase, bob, wingUp, isSelected);
  if (cachedSprite) {
    ctx.drawImage(
      cachedSprite,
      Math.round((cx - NPC_ATLAS_ANCHOR_X) * scale),
      Math.round((cy - NPC_ATLAS_ANCHOR_Y) * scale)
    );
  }

  // Overhead 16-bit JRPG `...` speech bubble cue when nearby or hovered!
  if (showSpeechBubble) {
    const by = cy + (npc.isHuman ? -26 + bob : -18 + bob);
    ctx.fillStyle = out;
    ctx.fillRect(
      Math.round((cx - 6) * scale),
      Math.round(by * scale),
      Math.round(13 * scale),
      Math.round(7 * scale)
    );
    ctx.fillRect(
      Math.round((cx - 1) * scale),
      Math.round((by + 7) * scale),
      Math.round(3 * scale),
      Math.round(2 * scale)
    );
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(
      Math.round((cx - 5) * scale),
      Math.round((by + 1) * scale),
      Math.round(11 * scale),
      Math.round(5 * scale)
    );
    // Animated 3 dots
    const activeDot = Math.floor(animTick / 4) % 3;
    for (let d = 0; d < 3; d++) {
      ctx.fillStyle = d === activeDot ? '#b45309' : '#291509';
      ctx.fillRect(
        Math.round((cx - 4 + d * 3) * scale),
        Math.round((by + 3) * scale),
        Math.max(1, Math.round(1.5 * scale)),
        Math.max(1, Math.round(1.5 * scale))
      );
    }
  }
}

export const NpcPortraitCanvas: React.FC<{
  npc: WorldNpc;
  animTick?: number;
  silhouette?: boolean;
  className?: string;
}> = ({ npc, animTick = 0, silhouette = false, className = 'w-14 h-14' }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (silhouette) {
      // Unobserved Bestiary species: mysterious sepia-parchment silhouette!
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tctx = tmp.getContext('2d');
      if (tctx) {
        tctx.imageSmoothingEnabled = false;
        drawNpcSprite16Bit(tctx, {
          cx: 12,
          cy: npc.isHuman ? 21 : 18,
          scale: 3,
          npc: { ...npc, facing: 'right' },
          animTick: 0,
          showSpeechBubble: false,
          isSelected: false,
        });
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = '#3b2414';
        tctx.fillRect(0, 0, tmp.width, tmp.height);
      }
      ctx.fillStyle = '#e5d3b3';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#cfb78f';
      ctx.fillRect(0, canvas.height - 16, canvas.width, 16);
      ctx.globalAlpha = 0.72;
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 1;
      return;
    }

    // Subtle habitat backdrop inside portrait frame
    ctx.fillStyle = npc.isSubterranean
      ? '#1c1917'
      : npc.isHuman
      ? '#efe2c6'
      : '#dcfce7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = npc.isSubterranean
      ? '#292524'
      : npc.isHuman
      ? '#d6c3a3'
      : '#bbf7d0';
    ctx.fillRect(0, canvas.height - 16, canvas.width, 16);

    drawNpcSprite16Bit(ctx, {
      cx: 12,
      cy: npc.isHuman ? 21 : 18,
      scale: 3,
      npc: { ...npc, facing: 'right' },
      animTick,
      showSpeechBubble: false,
      isSelected: false,
    });
  }, [npc, animTick, silhouette]);

  return React.createElement('canvas', {
    ref,
    width: 72,
    height: 72,
    className: `pixelated border-2 border-[#2b1d12] shrink-0 ${className}`,
  });
};

// ============================================================================
// BESTIARY 12-SPECIES NATURALIST CATALOG & NPC RUMOR / LEAD GENERATOR
// ============================================================================

export interface BestiarySpeciesMeta {
  kind: NpcKind;
  name: string;
  latinName: string;
  familyLabel: string;
  habitatLabel: string;
  rhythmLabel: string;
  clueHint: string;
  isSubterranean: boolean;
  previewNpc: WorldNpc;
}

function makePreviewSpeciesNpc(
  kind: NpcKind,
  name: string,
  roleLabel: string,
  habitatLabel: string,
  voice: NpcVoiceKind,
  isSubterranean = false
): WorldNpc {
  return {
    id: `preview_${kind}`,
    kind,
    voice,
    isHuman: false,
    isSubterranean,
    name,
    roleLabel,
    habitatLabel,
    lat: 0,
    lng: 0,
    facing: 'right',
    seed: 7,
    dialogues: [],
  };
}

export const BESTIARY_SPECIES_CATALOG: BestiarySpeciesMeta[] = [
  {
    kind: 'renard',
    name: 'Renard roux',
    latinName: 'Vulpes vulpes',
    familyLabel: 'Mammifère des lisières',
    habitatLabel: 'Lisières, haies & bocages',
    rhythmLabel: 'Crépuscule & Nuit (+ fréquent)',
    clueHint: 'Fréquente les lisières et les haies, et sort bien plus volontiers à découvert dès le crépuscule.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('renard', 'Renard roux', 'Faune des lisières', 'Lisières & bocages', 'beast'),
  },
  {
    kind: 'cerf',
    name: 'Chevreuil des bois',
    latinName: 'Capreolus capreolus',
    familyLabel: 'Cervidé sylvestre',
    habitatLabel: 'Futaies, clairières & orées',
    rhythmLabel: 'Aube, Jour & Crépuscule',
    clueHint: 'Se laisse apercevoir à l’orée des massifs boisés et des grandes clairières.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('cerf', 'Chevreuil des bois', 'Cervidé sylvestre', 'Forêts & clairières', 'beast'),
  },
  {
    kind: 'chouette',
    name: 'Chouette hulotte',
    latinName: 'Strix aluco',
    familyLabel: 'Rapace nocturne',
    habitatLabel: 'Vieux arbres, parcs & enclos',
    rhythmLabel: 'Crépuscule & Nuit (+ fréquente)',
    clueHint: 'Discrète en journée dans les vieux bois, elle multiplie ses apparitions au crépuscule et la nuit.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('chouette', 'Chouette hulotte', 'Oiseau des vieux bois', 'Futaies & grands parcs', 'bird'),
  },
  {
    kind: 'luciole',
    name: 'Luciole des prés',
    latinName: 'Lampyris noctiluca',
    familyLabel: 'Coléoptère bioluminescent',
    habitatLabel: 'Prairies fraîches, haies & parcs',
    rhythmLabel: 'Crépuscule & Nuit · Hors orage',
    clueHint: 'Apparaît uniquement au crépuscule et la nuit dans les prés, jardins et berges calmes.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('luciole', 'Luciole des prés', 'Insecte bioluminescent', 'Prés & haies nocturnes', 'insect'),
  },
  {
    kind: 'chamois',
    name: 'Chamois des crêtes',
    latinName: 'Rupicapra rupicapra',
    familyLabel: 'Ongulé rupestre',
    habitatLabel: 'Versants escarpés & corniches',
    rhythmLabel: 'Tous temps · Relief escarpé',
    clueHint: 'Arpente les pentes fortes, crêtes rocheuses et reliefs montagneux.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('chamois', 'Chamois des crêtes', 'Faune rupestre', 'Crêtes & pentes vives', 'beast'),
  },
  {
    kind: 'martin_pecheur',
    name: 'Martin-pêcheur d’Europe',
    latinName: 'Alcedo atthis',
    familyLabel: 'Oiseau des rivières',
    habitatLabel: 'Rivières claires, berges & pontons',
    rhythmLabel: 'Aube & Jour · Cours d’eau',
    clueHint: 'Guette les eaux vives depuis les berges, estacades et sentiers de halage.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('martin_pecheur', 'Martin-pêcheur', 'Oiseau des rivières', 'Berges & cours d’eau', 'bird'),
  },
  {
    kind: 'grenouille',
    name: 'Grenouille verte',
    latinName: 'Pelophylax kl. esculentus',
    familyLabel: 'Amphibien des rives',
    habitatLabel: 'Mares, roseaux & berges calmes',
    rhythmLabel: 'Pluie, Soir & Berges (+ active)',
    clueHint: 'Se tient au ras de l’eau et sort encore plus volontiers sous l’averse ou la brume.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('grenouille', 'Grenouille des berges', 'Amphibien ripicole', 'Rives & zones humides', 'amphibian'),
  },
  {
    kind: 'libellule',
    name: 'Libellule déprimée',
    latinName: 'Libellula depressa',
    familyLabel: 'Odonate aquatique',
    habitatLabel: 'Cours d’eau, gués & roselières',
    rhythmLabel: 'Diurne · Hors orage',
    clueHint: 'Patrouille de jour au-dessus des rivières, canaux et chemins longeant l’eau.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('libellule', 'Libellule bleue', 'Insecte des eaux vives', 'Berges & roseaux', 'insect'),
  },
  {
    kind: 'abeille',
    name: 'Abeille mellifère',
    latinName: 'Apis mellifera',
    familyLabel: 'Hyménoptère pollinisateur',
    habitatLabel: 'Prairies fleuries, vergers & jardins',
    rhythmLabel: 'Diurne · Temps sec uniquement',
    clueHint: 'Butine de jour dans les prés et vergers ; rentre à la ruche sous la pluie ou la nuit.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('abeille', 'Abeille butineuse', 'Pollinisateur local', 'Prairies & vergers', 'insect'),
  },
  {
    kind: 'papillon',
    name: 'Flambé des prairies',
    latinName: 'Iphiclides podalirius',
    familyLabel: 'Lépidoptère diurne',
    habitatLabel: 'Coteaux herbeux, parcs & clairières',
    rhythmLabel: 'Diurne · Temps sec uniquement',
    clueHint: 'Plane au soleil au-dessus des prés et parcs ; absent sous l’averse ou la nuit.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('papillon', 'Papillon des prés', 'Lépidoptère diurne', 'Prés & jardins', 'insect'),
  },
  {
    kind: 'lucane',
    name: 'Lucane cerf-volant',
    latinName: 'Lucanus cervus',
    familyLabel: 'Coléoptère saproxylique',
    habitatLabel: 'Vieux chênes & souches moussues',
    rhythmLabel: 'Jour & Crépuscule · Vieux bois',
    clueHint: 'Habite les vieilles chênaies, lisières forestières et prairies bordées d’arbres anciens.',
    isSubterranean: false,
    previewNpc: makePreviewSpeciesNpc('lucane', 'Lucane cerf-volant', 'Grand coléoptère des bois', 'Vieux bois & futaies', 'insect'),
  },
  {
    kind: 'chauve_souris',
    name: 'Petit rhinolophe',
    latinName: 'Rhinolophus hipposideros',
    familyLabel: 'Chiroptère cavernicole',
    habitatLabel: 'Grottes, carrières & cryptes (Sous-sol)',
    rhythmLabel: 'Cavernicole · Tous temps',
    clueHint: 'Basculez en strate Sous-sol (touche G ou escalier) pour l’observer sous les voûtes.',
    isSubterranean: true,
    previewNpc: makePreviewSpeciesNpc('chauve_souris', 'Petit rhinolophe', 'Faune cavernicole', 'Cavités & voûtes souterraines', 'beast', true),
  },
  {
    kind: 'salamandre',
    name: 'Salamandre tachetée',
    latinName: 'Salamandra salamandra',
    familyLabel: 'Urodèle des galeries humides',
    habitatLabel: 'Suintements, caves & nappes (Sous-sol)',
    rhythmLabel: 'Cavernicole · Parois humides',
    clueHint: 'Explorez les galeries humides et nappes souterraines pour croiser sa robe noir et or.',
    isSubterranean: true,
    previewNpc: makePreviewSpeciesNpc('salamandre', 'Salamandre tachetée', 'Amphibien des galeries', 'Parois humides & caves', 'amphibian', true),
  },
];

export type NpcRumorDraft = Omit<RumorLead, 'regionLabel' | 'createdAtIso' | 'verified'>;

function spokenDirectionFr(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(toLng - fromLng);
  const y = Math.sin(dLng) * Math.cos(toRad(toLat));
  const x =
    Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat)) -
    Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(dLng);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
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
  return dirs[Math.round(deg / 45) % 8];
}

function rumorWalkDistanceFr(meters: number): string {
  const rounded = Math.max(40, Math.round(meters / 10) * 10);
  if (rounded < 180) return `à une centaine de mètres`;
  const mins = Math.max(2, Math.round(rounded / 78));
  if (mins <= 3) return `à deux ou trois minutes de marche (${rounded} m)`;
  return `à environ ${mins} minutes de pas (${rounded} m)`;
}

/**
 * Generates an in-character local rumor ("Piste / Rumeur") offered by knowledgeable human NPCs
 * (`erudit`, `colporteur`, `puisatier`, and occasionally `villageois` / `randonneur`),
 * pointing either to a nearby undiscovered POI or a nearby subterranean cavity/stairwell access.
 */
export function buildNpcRumorOffer(
  npc: WorldNpc,
  params: {
    surfacePois: PoiItem[];
    subterraneanPois: PoiItem[];
    portalAnchors: Array<{ lat: number; lng: number; name: string }>;
    unlockedIds: Set<string>;
  }
): NpcRumorDraft | null {
  if (!npc.isHuman) return null;

  const isCoreInformant =
    npc.kind === 'erudit' || npc.kind === 'colporteur' || npc.kind === 'puisatier';
  const isOccasionalInformant =
    (npc.kind === 'villageois' || npc.kind === 'randonneur') && npc.seed % 2 === 0;

  if (!isCoreInformant && !isOccasionalInformant) return null;

  const { surfacePois, subterraneanPois, portalAnchors, unlockedIds } = params;

  // 1. Subterranean access rumor (prioritized for surface 'puisatier', or 'erudit' when a portal is close)
  if (
    !npc.isSubterranean &&
    portalAnchors.length > 0 &&
    (npc.kind === 'puisatier' || (npc.kind === 'erudit' && npc.seed % 3 === 0))
  ) {
    const nearbyPortals = portalAnchors
      .map((p) => ({
        portal: p,
        dist: haversineMeters(npc.lat, npc.lng, p.lat, p.lng),
      }))
      .filter((x) => x.dist >= 25 && x.dist <= 1150)
      .sort((a, b) => a.dist - b.dist);

    if (nearbyPortals.length > 0) {
      const pick = nearbyPortals[npc.seed % Math.min(3, nearbyPortals.length)];
      const dirFr = spokenDirectionFr(npc.lat, npc.lng, pick.portal.lat, pick.portal.lng);
      const distFr = rumorWalkDistanceFr(pick.dist);
      const cleanPortalName = cleanSpokenPlaceName(pick.portal.name) || 'Accès souterrain ancien';
      const portalId = `portal_${pick.portal.lat.toFixed(4)}_${pick.portal.lng.toFixed(4)}`;

      const rumorText =
        npc.kind === 'puisatier'
          ? `« Entre gens de métier : ${distFr} vers ${dirFr}, on trouve un accès discret vers les galeries de « ${cleanPortalName} ». Je peux vous pointer l’entrée sur votre carte si le sous-sol vous tente. »`
          : `« Les plans anciens mentionnent une descente vers « ${cleanPortalName} », ${distFr} vers ${dirFr}. Peu de promeneurs y prêtent attention aujourd’hui. »`;

      return {
        id: `rumor_portal_${portalId}`,
        targetType: 'portal',
        targetId: portalId,
        title: `Accès : ${cleanPortalName}`,
        rumorText,
        giverId: npc.id,
        giverName: npc.name,
        giverRole: npc.roleLabel,
        lat: pick.portal.lat,
        lng: pick.portal.lng,
        isSubterranean: false,
      };
    }
  }

  // 2. Undiscovered POI rumor on the NPC's current layer (or underground POI for a subterranean informant)
  const candidatePool = npc.isSubterranean ? subterraneanPois : surfacePois;
  const veiledCandidates = candidatePool
    .filter((p) => !unlockedIds.has(p.id))
    .map((poi) => {
      const dist = haversineMeters(npc.lat, npc.lng, poi.lat, poi.lng);
      let roleWeight = 0;
      if (npc.kind === 'erudit' && (poi.category === 'histoire' || poi.category === 'legende' || poi.category === 'etrange')) {
        roleWeight = -220;
      } else if (npc.kind === 'colporteur' && (poi.category === 'etrange' || poi.category === 'legende' || poi.category === 'histoire')) {
        roleWeight = -180;
      } else if (npc.kind === 'puisatier' && (poi.category === 'geographie' || poi.category === 'etrange')) {
        roleWeight = -200;
      } else if (npc.kind === 'randonneur' && (poi.category === 'geographie' || poi.category === 'ecosysteme')) {
        roleWeight = -180;
      }
      return { poi, dist, score: dist + roleWeight };
    })
    .filter((x) => x.dist >= 35 && x.dist <= 1650)
    .sort((a, b) => a.score - b.score);

  if (veiledCandidates.length === 0) return null;

  const chosen = veiledCandidates[npc.seed % Math.min(4, veiledCandidates.length)];
  const dirFr = spokenDirectionFr(npc.lat, npc.lng, chosen.poi.lat, chosen.poi.lng);
  const distFr = rumorWalkDistanceFr(chosen.dist);
  const mysteryLabel = chosen.poi.mysteryTitle || 'Lieu méconnu';
  const eraHint = chosen.poi.eraLabel ? ` (${chosen.poi.eraLabel.toLowerCase()})` : '';

  let rumorText: string;
  if (npc.kind === 'erudit') {
    rumorText = `« Si vous cherchez une piste encore hors des guides : ${distFr} vers ${dirFr}, les archives évoquent une curiosité${eraHint} surnommée « ${mysteryLabel} ». Voulez-vous que je la repère sur votre carte ? »`;
  } else if (npc.kind === 'colporteur') {
    rumorText = `« J’ai entendu parler sur la route d’un endroit singulier — « ${mysteryLabel} » — situé ${distFr} vers ${dirFr}. Laissez-moi vous tracer une marque sur la carte pour aller vérifier ! »`;
  } else if (npc.kind === 'puisatier') {
    rumorText = `« En sondant le terrain ${distFr} vers ${dirFr}, nos anciens ont signalé une singularité appelée « ${mysteryLabel} ». Ça vaut le détour d’œil sur place. »`;
  } else if (npc.kind === 'randonneur') {
    rumorText = `« Un peu plus loin vers ${dirFr}, ${distFr}, un détour mène à un coin intrigant que l’on nomme « ${mysteryLabel} ». Je vous indique le cap si vous voulez. »`;
  } else {
    rumorText = `« Les gens d’ici parlent parfois d’un lieu discret vers ${dirFr}, ${distFr} : « ${mysteryLabel} ». Allez donc voir par vous-même ! »`;
  }

  return {
    id: `rumor_poi_${chosen.poi.id}`,
    targetType: 'poi',
    targetId: chosen.poi.id,
    title: mysteryLabel,
    rumorText,
    giverId: npc.id,
    giverName: npc.name,
    giverRole: npc.roleLabel,
    lat: chosen.poi.lat,
    lng: chosen.poi.lng,
    isSubterranean: Boolean(chosen.poi.isSubterranean),
    category: chosen.poi.category,
  };
}

