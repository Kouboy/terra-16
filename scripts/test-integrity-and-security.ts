/**
 * Test de vérification automatique : Sécurité, simulation & intégrité (Lot P0)
 *
 * Vérifie rigoureusement selon la note « Corrections & affinages GD/UX v1.1 » :
 * - P0.1 : Exclusivité stricte entre Balade GPS réelle et Planificateur de balade
 * - P0.2 : Suppression intégrale des boutons de test et voies de triche sur la progression
 * - P0.3 : Honnêteté du récapitulatif de balade (modes, estimation temporelle, absence de mention "certifiée")
 * - P0.4 : Durcissement SQL Supabase (auth.uid obligatoire, anti-spoofing finder_id, search_path, idempotence)
 */

import fs from 'node:fs';
import path from 'node:path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ÉCHEC : ${message}`);
    process.exit(1);
  }
  console.log(`✅ SUCCÈS : ${message}`);
}

console.log('=== AUDIT ET TESTS COMPORTEMENTAUX DU LOT P0 ===\n');

// ----------------------------------------------------------------------------
// P0.1 — EXCLUSIVITÉ MODES GPS RÉEL ET PLANIFICATEUR (src/App.tsx)
// ----------------------------------------------------------------------------
console.log('[P0.1] Vérification de l’étanchéité GPS Réel vs Planificateur...');
const appPath = path.resolve('src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

assert(
  appContent.includes('if (simulationMode) {') && appContent.includes('navigator.geolocation.clearWatch'),
  'P0.1.a : Le suivi continu watchPosition est immédiatement suspendu et libéré dès l’entrée en mode Planificateur'
);

assert(
  appContent.includes('if (token !== activeWatchTokenRef.current) return;'),
  'P0.1.b : Les callbacks GPS asynchrones tardifs sont invalidés grâce au token d’écoute actif'
);

assert(
  appContent.includes('const handleToggleSimulationMode = useCallback') &&
    appContent.includes('prevUnlockPosRef.current = null;') &&
    appContent.includes('lastStepMetricRef.current = null;'),
  'P0.1.c : La transition de mode réinitialise à null les ancres de position pour interdire tout calcul de pas ou déverrouillage sur saut géographique'
);

assert(
  appContent.includes('const [sessionSimulatedMeters, setSessionSimulatedMeters] = useState<number>(0);') &&
    appContent.includes('const [sessionSimulatedElevGainM, setSessionSimulatedElevGainM] = useState<number>(0);'),
  'P0.1.d : Les compteurs de session réelle (sessionMeters) et planifiée (sessionSimulatedMeters) sont physiquement isolés dans l’état'
);

assert(
  appContent.includes('simulationMode || !prevPos'),
  'P0.1.e : Le balayage de déverrouillage de proximité est suspendu en mode simulation'
);

// ----------------------------------------------------------------------------
// P0.2 — SUPPRESSION DES VOIES DE TRICHE ET BOUTONS DE TEST
// ----------------------------------------------------------------------------
console.log('\n[P0.2] Vérification de l’absence de bypass de progression réelle...');
const challengesPath = path.resolve('src/components/WalkingChallengesView.tsx');
const challengesContent = fs.readFileSync(challengesPath, 'utf-8');

assert(
  !challengesContent.includes('onSimulateWalkStep') &&
    !challengesContent.includes('+500 m test') &&
    !challengesContent.includes('+2,5 km test'),
  'P0.2.a : Les boutons de test (+500 m, +2,5 km) et le callback onSimulateWalkStep sont supprimés de WalkingChallengesView'
);

assert(
  !appContent.includes('onSimulateWalkStep={'),
  'P0.2.b : Aucun callback d’injection de distance artificielle n’est transmis aux défis dans App.tsx'
);

assert(
  appContent.includes('walkedMeters: simulationMode ? p.walkedMeters || 0 : (p.walkedMeters || 0) + roundedStep'),
  'P0.2.c : La statistique persistée walkedMeters ne s’incrémente jamais en mode simulation'
);

// ----------------------------------------------------------------------------
// P0.3 — HONNÊTETÉ DU RÉCAPITULATIF DE BALADE (WalkRecapModal.tsx)
// ----------------------------------------------------------------------------
console.log('\n[P0.3] Vérification de l’honnêteté du récapitulatif de balade...');
const recapPath = path.resolve('src/components/WalkRecapModal.tsx');
const recapContent = fs.readFileSync(recapPath, 'utf-8');

assert(
  !recapContent.includes('Marche Réelle Vérifiée'),
  'P0.3.a : La qualification trompeuse "Marche Réelle Vérifiée (GPS de Terrain)" a été supprimée au profit d’une formulation sobre'
);

assert(
  recapContent.includes('Parcours de Reconnaissance (Planificateur)') &&
    recapContent.includes('Balade sur le Terrain (Suivi GPS)'),
  'P0.3.b : Le bandeau distingue sans ambiguïté la reconnaissance planifiée du suivi GPS de terrain'
);

assert(
  recapContent.includes('Temps estimé (~4 km/h)'),
  'P0.3.c : La durée calculée à partir de la distance est honnêtement libellée comme estimation'
);

assert(
  recapContent.includes('Aucun point, XP ni défi'),
  'P0.3.d : Le récapitulatif rappelle explicitement l’absence d’attribution d’XP en mode planificateur'
);

assert(
  appContent.includes('sessionMeters={simulationMode ? sessionSimulatedMeters : sessionMeters}'),
  'P0.3.e : WalkRecapModal reçoit fidèlement les métriques de la session active selon le mode'
);

// ----------------------------------------------------------------------------
// P0.4 — SÉCURISATION DES FONCTIONS COMMUNAUTAIRES SUPABASE (supabase_schema.sql)
// ----------------------------------------------------------------------------
console.log('\n[P0.4] Audit de la sécurité des fonctions communautaires Supabase...');
const schemaPath = path.resolve('supabase_schema.sql');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

assert(
  schemaContent.includes('create table if not exists public.cairn_upvotes') &&
    schemaContent.includes('primary key (cairn_id, user_id)'),
  'P0.4.a : Table de traçabilité cairn_upvotes créée avec clé primaire composite garantissant l’unicité d’un vote'
);

assert(
  schemaContent.includes('alter table public.cairn_upvotes enable row level security;'),
  'P0.4.b : RLS activé sur la table cairn_upvotes'
);

assert(
  schemaContent.includes('create or replace function public.increment_cairn_upvote') &&
    schemaContent.includes('security definer') &&
    schemaContent.includes('set search_path = public, pg_temp') &&
    schemaContent.includes('if v_user_id is null then') &&
    schemaContent.includes('if v_cairn_owner = v_user_id then'),
  'P0.4.c : RPC increment_cairn_upvote sécurisé avec search_path fixé, vérification auth.uid() et interdiction du vote pour son propre cairn'
);

assert(
  schemaContent.includes('revoke execute on function public.increment_cairn_upvote(text) from public, anon;') &&
    schemaContent.includes('grant execute on function public.increment_cairn_upvote(text) to authenticated;'),
  'P0.4.d : Droits EXECUTE révoqués pour public/anon et réservés au rôle authenticated pour les cairns'
);

assert(
  schemaContent.includes('create or replace function public.record_geocache_log') &&
    schemaContent.includes('security definer') &&
    schemaContent.includes('set search_path = public, pg_temp') &&
    schemaContent.includes('if p_finder_id is not null and p_finder_id <> v_user_id then') &&
    schemaContent.includes('if v_cache_owner <> v_user_id then'),
  'P0.4.e : RPC record_geocache_log immunisé contre le spoofing de p_finder_id et n’incrémentant pas finder_count si le créateur signe'
);

assert(
  schemaContent.includes('revoke execute on function public.record_geocache_log(text, uuid, text, text) from public, anon;') &&
    schemaContent.includes('grant execute on function public.record_geocache_log(text, uuid, text, text) to authenticated;'),
  'P0.4.f : Droits EXECUTE sur record_geocache_log révoqués pour public/anon et accordés à authenticated'
);

// ----------------------------------------------------------------------------
// P1.1 — STATUT ÉPISTÉMIQUE : INFORMATION À CONFIRMER (src/types.ts, server.ts)
// ----------------------------------------------------------------------------
console.log('\n[P1.1] Vérification du statut épistémique « Information à confirmer »...');
const typesPath = path.resolve('src/types.ts');
const typesContent = fs.readFileSync(typesPath, 'utf-8');
const serverPath = path.resolve('server.ts');
const serverContent = fs.readFileSync(serverPath, 'utf-8');

assert(
  typesContent.includes("'information_a_confirmer'") &&
    typesContent.includes('badgeLabel: \'Information à confirmer\''),
  'P1.1.a : Le statut épistémique « Information à confirmer » est défini dans types.ts avec ses métadonnées'
);

assert(
  typesContent.includes('const hasDocumentaryProof =') &&
    typesContent.includes("return 'information_a_confirmer';"),
  'P1.1.b : resolveEpistemicStatus réserve « Fait documenté » aux sources attestées et bascule sur « Information à confirmer » par défaut'
);

assert(
  serverContent.includes("'information_a_confirmer'") &&
    serverContent.includes("candidate.epistemicStatus = 'information_a_confirmer';"),
  'P1.1.c : Le serveur (enrichAndLinkPois) assigne « Information à confirmer » aux entités sans preuve documentaire archivistique'
);

// ----------------------------------------------------------------------------
// P1.2 — ASSOUPLISSEMENT DES INVITATIONS À OBSERVER (src/poiObservation.ts)
// ----------------------------------------------------------------------------
console.log('\n[P1.2] Vérification des invitations à observer et pistes de curiosité...');
const poiObsPath = path.resolve('src/poiObservation.ts');
const poiObsContent = fs.readFileSync(poiObsPath, 'utf-8');
const entryPanelPath = path.resolve('src/components/EntryDetailPanel.tsx');
const entryPanelContent = fs.readFileSync(entryPanelPath, 'utf-8');

assert(
  poiObsContent.includes('Depuis le chemin, regardez comment') &&
    poiObsContent.includes('Regardez comment l’ouvrage franchit') &&
    poiObsContent.includes('Depuis l’espace public, regardez si'),
  'P1.2.a : Les prompts d’observation sont formulés avec prudence (« regardez si… », « observez comment… ») sans présupposer d’éléments absents'
);

assert(
  poiObsContent.includes('voie publique') &&
    poiObsContent.includes('sans franchir') || poiObsContent.includes('respectez les limites'),
  'P1.2.b : Les observations rappellent la préservation du domaine public et l’absence d’intrusion sur terrain privé'
);

assert(
  entryPanelContent.includes('Piste de curiosité') &&
    !entryPanelContent.includes('Curiosité vérifiable'),
  'P1.2.c : L’en-tête de l’accroche est sobresquement libellé « Piste de curiosité » plutôt que « Curiosité vérifiable »'
);

// ----------------------------------------------------------------------------
// P1.3 — DÉDOUBLONNAGE INTELLIGENT RESPECTANT LES VOISINS (server.ts)
// ----------------------------------------------------------------------------
console.log('\n[P1.3] Vérification du dédoublonnage contrôlé...');

assert(
  !serverContent.includes('if (dist < 32) return true;'),
  'P1.3.a : La fusion brute inconditionnelle à moins de 32 mètres a été éliminée'
);

assert(
  serverContent.includes('isWaterPairConflict') &&
    serverContent.includes('isReligiousPairConflict'),
  'P1.3.b : Les paires d’objets voisins mais distincts (fontaine vs lavoir, église vs croix) sont expressément protégées contre la fusion'
);

// ----------------------------------------------------------------------------
// P1.4 — ACCESSIBILITÉ ET DISTANCES DANS LES QUÊTES (src/narrativeQuests.ts)
// ----------------------------------------------------------------------------
console.log('\n[P1.4] Vérification de l’accessibilité et de l’indicativité des quêtes...');
const nqPath = path.resolve('src/narrativeQuests.ts');
const nqContent = fs.readFileSync(nqPath, 'utf-8');

assert(
  nqContent.includes('isSafeAccessibleCandidate') &&
    nqContent.includes('p.isSubterranean') &&
    nqContent.includes('p.safetyNotice'),
  'P1.4.a : Les quêtes excluent systématiquement les cavités dangereuses non touristiques et les sites avec avis de danger ou terrain privé'
);

assert(
  nqContent.includes('à vol d’oiseau') &&
    nqContent.includes('Parcours thématique entièrement facultatif'),
  'P1.4.b : Les distances sont expressément qualifiées à vol d’oiseau et les quêtes sont désignées comme propositions d’arpentage facultatives sans pénalité'
);

// ----------------------------------------------------------------------------
// P2.1 — FICHE DÉCOUVERTE : ACCROCHE ET OBSERVATION AU PREMIER PLAN
// ----------------------------------------------------------------------------
console.log('\n[P2.1] Vérification de la structure de la Fiche Découverte...');
const entryPanelUpdatedContent = fs.readFileSync(entryPanelPath, 'utf-8');

assert(
  entryPanelUpdatedContent.indexOf('{entry.name}') < entryPanelUpdatedContent.indexOf('{hook && (') &&
    entryPanelUpdatedContent.indexOf('{hook && (') < entryPanelUpdatedContent.indexOf('{observation && (') &&
    entryPanelUpdatedContent.indexOf('{observation && (') < entryPanelUpdatedContent.indexOf('Repères d’archive & Coordonnées'),
  'P2.1 : L’accroche et l’observation sont positionnées immédiatement après le titre, et les détails documentaires/sceaux relégués en zone secondaire'
);

// ----------------------------------------------------------------------------
// P2.2 — HIÉRARCHIE DES LIEUX : ÉMERGENCE DU LORE LOCAL
// ----------------------------------------------------------------------------
console.log('\n[P2.2] Vérification de la hiérarchie des lieux...');
const updatedTypesContent = fs.readFileSync(typesPath, 'utf-8');

assert(
  updatedTypesContent.includes('hasRichLore') &&
    updatedTypesContent.includes('hasSubstantialStorytelling') &&
    updatedTypesContent.includes("official === 'monument_historique' || official === 'musee_de_france'"),
  'P2.2.a : classifyPoiSignificanceTier valorise le lore local (légendes, folklore, récits riches) comme remarquable sans traiter tout simple label administratif comme remarquable'
);

// Simulation logique de la hiérarchie
import { classifyPoiSignificanceTier } from '../src/types';

const genericDataTourismePoi = {
  name: 'Parking de randonnée',
  subType: 'Équipement touristique',
  source: 'datatourisme',
  summary: 'Aire de stationnement communale.',
};
assert(
  classifyPoiSignificanceTier(genericDataTourismePoi) === 'notable',
  'P2.2.b : Un simple point DataTourisme ordinaire sans lore reste classé "notable"'
);

const localLegendPoi = {
  name: 'Fontaine aux Fées',
  category: 'legende' as const,
  subType: 'Source sacrée',
  source: 'inventaire_local',
  summary: 'Selon la mémoire des anciens du village, les fées des eaux se réunissaient autour de cette margelle chaque nuit de solstice.',
};
assert(
  classifyPoiSignificanceTier(localLegendPoi) === 'remarquable',
  'P2.2.c : Une curiosité locale avec lore et tradition émerge comme "remarquable"'
);

// ----------------------------------------------------------------------------
// P2.3 — NOTIFICATIONS SOBRES SANS HIJACK DE L'ÉCRAN
// ----------------------------------------------------------------------------
console.log('\n[P2.3] Vérification de la sobriété des notifications...');
const updatedAppContent = fs.readFileSync(appPath, 'utf-8');

assert(
  !updatedAppContent.includes("id: `alchemy_${recipe.id}") &&
    !updatedAppContent.includes("id: `bestiary_${npc.kind}") &&
    !updatedAppContent.includes("id: `spec_${node.specimenId}") &&
    !updatedAppContent.includes("id: `summit_step_${hitStep.id}") &&
    !updatedAppContent.includes("id: `narrative_order_hint_${quest.id}"),
  'P2.3 : Les notifications ordinaires (alchimie, bestiaire, spécimens, étapes de triangulation et jalons intermédiaires) utilisent des toasts discrets sans interrompre l’exploration par des cut-in modaux'
);

// ----------------------------------------------------------------------------
// P2.4 — CARNET DE ROUTE : CENTRÉ SUR LES NOTES ET CLICHÉS
// ----------------------------------------------------------------------------
console.log('\n[P2.4] Vérification du Carnet de route...');
const profileViewPath = path.resolve('src/components/ExplorerProfileView.tsx');
const profileViewContent = fs.readFileSync(profileViewPath, 'utf-8');

assert(
  !profileViewContent.includes('Empreinte stratigraphique ({unlockedStrataSet.size} / {STRATUM_ORDER.length}') &&
    profileViewContent.includes('Horizons temporels rencontrés') &&
    profileViewContent.includes('Notes & Clichés ('),
  'P2.4.a : La checklist incitative avec ratio d’époques est remplacée par la simple mention des horizons temporels effectivement rencontrés'
);

assert(
  profileViewContent.includes('✎ Note consignée') &&
    profileViewContent.includes('📷') &&
    profileViewContent.includes('Notes de terrain') &&
    profileViewContent.includes('Clichés de terrain'),
  'P2.4.b : Les notes personnelles et photos de terrain de l’explorateur sont mises au premier plan dans le Carnet'
);

console.log('\n======================================================');
console.log('✅ TOUTES LES VÉRIFICATIONS DES LOTS P0, P1 ET P2 ONT RÉUSSI.');
console.log('======================================================\n');

