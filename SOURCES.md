# 🗺️ Sources de Données & Open Data — Terra-16

> **Terra-16** est un jeu de rôle d'exploration géolocalisée (JRPG 16-bit) ancré dans le monde réel.  
> L'intégralité des découvertes, de la topographie, du patrimoine et des données scientifiques provient de **bases de données publiques ouvertes**, sans aucune dépendance à des API cartographiques propriétaires et payantes (pas de Google Maps API, pas de clés fermées).

---

## 📑 Sommaire

1. [Cartographie Vectorielle & Modèle Numérique de Terrain (MNT)](#1-cartographie-vectorielle--modèle-numérique-de-terrain-mnt)
2. [Patrimoine Historique, Monuments & Culture](#2-patrimoine-historique-monuments--culture)
3. [Encyclopédie, Folklore & Mémoire Territoriale](#3-encyclopédie-folklore--mémoire-territoriale)
4. [Géologie, Paléontologie & Sous-Sol](#4-géologie-paléontologie--sous-sol)
5. [Biodiversité & Espaces Naturels](#5-biodiversité--espaces-naturels)
6. [Hydrographie & Eau](#6-hydrographie--eau)
7. [Archéologie, Voies Oubliées & Mémoire Industrielle](#7-archéologie-voies-oubliées--mémoire-industrielle)
8. [Météo, Éphémérides & Référentiel Administratif](#8-météo-éphémérides--référentiel-administratif)
9. [Attributions & Licences](#9-attributions--licences)

---

## 1. Cartographie Vectorielle & Modèle Numérique de Terrain (MNT)

| Source | Organisme / Projet | Accès / API | Format | Rôle dans Terra-16 | Licence |
|---|---|---|---|---|---|
| **OpenFreeMap & Protomaps** | Communauté OpenFreeMap & Brandon Liu | `https://tiles.openfreemap.org/planet` | Tuiles MVT / Planet PBF | Rendu cartographique vectoriel 16-bit (rues, chemins, bâtiments, parcs, voies ferrées, forêts). | ODbL / MIT |
| **OpenStreetMap (OSM)** | Fondation OpenStreetMap | Protocole vectoriel OSM via tuiles CARTO / OpenFreeMap | GeoJSON / MVT | Topologie du monde réel, réseau viaire et sentiers de randonnée. | ODbL |
| **IGN RGE ALTI** | Institut National de l’Information Géographique et Forestière (IGN) | `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json` | API REST JSON | Altitude NGF centimétrique, profil d'élévation et dénivelé des randonnées. | Licence Ouverte v2.0 (Etalab) |
| **AWS S3 Elevation Tiles (Terrarium)** | Mapzen / Amazon Open Data | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | Tuiles RGB PNG (Z14 ~6.5m) | Shading de relief, courbes de niveau et modèle de terrain continu. | CC0 / ODbL |
| **OSM Nominatim** | Projet OpenStreetMap | `https://nominatim.openstreetmap.org/` | API REST JSON | Géocodage direct (recherche de lieu) et géocodage inverse (identification de contrée). | ODbL |

---

## 2. Patrimoine Historique, Monuments & Culture

| Source | Organisme / Projet | Accès / API | Format | Rôle dans Terra-16 | Licence |
|---|---|---|---|---|---|
| **Base Mérimée** | Ministère de la Culture (Plateforme Ouverte du Patrimoine - POP) | `https://pop.culture.gouv.fr/notice/merimee/` via Wikidata & SPARQL | JSON / LOD | Monuments Historiques classés et inscrits (châteaux, remparts, cathédrales, abbayes, mégalithes, édifices civils). | Licence Ouverte v2.0 |
| **Base Palissy** | Ministère de la Culture (POP) | `https://pop.culture.gouv.fr/notice/palissy/` via Wikidata & data.gouv.fr | JSON / LOD | Mobilier historique remarquable (retables, reliquaires, cloches anciennes, vitraux classés). | Licence Ouverte v2.0 |
| **Maisons des Illustres** | Ministère de la Culture | API Tabulaire data.gouv.fr / Wikidata | JSON / CSV | Lieux de mémoire des écrivains, artistes, savants et scientifiques ayant marqué l'histoire. | Licence Ouverte v2.0 |
| **Muséofile** | Ministère de la Culture | API data.gouv.fr / Wikidata | JSON / CSV | Répertoire officiel des Musées de France. | Licence Ouverte v2.0 |
| **Jardins Remarquables** | Ministère de la Culture / Comité des Parcs et Jardins | API Tabulaire data.gouv.fr | JSON / CSV | Parcs historiques, jardins botaniques et arboretums labellisés. | Licence Ouverte v2.0 |
| **Panorama des Festivals** | Ministère de la Culture | Dataset `5b51825fa3a72936dfe1c340` (data.gouv.fr) | API Tabulaire data.gouv.fr | Événements culturels et festivals locaux par département (Almanach des contrées). | Licence Ouverte v2.0 |
| **Micro-Histoire & Plaques (`osm-france-historic`)** | OpenDataSoft / Contributeurs OSM France | `https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/osm-france-historic/` | API REST JSON | Plaques commémoratives, calvaires, fontaines anciennes, lavoirs, bornes royales et petit patrimoine vernaculaire. | ODbL |

---

## 3. Encyclopédie, Folklore & Mémoire Territoriale

| Source | Organisme / Projet | Accès / API | Format | Rôle dans Terra-16 | Licence |
|---|---|---|---|---|---|
| **Wikipédia FR (GeoSearch)** | Fondation Wikimédia | `https://fr.wikipedia.org/w/api.php?action=query&generator=geosearch` | API Action REST | Articles encyclopédiques géolocalisés à proximité de la position réelle du joueur. | CC BY-SA 4.0 |
| **Wikipédia FR (CirrusSearch)** | Fondation Wikimédia | `https://fr.wikipedia.org/w/api.php?action=query&generator=search` | API Search REST | Découverte des légendes locales, créatures folkloriques, récits de terroir, boves et curiosités. | CC BY-SA 4.0 |
| **Wikidata (Geo-SPARQL)** | Fondation Wikimédia | `https://query.wikidata.org/sparql` | SPARQL JSON-LD | Strates chronologiques (`P571` fondation, `P585` dates), alignements de codes mérimée (`P380`), mémoire littéraire (`P136`, `P800`) et anniversaires historiques locaux. | CC0 |
| **Wikimedia REST (OnThisDay)** | Fondation Wikimédia | `https://api.wikimedia.org/feed/v1/wikipedia/fr/onthisday/` | API REST JSON | Éphémérides historiques et scientifiques du jour dans l'Almanach de l'Éclaireur. | CC BY-SA 4.0 |

---

## 4. Géologie, Paléontologie & Sous-Sol

| Source | Organisme / Projet | Accès / API | Format | Rôle dans Terra-16 | Licence |
|---|---|---|---|---|---|
| **Macrostrat** | Université du Wisconsin-Madison / NSF | `https://macrostrat.org/api/v2/geologic_units/map` | API REST JSON | Cartographie du substrat géologique mondial (*bedrock*), lithologies, âges et failles tectoniques. | CC BY 4.0 |
| **The Paleobiology Database (PBDB)** | Consortium international de paléobiologistes | `https://paleobiodb.org/data1.2/occs/list.json` | API REST JSON | Gisements fossilifères scientifiques réels (macrofossiles, dinosaures, ammonites, flore ancienne). | CC BY 4.0 |
| **Banque du Sous-Sol (BSS)** | BRGM (Bureau de Recherches Géologiques et Minières) | Flux Hub'Eau & ADES (`https://hubeau.eaufrance.fr/`) | API REST JSON | Sondages géologiques profonds, forages géothermiques et coupes de terrain. | Licence Ouverte v2.0 |
| **Géorisques - Cavités Souterraines** | BRGM / Ministère de la Transition Écologique | API Géorisques / WFS BRGM | API REST JSON | Inventaire des carrières abandonnées, boves, souterrains annulaires et grottes anthropiques. | Licence Ouverte v2.0 |
| **InfoTerre BRGM** | BRGM | Flux WFS Géoplateforme | GeoJSON / WFS | Gisements miniers historiques, filons de quartz et métallogénie régionale. | Licence Ouverte v2.0 |

---

## 5. Biodiversité & Espaces Naturels

| Source | Organisme / Projet | Accès / API | Format | Rôle dans Terra-16 | Licence |
|---|---|---|---|---|---|
| **INPN - Inventaire du Patrimoine Géologique (INPG)** | Muséum National d'Histoire Naturelle (MNHN) / PatriNat | Flux WFS Géoplateforme (`patrinat_inpg:inpg`) | WFS 2.0.0 GeoJSON | Curiosités géologiques remarquables, affleurements d'exception et falaises classées. | Licence Ouverte v2.0 |
| **INPN - ZNIEFF Type 1 & Type 2** | MNHN / PatriNat | Flux WFS Géoplateforme (`patrinat_znieff1`, `patrinat_znieff2`) | WFS 2.0.0 GeoJSON | Espaces naturels remarquables, corridors écologiques et réservoirs de biodiversité. | Licence Ouverte v2.0 |
| **INPN - Sites Classés & Inscrits** | MNHN / Ministère de la Transition Écologique | Flux WFS Géoplateforme (`patrinat_sc:sc`) | WFS 2.0.0 GeoJSON | Monuments naturels et sites pittoresques protégés par la loi de 1930. | Licence Ouverte v2.0 |
| **Arbres Remarquables de France** | Association A.R.B.R.E.S. / Muséum / Wikidata / Ville de Paris | SPARQL Wikidata & Wikipedia | JSON | Arbres centenaires et millénaires remarquables pour leur âge, taille ou folklore. | CC-BY-SA / Licence Ouverte |
| **iNaturalist API (Research Grade)** | California Academy of Sciences & National Geographic | `https://api.inaturalist.org/v1/observations` | API REST JSON | Observations d'espèces faune/flore sauvages validées par la communauté scientifique (photos, taxonomie). | CC-BY-NC / CC0 / CC-BY |
| **GBIF** | Global Biodiversity Information Facility | `https://api.gbif.org/v1/occurrence/search` | API REST JSON | Occurrences historiques et contemporaines d'espèces issues des collections des muséums du monde entier. | CC-BY 4.0 / CC0 |

---

## 6. Hydrographie & Eau

| Source | Organisme / Projet | Accès / API | Format | Rôle dans Terra-16 | Licence |
|---|---|---|---|---|---|
| **Hub'Eau - Niveaux des Nappes (ADES)** | BRGM / Office Français de la Biodiversité (OFB) | `https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations` | API REST JSON | Surveillance piézométrique en direct des nappes phréatiques sous les pas de l'explorateur. | Licence Ouverte v2.0 |
| **Hub'Eau - Hydrométrie (Banque Hydro)** | Direction Générale de la Prévention des Risques (DGPR) / OFB | `https://hubeau.eaufrance.fr/api/v1/hydrometrie/observations_tr` | API REST JSON | Hauteur d'eau et débits instantanés des cours d'eau mesurés par les stations limnimétriques. | Licence Ouverte v2.0 |
| **IGN BD TOPO V3 Hydrographie** | IGN | Flux WFS Géoplateforme (`BDTOPO_V3:detail_hydrographique`) | WFS 2.0.0 GeoJSON | Sources naturelles, cascades, fontaines captées, pertes karstiques et petits cours d'eau. | Licence Ouverte v2.0 |
| **IGN BD TOPO V3 Orographie** | IGN | Flux WFS Géoplateforme (`BDTOPO_V3:detail_orographique`) | WFS 2.0.0 GeoJSON | Grottes, gouffres, ravins, falaises et chaos rocheux remarquables. | Licence Ouverte v2.0 |

---

## 7. Archéologie, Voies Oubliées & Mémoire Industrielle

| Source | Organisme / Projet | Accès / API | Format | Rôle dans Terra-16 | Licence |
|---|---|---|---|---|---|
| **Archéologie Préventive** | INRAP / Wikidata | SPARQL Wikidata / Inrap | JSON | Traces archéologiques, nécropoles, villae gallo-romaines et diagnostics de fouilles. | CC0 / Licence Ouverte |
| **Cartofriches** | CEREMA / Ministère de la Transition Écologique | Dataset data.gouv.fr / API Tabulaire | JSON / CSV | Friches industrielles, ferroviaires, minières et militaires en cours de réhabilitation ou oubliées. | Licence Ouverte v2.0 |
| **Voies Ferrées Disparues** | IGN BD TOPO / OpenStreetMap Historical Railways | WFS IGN / Overpass API | GeoJSON | Lignes de chemin de fer secondaires déclassées, anciens tacots et embranchements miniers. | Licence Ouverte / ODbL |
| **Toponymie & Lieux-Dits Anciens** | IGN BD TOPO V3 | Flux WFS Géoplateforme (`BDTOPO_V3:zone_d_habitation`) | WFS 2.0.0 GeoJSON | Noms de terroirs historiques, parcelles évocatrices et micro-toponymes. | Licence Ouverte v2.0 |
| **Réseau Géodésique Français** | IGN Service de Géodésie | WFS Géoplateforme (`ign_rbf`, `ign_rdf`, `ign_rn`) | WFS GeoJSON | Bornes géodésiques fondamentales et repères de nivellement historiques de France. | Licence Ouverte v2.0 |

---

## 8. Météo, Éphémérides & Référentiel Administratif

| Source | Organisme / Projet | Accès / API | Format | Rôle dans Terra-16 | Licence |
|---|---|---|---|---|---|
| **Open-Meteo API** | Open-Meteo GmbH | `https://api.open-meteo.com/v1/forecast` | API REST JSON | Météo en direct (WMO, température, vent, jour/nuit) qui module en temps réel l'ambiance 16-bit, la pluie, la neige et les musiques de Terra-16. | CC-BY 4.0 |
| **GeoAPI Gouv FR** | Etalab / Direction Interministérielle du Numérique (DINUM) | `https://geo.api.gouv.fr/communes` | API REST JSON | Découpage administratif officiel : commune actuelle, département, région, codes INSEE et population légale. | Licence Ouverte v2.0 |
| **Plateforme Nationale DATAtourisme** | Tourisme & Territoires / data.gouv.fr | API GraphQL / Tabulaire data.gouv.fr | JSON / CSV | Sélection des points d'intérêt patrimoniaux certifiés par les offices de tourisme régionaux. | Licence Ouverte v2.0 |

---

## 9. Attributions & Licences

Toutes les données intégrées à **Terra-16** sont réutilisées dans le strict respect de leurs licences d'origine :

* **Licence Ouverte / Open Licence v2.0 (Etalab)** : Réutilisation libre sous réserve de mention de la paternité (IGN, Ministère de la Culture, BRGM, CEREMA, MNHN, OFB, data.gouv.fr).
* **Open Database License (ODbL 1.0)** : © Les contributeurs d'OpenStreetMap (données vectorielles, Nominatim).
* **Creative Commons (CC-BY / CC-BY-SA 4.0)** : Wikipédia, Wikidata, Wikimedia Commons, GBIF, Macrostrat, Paleobiology Database, Open-Meteo.
* **iNaturalist API** : Les photographies d'espèces sauvages et les observations présentées conservent les licences respectives définies par leurs observateurs naturalistes (CC-BY, CC-BY-NC, CC0).
