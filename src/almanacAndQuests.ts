import {
  BedrockInfo,
  CATEGORY_META,
  ElevationGrid,
  ExplorationCategory,
  haversineMeters,
  HistoricalStratum,
  PoiItem,
  sampleElevationMeters,
  STRATUM_META,
  TerrainFeature,
  UnlockedEntry,
  WeatherInfo,
} from './types';
import { RegionalStyleId } from './regionalBiomes';

// ============================================================================
// 1. TYPES — ALMANACH CALENDAIRE (GLOBAL + LOCAL), SAISONS, ÉNIGMES & PISTES
// ============================================================================

export type SeasonId = 'printemps' | 'ete' | 'automne' | 'hiver';

export interface GlobalEphemerisItem {
  year: number;
  text: string;
  articleTitle?: string;
  articleUrl?: string;
}

export interface LocalAnniversaryItem {
  id: string;
  label: string;
  description: string;
  year: number | null;
  dateLabel: string;
  exactDayMatch: boolean;
  distanceKm: number;
  lat: number;
  lng: number;
  articleUrl?: string;
}

export interface LocalFestivalItem {
  id: string;
  name: string;
  commune: string;
  domain: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  distanceKm: number | null;
  lat: number | null;
  lng: number | null;
  website?: string;
}

export interface SectorAlmanacPayload {
  dateIso: string;
  month: number;
  day: number;
  locality: {
    commune: string;
    departement: string;
    codeDepartement?: string;
    region: string;
    population?: number;
  };
  globalEphemerides: GlobalEphemerisItem[];
  localAnniversaries: LocalAnniversaryItem[];
  localFestivals?: LocalFestivalItem[];
}

export interface CalendarEventDefinition {
  id: string;
  scope: 'global' | 'regional';
  regionalStyles?: RegionalStyleId[];
  kicker: string;
  title: string;
  subtitle: string;
  description: string;
  category: ExplorationCategory;
  xpBonus: number;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  questTitle: string;
  questGoalDescription: string;
  targetCount: number;
  evaluateProgress: (ctx: AlmanacQuestEvalContext) => number;
}

export interface ActiveCalendarEvent {
  event: CalendarEventDefinition;
  status: 'active' | 'upcoming';
  daysUntilStart: number;
  daysRemaining: number;
  dateRangeLabel: string;
}

export interface SeasonalQuestDefinition {
  id: string;
  season: SeasonId;
  kicker: string;
  title: string;
  description: string;
  category: ExplorationCategory;
  xpBonus: number;
  targetCount: number;
  evaluateProgress: (ctx: AlmanacQuestEvalContext) => number;
}

export interface AlmanacQuestEvalContext {
  entries: UnlockedEntry[];
  solvedRiddleIds: ReadonlySet<string>;
  completedHuntIds: ReadonlySet<string>;
  weather?: WeatherInfo | null;
  isNightOrDusk: boolean;
}

export interface SeasonMeta {
  id: SeasonId;
  nameFr: string;
  almanacTitle: string;
  dateSpanLabel: string;
  motto: string;
  palette: {
    bgDark: string;
    bgMid: string;
    accent: string;
    highlight: string;
  };
}

// ============================================================================
// 2. SAISONS ASTRONOMIQUES & MÉTADONNÉES 16-BIT
// ============================================================================

export const SEASON_META: Record<SeasonId, SeasonMeta> = {
  printemps: {
    id: 'printemps',
    nameFr: 'Printemps',
    almanacTitle: 'Printemps des Sources Vives & Floraisons',
    dateSpanLabel: '20 mars – 20 juin',
    motto: 'Les rus chantent sous la mousse, les bourgeons percent la pierre ancienne.',
    palette: {
      bgDark: '#14381d',
      bgMid: '#15803d',
      accent: '#4ade80',
      highlight: '#fef08a',
    },
  },
  ete: {
    id: 'ete',
    nameFr: 'Été',
    almanacTitle: 'Été des Crêtes, Solstices & Mégalithes',
    dateSpanLabel: '21 juin – 21 septembre',
    motto: 'L’ombre des menhirs tourne au zénith, les sentiers de crête s’ouvrent au loin.',
    palette: {
      bgDark: '#451a03',
      bgMid: '#b45309',
      accent: '#f59e0b',
      highlight: '#fef9c3',
    },
  },
  automne: {
    id: 'automne',
    nameFr: 'Automne',
    almanacTitle: 'Automne des Brumes, Friches & Légendes',
    dateSpanLabel: '22 septembre – 20 décembre',
    motto: 'Quand le brouillard enveloppe les vallons, les récits oubliés affleurent.',
    palette: {
      bgDark: '#3b150c',
      bgMid: '#9a3412',
      accent: '#fb923c',
      highlight: '#fde68a',
    },
  },
  hiver: {
    id: 'hiver',
    nameFr: 'Hiver',
    almanacTitle: 'Hiver des Pierres, Cryptes & Longues Veillées',
    dateSpanLabel: '21 décembre – 19 mars',
    motto: 'Les arbres nus dévoilent les remparts, la lanterne guide vers le sous-sol.',
    palette: {
      bgDark: '#0f172a',
      bgMid: '#1e3a8a',
      accent: '#7dd3fc',
      highlight: '#f8fafc',
    },
  },
};

export function resolveSeasonForDate(date = new Date()): SeasonId {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const md = m * 100 + d;
  if (md >= 320 && md <= 620) return 'printemps';
  if (md >= 621 && md <= 921) return 'ete';
  if (md >= 922 && md <= 1220) return 'automne';
  return 'hiver';
}

const MONTHS_SHORT_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export function formatDayMonthFr(month: number, day: number): string {
  const mLabel = MONTHS_SHORT_FR[Math.max(0, Math.min(11, month - 1))];
  return `${day === 1 ? '1er' : day} ${mLabel}`;
}

function dayOfYearNonLeap(month: number, day: number): number {
  const daysBefore = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const mIdx = Math.max(0, Math.min(11, month - 1));
  return daysBefore[mIdx] + Math.max(1, Math.min(31, day));
}

function checkWindowStatus(
  nowMonth: number,
  nowDay: number,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number
): { isActive: boolean; daysUntilStart: number; daysRemaining: number } {
  const cur = dayOfYearNonLeap(nowMonth, nowDay);
  const start = dayOfYearNonLeap(startMonth, startDay);
  const end = dayOfYearNonLeap(endMonth, endDay);

  if (start <= end) {
    if (cur >= start && cur <= end) {
      return { isActive: true, daysUntilStart: 0, daysRemaining: end - cur + 1 };
    }
    const until = cur < start ? start - cur : 365 - cur + start;
    return { isActive: false, daysUntilStart: until, daysRemaining: 0 };
  }

  // Cross-year window (e.g. Dec 28 -> Jan 4)
  if (cur >= start || cur <= end) {
    const rem = cur >= start ? 365 - cur + end + 1 : end - cur + 1;
    return { isActive: true, daysUntilStart: 0, daysRemaining: rem };
  }
  return { isActive: false, daysUntilStart: start - cur, daysRemaining: 0 };
}

// ============================================================================
// 3. QUÊTES DES 4 SAISONS
// ============================================================================

export const SEASONAL_QUESTS_CATALOG: SeasonalQuestDefinition[] = [
  // PRINTEMPS
  {
    id: 'sq_printemps_eaux',
    season: 'printemps',
    kicker: 'Quête de Printemps · Hydrologie',
    title: 'Le Réveil des Fontaines & Ruisseaux',
    description:
      'Découvrez 2 lieux bordés par l’eau vive (rivière, source, fontaine ou lavoir) durant le renouveau printanier.',
    category: 'geographie',
    xpBonus: 160,
    targetCount: 2,
    evaluateProgress: ({ entries }) =>
      Math.min(
        2,
        entries.filter(
          (e) =>
            e.nearWaterway ||
            /fontaine|source|lavoir|moulin|ruisseau|rivière/i.test(`${e.name} ${e.subType}`)
        ).length
      ),
  },
  {
    id: 'sq_printemps_vivant',
    season: 'printemps',
    kicker: 'Quête de Printemps · Biodiversité',
    title: 'Herbier d’Équinoxe & Arbres Vénérables',
    description:
      'Consignez 2 sanctuaires écologiques, parcs, arbres remarquables ou observations naturalistes.',
    category: 'ecosysteme',
    xpBonus: 155,
    targetCount: 2,
    evaluateProgress: ({ entries }) =>
      Math.min(2, entries.filter((e) => e.category === 'ecosysteme').length),
  },

  // ÉTÉ
  {
    id: 'sq_ete_megalithes',
    season: 'ete',
    kicker: 'Quête d’Été · Solstice',
    title: 'Pierres Levées & Cadrans Solaires',
    description:
      'Débloquez 2 sites antiques, préhistoriques, mégalithiques ou repères géodésiques IGN baignés de lumière.',
    category: 'histoire',
    xpBonus: 170,
    targetCount: 2,
    evaluateProgress: ({ entries }) =>
      Math.min(
        2,
        entries.filter((e) =>
          /préhist|mégalith|dolmen|menhir|antiqu|gallo|géodésique|nivellement|cadran/i.test(
            `${e.name} ${e.subType} ${e.eraLabel}`
          )
        ).length
      ),
  },
  {
    id: 'sq_ete_piste',
    season: 'ete',
    kicker: 'Quête d’Été · Grande Marche',
    title: 'Chasseur des Longs Jours',
    description:
      'Menez à terme une Chasse au Trésor par piste d’indices ou résolvez 2 énigmes de terrain.',
    category: 'geographie',
    xpBonus: 185,
    targetCount: 2,
    evaluateProgress: ({ solvedRiddleIds, completedHuntIds }) =>
      Math.min(2, completedHuntIds.size * 2 + solvedRiddleIds.size),
  },

  // AUTOMNE
  {
    id: 'sq_automne_brumes',
    season: 'automne',
    kicker: 'Quête d’Automne · Mémoire & Contes',
    title: 'Veillée des Brumes, Contes & Friches',
    description:
      'Révélez 2 légendes locales, anciens lieux-dits, friches oubliées ou voies fantômes d’automne.',
    category: 'legende',
    xpBonus: 175,
    targetCount: 2,
    evaluateProgress: ({ entries }) =>
      Math.min(
        2,
        entries.filter((e) => e.category === 'legende' || e.category === 'etrange').length
      ),
  },
  {
    id: 'sq_automne_erudit',
    season: 'automne',
    kicker: 'Quête d’Automne · Sceaux d’Or',
    title: 'Glaneur d’Énigmes d’Automne',
    description:
      'Résolvez 2 énigmes contextuelles sur des lieux découverts pour apposer votre Sceau d’Or d’Érudit.',
    category: 'histoire',
    xpBonus: 165,
    targetCount: 2,
    evaluateProgress: ({ solvedRiddleIds }) => Math.min(2, solvedRiddleIds.size),
  },

  // HIVER
  {
    id: 'sq_hiver_souterrains',
    season: 'hiver',
    kicker: 'Quête d’Hiver · Profondeurs',
    title: 'À l’Abri des Voûtes & Souterrains',
    description:
      'Explorez 2 cryptes, cavités naturelles, carrières souterraines ou édifices patrimoniaux majeurs.',
    category: 'etrange',
    xpBonus: 180,
    targetCount: 2,
    evaluateProgress: ({ entries }) =>
      Math.min(
        2,
        entries.filter(
          (e) =>
            e.category === 'etrange' ||
            /crypte|cavité|grotte|souterrain|église|abbaye|château/i.test(
              `${e.name} ${e.subType}`
            )
        ).length
      ),
  },
  {
    id: 'sq_hiver_lanterne',
    season: 'hiver',
    kicker: 'Quête d’Hiver · Petit Patrimoine',
    title: 'Ronde des Fours, Puits & Pierres de Bourg',
    description:
      'Découvrez 2 témoins d’histoire locale et complétez une énigme ou une piste au cœur de l’hiver.',
    category: 'histoire',
    xpBonus: 170,
    targetCount: 2,
    evaluateProgress: ({ entries, solvedRiddleIds }) =>
      Math.min(
        2,
        Math.min(1, entries.filter((e) => e.category === 'histoire').length) +
          Math.min(1, solvedRiddleIds.size)
      ),
  },
];

// ============================================================================
// 4. CALENDRIER GLOBAL & RÉGIONAL DES FÊTES, JOURNÉES THÉMATIQUES & SOLSTICES
// ============================================================================

export const CALENDAR_EVENTS_CATALOG: CalendarEventDefinition[] = [
  // --- GLOBAL / NATIONAL CULTURAL & SCIENTIFIC CALENDAR ---
  {
    id: 'cal_zones_humides',
    scope: 'global',
    kicker: 'Journée Thématique Mondiale',
    title: 'Journée Mondiale des Zones Humides',
    subtitle: 'Marais, étangs, tourbières & rivières vivantes',
    description:
      'Chaque début février célèbre la convention de Ramsar et les milieux aquatiques qui filtrent nos eaux et abritent oiseaux et amphibiens.',
    category: 'ecosysteme',
    xpBonus: 150,
    startMonth: 1,
    startDay: 30,
    endMonth: 2,
    endDay: 5,
    questTitle: 'Sentinelle des Eaux & Marais',
    questGoalDescription: 'Découvrez un lieu proche d’un cours d’eau ou d’une zone écologique.',
    targetCount: 1,
    evaluateProgress: ({ entries }) =>
      Math.min(
        1,
        entries.filter((e) => e.nearWaterway || e.category === 'ecosysteme').length
      ),
  },
  {
    id: 'cal_equinoxe_printemps',
    scope: 'global',
    kicker: 'Éphéméride Astronomique',
    title: 'Équinoxe de Printemps & Journée de l’Eau',
    subtitle: 'Équilibre du jour et de la nuit · Réveil des sources',
    description:
      'Autour du 20–22 mars, la durée du jour égale celle de la nuit, suivie immédiatement par la Journée Mondiale de l’Eau.',
    category: 'geographie',
    xpBonus: 165,
    startMonth: 3,
    startDay: 19,
    endMonth: 3,
    endDay: 24,
    questTitle: 'Pèlerin des Sources d’Équinoxe',
    questGoalDescription: 'Révélez une fontaine, un moulin, une source ou un point riverain.',
    targetCount: 1,
    evaluateProgress: ({ entries }) =>
      Math.min(
        1,
        entries.filter(
          (e) => e.nearWaterway || /fontaine|source|moulin|lavoir|puits/i.test(`${e.name} ${e.subType}`)
        ).length
      ),
  },
  {
    id: 'cal_jour_terre',
    scope: 'global',
    kicker: 'Journée Mondiale',
    title: 'Journée Mondiale de la Terre & Géodiversité',
    subtitle: 'Roches-mères, sols vivants et forêts anciennes',
    description:
      'Rendez hommage aux 500 millions d’années d’histoire géologique et écologique inscrites sous nos pas.',
    category: 'geographie',
    xpBonus: 160,
    startMonth: 4,
    startDay: 20,
    endMonth: 4,
    endDay: 25,
    questTitle: 'Lecture de la Terre Vivante',
    questGoalDescription: 'Débloquez un site géologique ou écologique et résolvez 1 énigme de terrain.',
    targetCount: 2,
    evaluateProgress: ({ entries, solvedRiddleIds }) =>
      Math.min(
        1,
        entries.filter((e) => e.category === 'geographie' || e.category === 'ecosysteme').length
      ) + Math.min(1, solvedRiddleIds.size),
  },
  {
    id: 'cal_nuit_musees_geologie',
    scope: 'global',
    kicker: 'Rendez-vous Culturel & Scientifique',
    title: 'Nuit des Musées & Journées de la Géologie',
    subtitle: 'Trésors classés, collections et affleurements rocheux',
    description:
      'La mi-mai réunit la Nuit Européenne des Musées et les sorties de terrain de la Société Géologique de France.',
    category: 'histoire',
    xpBonus: 175,
    startMonth: 5,
    startDay: 13,
    endMonth: 5,
    endDay: 25,
    questTitle: 'Veilleur des Collections & Affleurements',
    questGoalDescription: 'Découvrez 2 lieux d’Histoire ou de Géologie sur le terrain.',
    targetCount: 2,
    evaluateProgress: ({ entries }) =>
      Math.min(
        2,
        entries.filter((e) => e.category === 'histoire' || e.category === 'geographie').length
      ),
  },
  {
    id: 'cal_jea_archeologie',
    scope: 'global',
    kicker: 'Fête Nationale & Européenne',
    title: 'Journées Européennes de l’Archéologie (JEA)',
    subtitle: 'Chantiers INRAP, substructions antiques & strates enfouies',
    description:
      'Chaque mois de juin, archéologues et chercheurs ouvrent les portes du temps profond et des fouilles préventives.',
    category: 'histoire',
    xpBonus: 190,
    startMonth: 6,
    startDay: 12,
    endMonth: 6,
    endDay: 19,
    questTitle: 'Sondeur des Strates Anciennes',
    questGoalDescription: 'Révélez un site archéologique, antique, médiéval ou préhistorique.',
    targetCount: 1,
    evaluateProgress: ({ entries }) =>
      Math.min(
        1,
        entries.filter((e) =>
          /archéo|inrap|antiqu|gallo|préhist|médiéval|moyen âge/i.test(
            `${e.name} ${e.subType} ${e.eraLabel} ${e.source}`
          )
        ).length
      ),
  },
  {
    id: 'cal_solstice_ete',
    scope: 'global',
    kicker: 'Solstice & Fête Populaire',
    title: 'Solstice d’Été, Feux de la Saint-Jean & Musique',
    subtitle: 'Le plus long jour de l’année sur les places et collines',
    description:
      'Du 20 au 24 juin, la lumière culmine : places historiques, kiosques et feux des sommets s’animent jusqu’au crépuscule.',
    category: 'legende',
    xpBonus: 180,
    startMonth: 6,
    startDay: 20,
    endMonth: 6,
    endDay: 25,
    questTitle: 'Marcheur du Zénith Solaire',
    questGoalDescription: 'Découvrez 2 points d’intérêt ou terminez une piste au trésor.',
    targetCount: 2,
    evaluateProgress: ({ entries, completedHuntIds }) =>
      Math.min(2, completedHuntIds.size * 2 + Math.min(2, entries.length)),
  },
  {
    id: 'cal_nuits_etoiles',
    scope: 'global',
    kicker: 'Événement Astronomique',
    title: 'Les Nuits des Étoiles & Perséides',
    subtitle: 'Ciels d’août, promontoires dégagés & orientation céleste',
    description:
      'Sous la pluie d’étoiles filantes des Perséides, les sommets et clairières loin des halos urbains offrent une lecture pure de la voûte céleste.',
    category: 'geographie',
    xpBonus: 175,
    startMonth: 8,
    startDay: 5,
    endMonth: 8,
    endDay: 15,
    questTitle: 'Astrolabe des Promontoires',
    questGoalDescription: 'Résolvez une énigme de terrain ou explorez un point de vue / repère IGN.',
    targetCount: 1,
    evaluateProgress: ({ entries, solvedRiddleIds }) =>
      Math.min(
        1,
        solvedRiddleIds.size +
          entries.filter((e) => /géodésique|belvédère|panorama|tour|colline/i.test(`${e.name} ${e.subType}`)).length
      ),
  },
  {
    id: 'cal_nuit_chauve_souris',
    scope: 'global',
    kicker: 'Rendez-vous Biodiversité & Cavités',
    title: 'Nuit Internationale de la Chauve-Souris',
    subtitle: 'Grottes, ponts de pierre, combles & écholocalisation',
    description:
      'Fin août met à l’honneur les chiroptères qui veillent dans nos cavités karstiques, carrières souterraines et vieux ponts.',
    category: 'etrange',
    xpBonus: 170,
    startMonth: 8,
    startDay: 24,
    endMonth: 8,
    endDay: 31,
    questTitle: 'Écouteur des Voûtes Nocturnes',
    questGoalDescription: 'Découvrez une cavité souterraine, un pont ancien ou un refuge écologique.',
    targetCount: 1,
    evaluateProgress: ({ entries }) =>
      Math.min(
        1,
        entries.filter((e) => e.category === 'etrange' || e.category === 'ecosysteme').length
      ),
  },
  {
    id: 'cal_jep_patrimoine',
    scope: 'global',
    kicker: 'Grand Rendez-vous Européen',
    title: 'Journées Européennes du Patrimoine (JEP)',
    subtitle: 'Monuments Mérimée, cours secrètes, moulins & archives ouvertes',
    description:
      'Le grand rendez-vous de septembre où châteaux, édifices civils, ouvrages d’art et petits patrimoines dévoilent leurs coulisses.',
    category: 'histoire',
    xpBonus: 210,
    startMonth: 9,
    startDay: 16,
    endMonth: 9,
    endDay: 23,
    questTitle: 'Grand Conservateur du Patrimoine',
    questGoalDescription: 'Révélez 2 monuments ou lieux d’Histoire et obtenez 1 Sceau d’Or d’énigme.',
    targetCount: 3,
    evaluateProgress: ({ entries, solvedRiddleIds }) =>
      Math.min(2, entries.filter((e) => e.category === 'histoire').length) +
      Math.min(1, solvedRiddleIds.size),
  },
  {
    id: 'cal_fete_science',
    scope: 'global',
    kicker: 'Fête Nationale Scientifique',
    title: 'Fête de la Science & Journées de l’Architecture',
    subtitle: 'Géologie, hydrologie, biodiversité et génie des bâtisseurs',
    description:
      'Octobre célèbre la curiosité scientifique sur le terrain : comprendre les roches, le cycle de l’eau et la structure des édifices.',
    category: 'geographie',
    xpBonus: 180,
    startMonth: 10,
    startDay: 3,
    endMonth: 10,
    endDay: 19,
    questTitle: 'Esprit d’Observation Scientifique',
    questGoalDescription: 'Résolvez 2 énigmes contextuelles sur le terrain.',
    targetCount: 2,
    evaluateProgress: ({ solvedRiddleIds }) => Math.min(2, solvedRiddleIds.size),
  },
  {
    id: 'cal_veillee_brumes_toussaint',
    scope: 'global',
    kicker: 'Tradition Calendaire d’Automne',
    title: 'Veillée des Brumes, Mémoires & Légendes Anciennes',
    subtitle: '30 oct. – 5 nov. · Contes populaires, pierres du souvenir & cités englouties',
    description:
      'Au tournant de novembre (ancienne Samhain celtique et temps de la Toussaint), les brumes d’automne réveillent la mémoire des ancêtres, les fontaines sacrées, les cryptes et le folklore des campagnes.',
    category: 'legende',
    xpBonus: 200,
    startMonth: 10,
    startDay: 29,
    endMonth: 11,
    endDay: 6,
    questTitle: 'Passeur des Brumes de Novembre',
    questGoalDescription:
      'Découvrez 2 lieux (Légendes, Souterrains ou Histoire) ou complétez une Chasse au Trésor.',
    targetCount: 2,
    evaluateProgress: ({ entries, completedHuntIds }) =>
      Math.min(
        2,
        completedHuntIds.size * 2 +
          entries.filter(
            (e) =>
              e.category === 'legende' ||
              e.category === 'etrange' ||
              e.category === 'histoire'
          ).length
      ),
  },
  {
    id: 'cal_sainte_barbe_mineurs',
    scope: 'global',
    kicker: 'Fête Corporative & Souterraine',
    title: 'La Sainte-Barbe — Fête des Mineurs, Carriers & Sapeurs',
    subtitle: '4 décembre · Galeries souterraines, carrières de pierre et filons BRGM',
    description:
      'Célébrée le 4 décembre dans tous les bassins miniers et cités de carriers, Sainte-Barbe protège ceux qui œuvrent sous la voûte rocheuse.',
    category: 'etrange',
    xpBonus: 195,
    startMonth: 12,
    startDay: 1,
    endMonth: 12,
    endDay: 8,
    questTitle: 'Lanterne de Sainte-Barbe',
    questGoalDescription: 'Basculez en Sous-sol et révélez une cavité, carrière, mine ou crypte.',
    targetCount: 1,
    evaluateProgress: ({ entries }) =>
      Math.min(1, entries.filter((e) => e.category === 'etrange').length),
  },
  {
    id: 'cal_solstice_hiver',
    scope: 'global',
    kicker: 'Solstice Astronomique',
    title: 'Solstice d’Hiver & Renaissance de la Lumière',
    subtitle: '21 décembre · La plus longue nuit et l’alignement des sanctuaires anciens',
    description:
      'De nombreux dolmens, allées couvertes et églises romanes furent orientés sur le lever solaire du solstice d’hiver.',
    category: 'legende',
    xpBonus: 190,
    startMonth: 12,
    startDay: 19,
    endMonth: 12,
    endDay: 26,
    questTitle: 'Porteur de Clarté au Solstice',
    questGoalDescription: 'Découvrez un lieu patrimonial et résolvez son énigme d’observation.',
    targetCount: 2,
    evaluateProgress: ({ entries, solvedRiddleIds }) =>
      Math.min(1, entries.length) + Math.min(1, solvedRiddleIds.size),
  },

  // --- REGIONAL / TERROIR CALENDAR TRADITIONS ---
  {
    id: 'reg_armorique_samaïn_pardons',
    scope: 'regional',
    regionalStyles: ['armorique_granit'],
    kicker: 'Tradition Locale · Terres d’Armorique',
    title: 'Veillées Celtes de Kalan Goañv & Pardons de Granit',
    subtitle: 'Landes, fontaines sacrées, calvaires et contes de Basse & Haute-Bretagne',
    description:
      'En terre granitique et armoricaine, l’entrée dans la moitié sombre de l’année et le cycle des fontaines à dévotion imprègnent chaque chapelle et mégalithe.',
    category: 'legende',
    xpBonus: 175,
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    questTitle: 'Chroniqueur des Fontaines & Calvaires d’Armorique',
    questGoalDescription: 'Révélez un mégalithe, calvaire, fontaine ou légende du terroir.',
    targetCount: 1,
    evaluateProgress: ({ entries }) =>
      Math.min(
        1,
        entries.filter(
          (e) =>
            e.category === 'legende' ||
            /calvaire|fontaine|menhir|dolmen|chapelle/i.test(`${e.name} ${e.subType}`)
        ).length
      ),
  },
  {
    id: 'reg_alsace_vendanges_avent',
    scope: 'regional',
    regionalStyles: ['alsace_colombage'],
    kicker: 'Tradition Locale · Alsace & Vosges',
    title: 'Cycle des Coteaux, Grès Rose & Veillées Rhénanes',
    subtitle: 'Maisons à pans de bois, puits Renaissance, châteaux forts des crêtes',
    description:
      'Entre les vendanges d’automne, la Saint-Martin, les lumières de l’Avent et le retour des cigognes au printemps, les bourgs à colombages vivent au rythme des saisons.',
    category: 'histoire',
    xpBonus: 175,
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    questTitle: 'Arpenteur des Bourgs & Crêtes de Grès Rose',
    questGoalDescription: 'Découvrez un monument ou puits ancien et résolvez 1 énigme locale.',
    targetCount: 2,
    evaluateProgress: ({ entries, solvedRiddleIds }) =>
      Math.min(1, entries.length) + Math.min(1, solvedRiddleIds.size),
  },
  {
    id: 'reg_flandres_beffrois_boves',
    scope: 'regional',
    regionalStyles: ['flandres_brique'],
    kicker: 'Tradition Locale · Flandres, Artois & Nord',
    title: 'Ronde des Beffrois, Géants & Carrières de Craie',
    subtitle: 'Places pavées, pignons à pas de moineaux, boves souterraines et mémoire minière',
    description:
      'Des cortèges de Géants classés à l’UNESCO aux galeries crayeuses creusées sous les grand-places, le Nord conjugue fête civique et monde souterrain.',
    category: 'etrange',
    xpBonus: 175,
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    questTitle: 'Guetteur des Beffrois & des Boves',
    questGoalDescription: 'Découvrez un édifice historique ou une galerie du sous-sol.',
    targetCount: 1,
    evaluateProgress: ({ entries }) =>
      Math.min(
        1,
        entries.filter((e) => e.category === 'histoire' || e.category === 'etrange').length
      ),
  },
  {
    id: 'reg_midi_olivades_transhumance',
    scope: 'regional',
    regionalStyles: ['midi_ocre'],
    kicker: 'Tradition Locale · Midi, Provence & Occitanie',
    title: 'Almanach des Olivades, Drailles & Fontaines d’Ocre',
    subtitle: 'Tuiles canal, restanques en pierre sèche, aqueducs antiques et lavoirs ombragés',
    description:
      'Du départ des troupeaux sur les drailles de printemps à la récolte des olives d’automne, l’eau et l’ombre structurent la vie des villages méridionaux.',
    category: 'geographie',
    xpBonus: 175,
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    questTitle: 'Sourcier des Pierres Sèches & Fontaines',
    questGoalDescription: 'Découvrez un ouvrage hydraulique, antique ou géologique du Midi.',
    targetCount: 1,
    evaluateProgress: ({ entries }) =>
      Math.min(
        1,
        entries.filter((e) => e.nearWaterway || e.category === 'geographie' || e.category === 'histoire').length
      ),
  },
  {
    id: 'reg_alpin_inalpe_cristalliers',
    scope: 'regional',
    regionalStyles: ['alpin_montagne'],
    kicker: 'Tradition Locale · Alpes & Hautes Vallées',
    title: 'Saison des Alpages, Désalpe & Quête des Cristalliers',
    subtitle: 'Chalets de mélèze, torrents glaciaires, cols et fours de hameaux',
    description:
      'Entre l’inalpe d’été et la redescente fleurie des troupeaux à l’automne, les hameaux d’altitude perpétuent fours banaux, chapelles des neiges et savoir des cristalliers.',
    category: 'geographie',
    xpBonus: 180,
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    questTitle: 'Guide des Hameaux & Torrents d’Altitude',
    questGoalDescription: 'Découvrez un repère d’altitude, géologique ou patrimonial.',
    targetCount: 1,
    evaluateProgress: ({ entries }) => Math.min(1, entries.length),
  },
  {
    id: 'reg_volcan_estives_sources',
    scope: 'regional',
    regionalStyles: ['auvergne_volcan'],
    kicker: 'Tradition Locale · Terres Volcaniques & Estives',
    title: 'Cycle des Estives, Burons & Sources Thermales',
    subtitle: 'Orgues basaltiques, pierre sombre, lacs de cratère et fontaines minérales',
    description:
      'De la montée aux estives fin mai aux foires d’automne, le socle volcanique fait jaillir sources chaudes et eaux ferrugineuses.',
    category: 'geographie',
    xpBonus: 180,
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    questTitle: 'Veilleur des Puys & Sources Minérales',
    questGoalDescription: 'Découvrez une curiosité volcanique, hydrologique ou rurale.',
    targetCount: 1,
    evaluateProgress: ({ entries }) => Math.min(1, entries.length),
  },
  {
    id: 'reg_bassin_calcaire_carrieres_vignes',
    scope: 'regional',
    regionalStyles: ['bassin_calcaire'],
    kicker: 'Tradition Locale · Bassins de Pierre Blonde & Fleuves',
    title: 'Chronique des Tailleurs de Pierre, Coteaux & Passages Couverts',
    subtitle: 'Calcaire lutétien ou tuffeau, gués fluviaux, caves voûtées et clos anciens',
    description:
      'Sous les villes et villages de pierre blonde courent d’anciennes carrières, caves de vignerons et rivières busées qui ont bâti cathédrales et ponts.',
    category: 'histoire',
    xpBonus: 175,
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    questTitle: 'Compagnon de la Pierre Blonde',
    questGoalDescription: 'Découvrez un monument en pierre ou une galerie souterraine.',
    targetCount: 1,
    evaluateProgress: ({ entries }) => Math.min(1, entries.length),
  },
];

export function resolveCalendarEventsForNow(
  regionalStyle: RegionalStyleId,
  date = new Date()
): {
  activeGlobalEvents: ActiveCalendarEvent[];
  upcomingGlobalEvents: ActiveCalendarEvent[];
  regionalTradition: ActiveCalendarEvent | null;
} {
  const m = date.getMonth() + 1;
  const d = date.getDate();

  const activeGlobalEvents: ActiveCalendarEvent[] = [];
  const upcomingGlobalEvents: ActiveCalendarEvent[] = [];
  let regionalTradition: ActiveCalendarEvent | null = null;

  for (const ev of CALENDAR_EVENTS_CATALOG) {
    const win = checkWindowStatus(m, d, ev.startMonth, ev.startDay, ev.endMonth, ev.endDay);
    const dateRangeLabel =
      ev.startMonth === 1 && ev.endMonth === 12
        ? 'Tradition vivante du terroir'
        : `${formatDayMonthFr(ev.startMonth, ev.startDay)} – ${formatDayMonthFr(ev.endMonth, ev.endDay)}`;

    if (ev.scope === 'regional') {
      if (ev.regionalStyles?.includes(regionalStyle) && !regionalTradition) {
        regionalTradition = {
          event: ev,
          status: 'active',
          daysUntilStart: 0,
          daysRemaining: win.daysRemaining,
          dateRangeLabel,
        };
      }
      continue;
    }

    if (win.isActive) {
      activeGlobalEvents.push({
        event: ev,
        status: 'active',
        daysUntilStart: 0,
        daysRemaining: win.daysRemaining,
        dateRangeLabel,
      });
    } else {
      upcomingGlobalEvents.push({
        event: ev,
        status: 'upcoming',
        daysUntilStart: win.daysUntilStart,
        daysRemaining: 0,
        dateRangeLabel,
      });
    }
  }

  upcomingGlobalEvents.sort((a, b) => a.daysUntilStart - b.daysUntilStart);
  return {
    activeGlobalEvents,
    upcomingGlobalEvents: upcomingGlobalEvents.slice(0, 3),
    regionalTradition,
  };
}

// ============================================================================
// 5. ÉNIGMES CONTEXTUELLES DE TERRAIN (« L'ÉPREUVE DU SCEAU D'OR »)
// ============================================================================

export interface ContextualRiddle {
  riddleId: string;
  poiId: string;
  poiName: string;
  category: ExplorationCategory;
  themeLabel: string;
  question: string;
  fieldObservationHint: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  xpBonus: number;
}

const SOLVED_RIDDLES_KEY = 'terra16_solved_riddles_v1';
const CLAIMED_ALMANAC_QUESTS_KEY = 'terra16_claimed_almanac_quests_v1';

export function loadSolvedRiddleIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SOLVED_RIDDLES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function saveSolvedRiddleIds(set: Set<string>): void {
  try {
    localStorage.setItem(SOLVED_RIDDLES_KEY, JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    // Ignore storage quota
  }
}

export function loadClaimedAlmanacQuestIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CLAIMED_ALMANAC_QUESTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function saveClaimedAlmanacQuestIds(set: Set<string>): void {
  try {
    localStorage.setItem(CLAIMED_ALMANAC_QUESTS_KEY, JSON.stringify(Array.from(set).slice(-300)));
  } catch {
    // Ignore storage quota
  }
}

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function deterministicShuffleWithAnswer(
  correct: string,
  distractors: string[],
  seed: number
): { options: string[]; correctIndex: number } {
  const uniqueDistractors = distractors.filter(
    (d, idx) => d.trim().length > 0 && d !== correct && distractors.indexOf(d) === idx
  );
  const pool = [correct, ...uniqueDistractors.slice(0, 2)];
  while (pool.length < 3) {
    pool.push(pool.length === 1 ? 'Aucune correspondance documentée' : 'Origine contemporaine indéterminée');
  }
  // Deterministic permutation of 3 items
  const perms = [
    [0, 1, 2],
    [1, 0, 2],
    [1, 2, 0],
    [0, 2, 1],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const perm = perms[seed % perms.length];
  const options = perm.map((idx) => pool[idx]);
  const correctIndex = options.indexOf(correct);
  return { options, correctIndex: Math.max(0, correctIndex) };
}

function inferStratumFromEntry(entry: UnlockedEntry, sectorPoi?: PoiItem | null): HistoricalStratum {
  if (sectorPoi) return sectorPoi.stratum;
  const txt = `${entry.eraLabel} ${entry.subType} ${entry.name}`.toLowerCase();
  if (/ma\b|géolog|jurass|crétac|lutétien|oligocène|paléozo|trias|fossile|substrat/.test(txt)) {
    return 'temps_profond';
  }
  if (/préhist|néolith|paléolith|dolmen|menhir|mégalith/.test(txt)) return 'prehistoire';
  if (/antiqu|gallo|romain|lutèce/.test(txt)) return 'antiquite';
  if (/moyen âge|médiéval|roman|gothique|xie|xiie|xiiie|xive|xve/.test(txt)) return 'moyen_age';
  if (/moderne|xvie|xviie|xviiie|renaissance|classique/.test(txt)) return 'moderne';
  if (entry.category === 'ecosysteme' || entry.category === 'legende') return 'vivant_folklore';
  return 'contemporain';
}

export function generateContextualRiddleForEntry(params: {
  entry: UnlockedEntry;
  sectorPoi?: PoiItem | null;
  bedrock?: BedrockInfo | null;
  elevation?: ElevationGrid | null;
}): ContextualRiddle {
  const { entry, sectorPoi, bedrock, elevation } = params;
  const seed = stableHash(`riddle_${entry.poiId}`);
  const stratum = inferStratumFromEntry(entry, sectorPoi);
  const alt = sampleElevationMeters(elevation, entry.lat, entry.lng);

  // Choose the richest real-world angle available for this POI
  const hasNamedWater = Boolean(entry.nearWaterway && entry.waterwayName.trim().length >= 3);
  const hasBedrock = Boolean(bedrock && bedrock.lithology && bedrock.period);
  const hasHistoricalEra =
    stratum !== 'contemporain' && stratum !== 'vivant_folklore';

  // Angle 1: Named Hydrological Link
  if (hasNamedWater && seed % 3 === 0) {
    const wName = entry.waterwayName.trim();
    const distractors = [
      'Un ancien cratère volcanique asséché sans écoulement',
      'Une crête aride éloignée de tout réseau hydrographique',
    ];
    const correct = `La proximité hydrographique avec « ${wName} »`;
    const { options, correctIndex } = deterministicShuffleWithAnswer(correct, distractors, seed);
    return {
      riddleId: `rid_${entry.poiId}`,
      poiId: entry.poiId,
      poiName: entry.name,
      category: entry.category,
      themeLabel: 'Lecture Hydrographique du Site',
      question: `Quel lien géographique structure l’implantation de « ${entry.name} » dans ce secteur ?`,
      fieldObservationHint:
        'Observez la pente du terrain autour de vous, l’humidité de la végétation ou le tracé bleu sur la carte 16-bit.',
      options,
      correctIndex,
      explanation: `Ce site (${entry.subType.toLowerCase()}) s’inscrit directement dans le couloir hydrographique lié à « ${wName} », ressource vitale pour les usages anciens, la fraîcheur et la biodiversité.`,
      xpBonus: 30,
    };
  }

  // Angle 2: Geological Bedrock & Building Stone / Subsoil
  if (hasBedrock && (entry.category === 'geographie' || entry.category === 'etrange' || seed % 3 === 1)) {
    const litho = bedrock!.lithology;
    const period = bedrock!.period;
    const correct = `${litho} (${period})`;
    const isCalcaire = /calcaire|craie|marne/i.test(litho);
    const isGranit = /granit|gneiss|schist/i.test(litho);
    const distractors = isCalcaire
      ? [
          'Coulées basaltiques récentes du Quaternaire volcanique',
          'Socle plutonique de granit rose précambrien',
        ]
      : isGranit
      ? [
          'Craie blanche marine tendre du Bassin tertiaire',
          'Évaporites salifères désertiques récentes',
        ]
      : [
          'Récif corallien lagunaire subactuel non consolidé',
          'Calotte d’obsidienne vitreuse superficielle',
        ];
    const { options, correctIndex } = deterministicShuffleWithAnswer(correct, distractors, seed);
    return {
      riddleId: `rid_${entry.poiId}`,
      poiId: entry.poiId,
      poiName: entry.name,
      category: entry.category,
      themeLabel: 'Socle Géologique & Pierre du Terroir',
      question: `Sur quelle assise géologique réelle repose « ${entry.name} » (${
        alt !== null ? `Alt. ~${Math.round(alt)} m` : 'dans ce secteur'
      }) ?`,
      fieldObservationHint: `Regardez les soubassements de pierre des vieux murs voisins ou la coupe géologique de votre bandeau (${bedrock!.ageRangeMa}).`,
      options,
      correctIndex,
      explanation: `Sous vos pas s’étend un substrat de ${litho.toLowerCase()} formé à l’époque « ${period} » (${bedrock!.ageRangeMa}), qui a façonné le relief local et fourni les matériaux traditionnels du pays.`,
      xpBonus: 30,
    };
  }

  // Angle 3: Stratigraphic & Historical Era Deduction
  if (hasHistoricalEra) {
    const stratumMeta = STRATUM_META[stratum];
    const correct = `${stratumMeta.label} (${stratumMeta.eraSpan})`;
    const otherStrata: HistoricalStratum[] = (
      [
        'temps_profond',
        'prehistoire',
        'antiquite',
        'moyen_age',
        'moderne',
        'contemporain',
      ] as HistoricalStratum[]
    ).filter((s) => s !== stratum);
    const d1 = STRATUM_META[otherStrata[seed % otherStrata.length]];
    const d2 = STRATUM_META[otherStrata[(seed + 2) % otherStrata.length]];
    const { options, correctIndex } = deterministicShuffleWithAnswer(
      correct,
      [`${d1.label} (${d1.eraSpan})`, `${d2.label} (${d2.eraSpan})`],
      seed
    );
    return {
      riddleId: `rid_${entry.poiId}`,
      poiId: entry.poiId,
      poiName: entry.name,
      category: entry.category,
      themeLabel: 'Datation & Strate Temporelle',
      question: `À quelle grande strate du temps appartient principalement « ${entry.name} » (${entry.subType}) ?`,
      fieldObservationHint: `Indice d’archive : ce témoignage est rattaché à « ${
        entry.eraLabel || stratumMeta.short
      } » (source : ${entry.source}).`,
      options,
      correctIndex,
      explanation: `« ${entry.name} » s’inscrit dans la strate « ${stratumMeta.label} » (${
        entry.eraLabel || stratumMeta.eraSpan
      }), recensée via ${entry.source}.`,
      xpBonus: 25,
    };
  }

  // Angle 4: Guild Function & Patrimonial Nature (Universal fallback for contemporary, folklore, ecology)
  const catMeta = CATEGORY_META[entry.category];
  const correct = `${entry.subType} (${catMeta.shortLabel})`;
  const fallbackDistractorsByCat: Record<ExplorationCategory, [string, string]> = {
    histoire: [
      'Station piézométrique souterraine fermée (Souterrains)',
      'Gisement fossile marin du Paléozoïque (Géologie)',
    ],
    geographie: [
      'Lieu de tournage cinématographique contemporain (Histoire)',
      ' Conte oral de géant bâtisseur sans repère physique (Légendes)',
    ],
    legende: [
      'Poste de transformation électrique industriel (Souterrains)',
      'Borne routière kilométrique standardisée moderne (Géologie)',
    ],
    etrange: [
      'Jardin botanique d’acclimatation florale (Écosystème)',
      'Cadran solaire méridien de façade baroque (Histoire)',
    ],
    ecosysteme: [
      'Fosse d’extraction houillère désaffectée (Souterrains)',
      ' Enceinte bastionnée militaire du XVIIe siècle (Histoire)',
    ],
  };
  const [distA, distB] = fallbackDistractorsByCat[entry.category];
  const { options, correctIndex } = deterministicShuffleWithAnswer(
    correct,
    [distA.trim(), distB.trim()],
    seed
  );

  return {
    riddleId: `rid_${entry.poiId}`,
    poiId: entry.poiId,
    poiName: entry.name,
    category: entry.category,
    themeLabel: 'Identification Patrimoniale sur Place',
    question: `Quelle est la nature exacte de ce signal consigné dans votre Grimoire (« ${entry.name} ») ?`,
    fieldObservationHint: `Observez les lieux et relisez le feuillet issu de l’archive « ${entry.source} ».`,
    options,
    correctIndex,
    explanation: `Ce point remarquable est répertorié comme « ${entry.subType} » au sein de la Guilde ${catMeta.label} (${entry.source}).`,
    xpBonus: 25,
  };
}

// ============================================================================
// 6. CHASSES AUX TRÉSORS PAR PISTE D'INDICES (« PARCHEMINS DE PISTE »)
// ============================================================================

export interface ClueHuntStep {
  stepIndex: number;
  poiId: string;
  trueName: string;
  mysteryTitle: string;
  category: ExplorationCategory;
  lat: number;
  lng: number;
  isSubterranean: boolean;
  reachRadiusMeters: number;
  poeticClue: string;
  terrainClue: string;
}

export interface ClueTreasureHunt {
  huntId: string;
  sectorKey: string;
  title: string;
  subtitle: string;
  xpReward: number;
  relicTitle: string;
  steps: ClueHuntStep[];
}

export type HotColdLevel = 'glacial' | 'froid' | 'tiede' | 'chaud' | 'brulant' | 'sur_place';

export interface HotColdReading {
  level: HotColdLevel;
  labelFr: string;
  compassFr: string;
  approxBandFr: string;
  distanceMeters: number;
  heatPct: number;
}

const COMPLETED_HUNTS_KEY = 'terra16_completed_clue_hunts_v1';
const ACTIVE_HUNT_PROGRESS_KEY = 'terra16_active_clue_hunt_progress_v1';

export function loadCompletedHuntIds(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPLETED_HUNTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function saveCompletedHuntIds(set: Set<string>): void {
  try {
    localStorage.setItem(COMPLETED_HUNTS_KEY, JSON.stringify(Array.from(set).slice(-200)));
  } catch {
    // Ignore storage quota
  }
}

export function loadHuntVisitedStepMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(ACTIVE_HUNT_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveHuntVisitedStepMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(ACTIVE_HUNT_PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota
  }
}

export function compassDirectionFullFr(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const dLat = toLat - fromLat;
  const cosLat = Math.max(0.2, Math.cos((fromLat * Math.PI) / 180));
  const dLng = (toLng - fromLng) * cosLat;
  const deg = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
  const dirs = [
    'Nord',
    'Nord-Est',
    'Est',
    'Sud-Est',
    'Sud',
    'Sud-Ouest',
    'Ouest',
    'Nord-Ouest',
  ];
  return dirs[Math.round(deg / 45) % 8];
}

export function computeHotColdReading(
  playerLat: number,
  playerLng: number,
  targetLat: number,
  targetLng: number,
  reachRadius = 56
): HotColdReading {
  const dist = Math.round(haversineMeters(playerLat, playerLng, targetLat, targetLng));
  const compassFr = compassDirectionFullFr(playerLat, playerLng, targetLat, targetLng);

  let approxBandFr = 'à plus de 600 m';
  if (dist <= reachRadius) approxBandFr = 'juste devant vous !';
  else if (dist <= 110) approxBandFr = 'à moins de 110 m';
  else if (dist <= 220) approxBandFr = `à environ ${Math.round(dist / 25) * 25} m`;
  else if (dist <= 450) approxBandFr = `à environ ${Math.round(dist / 50) * 50} m`;
  else if (dist <= 900) approxBandFr = `à environ ${Math.round(dist / 100) * 100} m`;
  else approxBandFr = `à ~${(dist / 1000).toFixed(1)} km`;

  if (dist <= reachRadius) {
    return {
      level: 'sur_place',
      labelFr: 'Sur la cache !',
      compassFr,
      approxBandFr,
      distanceMeters: dist,
      heatPct: 100,
    };
  }
  if (dist <= 115) {
    return {
      level: 'brulant',
      labelFr: 'Brûlant !',
      compassFr,
      approxBandFr,
      distanceMeters: dist,
      heatPct: 88,
    };
  }
  if (dist <= 240) {
    return {
      level: 'chaud',
      labelFr: 'Chaud',
      compassFr,
      approxBandFr,
      distanceMeters: dist,
      heatPct: 68,
    };
  }
  if (dist <= 440) {
    return {
      level: 'tiede',
      labelFr: 'Tiède',
      compassFr,
      approxBandFr,
      distanceMeters: dist,
      heatPct: 44,
    };
  }
  if (dist <= 750) {
    return {
      level: 'froid',
      labelFr: 'Froid',
      compassFr,
      approxBandFr,
      distanceMeters: dist,
      heatPct: 24,
    };
  }
  return {
    level: 'glacial',
    labelFr: 'Glacial',
    compassFr,
    approxBandFr,
    distanceMeters: dist,
    heatPct: 10,
  };
}

function buildPoeticClueForPoi(
  poi: PoiItem,
  elevation?: ElevationGrid | null,
  prevLat?: number,
  prevLng?: number
): { poeticClue: string; terrainClue: string } {
  const txt = `${poi.subType} ${poi.name}`.toLowerCase();
  const alt = sampleElevationMeters(elevation, poi.lat, poi.lng);
  const prevAlt =
    prevLat !== undefined && prevLng !== undefined
      ? sampleElevationMeters(elevation, prevLat, prevLng)
      : null;

  let slopeHint = '';
  if (alt !== null && prevAlt !== null) {
    const diff = Math.round(alt - prevAlt);
    if (diff >= 8) slopeHint = ` en gravissant le relief (+${diff} m)`;
    else if (diff <= -8) slopeHint = ` en redescendant la pente (${diff} m)`;
  }

  let poetic = `« Cherche un jalon de la branche ${CATEGORY_META[poi.category].shortLabel} portant la marque de l’époque "${poi.eraLabel}"${slopeHint}… »`;

  if (/lavoir|fontaine|source|puits|moulin|aqueduc/.test(txt) || poi.nearWaterway) {
    poetic = `« Là où l’eau claire murmure${
      poi.waterwayName ? ` non loin de ${poi.waterwayName}` : ''
    }, cherche l’ouvrage des anciens${slopeHint}… »`;
  } else if (/église|chapelle|abbaye|cathédrale|calvaire|croix|oratoire/.test(txt)) {
    poetic = `« Sous la pierre levée vers le ciel (${poi.eraLabel.toLowerCase()}), trouve le sanctuaire qui veille sur le quartier${slopeHint}… »`;
  } else if (/château|rempart|tour|porte|fort|bastion/.test(txt)) {
    poetic = `« Approche des vieilles murailles défensives où résonne la garde d’autrefois${slopeHint}… »`;
  } else if (/dolmen|menhir|mégalith|tumulus|préhist/.test(txt)) {
    poetic = `« Cherche la pierre dressée avant l’écriture, immobile depuis les âges préhistoriques${slopeHint}… »`;
  } else if (/nivellement|géodésique|borne|repère ign/.test(txt)) {
    poetic = `« Scrute le soubassement des murs : un médaillon géométrique des géographes y mesure la Terre${slopeHint}… »`;
  } else if (/arbre|parc|forêt|bois|znieff|jardin/.test(txt)) {
    poetic = `« Sous la voûte végétale, rejoins le refuge du vivant recensé par les naturalistes${slopeHint}… »`;
  } else if (poi.isSubterranean || /grotte|cavité|carrière|crypte|souterrain|mine/.test(txt)) {
    poetic = `« Bascule ta lanterne vers le monde d’en bas : une cavité ou voûte secrète t’attend sous la surface… »`;
  }

  const terrainClue = `Indice d’archive : ${poi.subType} · Strate « ${
    STRATUM_META[poi.stratum]?.short || poi.eraLabel
  } »${alt !== null ? ` · Alt. ~${Math.round(alt)} m` : ''}.`;

  return { poeticClue: poetic, terrainClue };
}

export function generateSectorTreasureHunt(params: {
  centerLat: number;
  centerLng: number;
  surfacePois: PoiItem[];
  subterraneanPois: PoiItem[];
  terrain: TerrainFeature[];
  elevation?: ElevationGrid | null;
  localityName?: string;
}): ClueTreasureHunt | null {
  const { centerLat, centerLng, surfacePois, elevation, localityName } = params;

  // Prefer accessible surface POIs within 90m–950m so the hunt is genuinely walkable!
  const candidates = [...surfacePois]
    .map((p) => ({
      poi: p,
      distFromCenter: haversineMeters(centerLat, centerLng, p.lat, p.lng),
    }))
    .filter((x) => x.distFromCenter >= 45 && x.distFromCenter <= 1250)
    .sort((a, b) => a.distFromCenter - b.distFromCenter);

  const pool = candidates.length >= 3 ? candidates.map((c) => c.poi) : surfacePois.slice(0, 12);
  if (pool.length < 2) return null;

  const sectorKey = `${centerLat.toFixed(2)}_${centerLng.toFixed(2)}`;
  const seed = stableHash(`clue_hunt_${sectorKey}`);

  // Pick Step 1 (nearby starter ~80–380m), Step 2 (distinct >= 110m from Step 1), Step 3 (finale >= 110m from Step 2 & Step 1)
  const step1 = pool[seed % Math.min(4, pool.length)];
  const step2Candidates = pool.filter(
    (p) => p.id !== step1.id && haversineMeters(step1.lat, step1.lng, p.lat, p.lng) >= 95
  );
  const step2 =
    step2Candidates[(seed >> 3) % Math.max(1, Math.min(5, step2Candidates.length))] ||
    pool.find((p) => p.id !== step1.id) ||
    null;

  if (!step2) return null;

  const step3Candidates = pool.filter(
    (p) =>
      p.id !== step1.id &&
      p.id !== step2.id &&
      haversineMeters(step2.lat, step2.lng, p.lat, p.lng) >= 95 &&
      haversineMeters(step1.lat, step1.lng, p.lat, p.lng) >= 95
  );
  const step3 =
    step3Candidates.length > 0
      ? step3Candidates[(seed >> 5) % Math.min(5, step3Candidates.length)]
      : null;

  const chosenPois = step3 ? [step1, step2, step3] : [step1, step2];

  const steps: ClueHuntStep[] = chosenPois.map((poi, idx) => {
    const prev = idx === 0 ? { lat: centerLat, lng: centerLng } : chosenPois[idx - 1];
    const { poeticClue, terrainClue } = buildPoeticClueForPoi(poi, elevation, prev.lat, prev.lng);
    return {
      stepIndex: idx,
      poiId: poi.id,
      trueName: poi.name,
      mysteryTitle: poi.mysteryTitle,
      category: poi.category,
      lat: poi.lat,
      lng: poi.lng,
      isSubterranean: Boolean(poi.isSubterranean),
      reachRadiusMeters: Math.max(54, poi.unlockRadiusMeters || 50),
      poeticClue,
      terrainClue,
    };
  });

  const relicTitles = [
    'Astrolabe des Arpenteurs Secrets',
    'Sceau de Cire des Cartographes',
    'Boussole d’Or des Trois Jalons',
    'Clef de Voûte des Chroniqueurs',
  ];
  const locSuffix = localityName ? ` · ${localityName}` : '';

  return {
    huntId: `hunt_${sectorKey}_${steps.map((s) => s.poiId.slice(-5)).join('_')}`,
    sectorKey,
    title: `Le Parchemin aux ${steps.length} Sceaux${locSuffix}`,
    subtitle:
      'Suivez la boussole et les indices sans connaître le nom des étapes : chaque jalon atteint déverrouille la strophe suivante jusqu’au coffre final.',
    xpReward: steps.length === 3 ? 195 : 140,
    relicTitle: relicTitles[seed % relicTitles.length],
    steps,
  };
}
