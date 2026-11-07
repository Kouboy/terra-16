import {
  CollectedSpecimen,
  ExplorationCategory,
  UnlockedEntry,
} from './types';

export type HeraldicMotif =
  | 'roman_eagle'
  | 'oak_leaf'
  | 'rail_wheel'
  | 'millstone'
  | 'fountain'
  | 'megalith'
  | 'fortress'
  | 'rose_window'
  | 'cavern_key'
  | 'heron'
  | 'golden_bough'
  | 'ammonite'
  | 'borehole_derrick'
  | 'hydro_gauge'
  | 'pioneer_factory';

export interface ThematicCollectionCrest {
  motif: HeraldicMotif;
  badgeName: string;
  badgeTitle: string;
  tier: 'argent' | 'or' | 'azur' | 'sinople' | 'gueules' | 'obsidienne';
  primaryColor: string;
  secondaryColor: string;
  shieldBorder: string;
  bgColor: string;
}

export interface ThematicCollectionReward {
  cosmeticName: string;
  cosmeticSlot: 'headgear' | 'outfit' | 'tool' | 'pack' | 'familiar';
  cosmeticIcon: string;
  cosmeticDescription: string;
  honorificTitle: string;
}

export interface ThematicCollectionItemSlot {
  label: string;
  hint: string;
  iconName: string;
}

export interface ThematicCollection {
  id: string;
  title: string;
  shortTitle: string;
  category: ExplorationCategory;
  subtitle: string;
  description: string;
  loreBlurb: string;
  regionFocus: string;
  targetCount: number;
  bonusXp: number;
  crest: ThematicCollectionCrest;
  reward: ThematicCollectionReward;
  itemSlots: ThematicCollectionItemSlot[];
  matcher: (entry: UnlockedEntry) => boolean;
  specimenMatcher?: (specimen: CollectedSpecimen) => boolean;
}

export interface EvaluatedThematicCollection {
  collection: ThematicCollection;
  discoveredEntries: UnlockedEntry[];
  discoveredSpecimens: CollectedSpecimen[];
  currentCount: number;
  targetCount: number;
  isComplete: boolean;
  isClaimed: boolean;
  progressPct: number;
}

export const THEMATIC_COLLECTIONS_CATALOG: ThematicCollection[] = [
  {
    id: 'ruines_gallo_romaines',
    title: 'Vestiges & Voies de la Gaule Romaine',
    shortTitle: 'Gaule Romaine',
    category: 'histoire',
    subtitle: 'Arènes, thermes, villae, voies dallées & bornes milliaires',
    description:
      'Retrouvez les fondations enfouies, théâtres antiques, sanctuaires gallo-romains et tronçons pavés de l’Empire.',
    loreBlurb:
      '« Deux mille ans d’Histoire dorment sous les mottes de terre et le gravier des chemins vicinaux. Écoutez le pas cadencé des légions et le murmure des fontaines thermales. »',
    regionFocus: 'Contrées antiques & voies de César',
    targetCount: 3,
    bonusXp: 320,
    crest: {
      motif: 'roman_eagle',
      badgeName: 'Aigle d’Airain Auguste',
      badgeTitle: 'Légat des Voies Romaines',
      tier: 'or',
      primaryColor: '#fbbf24',
      secondaryColor: '#b45309',
      shieldBorder: '#d97706',
      bgColor: '#451a03',
    },
    reward: {
      cosmeticName: 'Lauriers d’Airain Antique',
      cosmeticSlot: 'headgear',
      cosmeticIcon: 'crown',
      cosmeticDescription: 'Couronne ciselée à feuilles de laurier des tribuns romains.',
      honorificTitle: 'Arpenteur de la Gaule Ancienne',
    },
    itemSlots: [
      {
        label: 'Théâtre, thermes ou arènes antiques',
        hint: 'Cherchez un édifice antique, des thermes ou des gradins répertoriés au patrimoine.',
        iconName: 'temple',
      },
      {
        label: 'Voie romaine, chaussée ou borne',
        hint: 'Explorez une ancienne via romaine, chaussée de Brunehaut ou borne milliaire.',
        iconName: 'path',
      },
      {
        label: 'Villa, fanum ou fouille archéologique',
        hint: 'Révélez une fouille Inrap, un fanum ou une villa gallo-romaine.',
        iconName: 'ruin',
      },
    ],
    matcher: (e) =>
      /arène|théâtre antique|thermes|gallo-romain|antiquité romaine|voie romaine|chaussée de brunehaut|aqueduc gallo|villa gallo|fanum|oppidum|milliaire|fouille inrap antique/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },

  {
    id: 'especes_parcs_naturels',
    title: 'Espèces Endémiques & Parcs Protégés',
    shortTitle: 'Flore & Parcs',
    category: 'ecosysteme',
    subtitle: 'Faune vulnérable, flore rare, tourbières & réserves naturelles',
    description:
      'Recensez la biodiversité préservée des parcs régionaux, zones humides d’intérêt et réserves Inpn.',
    loreBlurb:
      '« Des tourbières acides aux coteaux calcicoles, la flore menacée trouve refuge dans les sanctuaires où l’œil de l’herboriste sait s’attarder sans détruire. »',
    regionFocus: 'Parcs naturels, ZNIEFF & zones humides',
    targetCount: 3,
    bonusXp: 300,
    crest: {
      motif: 'oak_leaf',
      badgeName: 'Couronne de Chêne Séquane',
      badgeTitle: 'Gardien des Sanctuaires Verts',
      tier: 'sinople',
      primaryColor: '#4ade80',
      secondaryColor: '#15803d',
      shieldBorder: '#22c55e',
      bgColor: '#052e16',
    },
    reward: {
      cosmeticName: 'Herbier d’Écorce & Mousses',
      cosmeticSlot: 'pack',
      cosmeticIcon: 'leaf',
      cosmeticDescription: 'Besace sylvestre garnie de buvard végétal pour plantes rares.',
      honorificTitle: 'Naturaliste des Réserves',
    },
    itemSlots: [
      {
        label: 'Sanctuaire de réserve ou parc',
        hint: 'Visitez une zone ZNIEFF, réserve naturelle ou parc régional protégé.',
        iconName: 'leaf',
      },
      {
        label: 'Zone humide, tourbière ou berge',
        hint: 'Approchez une tourbière, zone humide ou roselière vivante.',
        iconName: 'water',
      },
      {
        label: 'Arbre ou habitat remarquable',
        hint: 'Identifiez un arbre séculaire ou un biotope exceptionnel d’inventaire.',
        iconName: 'tree',
      },
    ],
    matcher: (e) =>
      /znieff|réserve naturelle|parc national|parc naturel|zone humide|tourbière|coteau calcaire|inpn|patrinat|natura 2000|ripisylve/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
    specimenMatcher: (sp) =>
      sp.domain === 'botanique' &&
      /tourbière|zone humide|calcaire|rare|protégé|pelouse|humide|marais/i.test(
        `${sp.habitatLabel} ${sp.name} ${sp.latinOrMineralName}`
      ),
  },

  {
    id: 'chemins_de_fer_oublies',
    title: 'Voies Ferrées Fantômes & Gares Esseulées',
    shortTitle: 'Lignes Fantômes',
    category: 'geographie',
    subtitle: 'Gares rurales fermées, viaducs esseulés & lignes du Tacot',
    description:
      'Parcourez le tracé des anciennes lignes à voie métrique, passages à niveau oubliés et ballast envahi par les ronces.',
    loreBlurb:
      '« Le sifflet du tortillard s’est éteint il y a des décennies, mais la saignée rectiligne du ballast fend toujours le coteau sous le lierre. »',
    regionFocus: 'Anciens réseaux ferrés départementaux',
    targetCount: 3,
    bonusXp: 300,
    crest: {
      motif: 'rail_wheel',
      badgeName: 'Roue Ailée du Tacot',
      badgeTitle: 'Vagabond du Rail Disparu',
      tier: 'azur',
      primaryColor: '#67e8f9',
      secondaryColor: '#0e7490',
      shieldBorder: '#06b6d4',
      bgColor: '#083344',
    },
    reward: {
      cosmeticName: 'Lanterne de Chef de Gare 1900',
      cosmeticSlot: 'tool',
      cosmeticIcon: 'lantern',
      cosmeticDescription: 'Lanterne à trois feux en laiton patiné des lignes du siècle passé.',
      honorificTitle: 'Arpenteur des Voies Éteintes',
    },
    itemSlots: [
      {
        label: 'Gare ancienne ou halte',
        hint: 'Localisez une gare désaffectée, halte de canton ou maison de garde-barrière.',
        iconName: 'station',
      },
      {
        label: 'Viaduc ou ouvrage d’art ferroviaire',
        hint: 'Franchissez un viaduc en pierre, pont métallique ou tranchée de ballast.',
        iconName: 'bridge',
      },
      {
        label: 'Tracé de ligne ou embranchement',
        hint: 'Retrouvez une trace de chemin de fer départemental ou voie verte sur voie ferrée.',
        iconName: 'rail',
      },
    ],
    matcher: (e) =>
      /gare|voie ferrée|chemin de fer|ligne désaffectée|viaduc ferroviaire|passage à niveau|locomotive|tacot|ballast|sncf historique|voie verte ferroviaire|tramway rural/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },

  {
    id: 'moulins_et_meulieres',
    title: 'Moulins d’Antan & Pierres Meulières',
    shortTitle: 'Moulins & Meules',
    category: 'histoire',
    subtitle: 'Moulins à vent, roues à aubes, biefs meuniers & carrières de meules',
    description:
      'Identifiez les témoins du travail du grain et de l’eau : moulins à farine, foulons, biefs et carrières meulières.',
    loreBlurb:
      '« Le cliquetis des meules et le chant du bief ont rythmé les moissons de nos aïeux. Chaque pierre meulière raconte la sueur des artisans. »',
    regionFocus: 'Vallées meunières & plateaux à vent',
    targetCount: 3,
    bonusXp: 280,
    crest: {
      motif: 'millstone',
      badgeName: 'Meulière aux Épis Dorés',
      badgeTitle: 'Compagnon Meunier d’Honneur',
      tier: 'or',
      primaryColor: '#fde047',
      secondaryColor: '#ca8a04',
      shieldBorder: '#eab308',
      bgColor: '#3f2c00',
    },
    reward: {
      cosmeticName: 'Bourse de Farine & Blé Vénérable',
      cosmeticSlot: 'pack',
      cosmeticIcon: 'wheat',
      cosmeticDescription: 'Poche de toile brute frappée au sceau des moulins de la contrée.',
      honorificTitle: 'Maître des Moulins d’Antan',
    },
    itemSlots: [
      {
        label: 'Moulin à vent ou à eau',
        hint: 'Découvrez un moulin traditionnel à vent, à aubes ou à farine.',
        iconName: 'mill',
      },
      {
        label: 'Bief meunier ou vanne',
        hint: 'Suivez le canal d’amenée d’eau, la vanne de décharge ou le bief meunier.',
        iconName: 'water',
      },
      {
        label: 'Meulière ou vestige de mouture',
        hint: 'Repérez une ancienne pierre meulière, carrière de meules ou roue de moulin.',
        iconName: 'stone',
      },
    ],
    matcher: (e) =>
      /moulin|meuni|meulière|bief|roue à aubes|moulin à vent|moulin à eau|moulin à farine|moulin à huile|foulon/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },

  {
    id: 'sources_fontaines_lavoirs',
    title: 'Sources Vives, Fontaines & Lavoirs',
    shortTitle: 'Sources & Lavoirs',
    category: 'geographie',
    subtitle: 'Lavoirs des lavandières, fontaines votives & résurgences pures',
    description:
      'Suivez le cheminement de l’eau douce à travers les villages : bassins de pierre, fontaines miraculeuses et captages.',
    loreBlurb:
      '« Aux lavoirs résonnaient autrefois les battoirs et les confidences des villageoises. Les sources guérisseuses murmurent toujours sous les mousses. »',
    regionFocus: 'Creux de vallons & bassins de fontaine',
    targetCount: 4,
    bonusXp: 300,
    crest: {
      motif: 'fountain',
      badgeName: 'Triskèle des Eaux Claires',
      badgeTitle: 'Sourcier des Vallons',
      tier: 'azur',
      primaryColor: '#38bdf8',
      secondaryColor: '#0284c7',
      shieldBorder: '#0ea5e9',
      bgColor: '#0c263b',
    },
    reward: {
      cosmeticName: 'Gourde en Grès des Eaux Vives',
      cosmeticSlot: 'tool',
      cosmeticIcon: 'flask',
      cosmeticDescription: 'Flacon de céramique scellé de cire pour puiser aux résurgences pures.',
      honorificTitle: 'Gardien des Fontaines Pures',
    },
    itemSlots: [
      {
        label: 'Lavoir communal de village',
        hint: 'Trouvez un lavoir traditionnel en contrebas du village.',
        iconName: 'washhouse',
      },
      {
        label: 'Fontaine de pierre ou borne',
        hint: 'Identifiez une fontaine publique ou un bassin sculpté.',
        iconName: 'fountain',
      },
      {
        label: 'Source naturelle ou résurgence',
        hint: 'Approchez une source captée, résurgence karstique ou fontaine de dévotion.',
        iconName: 'spring',
      },
      {
        label: 'Puits ancien ou abreuvoir',
        hint: 'Découvrez un puits à margelle ou un grand abreuvoir communal.',
        iconName: 'well',
      },
    ],
    matcher: (e) =>
      /lavoir|fontaine|source|résurgence|puits ancien|abreuvoir|lavandière|fontaine votive|fontaine miraculeuse/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },

  {
    id: 'megalithes_et_tumulus',
    title: 'Dolmens, Menhirs & Tumulus Mégalithiques',
    shortTitle: 'Mégalithes Sacrés',
    category: 'legende',
    subtitle: 'Tables de pierre néolithiques, menhirs solitaires & allées couvertes',
    description:
      'Percez le secret des alignements mégalithiques et tertres funéraires érigés il y a cinq mille ans.',
    loreBlurb:
      '« Dressés face aux étoiles bien avant les cathédrales, ces blocs de grès et de granit gardent la mémoire des premiers arpenteurs du néolithique. »',
    regionFocus: 'Landes, clairières & collines sacrées',
    targetCount: 2,
    bonusXp: 350,
    crest: {
      motif: 'megalith',
      badgeName: 'Monolithe Étoilé des Ancêtres',
      badgeTitle: 'Initié des Pierres Levées',
      tier: 'obsidienne',
      primaryColor: '#e879f9',
      secondaryColor: '#9333ea',
      shieldBorder: '#a855f7',
      bgColor: '#2e1065',
    },
    reward: {
      cosmeticName: 'Pendentif de Schiste Gravé de Runes',
      cosmeticSlot: 'tool',
      cosmeticIcon: 'rune',
      cosmeticDescription: 'Amulette de schiste taillée selon les constellations néolithiques.',
      honorificTitle: 'Érudit des Tumulus Anciens',
    },
    itemSlots: [
      {
        label: 'Dolmen ou allée couverte',
        hint: 'Rendez hommage à une table de pierre dolménique ou sépulture mégalithique.',
        iconName: 'dolmen',
      },
      {
        label: 'Menhir, tumulus ou pierre dressée',
        hint: 'Trouvez un menhir isolé, un cromlech ou un tumulus herbeux.',
        iconName: 'menhir',
      },
    ],
    matcher: (e) =>
      /dolmen|menhir|tumulus|allée couverte|pierre levée|cromlech|mégalith|néolithique|pierre fitte|pierre fichée/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },

  {
    id: 'forteresses_et_donjons',
    title: 'Forteresses, Donjons & Châteaux Forts',
    shortTitle: 'Châteaux Forts',
    category: 'histoire',
    subtitle: 'Mottes castrales, tours sentinelles, donjons & courtines',
    description:
      'Reconnaissez l’architecture défensive féodale : tours de guet, créneaux, poternes et vestiges seigneuriaux.',
    loreBlurb:
      '« Perché sur son éperon rocheux, le vieux donjon défiait autrefois assaillants et intempéries. Ses meurtrières surveillent encore la plaine. »',
    regionFocus: 'Éperons rocheux & mottes féodales',
    targetCount: 3,
    bonusXp: 300,
    crest: {
      motif: 'fortress',
      badgeName: 'Heaume du Donjon Crénelé',
      badgeTitle: 'Châtelain des Marches',
      tier: 'gueules',
      primaryColor: '#f87171',
      secondaryColor: '#b91c1c',
      shieldBorder: '#ef4444',
      bgColor: '#450a0a',
    },
    reward: {
      cosmeticName: 'Surcot d’Armes du Chevalier Guetteur',
      cosmeticSlot: 'outfit',
      cosmeticIcon: 'shield',
      cosmeticDescription: 'Tunique médiévale frappée d’un donjon d’argent sur champ de gueules.',
      honorificTitle: 'Maître des Donjons Féodaux',
    },
    itemSlots: [
      {
        label: 'Château fort ou forteresse',
        hint: 'Explorez une forteresse médiévale ou un château à douves.',
        iconName: 'castle',
      },
      {
        label: 'Donjon ou tour de guet',
        hint: 'Repérez une tour maîtresse, un donjon carré ou une motte castrale.',
        iconName: 'tower',
      },
      {
        label: 'Rempart, poterne ou porte fortifiée',
        hint: 'Pénétrez une enceinte fortifiée ou une ancienne porte de cité.',
        iconName: 'gate',
      },
    ],
    matcher: (e) =>
      /château fort|donjon|forteresse|motte féodale|motte castrale|rempart|château médiéval|créneau|tour de guet|courtine|poterne/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },

  {
    id: 'abbayes_et_prieures',
    title: 'Abbayes Cisterciennes & Prieurés Romans',
    shortTitle: 'Abbayes & Cloîtres',
    category: 'histoire',
    subtitle: 'Cloîtres silencieux, chapelles romanes, scriptoria & prieurés',
    description:
      'Découvrez la rigueur et la sérénité des ordres monastiques cisterciens, bénédictins et chartreux.',
    loreBlurb:
      '« Dans l’ombre fraîche des arcades romanes et des voussures sculptées, les moines copistes enluminaient les premiers parchemins. »',
    regionFocus: 'Vallons retirés & prieurés historiques',
    targetCount: 3,
    bonusXp: 280,
    crest: {
      motif: 'rose_window',
      badgeName: 'Rosace Romane Cistercienne',
      badgeTitle: 'Scribe du Scriptorial',
      tier: 'argent',
      primaryColor: '#e2e8f0',
      secondaryColor: '#475569',
      shieldBorder: '#94a3b8',
      bgColor: '#1e293b',
    },
    reward: {
      cosmeticName: 'Plume d’Enluminure des Chartreux',
      cosmeticSlot: 'tool',
      cosmeticIcon: 'quill',
      cosmeticDescription: 'Plume d’oie effilée aux pigments d’or fin pour transcrire les chartes.',
      honorificTitle: 'Chroniqueur des Abbayes',
    },
    itemSlots: [
      {
        label: 'Abbaye ou monastère historique',
        hint: 'Localisez une grande abbaye cistercienne ou bénédictine.',
        iconName: 'church',
      },
      {
        label: 'Prieuré ou chapelle romane',
        hint: 'Découvrez un prieuré ou une chapelle du XIe ou XIIe siècle.',
        iconName: 'chapel',
      },
      {
        label: 'Cloître, grange dîmière ou chartreuse',
        hint: 'Trouvez un vestige monastique : cloître, grange dîmière ou chartreuse.',
        iconName: 'cloister',
      },
    ],
    matcher: (e) =>
      /abbaye|prieuré|cloître|cistercien|chapelle romane|église romane|monastère|ordre monastique|grange dîmière|chartreuse|bénédictin/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },

  {
    id: 'tunnels_et_mondes_souterrains',
    title: 'Têtes de Tunnels & Galeries Souterraines',
    shortTitle: 'Tunnels & Cavités',
    category: 'etrange',
    subtitle: 'Portails de tunnels ferroviaires, boves, grottes & carrières',
    description:
      'Franchissez la frontière du monde souterrain : portails monumentaux taillés dans la roche, boves et cavités BRGM.',
    loreBlurb:
      '« Quand la lumière du jour s’efface sous l’arche sombre d’un tunnel de brique ou dans l’abîme d’une crypte, la terre dévoile ses secrets enfouis. »',
    regionFocus: 'Entrées sous terre, cavités & tranchées',
    targetCount: 3,
    bonusXp: 320,
    crest: {
      motif: 'cavern_key',
      badgeName: 'Clé de Voûte des Profondeurs',
      badgeTitle: 'Explorateur des Mondes Noirs',
      tier: 'obsidienne',
      primaryColor: '#c084fc',
      secondaryColor: '#6b21a8',
      shieldBorder: '#9333ea',
      bgColor: '#1e1b4b',
    },
    reward: {
      cosmeticName: 'Casque de Mineur à Flamme Carburée',
      cosmeticSlot: 'headgear',
      cosmeticIcon: 'helmet',
      cosmeticDescription: 'Casque en cuir bouilli muni d’une veilleuse acétylène pour galerie.',
      honorificTitle: 'Pionnier des Souterrains',
    },
    itemSlots: [
      {
        label: 'Tête ou portail de tunnel',
        hint: 'Découvrez une bouche de tunnel ferroviaire, routier ou canal voûté.',
        iconName: 'tunnel',
      },
      {
        label: 'Cavité karstique, grotte ou gouffre',
        hint: 'Explorez une grotte naturelle, aven ou cavité répertoriée BDCavités.',
        iconName: 'cave',
      },
      {
        label: 'Carrière souterraine, crypte ou bove',
        hint: 'Identifiez une ancienne carrière de pierre souterraine, bove ou crypte.',
        iconName: 'crypt',
      },
    ],
    matcher: (e) =>
      Boolean(
        e.poiId.startsWith('subpoi_') ||
        e.poiId.startsWith('cav_') ||
        e.poiId.startsWith('ign_ug_') ||
        /tunnel|portail|cavité|grotte|gouffre|aven|bove|souterrain|karst|crypte|carrière souterraine|mine|galerie/i.test(
          `${e.name} ${e.subType} ${e.summary} ${e.source}`
        )
      ),
  },

  {
    id: 'marais_et_faune_aquatique',
    title: 'Marais, Roselières & Oiseaux d’Eau',
    shortTitle: 'Marais & Eaux Vives',
    category: 'ecosysteme',
    subtitle: 'Étangs calmes, haltes migratoires, roselières & nids de hérons',
    description:
      'Observez la quiétude des zones humides : roselières bruissantes, hérons cendrés, frayères et étangs sauvages.',
    loreBlurb:
      '« Dans la vapeur matinale des étangs, le pas feutré de l’oiseau pêcheur ne trouble même pas le miroir d’eau où fleurissent les nénuphars. »',
    regionFocus: 'Zones humides, étangs & bras morts',
    targetCount: 3,
    bonusXp: 280,
    crest: {
      motif: 'heron',
      badgeName: 'Plume d’Aigrette des Roselières',
      badgeTitle: 'Vigie des Eaux Dormantes',
      tier: 'sinople',
      primaryColor: '#86efac',
      secondaryColor: '#166534',
      shieldBorder: '#22c55e',
      bgColor: '#022c22',
    },
    reward: {
      cosmeticName: 'Longue-vue Camouflée des Joncs',
      cosmeticSlot: 'tool',
      cosmeticIcon: 'spyglass',
      cosmeticDescription: 'Optique gainée d’osier pour observer la faune aquatique sans alerte.',
      honorificTitle: 'Veilleur des Marais Vivants',
    },
    itemSlots: [
      {
        label: 'Marais, étang ou roselière',
        hint: 'Approchez un plan d’eau sauvage, marais ou ceinture de roseaux.',
        iconName: 'swamp',
      },
      {
        label: 'Halte migratoire ou héronnière',
        hint: 'Localisez un observatoire ornithologique ou site de nidification.',
        iconName: 'bird',
      },
      {
        label: 'Bras mort, frayère ou tourbière',
        hint: 'Identifiez un bras mort de rivière ou une frayère protégée.',
        iconName: 'fish',
      },
    ],
    matcher: (e) =>
      /marais|roselière|étang|héron|oiseau d'eau|frayère|zone humide|tourbière|bras mort|nénuphar|avifaune|ornithologique/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },

  {
    id: 'arbres_remarquables_et_forets',
    title: 'Arbres Remarquables & Forêts Séculaires',
    shortTitle: 'Arbres Vénérables',
    category: 'ecosysteme',
    subtitle: 'Chênes millénaires, hêtres tortillards & futaies royales',
    description:
      'Rendez visite aux géants verts de nos contrées : spécimens classés Arbre Remarquable et futaies préservées.',
    loreBlurb:
      '« Ces arbres majestueux ont vu passer rois, brigands et laboureurs sans vaciller. Leur ramure tutélaire abrite les esprits de la forêt. »',
    regionFocus: 'Forêts domaniales & clairières légendaires',
    targetCount: 3,
    bonusXp: 300,
    crest: {
      motif: 'golden_bough',
      badgeName: 'Rameau d’Or Vénérable',
      badgeTitle: 'Ami des Géants Sylvestres',
      tier: 'or',
      primaryColor: '#facc15',
      secondaryColor: '#854d0e',
      shieldBorder: '#ca8a04',
      bgColor: '#2e1800',
    },
    reward: {
      cosmeticName: 'Coiffe de Druide aux Feuilles d’If',
      cosmeticSlot: 'headgear',
      cosmeticIcon: 'hood',
      cosmeticDescription: 'Capuche tissée de fibres végétales honorant la futaie millénaire.',
      honorificTitle: 'Protecteur des Arbres Remarquables',
    },
    itemSlots: [
      {
        label: 'Arbre labellisé remarquable',
        hint: 'Rendez visite à un arbre remarquable répertorié au patrimoine naturel.',
        iconName: 'tree',
      },
      {
        label: 'Forêt domaniale ou futaie séculaire',
        hint: 'Pénétrez une forêt domaniale d’exception ou un massif ancien.',
        iconName: 'forest',
      },
      {
        label: 'Clairière mythique ou arbre de légende',
        hint: 'Identifiez un arbre de justice, un chêne des fées ou un if d’enclos.',
        iconName: 'leaf',
      },
    ],
    matcher: (e) =>
      /arbre remarquable|chêne séculaire|chêne millénaire|hêtre tortillard|if millénaire|forêt domaniale|futaie|arbre classé|arbre vénérable/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },

  {
    id: 'geologie_fossiles_et_falaises',
    title: 'Géologie Singulière, Fossiles & Falaises',
    shortTitle: 'Strates & Fossiles',
    category: 'geographie',
    subtitle: 'Affleurements remarquables BRGM, calcaires coquilliers & failles',
    description:
      'Déchiffrez le grand livre de la Terre : falaises escarpées, bancs coquilliers fossilisés et strates rocheuses.',
    loreBlurb:
      '« Des mers disparues du Jurassique aux poussées orogéniques, la pierre garde l’empreinte intacte d’un monde d’avant les hommes. »',
    regionFocus: 'Affleurements géologiques & falaises',
    targetCount: 3,
    bonusXp: 320,
    crest: {
      motif: 'ammonite',
      badgeName: 'Ammonite Spirale du Jurassique',
      badgeTitle: 'Lithologue des Ères Premières',
      tier: 'argent',
      primaryColor: '#cbd5e1',
      secondaryColor: '#334155',
      shieldBorder: '#64748b',
      bgColor: '#0f172a',
    },
    reward: {
      cosmeticName: 'Marteau de Géologue en Acier Trempé',
      cosmeticSlot: 'tool',
      cosmeticIcon: 'hammer',
      cosmeticDescription: 'Outil de pointe pour prélever des éclats minéraux avec respect.',
      honorificTitle: 'Sondeur des Strates Terrestres',
    },
    itemSlots: [
      {
        label: 'Affleurement géologique remarquable',
        hint: 'Explorez un site classé à l’inventaire national du patrimoine géologique.',
        iconName: 'rock',
      },
      {
        label: 'Falaise, gorge ou escarpement',
        hint: 'Contemplez une falaise taillée, une gorge abrupte ou un chaos rocheux.',
        iconName: 'cliff',
      },
      {
        label: 'Gisement fossile ou carrière de strate',
        hint: 'Découvrez une ancienne carrière révélant des strates sédimentaires.',
        iconName: 'fossil',
      },
    ],
    matcher: (e) =>
      /géologique|affleurement|fossile|falaise|gorge|chaos rocheux|inpg|brgm|calcaire coquillier|marne|craie|faille|carrière remarquable/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
    specimenMatcher: (sp) =>
      sp.domain === 'geologie' ||
      sp.affinity === 'volcanique' ||
      sp.affinity === 'schiste' ||
      sp.affinity === 'souterrain',
  },

  {
    id: 'forages_profonds_bss',
    title: 'Banque du Sous-Sol & Forages BRGM',
    shortTitle: 'Forages & Nappes BSS',
    category: 'geographie',
    subtitle: 'Sondages géologiques, coupes lithologiques, piézomètres & nappes',
    description:
      'Explorez les yeux perçants de la géologie : forages profonds et piézomètres de la Banque du Sous-Sol (BSS).',
    loreBlurb:
      '« Sous la terre végétale et le ballast se cachent des centaines de mètres de sédiments marins et de nappes d’eau pure. Le carottage en conserve la mémoire intacte. »',
    regionFocus: 'Sondages géotechniques & piézomètres officiels',
    targetCount: 3,
    bonusXp: 300,
    crest: {
      motif: 'borehole_derrick',
      badgeName: 'Trépan d’Acier des Abysses',
      badgeTitle: 'Géotechnicien des Profondeurs',
      tier: 'argent',
      primaryColor: '#e2e8f0',
      secondaryColor: '#475569',
      shieldBorder: '#94a3b8',
      bgColor: '#0f172a',
    },
    reward: {
      cosmeticName: 'Sonde Piézométrique en Laiton',
      cosmeticSlot: 'tool',
      cosmeticIcon: 'probe',
      cosmeticDescription: 'Sonde de niveau à ruban gradué et capteur acoustique pour mesurer les nappes.',
      honorificTitle: 'Sondeur des Abysses Minéraux',
    },
    itemSlots: [
      {
        label: 'Forage profond ou piézomètre BSS',
        hint: 'Localisez un point BSS du BRGM avec numéro officiel ou coupe lithologique.',
        iconName: 'drill',
      },
      {
        label: 'Sondage hydrogéologique ou nappe',
        hint: 'Consignez un ouvrage mesurant les nappes phréatiques captives ou libres.',
        iconName: 'aquifer',
      },
      {
        label: 'Coupe géologique carottée',
        hint: 'Identifiez un sondage décrivant la succession des couches sédimentaires.',
        iconName: 'strata',
      },
    ],
    matcher: (e) =>
      e.poiId.startsWith('bss_') ||
      /bss|banque du sous-sol|forage|piézomètre|piezometre|carottage|lithologie/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
    specimenMatcher: (sp) => sp.affinity === 'souterrain' || sp.isSubterranean,
  },

  {
    id: 'vigies_fleuves_hubeau',
    title: 'Sentinelles des Fleuves & Hub’Eau',
    shortTitle: 'Vigies Hub’Eau',
    category: 'geographie',
    subtitle: 'Stations hydrométriques, limnimètres, cotes de crue & débits m³/s',
    description:
      'Suivez les pulsations des rivières françaises : stations hydrométriques Hub’Eau mesurant hauteur et débit.',
    loreBlurb:
      '« Le fleuve ne dort jamais. Des limnimètres à échelle aux sondes ultrasonores, chaque goutte qui dévale vers l’océan est comptée par les sentinelles des eaux. »',
    regionFocus: 'Rives des fleuves, torrents & stations Vigicrues',
    targetCount: 3,
    bonusXp: 300,
    crest: {
      motif: 'hydro_gauge',
      badgeName: 'Limnimètre d’Argent des Eaux Vives',
      badgeTitle: 'Gardien du Cours des Eaux',
      tier: 'azur',
      primaryColor: '#38bdf8',
      secondaryColor: '#0369a1',
      shieldBorder: '#0ea5e9',
      bgColor: '#082f49',
    },
    reward: {
      cosmeticName: 'Moulinet Hydrométrique de Précision',
      cosmeticSlot: 'tool',
      cosmeticIcon: 'propeller',
      cosmeticDescription: 'Hélice étalonnée mesurant la vitesse de courant des rivières en crue.',
      honorificTitle: 'Vigie des Eaux Vives & Crues',
    },
    itemSlots: [
      {
        label: 'Station hydrométrique Hub’Eau',
        hint: 'Localisez une station de jaugeage officielle Hub’Eau / Vigicrues.',
        iconName: 'gauge',
      },
      {
        label: 'Mesure de débit en temps réel',
        hint: 'Consignez une station transmettant son débit en mètres cubes par seconde.',
        iconName: 'flow',
      },
      {
        label: 'Échelle limnimétrique ou repère de crue',
        hint: 'Observez une échelle de niveau peinte ou balise de crue historique.',
        iconName: 'flood_marker',
      },
    ],
    matcher: (e) =>
      e.poiId.startsWith('hydro_') ||
      /hub[’']?eau|hydrométrie|hydrometrie|station hydrométrique|débit|vigicrues|limnimètre/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },

  {
    id: 'friches_cerema_patrimoine',
    title: 'Cartofriches : Mémoire Industrielle & Renaissance',
    shortTitle: 'Friches & Renaturation',
    category: 'etrange',
    subtitle: 'Manufactures oubliées, triages ferroviaires & reconversion Cerema',
    description:
      'Parcourez les paysages en métamorphose : friches industrielles et ferroviaires répertoriées par le Cerema.',
    loreBlurb:
      '« Là où battaient les marteaux-pilons et grinçaient les wagons de fret, la mousse pionnière et les bouleaux reprennent leurs droits sur la brique et le fer rouillé. »',
    regionFocus: 'Anciens bassins manufacturiers & friches urbaines',
    targetCount: 3,
    bonusXp: 320,
    crest: {
      motif: 'pioneer_factory',
      badgeName: 'Roue Crantée & Pousse Verte',
      badgeTitle: 'Arpenteur des Friches Oubliées',
      tier: 'sinople',
      primaryColor: '#a3e635',
      secondaryColor: '#4d7c0f',
      shieldBorder: '#65a30d',
      bgColor: '#142907',
    },
    reward: {
      cosmeticName: 'Tenue d’Exploration des Friches & Urbex',
      cosmeticSlot: 'outfit',
      cosmeticIcon: 'jacket',
      cosmeticDescription: 'Parka renforcée aux coudes et bottes de marche à semelles d’acier.',
      honorificTitle: 'Pionnier des Terres en Renaissance',
    },
    itemSlots: [
      {
        label: 'Friche industrielle ou manufacture',
        hint: 'Découvrez une ancienne usine, forge ou tissage référencé Cartofriches.',
        iconName: 'factory',
      },
      {
        label: 'Friche ferroviaire ou dépôt SNCF',
        hint: 'Localisez un ancien triage de fret, rotonde ou faisceau ferroviaire en désuétude.',
        iconName: 'depot',
      },
      {
        label: 'Espace en renaturation spontanée',
        hint: 'Observez le retour de la biodiversité pionnière sur dalles de béton ou ballast.',
        iconName: 'sprout',
      },
    ],
    matcher: (e) =>
      e.poiId.startsWith('friche_') ||
      /cartofriches|cerema|friche industrielle|friche ferroviaire|friche|reconversion|friche d’activités/i.test(
        `${e.name} ${e.subType} ${e.summary} ${e.source}`
      ),
  },
];

export function evaluateThematicCollections(
  entries: UnlockedEntry[],
  specimens: CollectedSpecimen[],
  claimedCollectionIds: string[] = []
): EvaluatedThematicCollection[] {
  const claimedSet = new Set(claimedCollectionIds);

  return THEMATIC_COLLECTIONS_CATALOG.map((collection) => {
    const discoveredEntries: UnlockedEntry[] = [];
    const seenPoiIds = new Set<string>();

    for (const entry of entries) {
      if (seenPoiIds.has(entry.poiId)) continue;
      if (collection.matcher(entry)) {
        seenPoiIds.add(entry.poiId);
        discoveredEntries.push(entry);
      }
    }

    const discoveredSpecimens: CollectedSpecimen[] = [];
    if (collection.specimenMatcher) {
      const seenSpecimenIds = new Set<string>();
      for (const specimen of specimens) {
        if (seenSpecimenIds.has(specimen.specimenId)) continue;
        if (collection.specimenMatcher(specimen)) {
          seenSpecimenIds.add(specimen.specimenId);
          discoveredSpecimens.push(specimen);
        }
      }
    }

    const totalDiscovered = discoveredEntries.length + discoveredSpecimens.length;
    const currentCount = Math.min(collection.targetCount, totalDiscovered);
    const isComplete = currentCount >= collection.targetCount;
    const isClaimed = claimedSet.has(collection.id);
    const progressPct = Math.min(100, Math.round((currentCount / collection.targetCount) * 100));

    return {
      collection,
      discoveredEntries,
      discoveredSpecimens,
      currentCount,
      targetCount: collection.targetCount,
      isComplete,
      isClaimed,
      progressPct,
    };
  });
}
