import { UnlockedEntry, PoiItem } from './types';

export interface ObservationCuriosity {
  hook: string | null;
  observationPrompt: string | null;
  observationDetailCategory: 'architecture' | 'nature' | 'eau' | 'histoire' | 'technique' | 'paysage';
  hasRichLore: boolean;
}

/**
 * Extracts a gentle, authentic curiosity note based on authentic summary text and archival metadata.
 * Does not force trivia on trivial sentences ("Le saviez-vous ?"). Returns null if no authentic curiosity is present.
 */
export function extractVerifiableHook(entry: UnlockedEntry | PoiItem): string | null {
  const summary = (entry.summary || '').trim();
  if (!summary || summary.length < 25) return null;

  // Split into first complete sentence
  const sentenceMatch = summary.match(/^([^.!?\n]+[.!?])/);
  let firstSentence = sentenceMatch ? sentenceMatch[1].trim() : summary.slice(0, 160).trim();

  // Clean trailing punctuation
  firstSentence = firstSentence.replace(/[.!?]+$/, '');

  const lower = firstSentence.toLowerCase();

  // Discard banal administrative or locative introductory sentences
  if (
    lower.startsWith('il s’agit') ||
    lower.startsWith("il s'agit") ||
    lower.startsWith('édifice situé') ||
    lower.startsWith('monument situé') ||
    lower.startsWith('situé sur la commune') ||
    lower.startsWith('située sur la commune') ||
    lower.startsWith('ce lieu se trouve') ||
    lower.startsWith('cette commune')
  ) {
    return null;
  }

  // Only retain when sentence carries genuine architectural, historical, natural or legendary substance
  const hasSubstance =
    lower.includes('siècle') ||
    lower.includes('édifié') ||
    lower.includes('construit') ||
    lower.includes('classé') ||
    lower.includes('inscrit') ||
    lower.includes('architect') ||
    lower.includes('sculpt') ||
    lower.includes('voûte') ||
    lower.includes('pierre') ||
    lower.includes('granite') ||
    lower.includes('calcaire') ||
    lower.includes('source') ||
    lower.includes('légende') ||
    lower.includes('tradition') ||
    lower.includes('mémoire') ||
    lower.includes('vestige') ||
    lower.includes('fouille') ||
    lower.includes('époque') ||
    /\b(1[0-9]{3}|20[0-2][0-9])\b/.test(lower);

  if (!hasSubstance) return null;

  if (firstSentence.length >= 25 && firstSentence.length <= 180) {
    if (/^saviez-vous/i.test(firstSentence)) {
      return `${firstSentence} ?`;
    }
    return `${firstSentence}.`;
  }

  return null;
}

/**
 * Provides a gentle, safe, and authentic observation prompt for the real world.
 * Strictly respects rule: "Si aucun détail pertinent n'est connu, ne pas en inventer."
 * Formulates invitations as open suggestions ("Regardez si...", "Observez comment...")
 * and insists on observation from public paths without trespassing or taking samples.
 */
export function getSafeObservationPrompt(entry: UnlockedEntry | PoiItem): {
  prompt: string;
  category: ObservationCuriosity['observationDetailCategory'];
} | null {
  const nameL = (entry.name || '').toLowerCase();
  const subL = (entry.subType || '').toLowerCase();
  const srcL = (entry.source || '').toLowerCase();

  // 1. Waterways, washhouses, wells, fountains
  if (
    subL.includes('fontaine') ||
    subL.includes('lavoir') ||
    subL.includes('puits') ||
    subL.includes('source') ||
    nameL.includes('fontaine') ||
    nameL.includes('lavoir') ||
    nameL.includes('source')
  ) {
    return {
      prompt:
        'Depuis le chemin, regardez comment l’eau est captée et guidée : observez si la maçonnerie porte des rigoles d’écoulement, d’éventuelles entailles d’usage sur la pierre ou un bassin de décantation.',
      category: 'eau',
    };
  }

  // 2. Bridges, aqueducts, weirs, mills
  if (
    subL.includes('pont') ||
    subL.includes('aqueduc') ||
    subL.includes('moulin') ||
    subL.includes('barrage') ||
    nameL.includes('pont') ||
    nameL.includes('moulin')
  ) {
    return {
      prompt:
        'Regardez comment l’ouvrage franchit le cours d’eau : observez le profil des piles, cherchez si des avant-becs ont été aménagés contre le courant, ou comment les matériaux (pierre, fer ou maçonnerie) s’accordent au lit de la rivière.',
      category: 'eau',
    };
  }

  // 3. Religious architecture: churches, chapels, abbeys, calvaries
  if (
    subL.includes('église') ||
    subL.includes('chapelle') ||
    subL.includes('abbaye') ||
    subL.includes('cathédrale') ||
    subL.includes('calvaire') ||
    subL.includes('croix') ||
    nameL.includes('église') ||
    nameL.includes('chapelle') ||
    nameL.includes('croix')
  ) {
    return {
      prompt:
        'Depuis l’espace public, regardez si le chevet est orienté vers le levant et observez les assises de maçonnerie : on y discerne parfois d’anciennes marques de tailleurs de pierre ou des réemplois de matériaux.',
      category: 'architecture',
    };
  }

  // 4. Feudal, military, castles, city gates, ramparts
  if (
    subL.includes('château') ||
    subL.includes('rempart') ||
    subL.includes('tour') ||
    subL.includes('porte') ||
    subL.includes('manoir') ||
    subL.includes('donjon') ||
    nameL.includes('château') ||
    nameL.includes('manoir')
  ) {
    return {
      prompt:
        'Depuis la voie publique, observez comment l’édifice tire parti du relief naturel et cherchez d’éventuelles ouvertures défensives (archères, canonnières) ou des reprises de construction entre différentes époques.',
      category: 'histoire',
    };
  }

  // 5. Prehistory & megaliths: dolmens, menhirs, barrows
  if (
    subL.includes('menhir') ||
    subL.includes('dolmen') ||
    subL.includes('mégalithe') ||
    subL.includes('tumulus') ||
    nameL.includes('menhir') ||
    nameL.includes('dolmen')
  ) {
    return {
      prompt:
        'Observez la nature de la roche et sa texture : regardez si les faces abritées accueillent des lichens ou des aspérités singulières, en veillant à observer à distance sans altérer le monument.',
      category: 'histoire',
    };
  }

  // 6. Remarkable trees, botanical specimens, hedgerows
  if (
    subL.includes('arbre remarquable') ||
    subL.includes('chêne') ||
    subL.includes('if') ||
    subL.includes('forêt') ||
    subL.includes('jardin') ||
    nameL.includes('arbre')
  ) {
    return {
      prompt:
        'Depuis le sentier, levez les yeux vers le houppier pour apprécier l’élancement des branches et observez l’écorce à hauteur du regard, sans prélever ni fragiliser le végétal.',
      category: 'nature',
    };
  }

  // 7. Viewpoints, orientation tables, panoramas
  if (
    subL.includes('belvédère') ||
    subL.includes('panorama') ||
    subL.includes('point de vue') ||
    subL.includes('table d’orientation') ||
    nameL.includes('panorama') ||
    nameL.includes('belvédère')
  ) {
    return {
      prompt:
        'Prenez quelques instants pour observer le paysage sans l’écran : identifiez les lignes de crêtes, les vallons boisés et la manière dont les voies de communication et les habitations s’adaptent au relief.',
      category: 'paysage',
    };
  }

  // 8. Technical geodesy, leveling benchmarks, BSS boreholes
  if (
    srcL.includes('bss') ||
    srcL.includes('ign') ||
    subL.includes('borne') ||
    subL.includes('repère de nivellement') ||
    subL.includes('forage') ||
    subL.includes('piézom')
  ) {
    return {
      prompt:
        'Depuis la voie publique, regardez si un disque ou clou en fonte/bronze est scellé dans le soubassement. Si le repère se situe sur une propriété privée ou un édifice clos, n’entrez pas et respectez les limites du domaine public.',
      category: 'technique',
    };
  }

  // If none known, do NOT invent fabricated observation prompts
  return null;
}
