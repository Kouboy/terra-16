# TERRA 16 — Feuille de route GD / UX
## Retrouver le merveilleux à deux pas de chez soi

**Version :** 1.0 · 7 novembre 2026  
**Projet :** [Kouboy/terra-16](https://github.com/Kouboy/terra-16)  
**Nature :** cadrage de game design et d’expérience utilisateur, prêt à transmettre à un agent de développement.  
**Statut :** proposition à valider en jeu, **pas** une demande de refonte globale.

---

## 0. Brief opérationnel à l’agent

> **Mission :** simplifier et affiner Terra 16 pour qu’il donne envie d’explorer les curiosités réelles situées parfois à quelques pas de chez soi. Le territoire est le protagoniste ; le jeu révèle, suggère, accompagne et sait se taire.
>
> **Règle absolue :** privilégier le **retrait, la hiérarchisation et la réutilisation** de systèmes existants. Ne pas supprimer des fonctionnalités achevées ni engager de réarchitecture lourde pour obtenir une interface plus calme.
>
> **Méthode :** procéder par petits lots réversibles, conserver les comportements antérieurs derrière des paramètres si nécessaire, documenter ce qui change, montrer des captures et proposer un test concret avant de poursuivre.
>
> **Première demande :** commencer uniquement par **Lot 0 (état des lieux)**, puis proposer l’implémentation du **Lot 1 (sobriété de l’interface)**. Les lots suivants demandent une validation distincte.

### Intention non négociable

**Terra 16 ne doit pas motiver le joueur à marcher pour gagner des XP ; il doit lui donner envie d’aller voir ce qu’il pourrait manquer dans son voisinage.**

Une découverte réussie se mesure à la curiosité qu’elle provoque et à ce qu’elle laisse dans la mémoire, pas au nombre de notifications déclenchées.

### Ce que Terra 16 doit continuer à être

- Une **carte 16-bit du territoire réel**, qui reste plaisante à regarder.
- Un outil de **curiosité géographique, patrimoniale, naturelle et culturelle**.
- Un **carnet personnel** de lieux explorés, d’observations et de souvenirs.
- Une aventure **facultative et accueillante**, sans pression quotidienne ni compétition obligatoire.
- Une expérience pouvant se tester en **marche simulée** avant d’être pratiquée sur le terrain.

### Ce que Terra 16 ne cherche pas à devenir

- Une application de productivité de la marche, remplie d’objectifs à cocher.
- Un jeu-service qui utilise l’urgence, les séries quotidiennes ou la peur de rater quelque chose.
- Un inventaire exhaustif d’icônes géographiques à vider.
- Un guide prétendant que toutes ses hypothèses et ses légendes sont des faits établis.

---

## 1. Les principes d’expérience

**Boucle centrale :** marcher → remarquer → s’intriguer → observer → comprendre → conserver.

1. **Le monde d’abord.** La carte et le paysage réel ne doivent pas être étouffés par les couches d’interface.
2. **Une invitation, pas une injonction.** On peut ignorer un lieu, modifier son itinéraire ou simplement se promener sans sanction.
3. **La surprise plutôt que l’abondance.** Un détail local singulier vaut mieux qu’une succession de découvertes interchangeables.
4. **La récompense se fait discrète.** Les XP et les guildes restent en coulisse, sans monopoliser l’attention.
5. **La fiction est assumée.** Les objets magiques et les récits imaginés enrichissent le monde sans se déguiser en histoire attestée.
6. **Le carnet est l’aboutissement.** Une promenade doit laisser un récit personnel, pas seulement un compteur.
7. **Le silence fait partie du rythme.** Une séquence sans sollicitation n’est pas un vide à combler.

---

## 2. Feuille de route priorisée

### LOT 0 — Établir une référence avant modification

**Priorité : P0 · Nature : observation · Risque : très faible**

**Objectif :** vérifier les irritants réellement visibles, sans présumer que chaque système présent dans le code dérange le joueur.

- [ ] Capturer l’état actuel de la carte, du panneau de découverte, des missions, du Carnet et des notifications sur **mobile**.
- [ ] Relever quels événements provoquent une notification, un effet de récompense ou un changement de panneau.
- [ ] Relever la quantité de marqueurs visibles à différents zooms et dans un secteur dense / peu dense.
- [ ] Parcourir une session simulée de 15–20 minutes ; noter les sollicitations et leurs enchaînements.
- [ ] Faire ultérieurement au moins deux essais réels, dont une promenade connue et un quartier moins familier.
- [ ] Lister les options de présentation déjà disponibles, afin de réutiliser l’existant.

**Livrable :** une courte note « Avant », 5 à 10 captures et les 5 irritants les plus gênants, classés par impact. **Aucun changement de code exigé à ce stade.**

**Critère de sortie :** pouvoir décrire précisément ce qui gêne l’attention sur le terrain.

### LOT 1 — Une carte qui respire

**Priorité : P1 · Nature : UX / présentation · Réversible**

**Objectif :** ouvrir Terra 16 et comprendre immédiatement où l’on se trouve, sans être submergé.

- [ ] Faire de la **Carte** l’entrée naturelle et du **Carnet** le deuxième pilier visible.
- [ ] Conserver Missions / Guildes / Profil, mais réduire leur saillance initiale plutôt que les supprimer.
- [ ] Introduire une hiérarchie visuelle des marqueurs : curiosités suggérées, autres découvertes possibles, éléments secondaires.
- [ ] Donner la priorité aux lieux **proches, singuliers et bien documentés** ; laisser les autres accessibles en exploration libre ou via filtres.
- [ ] Réduire les répétitions de marqueurs équivalents et les libellés concurrents sur les zones denses.
- [ ] Vérifier que l’animation, les paysages 16-bit, les biomes et les variations météo restent lisibles.
- [ ] Garder les indicateurs utiles au déplacement accessibles rapidement, sans surcharge permanente.

**Ne pas faire :** supprimer des catégories, désactiver la cartographie riche, cacher arbitrairement des points accessibles sans laisser de moyen de les retrouver.

**Critères d’acceptation :**

- Un nouvel utilisateur peut identifier sa position et une curiosité à explorer sans ouvrir une page de tutoriel.
- Une zone très documentée ne devient pas illisible à l’échelle d’une promenade.
- Une zone peu dense reste intéressante et ne paraît pas artificiellement vide.
- Le comportement d’exploration libre reste intact.

### LOT 2 — Repenser le moment de découverte

**Priorité : P1 · Nature : GD / rédaction / UX · Réversible**

**Objectif :** transformer le déverrouillage d’un POI en **invitation à regarder autour de soi**.

Proposition de hiérarchie de lecture pour la fiche :

1. **Nom du lieu** + nature de la curiosité.
2. **Une accroche courte, spécifique et vérifiable** lorsque la source le permet : « Saviez-vous que… ? » sans sensationnalisme fabriqué.
3. **Une invitation douce à observer** un détail accessible et non dangereux. Si aucun détail pertinent n’est connu, ne pas en inventer.
4. **En savoir plus** : contexte, sources et informations documentaires.
5. **Ajouter au Carnet** : photo, note, souvenir, facultatifs.
6. **XP / progression de guilde** : intégrés discrètement, sans dominer l’écran.

- [ ] Limiter les interruptions visuelles lors des découvertes ordinaires.
- [ ] Préserver une célébration un peu plus marquée pour les trouvailles **véritablement exceptionnelles**.
- [ ] Ne pas obliger le joueur à prendre une photo ou saisir un commentaire pour « terminer » la découverte.
- [ ] Prévoir une présentation agréable quand la documentation manque : **moins de texte**, pas de remplissage narratif automatique.

**Critères d’acceptation :** la première lecture indique *pourquoi ce lieu mérite un regard* ; la progression chiffrée est secondaire ; la fiche peut être refermée instantanément.

### LOT 3 — Une sélection éditoriale, pas un déluge procédural

**Priorité : P2 · Nature : contenu / qualité des données**

**Objectif :** que la valeur moyenne des suggestions augmente, même si leur quantité visible diminue.

- [ ] Classer les points d’intérêt selon la **richesse de la source, la singularité locale, l’accessibilité estimée, la proximité et la diversité thématique**.
- [ ] Éviter de proposer simultanément plusieurs points quasi identiques ou plusieurs formulations du même fait.
- [ ] Identifier visuellement ou textuellement : **fait documenté**, **hypothèse / reconstitution**, **fiction ludique / légende racontée**.
- [ ] Conserver les liens vers les sources d’origine ; éviter qu’une phrase procédurale soit présentée comme un témoignage historique.
- [ ] Faire des vérifications ciblées sur les propositions botaniques, géologiques et historiques les plus étonnantes.
- [ ] Préférer « pas assez d’informations pour raconter davantage » à une généralité enjolivée.

**Note :** la génération de spécimens à partir du biome et de la lithologie peut représenter des **présences plausibles**, pas des observations réalisées in situ. Ne pas confondre les deux statuts.

**Critères d’acceptation :** dans des secteurs tests contrastés, les suggestions sont variées, sourcées quand elles énoncent des faits, et ne créent pas de fausses certitudes.

### LOT 4 — Quêtes et PNJ à faible intensité

**Priorité : P2 · Nature : rythme / règles de déclenchement**

**Objectif :** que les systèmes RPG enrichissent la promenade *quand ils ont quelque chose à apporter*.

- [ ] Conserver les quêtes, contrats, énigmes, PNJ, guildes, collections et familiers existants.
- [ ] Limiter les sollicitations spontanées et permettre de consulter les activités volontaires depuis leurs sections.
- [ ] Proposer une quête en plusieurs étapes uniquement si les lieux forment une séquence **assez proche, accessible et thématiquement pertinente**.
- [ ] Ne pas présenter une association de lieux calculée par algorithme comme un lien historique attesté.
- [ ] Écrire les PNJ comme des **passeurs de curiosité** : un détail local, une rumeur attribuée, une piste facultative ; moins de discours encyclopédiques.
- [ ] Garder les défis journaliers / hebdomadaires en option ; éviter toute conséquence négative à ne pas jouer.
- [ ] Ne pas multiplier les coffres ou trésors pour compenser artificiellement une zone pauvre en documentation.

**Critère d’acceptation :** il est plaisant de jouer 20 minutes **sans activer aucune quête**, et une quête choisie apporte une vraie valeur ajoutée.

### LOT 5 — Valoriser le Carnet et la fin de promenade

**Priorité : P2 · Nature : expérience longue / personnalisation**

**Objectif :** faire sentir que l’explorateur compose au fil du temps **son propre atlas du territoire**.

- [ ] Donner de la place aux photos, observations personnelles, dates et lieux réellement visités.
- [ ] Afficher simplement les découvertes d’une sortie sans exiger un bilan de fin de session.
- [ ] Proposer un petit récapitulatif **consultable à la demande** : lieux, distance si pertinente, notes, images.
- [ ] Autoriser une promenade « sans rien trouver » à conserver une valeur : trajet, souvenir, ou simple absence de résultat.
- [ ] Éviter les récompenses multiples pour une même action (découverte + mission + collection + palier + badge simultanés).

**Critère d’acceptation :** relire le Carnet donne envie de se souvenir de l’endroit, pas seulement du niveau atteint.

---

## 3. Chantiers transversaux à vérifier avant une bêta publique

Ces points sont distincts de la passe de sobriété UX. **Les examiner, ne pas les mélanger aux lots d’interface.**

### A. Marche réelle et marche simulée

Le mode simulé est précieux pour tester et visiter des lieux à distance. Il semble cependant partager une partie de la logique de déplacement, des découvertes et des compteurs de distance avec le GPS réel (`src/App.tsx`).

- [ ] Auditer les statistiques et récompenses obtenues en simulation.
- [ ] **Séparer les métriques et les classements liés à la marche réelle** de la progression ludique simulée.
- [ ] Conserver la simulation comme outil de découverte et de test, sans la traiter comme une fraude en soi.
- [ ] Clarifier dans l’interface quel mode est actif.

### B. Sécurité et respect des lieux

- [ ] Ne jamais inciter à pénétrer dans un souterrain, une friche, un terrain privé ou un milieu naturel fragile pour débloquer une récompense.
- [ ] Prévoir une découverte depuis un point public et sûr lorsqu’un site est inaccessible ou dangereux.
- [ ] Signaler le caractère indicatif du tracé GPS et des chemins issus des données cartographiques.
- [ ] Vérifier les suggestions de boucles à pied sur des zones où certains chemins ne sont pas praticables.

### C. Données personnelles et sécurité communautaire

Le fichier `supabase_schema.sql` contient notamment des politiques de mise à jour `cairns_update_upvote` et `geocaches_update_finder` avec `using (true)`. **Cela mérite un audit ciblé** : les restrictions exactes dépendent aussi des privilèges, des colonnes et du code exécuté, donc ne pas conclure à une exploitation démontrée sur cette seule lecture.

- [ ] Vérifier les droits de modification réels, le contrôle d’identité et les champs modifiables.
- [ ] Vérifier quelles coordonnées précises ou données de profil sont publiées aux autres joueurs.
- [ ] Ajuster si nécessaire les politiques ou les opérations serveur pour limiter les modifications aux actions autorisées.

### D. Maintenance sans refonte totale

Certains fichiers centraux sont très volumineux (`src/App.tsx`, `src/components/PixelMapCanvas.tsx`, `server.ts`).

- [ ] Pour chaque lot, isoler les règles de présentation modifiées lorsque c’est simple.
- [ ] Ajouter quelques tests ciblés sur les décisions de filtrage, les déverrouillages, les modes simulé/réel et les permissions concernées.
- [ ] **Ne pas lancer une réécriture générale** sous prétexte de simplifier l’expérience.

---

## 4. Protocole de test léger

Tester après chaque lot, idéalement sur téléphone, dans trois contextes :

| Situation | Question à résoudre | Signal positif |
|---|---|---|
| Quartier connu | Le jeu me fait-il voir autrement un endroit familier ? | Au moins une curiosité retenue ou un détail observé |
| Secteur riche en patrimoine | Suis-je submergé de marqueurs, textes ou récompenses ? | Carte lisible et choix spontanés |
| Zone rurale peu documentée | Le jeu reste-t-il agréable sans beaucoup de POI ? | Promenade plaisante sans contenu inventé pour remplir |

**Pendant chaque essai :** noter les moments où l’utilisateur sort son téléphone, ce qui lui donne envie de regarder autour de lui, les écrans qu’il ferme machinalement et les interruptions qu’il aurait volontiers évitées.

### Questions de validation

- [ ] Comprend-on en moins de quelques instants ce qu’il y a d’intéressant autour de soi ?
- [ ] Le jeu respecte-t-il le droit de ne pas consulter son écran en permanence ?
- [ ] Les découvertes racontent-elles quelque chose de précis et pertinent ?
- [ ] Le joueur comprend-il ce qui est réel, probable, folklorique ou fictif ?
- [ ] Une promenade sans quête est-elle satisfaisante ?
- [ ] Le Carnet restitue-t-il le souvenir des lieux ?
- [ ] Les usages simulés et GPS restent-ils cohérents et distincts lorsqu’il le faut ?

**Critère d’arrêt :** si un lot ne produit pas d’amélioration observable de la promenade, le simplifier ou revenir en arrière plutôt que construire un deuxième système pour corriger le premier.

---

## 5. Ordre de livraison recommandé

| Vague | Contenu | Décision après livraison |
|---|---|---|
| **V0** | Lot 0 : état des lieux, captures, irritants | Valider les vrais problèmes |
| **V1** | Lot 1 : hiérarchie des marqueurs et baisse des sollicitations | Tester la lisibilité sur mobile |
| **V2** | Lot 2 : fiche de découverte plus curieuse et moins bruyante | Tester la qualité du moment de découverte |
| **V3** | Lot 3 : tri qualitatif, redondances, statut des sources | Tester les secteurs denses et ruraux |
| **V4** | Lots 4 et 5 : quêtes/PNJ discrets, Carnet valorisé | Tester une promenade complète |
| **Transversal** | Vérifications sécurité / simulation / confidentialité / tests | Traiter avant ouverture publique selon gravité |

Les vagues ne sont **pas** des dates ni des engagements de durée. Une vague peut être réduite, différée ou abandonnée si les tests ne montrent aucun bénéfice.

---

## 6. Périmètre technique existant à privilégier

Les chemins suivants sont des **points d’entrée repérés dans le dépôt**, pas une prescription de modifier tous ces fichiers :

| Sujet | Points d’entrée |
|---|---|
| Carte, onglets, GPS, événements, progression | [`src/App.tsx`](https://github.com/Kouboy/terra-16/blob/main/src/App.tsx) |
| Rendu 16-bit et marqueurs | [`src/components/PixelMapCanvas.tsx`](https://github.com/Kouboy/terra-16/blob/main/src/components/PixelMapCanvas.tsx) |
| Fiches de découverte, Carnet | [`src/components/EntryDetailPanel.tsx`](https://github.com/Kouboy/terra-16/blob/main/src/components/EntryDetailPanel.tsx) |
| Quêtes narratives | [`src/narrativeQuests.ts`](https://github.com/Kouboy/terra-16/blob/main/src/narrativeQuests.ts) |
| PNJ et dialogues | [`src/npcs.ts`](https://github.com/Kouboy/terra-16/blob/main/src/npcs.ts) |
| Boucles de promenade | [`src/roadLoopPlanner.ts`](https://github.com/Kouboy/terra-16/blob/main/src/roadLoopPlanner.ts) |
| Spécimens et biomes | [`src/specimens.ts`](https://github.com/Kouboy/terra-16/blob/main/src/specimens.ts) |
| Sources géographiques / API | [`server.ts`](https://github.com/Kouboy/terra-16/blob/main/server.ts) |
| Progression communautaire et cloud | [`src/supabase.ts`](https://github.com/Kouboy/terra-16/blob/main/src/supabase.ts), [`supabase_schema.sql`](https://github.com/Kouboy/terra-16/blob/main/supabase_schema.sql) |

### Format attendu des retours de l’agent

Pour chaque lot, fournir **une réponse courte**, structurée ainsi :

1. **Constat** : ce qui gêne actuellement, avec preuve ou capture.
2. **Changement minimal** : comportement proposé, fichiers touchés, impact sur l’existant.
3. **Vérification** : test reproduisible et résultat observé.
4. **Risques / retour arrière** : point de vigilance et méthode pour revenir à l’état antérieur.
5. **Décision** : `VALIDER`, `AJUSTER` ou `ABANDONNER`.

**Interdits :** ajout de nouvelles méta-boucles de récompense, suppression massive de contenu, refonte de l’architecture, migration des données ou nouveaux services externes sans validation explicite.

---

## 7. Boussole finale

> **La réussite de Terra 16, c’est le moment où le joueur range son téléphone pour regarder quelque chose qu’il n’aurait jamais remarqué autrement.**

Chaque évolution doit répondre à une question :

**« Est-ce que cela enrichit la relation entre l’explorateur et le lieu ? »**

Si non, simplifier, déplacer en arrière-plan ou ne rien ajouter.

*Document de cadrage proposé après lecture du code du dépôt. Les diagnostics de comportement et de sécurité restent à vérifier en exécution ; les critères de qualité doivent être confirmés par des promenades réelles.*
