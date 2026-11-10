import { UnlockedEntry, PoiItem } from './types';

export interface ObservationCuriosity {
  hook: string | null;
  observationPrompt: string | null;
  observationDetailCategory: 'architecture' | 'nature' | 'eau' | 'histoire' | 'technique' | 'paysage';
  hasRichLore: boolean;
}

/**
 * Extracts a concise, verifiable hook ("Saviez-vous que... ?")
 * based on authentic summary text and archival metadata,
 * avoiding sensationalist filler or invented facts.
 */
export function extractVerifiableHook(entry: UnlockedEntry | PoiItem): string | null {
  const summary = (entry.summary || '').trim();
  if (!summary || summary.length < 15) return null;

  // Split into first complete sentence
  const sentenceMatch = summary.match(/^([^.!?\n]+[.!?])/);
  let firstSentence = sentenceMatch ? sentenceMatch[1].trim() : summary.slice(0, 140).trim();

  // Clean trailing punctuation for hook injection
  firstSentence = firstSentence.replace(/[.!?]+$/, '');

  // If the sentence is already concise and factual, present as a gentle hook
  if (firstSentence.length >= 20 && firstSentence.length <= 180) {
    if (/^saviez-vous/i.test(firstSentence)) {
      return `${firstSentence} ?`;
    }
    return `Le saviez-vous ? ${firstSentence}.`;
  }

  return null;
}

/**
 * Provides a gentle, safe, and authentic observation prompt for the real world.
 * Strictly respects rule: "Si aucun détail pertinent n'est connu, ne pas en inventer."
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
        'Ouvrez l’œil sur la margelle de pierre taillée : observez les rigoles d’écoulement d’eau ou les entailles creusées par le frottement répété des seaux et des cordes.',
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
        'Observez le profil des piles et les avant-becs maçonnés, conçus pour fendre le courant de l’eau et dévier les bois flottants.',
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
        'Repérez l’orientation du chevet (traditionnellement axé vers le levant) et cherchez sur les blocs de soubassement d’éventuelles marques de tâcherons gravées par les tailleurs de pierre.',
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
        'Notez l’épaisseur apparente des maçonneries, la forme des ouvertures (archères, canonnières) et les reprises de taille entre différentes époques de construction.',
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
        'Examinez la nature de la roche (souvent du granite ou grès local transporté sur site) et la présence de cupules ou de lichens centenaires sur la face la moins exposée au vent.',
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
        'Levez les yeux vers le houppier pour apprécier l’envergure des branches maîtresses et observez l’écorce à hauteur d’homme, refuge d’une micro-faune et de mousses précieuses.',
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
        'Prenez quelques secondes pour regarder au loin sans l’écran : identifiez les lignes de crêtes, les vallons boisés et la façon dont les habitations se sont installées le long du relief.',
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
        'Si vous êtes sur place, cherchez un médaillon en fonte ou bronze scellé dans la maçonnerie basse (souvent à environ 50 cm du sol) portant la marque du nivellement général.',
      category: 'technique',
    };
  }

  // If none known, do NOT invent fabricated observation prompts
  return null;
}
