# TERRA 16 — Note de consolidation GD / UX / intégrité
## Corrections et affinages après la première passe de sobriété

**Version :** 1.1 — 12 novembre 2026  
**Dépôt :** https://github.com/Kouboy/terra-16  
**Référence de comparaison :** commit `4ce1ffc7` (7 novembre) → `12579f38` (11 novembre)  
**Document de référence :** `Terra16_Feuille_de_route_GD_UX_v1.md` (7 novembre 2026)  
**Nature :** note de revue de code et de cadrage pour une intervention ciblée ; **pas** un audit d'exécution ni une refonte générale.  
**Statut :** propositions à vérifier et à valider dans l'application.

---

## 0. Instruction à l'agent

> **Mission :** consolider les modifications déjà apportées à Terra 16, corriger les incohérences repérées et affiner discrètement l'expérience. **Ne pas ajouter de nouvelles mécaniques**, ne pas supprimer les systèmes existants et ne pas entreprendre de réarchitecture sans justification et accord.
>
> **Ordre de travail :** confirmer les constats dans le code courant → traiter **P0** → exécuter des tests comportementaux → soumettre les résultats → seulement ensuite proposer **P1** et **P2**. Fournir des changements petits, traçables et réversibles.
>
> **Intention :** « Terra 16 doit donner envie d'explorer ce qu'il y a de merveilleux parfois à deux pas. » La carte et le réel restent au premier plan. Le jeu suggère, accompagne et sait se taire.

### Points réussis à préserver

- Nouvelle hiérarchie visuelle des marqueurs, particulièrement la discrétion des relevés techniques.
- Découvertes davantage tournées vers l'observation ; contenu encyclopédique dépliable.
- Récompenses de missions moins intrusives pendant les découvertes.
- PNJ moins nombreux et dialogues plus resserrés.
- Carnet et récapitulatif de promenade consultable **sans obligation de clôture**.
- Distinction naissante entre documents, hypothèses et légendes.
- Marche simulée conservée comme outil de préparation et de découverte de l'application.

---

## 1. P0 — Corrections prioritaires avant tests terrain

### P0.1 — Rendre les modes GPS réel et planificateur réellement exclusifs

**Fichier principal :** `src/App.tsx`.

**Constat de revue :** `watchPosition` reste actif indépendamment de `simulationMode`. Une mise à jour GPS peut donc repositionner l'explorateur pendant la préparation d'un itinéraire. Les changements de mode peuvent aussi mélanger des métriques de session.

**À faire :**

- [ ] Ne démarrer le suivi GPS continu qu'en mode **Balade GPS** et l'arrêter proprement à l'entrée en **Planificateur**.
- [ ] Écarter les callbacks GPS arrivés tardivement après un changement de mode.
- [ ] Réinitialiser les références de position utilisées pour calculer les pas et déverrouillages lors d'une transition de mode, afin de ne pas compter un saut géographique comme de la marche.
- [ ] Garder une demande de permission explicite et un état lisible en cas de refus ou de signal indisponible.
- [ ] Ne pas qualifier le GPS de preuve infalsifiable de marche physique : il permet un suivi, pas une certification antifraude.

**Validation :** en planificateur, les déplacements simulés ne sont pas écrasés par le GPS ; aucun point, XP, défi ou lieu n'est validé ; le retour au GPS ne crée pas de déplacement artificiel.

### P0.2 — Supprimer les chemins de progression réelle par les boutons de test

**Fichiers :** `src/App.tsx`, `src/components/WalkingChallengesView.tsx`.

**Constat de revue :** le callback `onSimulateWalkStep` ajoute encore les mètres de test à `walkedMeters` et à l'état des défis. Les boutons « +500 m test » / « +2,5 km test » peuvent donc contaminer une progression censée être réelle.

**À faire :**

- [ ] Supprimer ces boutons de l'interface de production **ou** les limiter à un mode de diagnostic isolé, non persistant et non synchronisé.
- [ ] Si le test demeure, écrire seulement dans des statistiques simulées distinctes ; jamais dans les défis, classements ou récompenses réels.
- [ ] Vérifier toutes les autres voies de progression : découverte, coffre, spécimen, mission, géocache, marche.

**Validation :** 2,5 km simulés ne changent ni `walkedMeters`, ni les défis compétitifs, ni les XP et récompenses de la vraie progression.

### P0.3 — Rendre le récapitulatif honnête sur le mode et les métriques

**Fichiers :** `src/components/WalkRecapModal.tsx`, `src/App.tsx`.

**Constat de revue :** `isSimulatedLocation` est transmis au composant mais n'est pas exploité ; le bandeau « Marche Réelle Vérifiée » apparaît inconditionnellement. `sessionMeters` peut également représenter des mouvements simulés.

**À faire :**

- [ ] Afficher « Parcours simulé / préparation » ou « Balade GPS » suivant **l'origine réelle des données de session**, et non un intitulé de certification.
- [ ] Séparer ou remettre à zéro les compteurs de session au changement de mode ; éviter les sorties hybrides ambiguës.
- [ ] Présenter le temps calculé par distance / vitesse moyenne comme **estimation**, jamais comme durée mesurée.
- [ ] Préserver le bilan non intrusif et l'idée qu'une promenade sans POI reste enrichissante.

**Validation :** le récapitulatif n'attribue jamais un label GPS à une sortie simulée ou mixte.

### P0.4 — Sécuriser les fonctions communautaires Supabase

**Fichiers :** `supabase_schema.sql`, `src/supabase.ts`.

**Constat de revue :** les politiques RLS de mise à jour ont été resserrées, ce qui est positif. Cependant les RPC `increment_cairn_upvote` et `record_geocache_log` utilisent `SECURITY DEFINER` sans contrôle explicite de `auth.uid()` ; la seconde accepte un identifiant de joueur fourni par le client. Vérifier également les droits `EXECUTE` effectifs, **sur la base déployée**.

**À faire :**

- [ ] Vérifier l'identité authentifiée **dans les fonctions SQL** ; refuser les appels anonymes non autorisés.
- [ ] Ne jamais faire confiance à un `finder_id` fourni par le client : le déduire de `auth.uid()` ou vérifier impérativement son égalité.
- [ ] Restreindre explicitement les droits d'exécution aux rôles nécessaires ; fixer un `search_path` sûr et qualifier les objets SQL.
- [ ] Prévenir votes et signatures multiples abusives (unicité/idempotence, contrôles serveur, limitation raisonnable).
- [ ] Tester les permissions sur une base de test, puis vérifier que les migrations ont été appliquées en production.

**Validation :** un appel anonyme ou une tentative d'usurpation échoue ; l'utilisateur légitime peut agir ; aucune modification d'un enregistrement tiers n'est possible par contournement.

---

## 2. P1 — Affinages éditoriaux et cohérence de l'exploration

### P1.1 — Éviter que « fait documenté » devienne la catégorie par défaut

**Fichiers :** `src/types.ts`, `server.ts`, `src/components/EntryDetailPanel.tsx`.

**Constat :** les fonctions de classification retournent « Fait documenté » lorsqu'elles ne trouvent ni indice de légende ni formule d'hypothèse. Ce raisonnement par défaut ne démontre pas la qualité d'une source.

- [ ] Introduire un état **« Information à confirmer »** (ou équivalent neutre) lorsque la provenance ne permet pas une qualification ferme.
- [ ] Réserver « Fait documenté » à un élément effectivement rattachable à une source identifiée et pertinente pour l'affirmation affichée.
- [ ] Conserver la distinction entre **existence du lieu**, **interprétation historique**, **légende locale** et **fiction ludique** ; un même lieu peut mêler ces niveaux.
- [ ] Dans les rapprochements multi-sources, ne pas transformer automatiquement une source fiable sur un aspect en caution pour tout le résumé.

**Validation :** plusieurs fiches ambiguës ou procédurales n'affichent plus un label de certitude excessif ; la source est consultable lorsqu'elle existe.

### P1.2 — Assouplir les invitations à observer

**Fichiers :** `src/poiObservation.ts`, `src/components/EntryDetailPanel.tsx`.

**Constat :** certains prompts associés à des catégories présupposent des éléments absents (avant-becs d'un pont, margelle de pierre, cupules, médaillon IGN, etc.). La première phrase d'un résumé devient parfois « Curiosité vérifiable » par simple extraction.

- [ ] Préférer **« regardez si… »**, **« observez comment… »**, **« cherchez d'éventuelles traces de… »** aux affirmations trop spécifiques non confirmées.
- [ ] N'utiliser une accroche factuelle affirmative que si la donnée est réellement rattachée à la source ; sinon, présenter une **piste de curiosité**, pas une vérification acquise.
- [ ] Accepter de **ne pas afficher de suggestion** lorsqu'aucune observation crédible et sûre n'est disponible.
- [ ] Préserver la possibilité d'observer depuis l'espace public, sans franchissement, prélèvement ni intrusion.

**Validation :** des ponts récents, des édifices atypiques et des sites naturels ne reçoivent pas d'instructions factuellement inadaptées.

### P1.3 — Contrôler les dédoublonnages trop agressifs

**Fichier :** `server.ts`, fonction `enrichAndLinkPois`.

**Constat :** les points séparés de moins de 32 mètres sont fusionnés sans contrôle d'identité. Deux objets patrimoniaux distincts peuvent pourtant être voisins (fontaine et lavoir, église et croix, etc.).

- [ ] Exiger davantage qu'une proximité brute : identité stable, nom comparable, type compatible ou autre preuve de correspondance.
- [ ] Préserver la consolidation des doublons avérés et éviter les répétitions visuelles sur les zones denses.
- [ ] Tester des paires **doublon réel / deux lieux différents mais voisins**.

**Validation :** les vrais doublons disparaissent et les curiosités proches mais distinctes restent consultables.

### P1.4 — Éviter de confondre proximité et accessibilité dans les quêtes

**Fichiers :** `src/narrativeQuests.ts`, éventuellement `src/roadLoopPlanner.ts`.

**Constat :** le générateur améliore la cohérence thématique et impose des distances à vol d'oiseau ; celles-ci ne démontrent pas qu'un trajet piéton est praticable.

- [ ] Quand la donnée est disponible, valider les étapes contre le graphe de chemins accessibles ou écarter les liaisons douteuses.
- [ ] Ne jamais encourager l'entrée dans un espace privé, une cavité dangereuse ou une zone naturelle sensible.
- [ ] Si l'accessibilité n'est pas établie, parler de **distance approximative**, sans promettre un parcours praticable.
- [ ] Garder les quêtes **facultatives** et ne pas générer artificiellement trois actes quand les lieux ne s'y prêtent pas.

**Validation :** trois secteurs contrastés ne produisent pas d'itinéraires manifestement inaccessibles ; abandonner une quête n'entraîne aucune pénalité.

---

## 3. P2 — Dernière passe de sobriété (après validation des P0/P1)

**Ne pas considérer ces éléments comme des bugs : ce sont des hypothèses UX à confronter au terrain.**

- [ ] **Fiche découverte :** positionner l'accroche et l'observation juste après le titre ; reléguer les coordonnées, sceaux et détails documentaires dans une zone secondaire, sans les supprimer.
- [ ] **Hiérarchie des lieux :** ne pas assimiler automatiquement « remarquable » à « monument classé ». Une petite curiosité locale bien racontée doit pouvoir émerger.
- [ ] **Notifications :** recenser les `setCutIn` et toasts qui interrompent encore l'exploration ; rendre les récompenses ordinaires discrètes, regrouper les résultats secondaires dans le Carnet.
- [ ] **Carnet :** privilégier ce que l'explorateur a vu, noté ou photographié ; aucune incitation à remplir des cases pour le simple taux de complétion.
- [ ] **Silence :** maintenir des moments sans marqueur, PNJ ou sollicitation. L'absence de notification n'est pas un manque de contenu.

**Validation :** la personne peut marcher et observer sans consulter constamment l'écran ; toutes les fonctions avancées restent accessibles volontairement.

---

## 4. Vérification et livrables attendus

### Tests automatisés

Le nouveau `scripts/test-integrity-and-security.ts` vérifie essentiellement la présence de fragments de code. **Le conserver comme garde-fou statique, sans le confondre avec des tests comportementaux.**

- [ ] Ajouter des tests qui exercent réellement la transition GPS ↔ simulation, les compteurs et les déclenchements de récompenses.
- [ ] Tester les trois états documentaires et la catégorie « à confirmer ».
- [ ] Tester les rapprochements de points voisins et les invitations à observer.
- [ ] Tester les RPC sur une base de test avec utilisateurs distincts et rôle anonyme.
- [ ] Exécuter `npm run lint`, `npm run build` et les tests disponibles ; documenter les résultats et limites.

### Tests terrain à réaliser ensuite

1. **Quartier familier :** au moins une vraie curiosité jusque-là inaperçue ?
2. **Zone riche en POI :** la carte et les fiches restent-elles lisibles sans avalanche de récompenses ?
3. **Secteur rural pauvre en données :** l'expérience reste-t-elle agréable sans ajout artificiel de quêtes ou d'objets ?

Observer notamment : temps passé à regarder l'écran, découvertes réellement mémorables, suggestions inadaptées, interruptions inutiles, écarts d'itinéraire et qualité du Carnet.

### Format de restitution de l'agent

Pour **chaque lot** :

- **Constat confirmé / infirmé**, avec preuve ou exemple reproductible.
- **Fichiers touchés** et résumé des changements.
- **Critères d'acceptation vérifiés** et tests exécutés (ou non exécutables, avec raison).
- **Capture avant/après** pour toute modification de présentation.
- **Risques résiduels et décision à prendre**, puis demande de validation avant le lot suivant.

**Ne pas annoncer une réussite terrain sur la seule base d'un test TypeScript ou d'une capture d'écran.**

---

## 5. Critère de décision final

> **Cette modification aide-t-elle le joueur à remarquer, comprendre ou se souvenir d'un lieu réel ?**
>
> Si non, elle doit probablement rester facultative, silencieuse ou ne pas être développée.

**Objectif final :** un jeu qui réussit au moment où l'explorateur relève les yeux de son téléphone.
