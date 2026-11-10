import React, { useEffect, useRef } from 'react';
import {
  ArchivistChestArchetype,
  BedrockInfo,
  ElevationGrid,
  ExplorationCategory,
  ExplorerGeocacheRecord,
  haversineMeters,
  OpenedArchivistChestRecord,
  PoiItem,
  sampleElevationMeters,
  SubterraneanFeature,
  TerrainFeature,
} from './types';

export interface ArchivistRelicCatalogItem {
  id: string;
  name: string;
  subtitle: string;
  category: ExplorationCategory;
  lore: string;
  isStarterToken?: boolean;
  palette: {
    primary: string;
    highlight: string;
    accent: string;
    base: string;
  };
  motif: 'astrolabe' | 'seal' | 'prism' | 'feather' | 'compass' | 'vial' | 'keystone' | 'ammonite' | 'coin' | 'lens' | 'medal' | 'lamp';
}

export const ARCHIVIST_RELICS_CATALOG: ArchivistRelicCatalogItem[] = [
  {
    id: 'relic_astrolabe_cassini',
    name: 'Astrolabe de Cassini',
    subtitle: 'Instrument de triangulation géodésique du XVIIIe siècle',
    category: 'geographie',
    lore: 'Un limbe de laiton finement gradué dont se servaient les premiers ingénieurs-géographes pour relever les clochers et crêtes du royaume.',
    palette: { primary: '#d97706', highlight: '#fef08a', accent: '#0284c7', base: '#78350f' },
    motif: 'astrolabe',
  },
  {
    id: 'relic_sceau_merovingien',
    name: 'Matrice de Sceau Ancien',
    subtitle: 'Empreinte d’archive en bronze patiné',
    category: 'histoire',
    lore: 'Conservée à l’abri des regards dans un coffret ciré, cette matrice porte les entrelacs d’une charte oubliée.',
    palette: { primary: '#b91c1c', highlight: '#fca5a5', accent: '#fbbf24', base: '#450a0a' },
    motif: 'seal',
  },
  {
    id: 'relic_spat_islande',
    name: 'Prisme de Spat d’Islande',
    subtitle: 'Calcite optique à double réfraction solaire',
    category: 'geographie',
    lore: 'Ce cristal limpide dédouble les traits d’encre et révèle la direction du soleil même à travers la brume épaisse.',
    palette: { primary: '#38bdf8', highlight: '#ffffff', accent: '#a855f7', base: '#0369a1' },
    motif: 'prism',
  },
  {
    id: 'relic_plume_pelerin',
    name: 'Rémige de Faucon Pèlerin',
    subtitle: 'Plume d’observation des hautes corniches',
    category: 'ecosysteme',
    lore: 'Trouvée sur un promontoire balayé par les vents, elle sert aux naturalistes pour épousseter les lichens fragiles.',
    palette: { primary: '#059669', highlight: '#a7f3d0', accent: '#f59e0b', base: '#064e3b' },
    motif: 'feather',
  },
  {
    id: 'relic_boussole_mineur',
    name: 'Boussole Suspendue de Mineur',
    subtitle: 'Cadran de galerie insensible au roulis',
    category: 'etrange',
    lore: 'Montée sur double cardan de cuivre, elle permettait aux maîtres-porions de tracer le fil des veines souterraines.',
    palette: { primary: '#f59e0b', highlight: '#fef9c3', accent: '#ef4444', base: '#78350f' },
    motif: 'compass',
  },
  {
    id: 'relic_fiole_karst',
    name: 'Fiole d’Eau Phosphorescente',
    subtitle: 'Gouttes recueillies sous une voûte karstique',
    category: 'etrange',
    lore: 'Scellée à la cire bleue, cette fiole renferme des micro-cristaux calcaires qui luisent doucement dans l’obscurité.',
    palette: { primary: '#06b6d4', highlight: '#cffafe', accent: '#bef264', base: '#164e63' },
    motif: 'vial',
  },
  {
    id: 'relic_clef_cistercienne',
    name: 'Clef d’Armarium Monastique',
    subtitle: 'Fer forgé à panneton ajouré en rosace',
    category: 'histoire',
    lore: 'Ouvrait jadis les coffres à manuscrits où dormaient les chroniques des défrichements et des moulins.',
    palette: { primary: '#64748b', highlight: '#e2e8f0', accent: '#fbbf24', base: '#1e293b' },
    motif: 'keystone',
  },
  {
    id: 'relic_ammonite_pyrite',
    name: 'Ammonite Pyritisée d’Or',
    subtitle: 'Spirale fossile aux reflets métalliques',
    category: 'geographie',
    lore: 'Lorsque les marnes anciennes se sont formées sans oxygène, la coquille nacrée s’est lentement changée en or des fous.',
    palette: { primary: '#eab308', highlight: '#fef08a', accent: '#a16207', base: '#422006' },
    motif: 'ammonite',
  },
  {
    id: 'relic_jeton_passeur',
    name: 'Méreau des Passeurs d’Eau',
    subtitle: 'Jeton de plomb frappé d’une barque et d’une étoile',
    category: 'legende',
    lore: 'Les anciens bateliers des confluences en glissaient un sous la pierre du gué pour s’assurer des eaux clémentes.',
    palette: { primary: '#8b5cf6', highlight: '#ede9fe', accent: '#38bdf8', base: '#4c1d95' },
    motif: 'coin',
  },
  {
    id: 'relic_lentille_herboriste',
    name: 'Loupe d’Herboriste en Laiton',
    subtitle: 'Verre poli à monture pliante des clairières',
    category: 'ecosysteme',
    lore: 'Grossit dix fois les nervures des fougères, les spores dorées et les grains de quartz roulés par le ruisseau.',
    palette: { primary: '#10b981', highlight: '#ecfdf5', accent: '#d97706', base: '#065f46' },
    motif: 'lens',
  },
  {
    id: 'relic_medaille_ign',
    name: 'Repère de Nivellement en Bronze',
    subtitle: 'Médaillon topographique des sommets et cols',
    category: 'geographie',
    lore: 'Scellé au point haut du relief, il relie ce lieu précis au grand canevas altimétrique des mers et montagnes.',
    palette: { primary: '#b45309', highlight: '#fde68a', accent: '#dc2626', base: '#451a03' },
    motif: 'medal',
  },
  {
    id: 'relic_lampe_galloromaine',
    name: 'Lampe de Veillée en Terre Sigillée',
    subtitle: 'Céramique rouge lustrée des carrefours anciens',
    category: 'legende',
    lore: 'Sa mèche de lin éclairait les récits des voyageurs arrêtés à la croisée des vieux chemins creux.',
    palette: { primary: '#ea580c', highlight: '#fed7aa', accent: '#fde047', base: '#7c2d12' },
    motif: 'lamp',
  },
  // Starter capsule tokens always available so any explorer can bury their very first geocache immediately
  {
    id: 'relic_jeton_eclaireur',
    name: 'Jeton de Guilde en Cuivre',
    subtitle: 'Gage d’Éclaireur pour capsule partagée',
    category: 'histoire',
    isStarterToken: true,
    lore: 'Frappé de la rose des vents des arpenteurs, ce jeton est traditionnellement déposé dans une première cache.',
    palette: { primary: '#d97706', highlight: '#fef3c7', accent: '#10b981', base: '#78350f' },
    motif: 'coin',
  },
  {
    id: 'relic_parchemin_cachete',
    name: 'Rouleau Enluminé de Salut',
    subtitle: 'Vélin scellé pour les prochains découvreurs',
    category: 'legende',
    isStarterToken: true,
    lore: 'Un court feuillet d’encre sépia portant le salut fraternel de celui ou celle qui a sondé ces lieux.',
    palette: { primary: '#dc2626', highlight: '#fef3c7', accent: '#f59e0b', base: '#7f1d1d' },
    motif: 'seal',
  },
  {
    id: 'relic_pierre_gravee',
    name: 'Galet Gravé d’Orientation',
    subtitle: 'Pierre polie marquée du méridien local',
    category: 'geographie',
    isStarterToken: true,
    lore: 'Une pierre de poche gravée d’une flèche discrète, laissée en témoignage de passage aux marcheurs attentifs.',
    palette: { primary: '#0284c7', highlight: '#e0f2fe', accent: '#fbbf24', base: '#0c4a6e' },
    motif: 'medal',
  },
];

export const CHEST_ARCHETYPE_META: Record<
  ArchivistChestArchetype,
  { labelFr: string; shortFr: string; defaultCategory: ExplorationCategory; xpReward: number }
> = {
  sommet_colline: {
    labelFr: 'Coffre de Promontoire & Sommet Local',
    shortFr: 'Sommet local',
    defaultCategory: 'geographie',
    xpReward: 125,
  },
  confluence_eaux: {
    labelFr: 'Coffre de Confluence & Rive Secrète',
    shortFr: 'Confluence d’eaux',
    defaultCategory: 'geographie',
    xpReward: 120,
  },
  cul_de_sac_forestier: {
    labelFr: 'Coffre du Sentier en Cul-de-sac',
    shortFr: 'Bout de sentier',
    defaultCategory: 'legende',
    xpReward: 115,
  },
  clairiere_sylvestre: {
    labelFr: 'Coffre de Clairière & Lande Isolée',
    shortFr: 'Clairière isolée',
    defaultCategory: 'ecosysteme',
    xpReward: 110,
  },
  bouche_souterraine: {
    labelFr: 'Coffre des Voûtes & Seuils Souterrains',
    shortFr: 'Voûte souterraine',
    defaultCategory: 'etrange',
    xpReward: 135,
  },
};

export interface WorldArchivistChestNode {
  chestId: string;
  archetype: ArchivistChestArchetype;
  title: string;
  placeNote: string;
  relic: ArchivistRelicCatalogItem;
  category: ExplorationCategory;
  lat: number;
  lng: number;
  altitudeMeters: number | null;
  isSubterranean: boolean;
  xpReward: number;
  seed: number;
}

function detHash(a: number, b: number): number {
  let h = (Math.imul(a, 2654435761) ^ Math.imul(b, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

export function getRelicById(id: string): ArchivistRelicCatalogItem {
  return ARCHIVIST_RELICS_CATALOG.find((r) => r.id === id) || ARCHIVIST_RELICS_CATALOG[0];
}

function buildDeterministicChestId(
  archetype: ArchivistChestArchetype,
  lat: number,
  lng: number,
  isSub: boolean
): string {
  const latCode = `${lat >= 0 ? 'p' : 'm'}${Math.round(Math.abs(lat) * 10000)}`;
  const lngCode = `${lng >= 0 ? 'p' : 'm'}${Math.round(Math.abs(lng) * 10000)}`;
  return `arch_${isSub ? 'sub' : 'srf'}_${archetype}_${latCode}_${lngCode}`.slice(0, 120);
}

/**
 * Quantizes (lat, lng) into a 0.04° × 0.04° (~4.4 km) tile key matching ^[a-zA-Z0-9_\-]+$
 * for cost-efficient regional Firestore geocache queries.
 */
export function computeGeocacheSectorKey(lat: number, lng: number): string {
  const bLat = Math.floor(lat / 0.04);
  const bLng = Math.floor(lng / 0.04);
  const sLat = bLat >= 0 ? `p${bLat}` : `m${Math.abs(bLat)}`;
  const sLng = bLng >= 0 ? `p${bLng}` : `m${Math.abs(bLng)}`;
  return `s_${sLat}_${sLng}`;
}

export function getNearbyGeocacheSectorKeys(lat: number, lng: number): string[] {
  const centerLatIdx = Math.floor(lat / 0.04);
  const centerLngIdx = Math.floor(lng / 0.04);
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const bLat = centerLatIdx + dy;
      const bLng = centerLngIdx + dx;
      const sLat = bLat >= 0 ? `p${bLat}` : `m${Math.abs(bLat)}`;
      const sLng = bLng >= 0 ? `p${bLng}` : `m${Math.abs(bLng)}`;
      keys.push(`s_${sLat}_${sLng}`);
    }
  }
  return keys;
}

/**
 * Deterministically places World Archivist Chests on remarkable geographical features of the real sector:
 * - Local hill summit / topographic prominence
 * - Confluence / riverbank bend of real waterways
 * - Dead-end forest or countryside footpath (cul-de-sac)
 * - Woodland / moorland glade away from busy roads
 * - Subterranean portal mouth or deep cavern chamber
 *
 * Everyone in the world visiting the same real coordinates sees the exact same chest & relic!
 */
export function spawnWorldArchivistChests(params: {
  centerLat: number;
  centerLng: number;
  terrain: TerrainFeature[];
  subterranean: SubterraneanFeature[];
  elevation: ElevationGrid | null;
  bedrock: BedrockInfo | null | undefined;
  pois: PoiItem[];
}): WorldArchivistChestNode[] {
  const { centerLat, centerLng, terrain, subterranean, elevation, pois } = params;
  const nonStarterRelics = ARCHIVIST_RELICS_CATALOG.filter((r) => !r.isStarterToken);
  const candidates: Array<{
    archetype: ArchivistChestArchetype;
    lat: number;
    lng: number;
    isSubterranean: boolean;
    score: number;
    placeNote: string;
    customTitle?: string;
  }> = [];

  const buildings = terrain.filter((t) => t.kind === 'building');
  const waters = terrain.filter((t) => t.kind === 'water');
  const majorRoads = terrain.filter((t) => t.kind === 'major_road');

  const isInsideBuildingOrWater = (lat: number, lng: number): boolean => {
    for (const b of buildings) {
      if (b.points.length > 0 && haversineMeters(lat, lng, b.points[0].lat, b.points[0].lng) < 13) {
        return true;
      }
    }
    for (const w of waters) {
      for (let i = 0; i < w.points.length; i += 2) {
        if (haversineMeters(lat, lng, w.points[i].lat, w.points[i].lng) < 14) {
          return true;
        }
      }
    }
    return false;
  };

  // 1. SOMMET DE COLLINE LOCAL (Real DEM prominence)
  if (
    elevation &&
    elevation.rows >= 4 &&
    elevation.cols >= 4 &&
    elevation.elevDm.length >= elevation.rows * elevation.cols
  ) {
    const cosLat = Math.max(0.15, Math.cos((elevation.centerLat * Math.PI) / 180));
    const halfX = (elevation.cols - 1) / 2;
    const halfY = (elevation.rows - 1) / 2;
    for (let r = 1; r < elevation.rows - 1; r++) {
      for (let c = 1; c < elevation.cols - 1; c++) {
        const val = elevation.elevDm[r * elevation.cols + c] / 10;
        if (!Number.isFinite(val)) continue;
        let isLocalMax = true;
        let neighborSum = 0;
        let neighborCnt = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nv = elevation.elevDm[(r + dr) * elevation.cols + (c + dc)] / 10;
            if (Number.isFinite(nv)) {
              if (nv > val) isLocalMax = false;
              neighborSum += nv;
              neighborCnt++;
            }
          }
        }
        if (!isLocalMax || neighborCnt === 0) continue;
        const prominence = val - neighborSum / neighborCnt;
        const reliefSpan = elevation.maxMeters - elevation.minMeters;
        if (prominence >= 2.2 || (reliefSpan >= 14 && val >= elevation.maxMeters - reliefSpan * 0.14)) {
          const lat = elevation.centerLat - ((r - halfY) * elevation.stepMeters) / 110540;
          const lng = elevation.centerLng + ((c - halfX) * elevation.stepMeters) / (111320 * cosLat);
          if (haversineMeters(centerLat, centerLng, lat, lng) > 1650) continue;
          if (isInsideBuildingOrWater(lat, lng)) continue;
          candidates.push({
            archetype: 'sommet_colline',
            lat,
            lng,
            isSubterranean: false,
            score: 120 + Math.round(prominence * 4),
            customTitle: `Coffre de Promontoire (${Math.round(val)} m)`,
            placeNote: `Posé au point culminant local (${Math.round(val)} m NGF), offrant une vue dégagée sur le relief environnant.`,
          });
        }
      }
    }
  }

  // 2. CONFLUENCE DE COURS D'EAU OU RIVE REMARQUABLE
  const waterways = terrain.filter((t) => t.kind === 'waterway' && t.points.length >= 2);
  for (let i = 0; i < waterways.length; i++) {
    const wA = waterways[i];
    const endsA = [wA.points[0], wA.points[wA.points.length - 1]];
    for (const ptA of endsA) {
      if (haversineMeters(centerLat, centerLng, ptA.lat, ptA.lng) > 1600) continue;
      for (let j = i + 1; j < waterways.length; j++) {
        const wB = waterways[j];
        if (wA.name && wB.name && wA.name === wB.name) continue;
        for (let k = 0; k < wB.points.length; k += Math.max(1, Math.floor(wB.points.length / 6))) {
          const ptB = wB.points[k];
          const d = haversineMeters(ptA.lat, ptA.lng, ptB.lat, ptB.lng);
          if (d <= 36) {
            // Offset ~16m onto the dry bank
            const h = detHash(Math.round(ptA.lat * 10000), Math.round(ptA.lng * 10000));
            const angle = ((h % 360) * Math.PI) / 180;
            const bankLat = ptA.lat + (Math.sin(angle) * 16) / 110540;
            const bankLng =
              ptA.lng + (Math.cos(angle) * 16) / (111320 * Math.max(0.2, Math.cos((ptA.lat * Math.PI) / 180)));
            if (!isInsideBuildingOrWater(bankLat, bankLng)) {
              const labelWater = wA.name || wB.name ? `près de ${wA.name || wB.name}` : 'à la rencontre de deux rus';
              candidates.push({
                archetype: 'confluence_eaux',
                lat: bankLat,
                lng: bankLng,
                isSubterranean: false,
                score: 135,
                customTitle: wA.name ? `Coffre de Confluence · ${wA.name}` : 'Coffre de Confluence des Eaux',
                placeNote: `Dissimulé sur la berge ${labelWater}, là où les courants unissent leur murmure.`,
              });
            }
            break;
          }
        }
      }
    }
  }

  // 3. BOUT D'UN SENTIER EN CUL-DE-SAC (Degree-1 footpath terminus)
  const paths = terrain.filter((t) => (t.kind === 'path' || t.kind === 'steps') && t.points.length >= 2);
  const allRoadCheckPts: Array<{ lat: number; lng: number; id: string }> = [];
  for (const r of terrain) {
    if (r.kind === 'path' || r.kind === 'minor_road' || r.kind === 'major_road' || r.kind === 'steps') {
      if (r.points.length > 0) {
        allRoadCheckPts.push({ lat: r.points[0].lat, lng: r.points[0].lng, id: r.id });
        const last = r.points[r.points.length - 1];
        allRoadCheckPts.push({ lat: last.lat, lng: last.lng, id: r.id });
        const mid = r.points[Math.floor(r.points.length / 2)];
        allRoadCheckPts.push({ lat: mid.lat, lng: mid.lng, id: r.id });
      }
    }
  }
  for (const p of paths) {
    const endpoints = [p.points[0], p.points[p.points.length - 1]];
    for (const ep of endpoints) {
      if (haversineMeters(centerLat, centerLng, ep.lat, ep.lng) > 1550) continue;
      let connectedOther = false;
      for (const other of allRoadCheckPts) {
        if (other.id === p.id) continue;
        if (haversineMeters(ep.lat, ep.lng, other.lat, other.lng) < 22) {
          connectedOther = true;
          break;
        }
      }
      if (!connectedOther && !isInsideBuildingOrWater(ep.lat, ep.lng)) {
        candidates.push({
          archetype: 'cul_de_sac_forestier',
          lat: ep.lat,
          lng: ep.lng,
          isSubterranean: false,
          score: 112 + (p.name ? 10 : 0),
          customTitle: p.name ? `Coffre du Bout de « ${p.name.slice(0, 28)} »` : 'Coffre du Sentier en Cul-de-sac',
          placeNote: 'Déposé tout au bout d’un sentier qui s’efface dans le paysage, loin du passage ordinaire.',
        });
      }
    }
  }

  // 4. CLAIRIÈRE SYLVESTRE / LANDE OU PARC ISOLÉ
  const naturalPolys = terrain.filter(
    (t) =>
      (t.kind === 'forest' || t.kind === 'scrub' || t.kind === 'park' || t.kind === 'wetland' || t.kind === 'scree') &&
      t.points.length >= 3
  );
  for (const poly of naturalPolys) {
    let sumLat = 0;
    let sumLng = 0;
    for (const pt of poly.points) {
      sumLat += pt.lat;
      sumLng += pt.lng;
    }
    const cLat = sumLat / poly.points.length;
    const cLng = sumLng / poly.points.length;
    if (haversineMeters(centerLat, centerLng, cLat, cLng) > 1600) continue;
    if (isInsideBuildingOrWater(cLat, cLng)) continue;
    const nearHighway = majorRoads.some(
      (mr) => mr.points.length > 0 && haversineMeters(cLat, cLng, mr.points[0].lat, mr.points[0].lng) < 45
    );
    if (nearHighway) continue;
    candidates.push({
      archetype: 'clairiere_sylvestre',
      lat: cLat,
      lng: cLng,
      isSubterranean: false,
      score: poly.kind === 'forest' || poly.kind === 'scrub' ? 108 : 98,
      customTitle: poly.name ? `Coffre de « ${poly.name.slice(0, 30)} »` : 'Coffre de Clairière Sylvestre',
      placeNote:
        poly.kind === 'forest'
          ? 'Niché au cœur d’une trouée lumineuse sous le couvert des grands arbres.'
          : 'Posé au calme d’une étendue naturelle préservée du tumulte.',
    });
  }

  // 5. BOUCHES SOUTERRAINES & VOÛTES PROFONDES (Surface threshold + Underground caverns!)
  for (const sub of subterranean) {
    if (sub.points.length === 0) continue;
    const anchor = sub.points[Math.floor(sub.points.length / 2)];
    if (haversineMeters(centerLat, centerLng, anchor.lat, anchor.lng) > 1650) continue;
    candidates.push({
      archetype: 'bouche_souterraine',
      lat: anchor.lat,
      lng: anchor.lng,
      isSubterranean: true,
      score: 128,
      customTitle: sub.name ? `Coffre Souterrain · ${sub.name.slice(0, 26)}` : 'Coffre des Voûtes Souterraines',
      placeNote: 'Scellé dans le silence minéral d’une cavité ou galerie souterraine du secteur.',
    });
  }

  for (const poi of pois) {
    if (poi.isSubterranean && haversineMeters(centerLat, centerLng, poi.lat, poi.lng) <= 1650) {
      const h = detHash(Math.round(poi.lat * 10000), Math.round(poi.lng * 10000));
      const ang = ((h % 360) * Math.PI) / 180;
      const offLat = poi.lat + (Math.sin(ang) * 28) / 110540;
      const offLng =
        poi.lng + (Math.cos(ang) * 28) / (111320 * Math.max(0.2, Math.cos((poi.lat * Math.PI) / 180)));
      candidates.push({
        archetype: 'bouche_souterraine',
        lat: offLat,
        lng: offLng,
        isSubterranean: true,
        score: 118,
        customTitle: `Coffre des Profondeurs · ${poi.name.slice(0, 24)}`,
        placeNote: 'Posé sur une corniche de roche taillée à quelques pas d’un écho souterrain.',
      });
    }
  }

  // Guaranteed deterministic fallback on a world-locked 0.008° (~880m) lattice so even the middle of nowhere has chests!
  const stepDeg = 0.008;
  const baseLatIdx = Math.round(centerLat / stepDeg);
  const baseLngIdx = Math.round(centerLng / stepDeg);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cLatIdx = baseLatIdx + dy;
      const cLngIdx = baseLngIdx + dx;
      const h = detHash(cLatIdx, cLngIdx);
      const fLat = (cLatIdx + (((h % 51) - 25) / 100) * 0.7) * stepDeg;
      const fLng = (cLngIdx + ((((h >>> 8) % 51) - 25) / 100) * 0.7) * stepDeg;
      if (!isInsideBuildingOrWater(fLat, fLng)) {
        candidates.push({
          archetype: h % 2 === 0 ? 'clairiere_sylvestre' : 'sommet_colline',
          lat: fLat,
          lng: fLng,
          isSubterranean: false,
          score: 75 + (h % 15),
          customTitle: 'Coffre d’Arpenteur des Confins',
          placeNote: 'Laissé par les géographes en plein air, sur un point de repère discret du secteur.',
        });
      }
      // Also 1 deterministic underground chest per ~880m cell
      const uLat = (cLatIdx + ((((h >>> 4) % 51) - 25) / 100) * 0.65) * stepDeg;
      const uLng = (cLngIdx + ((((h >>> 12) % 51) - 25) / 100) * 0.65) * stepDeg;
      candidates.push({
        archetype: 'bouche_souterraine',
        lat: uLat,
        lng: uLng,
        isSubterranean: true,
        score: 82 + (h % 12),
        customTitle: 'Coffre Géologique du Socle',
        placeNote: 'Enfoui dans une diaclase calme du sous-sol régional.',
      });
    }
  }

  // Deduplicate spatially (minimum 340m spacing on surface, 360m underground) keeping highest score deterministically
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.lat !== b.lat ? a.lat - b.lat : a.lng - b.lng;
  });

  const selectedSurface: WorldArchivistChestNode[] = [];
  const selectedSub: WorldArchivistChestNode[] = [];

  for (const cand of candidates) {
    const bucket = cand.isSubterranean ? selectedSub : selectedSurface;
    // Lot 4: Low-intensity chests; do not artificially flood sparsely documented areas
    const maxSurface = pois.length < 5 ? 1 : Math.min(2, Math.max(1, Math.floor(pois.length / 8)));
    const maxSub = subterranean.length < 3 ? 1 : 2;
    const maxCount = cand.isSubterranean ? maxSub : maxSurface;
    if (bucket.length >= maxCount) continue;
    const minSpacing = cand.isSubterranean ? 480 : 500;
    if (bucket.some((ex) => haversineMeters(ex.lat, ex.lng, cand.lat, cand.lng) < minSpacing)) {
      continue;
    }

    const qLat = Math.round(cand.lat * 10000) / 10000;
    const qLng = Math.round(cand.lng * 10000) / 10000;
    const seed = detHash(Math.round(qLat * 10000), Math.round(qLng * 10000) ^ (cand.isSubterranean ? 0x55aa : 0));
    const relic = nonStarterRelics[seed % nonStarterRelics.length];
    const meta = CHEST_ARCHETYPE_META[cand.archetype];
    const alt = sampleElevationMeters(elevation, qLat, qLng);

    bucket.push({
      chestId: buildDeterministicChestId(cand.archetype, qLat, qLng, cand.isSubterranean),
      archetype: cand.archetype,
      title: cand.customTitle || meta.labelFr,
      placeNote: cand.placeNote,
      relic,
      category: relic.category || meta.defaultCategory,
      lat: qLat,
      lng: qLng,
      altitudeMeters: alt !== null ? Math.round(alt) : null,
      isSubterranean: cand.isSubterranean,
      xpReward: meta.xpReward,
      seed,
    });
  }

  return [...selectedSurface, ...selectedSub];
}

// ============================================================================
// 16-BIT PIXEL ART RENDERERS (MAP CHEST, GEOCACHE CAPSULE, RADAR RING & RELICS)
// ============================================================================

export function drawArchivistChestSprite16Bit(
  ctx: CanvasRenderingContext2D,
  opts: {
    cx: number;
    cy: number;
    scale: number;
    isOpened: boolean;
    isHovered: boolean;
    animTick: number;
    /** Optional 0..1 progress right after unlocking the chest for JRPG lid + rising relic choreography */
    openingProgress01?: number;
    relicId?: string;
  }
) {
  const { cx, cy, scale, isOpened, isHovered, animTick, openingProgress01, relicId } = opts;
  const px = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round((cx + dx) * scale), Math.round((cy + dy) * scale), w * scale, h * scale);
  };

  const isAnimatingOpen =
    typeof openingProgress01 === 'number' && openingProgress01 > 0 && openingProgress01 < 1;

  // Ground shadow
  px(-8, 1, 16, 3, 'rgba(20, 11, 5, 0.42)');

  // Hover or unopened golden glint halo (expanded burst while opening!)
  if (isAnimatingOpen) {
    px(-11, -15, 22, 18, 'rgba(253, 224, 71, 0.36)');
  } else if (isHovered || (!isOpened && animTick % 6 < 3)) {
    px(-9, -12, 18, 14, isOpened ? 'rgba(52, 211, 153, 0.22)' : 'rgba(253, 224, 71, 0.28)');
  }

  // Crisp dark sepia 16-bit outline
  px(-7, -10, 14, 12, '#140b05');
  px(-8, -9, 16, 10, '#140b05');

  if (!isOpened && !isAnimatingOpen) {
    // Closed arched oak & brass Archivist Chest
    px(-7, -9, 14, 4, '#b45309'); // domed lid
    px(-6, -9, 12, 1, '#f59e0b'); // top specular
    px(-7, -5, 14, 1, '#140b05'); // lid seam
    px(-7, -4, 14, 5, '#78350f'); // oak body
    px(-6, -3, 12, 3, '#92400e');

    // Brass straps
    px(-5, -9, 2, 10, '#fbbf24');
    px(3, -9, 2, 10, '#fbbf24');
    px(-5, -9, 1, 3, '#fef08a');
    px(3, -9, 1, 3, '#fef08a');

    // Central golden lock plate
    px(-2, -6, 4, 4, '#fde047');
    px(-1, -5, 2, 2, '#140b05');
    if (animTick % 8 === 0 || isHovered) {
      px(-1, -13, 2, 2, '#ffffff');
      px(-2, -12, 4, 1, '#fde047');
    }
  } else if (isAnimatingOpen && openingProgress01 < 0.22) {
    // Frame 1 of opening: clasp pops & golden seam light cracks open!
    px(-7, -10, 14, 4, '#b45309');
    px(-6, -10, 12, 1, '#fde047');
    px(-7, -6, 14, 2, '#fef08a'); // bright golden crack of light!
    px(-7, -4, 14, 5, '#78350f');
    px(-5, -10, 2, 4, '#fbbf24');
    px(3, -10, 2, 4, '#fbbf24');
    px(-2, -8, 4, 3, '#ffffff');
  } else {
    // Frame 2+ / Opened chest showing crimson velvet interior & relic glow
    const lidLift = isAnimatingOpen && openingProgress01 < 0.45 ? -1 : 0;
    px(-8, -12 + lidLift, 16, 4, '#140b05');
    px(-7, -11 + lidLift, 14, 3, '#92400e');
    px(-6, -11 + lidLift, 12, 1, '#fbbf24');
    px(-6, -8, 12, 3, '#991b1b'); // crimson velvet lining
    px(-3, -8, 6, 2, isAnimatingOpen ? '#ffffff' : '#fef08a'); // relic gleam
    px(-7, -5, 14, 6, '#78350f');
    px(-5, -5, 2, 6, '#d97706');
    px(3, -5, 2, 6, '#d97706');

    // Rising 16-bit Relic & Golden Sunbeams Choreography!
    if (isAnimatingOpen && openingProgress01 >= 0.18) {
      const tRise = Math.min(1, (openingProgress01 - 0.18) / 0.62);
      const easeOut = 1 - Math.pow(1 - tRise, 3);
      const relicY = Math.round(-11 - easeOut * 13);
      const relicDef = relicId ? getRelicById(relicId) : null;
      const rPrimary = relicDef?.palette.primary || '#f59e0b';
      const rHighlight = relicDef?.palette.highlight || '#fef08a';
      const rAccent = relicDef?.palette.accent || '#38bdf8';

      // Vertical golden light shafts rising out of the chest
      px(-4, relicY + 3, 1, Math.max(2, -7 - relicY), 'rgba(254, 240, 138, 0.55)');
      px(0, relicY + 2, 1, Math.max(2, -7 - relicY), 'rgba(255, 255, 255, 0.72)');
      px(3, relicY + 3, 1, Math.max(2, -7 - relicY), 'rgba(254, 240, 138, 0.55)');

      // Floating 16-bit Relic Medallion with dark sepia outline
      px(-5, relicY - 5, 10, 10, '#140b05');
      px(-4, relicY - 4, 8, 8, rPrimary);
      px(-3, relicY - 3, 6, 6, rHighlight);
      px(-1, relicY - 2, 2, 4, rAccent);
      px(-2, relicY - 1, 4, 2, '#ffffff');

      // Orbiting 16-bit pixel sparkles
      const spPhase = Math.floor(openingProgress01 * 12) % 2 === 0;
      px(spPhase ? -9 : -8, relicY - 4, 2, 2, '#fde047');
      px(spPhase ? 7 : 6, relicY - 2, 2, 2, '#ffffff');
      px(-1, relicY - 9, 2, 2, '#fef08a');
    }
  }
}

export function drawExplorerCapsuleSprite16Bit(
  ctx: CanvasRenderingContext2D,
  opts: {
    cx: number;
    cy: number;
    scale: number;
    isFound: boolean;
    isOwn: boolean;
    isHovered: boolean;
    animTick: number;
  }
) {
  const { cx, cy, scale, isFound, isOwn, isHovered, animTick } = opts;
  const px = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round((cx + dx) * scale), Math.round((cy + dy) * scale), w * scale, h * scale);
  };

  // Disturbed earth / stone mound base
  px(-7, 0, 14, 3, '#140b05');
  px(-6, 0, 12, 2, '#78350f');
  px(-4, 0, 8, 1, '#b45309');

  if (isHovered || (!isFound && animTick % 4 < 2)) {
    px(-7, -12, 14, 13, isOwn ? 'rgba(56, 189, 248, 0.25)' : 'rgba(52, 211, 153, 0.28)');
  }

  // Brass & emerald cylindrical 16-bit geocache capsule
  px(-5, -10, 10, 11, '#140b05');
  px(-4, -11, 8, 2, '#fbbf24'); // brass cap
  px(-3, -11, 4, 1, '#fef9c3');
  const bodyMain = isOwn ? '#0284c7' : isFound ? '#059669' : '#10b981';
  const bodyLight = isOwn ? '#7dd3fc' : '#6ee7b7';
  px(-4, -9, 8, 8, bodyMain);
  px(-3, -9, 2, 7, bodyLight);
  // Wax/brass equatorial band & star seal
  px(-4, -5, 8, 2, '#d97706');
  px(-1, -6, 2, 4, '#fde047');
  px(0, -5, 1, 2, '#ffffff');
}

export function drawDetectorRadarPulse16Bit(
  ctx: CanvasRenderingContext2D,
  opts: {
    cx: number;
    cy: number;
    scale: number;
    animTick: number;
    hot: boolean;
  }
) {
  const { cx, cy, scale, animTick, hot } = opts;
  const phase = animTick % 8;
  const rPx = (14 + phase * 3) * scale;
  ctx.save();
  ctx.strokeStyle = hot
    ? `rgba(251, 191, 36, ${Math.max(0.18, 0.72 - phase * 0.07)})`
    : `rgba(52, 211, 153, ${Math.max(0.15, 0.6 - phase * 0.06)})`;
  ctx.lineWidth = Math.max(2, scale);
  ctx.setLineDash([4 * scale, 3 * scale]);
  ctx.beginPath();
  ctx.arc(Math.round(cx * scale), Math.round(cy * scale), rPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawRelic16BitIcon(
  ctx: CanvasRenderingContext2D,
  relic: ArchivistRelicCatalogItem,
  sizePx: number
) {
  ctx.clearRect(0, 0, sizePx, sizePx);
  const s = Math.max(1, Math.floor(sizePx / 16));
  const ox = Math.floor((sizePx - s * 16) / 2);
  const oy = Math.floor((sizePx - s * 16) / 2);
  const p = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(ox + x * s, oy + y * s, w * s, h * s);
  };

  const { primary, highlight, accent, base } = relic.palette;
  // Subtle parchment backing frame
  p(1, 1, 14, 14, '#2b1d12');
  p(2, 2, 12, 12, '#f8edd6');

  switch (relic.motif) {
    case 'astrolabe':
    case 'compass':
      p(6, 2, 4, 2, accent);
      p(4, 4, 8, 8, base);
      p(5, 5, 6, 6, primary);
      p(6, 6, 4, 4, highlight);
      p(7, 5, 2, 3, accent);
      p(7, 8, 2, 2, base);
      break;
    case 'seal':
      p(4, 4, 8, 8, base);
      p(5, 5, 6, 6, primary);
      p(6, 6, 4, 2, highlight);
      p(7, 7, 2, 3, accent);
      break;
    case 'prism':
      p(7, 3, 2, 2, highlight);
      p(6, 5, 4, 3, primary);
      p(4, 8, 8, 4, base);
      p(5, 8, 6, 3, primary);
      p(6, 5, 1, 5, highlight);
      p(10, 6, 2, 2, accent);
      break;
    case 'feather':
      p(9, 3, 4, 3, highlight);
      p(6, 5, 5, 4, primary);
      p(4, 8, 5, 3, base);
      p(3, 11, 2, 2, accent);
      break;
    case 'vial':
      p(6, 3, 4, 2, accent);
      p(5, 5, 6, 8, base);
      p(6, 6, 4, 6, primary);
      p(6, 7, 2, 3, highlight);
      break;
    case 'keystone':
      p(6, 3, 4, 4, primary);
      p(7, 4, 2, 2, '#f8edd6');
      p(7, 7, 2, 6, base);
      p(9, 10, 2, 1, accent);
      p(9, 12, 2, 1, accent);
      break;
    case 'ammonite':
      p(5, 4, 6, 2, primary);
      p(4, 6, 8, 5, base);
      p(5, 6, 6, 4, primary);
      p(6, 7, 3, 2, highlight);
      p(8, 9, 2, 2, accent);
      break;
    case 'lens':
      p(4, 4, 6, 6, accent);
      p(5, 5, 4, 4, primary);
      p(6, 6, 2, 2, highlight);
      p(9, 9, 4, 4, base);
      break;
    case 'lamp':
      p(11, 5, 2, 2, accent);
      p(4, 7, 8, 4, primary);
      p(5, 7, 5, 2, highlight);
      p(5, 11, 6, 2, base);
      break;
    case 'coin':
    case 'medal':
    default:
      p(5, 3, 6, 2, accent);
      p(4, 5, 8, 7, base);
      p(5, 6, 6, 5, primary);
      p(6, 7, 3, 2, highlight);
      break;
  }
}

export const RelicIconCanvas: React.FC<{
  relicId: string;
  size?: number;
  className?: string;
}> = ({ relicId, size = 40, className = '' }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const relic = getRelicById(relicId);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawRelic16BitIcon(ctx, relic, size);
  }, [relic, size]);

  return React.createElement('canvas', {
    ref,
    width: size,
    height: size,
    className: `pixelated shrink-0 ${className}`,
    'aria-hidden': 'true',
  });
};

// ============================================================================
// LOCAL STORAGE HELPERS FOR OFFLINE / HYBRID PERSISTENCE
// ============================================================================
const OPENED_ARCHIVIST_CHESTS_KEY = 'terra16_opened_archivist_chests_v1';
const FOUND_GEOCACHES_KEY = 'terra16_found_geocaches_v1';
const LOCAL_FALLBACK_GEOCACHES_KEY = 'terra16_local_geocaches_v1';

export function loadOpenedArchivistChests(): OpenedArchivistChestRecord[] {
  try {
    const raw = localStorage.getItem(OPENED_ARCHIVIST_CHESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOpenedArchivistChests(list: OpenedArchivistChestRecord[]): void {
  try {
    localStorage.setItem(OPENED_ARCHIVIST_CHESTS_KEY, JSON.stringify(list.slice(0, 500)));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadFoundGeocacheIds(): Set<string> {
  try {
    const raw = localStorage.getItem(FOUND_GEOCACHES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function saveFoundGeocacheIds(set: Set<string>): void {
  try {
    localStorage.setItem(FOUND_GEOCACHES_KEY, JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    // Ignore
  }
}

export function loadLocalFallbackGeocaches(): ExplorerGeocacheRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_FALLBACK_GEOCACHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalFallbackGeocaches(list: ExplorerGeocacheRecord[]): void {
  try {
    localStorage.setItem(LOCAL_FALLBACK_GEOCACHES_KEY, JSON.stringify(list.slice(0, 120)));
  } catch {
    // Ignore
  }
}
