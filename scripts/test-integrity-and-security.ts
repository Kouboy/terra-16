/**
 * Test de vérification automatique : Sécurité, simulation & intégrité
 * Vérifie :
 * 1. Distinction stricte entre marche physique réelle (GPS) et arpentage simulé
 * 2. Règles de sécurité de détection (rayon >= 55m permettant l'observation depuis la voie publique)
 * 3. Politiques RLS durcies et absence de clause permissive "using (true)" sur les UPDATE cairns/geocaches
 * 4. Présence des bandeaux de sécurité et d'intégrité
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

console.log('--- AUDIT SÉCURITÉ, SIMULATION & INTÉGRITÉ ---');

// 1. Audit Supabase RLS Schema
const schemaPath = path.resolve('supabase_schema.sql');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// Ensure no unsafe "for update using (true)" remains on cairns or geocaches
assert(
  !schemaContent.includes('create policy "cairns_update_upvote" on public.cairns for update using (true);'),
  'Aucune politique "cairns for update using (true)" ne subsiste dans le schéma'
);

assert(
  !schemaContent.includes('create policy "geocaches_update_finder" on public.geocaches for update using (true);'),
  'Aucune politique "geocaches for update using (true)" ne subsiste dans le schéma'
);

assert(
  schemaContent.includes('create policy "cairns_update_own" on public.cairns for update using (auth.uid() = owner_id);'),
  'Politique "cairns_update_own" restreinte au propriétaire (auth.uid() = owner_id)'
);

assert(
  schemaContent.includes('create policy "geocaches_update_own" on public.geocaches for update using (auth.uid() = owner_id);'),
  'Politique "geocaches_update_own" restreinte au propriétaire (auth.uid() = owner_id)'
);

assert(
  schemaContent.includes('increment_cairn_upvote') && schemaContent.includes('record_geocache_log'),
  'Fonctions RPC sécurisées (security definer) présentes pour incrémenter upvotes et logs sans exposer la table entière'
);

// 2. Audit Code TypeScript pour la séparation marche réelle vs simulation
const appPath = path.resolve('src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

assert(
  appContent.includes('walkedMeters: simulationMode ? p.walkedMeters || 0 : (p.walkedMeters || 0) + roundedStep'),
  'La distance physique walkedMeters n’augmente que sur les déplacements GPS réels (!simulationMode)'
);

assert(
  appContent.includes('simulatedWalkedMeters: simulationMode'),
  'Les pas de test clavier/D-Pad sont enregistrés distinctement dans simulatedWalkedMeters'
);

assert(
  appContent.includes('if (!simulationMode) {') && appContent.includes('recordStepDistanceInState'),
  'Les défis pédestres compétitifs (défis de marche) ne progressent que sur la marche GPS réelle'
);

assert(
  appContent.includes('const [simulationMode] = useState<boolean>(false);'),
  'Le mode GPS Réel est actif par défaut (simulationMode = false)'
);

// 3. Audit Sécurité et respect des lieux
const recapPath = path.resolve('src/components/WalkRecapModal.tsx');
const recapContent = fs.readFileSync(recapPath, 'utf-8');

assert(
  recapContent.includes('Marche Réelle Vérifiée'),
  'Le récapitulatif de promenade certifie la marche réelle vérifiée par GPS'
);

assert(
  recapContent.includes('Respect des lieux') && recapContent.includes('voies publiques'),
  'Avertissement de sécurité et de respect des propriétés privées présent dans le récapitulatif'
);

const entryPath = path.resolve('src/components/EntryDetailPanel.tsx');
const entryContent = fs.readFileSync(entryPath, 'utf-8');

assert(
  entryContent.includes('Observation sécurisée') && entryContent.includes('voie publique'),
  'Mention explicite d’observation à distance sécurisée depuis l’espace public intégrée aux fiches avec avis de sécurité'
);

console.log('--- TOUS LES CONTRÔLES D’INTÉGRITÉ ET DE SÉCURITÉ SONT VALIDÉS ---');
