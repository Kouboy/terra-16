import {
  ElevationGrid,
  haversineMeters,
  PoiItem,
  sampleElevationMeters,
  TerrainFeature,
} from './types';

export type LoopDurationPresetId = '15min' | '35min' | '60min';

export interface LoopDurationPresetMeta {
  id: LoopDurationPresetId;
  shortLabel: string;
  titleFr: string;
  targetTotalMeters: number;
  minRadiusMeters: number;
  maxRadiusMeters: number;
  desiredStops: number;
}

export const LOOP_DURATION_PRESETS: LoopDurationPresetMeta[] = [
  {
    id: '15min',
    shortLabel: '15 min',
    titleFr: 'Pause Découverte · ~15 min',
    targetTotalMeters: 1150,
    minRadiusMeters: 110,
    maxRadiusMeters: 480,
    desiredStops: 2,
  },
  {
    id: '35min',
    shortLabel: '35 min',
    titleFr: 'Flânerie Patrimoniale · ~35 min',
    targetTotalMeters: 2450,
    minRadiusMeters: 220,
    maxRadiusMeters: 920,
    desiredStops: 3,
  },
  {
    id: '60min',
    shortLabel: '60 min',
    titleFr: 'Grande Boucle d’Éclaireur · ~60 min',
    targetTotalMeters: 4200,
    minRadiusMeters: 360,
    maxRadiusMeters: 1550,
    desiredStops: 4,
  },
];

export interface PlannedLoopStop {
  poi: PoiItem;
  unlocked: boolean;
  cumulativeMeters: number;
}

export interface PlannedRoadLoop {
  id: string;
  presetId: LoopDurationPresetId | 'custom';
  titleFr: string;
  waypoints: Array<{ lat: number; lng: number }>;
  stops: PlannedLoopStop[];
  totalMeters: number;
  estMinutes: number;
  elevGainM: number;
  /** Share (0..100) of total loop distance routed on pedestrian trails, footpaths, stairs, plazas or bridges */
  trailSharePct: number;
  undiscoveredCount: number;
  isClosedLoop: boolean;
}

type WalkWayKind = 'trail' | 'plaza' | 'minor_road' | 'major_road' | 'bridge';

interface GraphNode {
  id: number;
  lat: number;
  lng: number;
  x: number;
  y: number;
}

interface GraphEdge {
  id: number;
  to: number;
  distM: number;
  baseWeight: number;
  wayKind: WalkWayKind;
}

interface SegmentRecord {
  edgeBaseId: number;
  u: number;
  v: number;
  wayKind: WalkWayKind;
  baseWeightFactor: number;
}

export interface PedestrianRoadGraph {
  refLat: number;
  refLng: number;
  cosLat: number;
  nodes: GraphNode[];
  adj: GraphEdge[][];
  segments: SegmentRecord[];
  waterSegments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

const graphCache = new WeakMap<TerrainFeature[], PedestrianRoadGraph>();

function toLocalXY(
  lat: number,
  lng: number,
  refLat: number,
  refLng: number,
  cosLat: number
): { x: number; y: number } {
  return {
    x: (lng - refLng) * 111320 * cosLat,
    y: (lat - refLat) * 110540,
  };
}

function fromLocalXY(
  x: number,
  y: number,
  refLat: number,
  refLng: number,
  cosLat: number
): { lat: number; lng: number } {
  return {
    lat: refLat + y / 110540,
    lng: refLng + x / (111320 * cosLat),
  };
}

function segmentsIntersect2D(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): boolean {
  const ccw = (p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number) =>
    (p3y - p1y) * (p2x - p1x) > (p2y - p1y) * (p3x - p1x);
  return (
    ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
    ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy)
  );
}

function projectPointOnSegment2D(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { projX: number; projY: number; t: number; distSq: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    const d2 = (px - ax) * (px - ax) + (py - ay) * (py - ay);
    return { projX: ax, projY: ay, t: 0, distSq: d2 };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const d2 = (px - projX) * (px - projX) + (py - projY) * (py - projY);
  return { projX, projY, t, distSq: d2 };
}

function wayWeightFactor(kind: WalkWayKind): number {
  switch (kind) {
    case 'bridge':
      return 0.78;
    case 'trail':
      return 0.82;
    case 'plaza':
      return 0.92;
    case 'minor_road':
      return 1.0;
    case 'major_road':
      return 1.32;
  }
}

/**
 * Builds and caches a topological pedestrian & road graph directly from the sector's real
 * OpenStreetMap vector polylines (`path`, `steps`, `minor_road`, `major_road`, `bridge`, `pier`, `plaza`).
 */
export function buildPedestrianRoadGraph(terrain: TerrainFeature[]): PedestrianRoadGraph | null {
  if (!terrain || terrain.length === 0) return null;
  const cached = graphCache.get(terrain);
  if (cached) return cached;

  let refLat = 0;
  let refLng = 0;
  let refFound = false;
  for (const f of terrain) {
    if (f.points.length > 0) {
      refLat = f.points[0].lat;
      refLng = f.points[0].lng;
      refFound = true;
      break;
    }
  }
  if (!refFound) return null;
  const cosLat = Math.max(0.2, Math.cos((refLat * Math.PI) / 180));

  const nodes: GraphNode[] = [];
  const adj: GraphEdge[][] = [];
  const segments: SegmentRecord[] = [];
  const waterSegments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  // Spatial hash for ~9.5 m vertex welding so road intersections & shared junctions merge cleanly
  const WELD_DIST = 9.5;
  const WELD_CELL = 12;
  const spatialCells = new Map<string, number[]>();

  const getOrCreateNode = (lat: number, lng: number): number => {
    const { x, y } = toLocalXY(lat, lng, refLat, refLng, cosLat);
    const cx = Math.floor(x / WELD_CELL);
    const cy = Math.floor(y / WELD_CELL);

    let bestId = -1;
    let bestD2 = WELD_DIST * WELD_DIST;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = spatialCells.get(`${cx + dx}_${cy + dy}`);
        if (!bucket) continue;
        for (const nid of bucket) {
          const n = nodes[nid];
          const d2 = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
          if (d2 <= bestD2) {
            bestD2 = d2;
            bestId = nid;
          }
        }
      }
    }
    if (bestId !== -1) return bestId;

    const id = nodes.length;
    nodes.push({ id, lat, lng, x, y });
    adj.push([]);
    const key = `${cx}_${cy}`;
    const arr = spatialCells.get(key);
    if (arr) arr.push(id);
    else spatialCells.set(key, [id]);
    return id;
  };

  let nextEdgeId = 1;
  const addUndirectedEdge = (u: number, v: number, wayKind: WalkWayKind, factorOverride?: number) => {
    if (u === v) return;
    const nu = nodes[u];
    const nv = nodes[v];
    const distM = Math.hypot(nv.x - nu.x, nv.y - nu.y);
    if (distM < 0.4) return;
    // Avoid duplicate parallel edge
    if (adj[u].some((e) => e.to === v)) return;

    const edgeId = nextEdgeId++;
    const factor = factorOverride ?? wayWeightFactor(wayKind);
    const baseWeight = distM * factor;
    adj[u].push({ id: edgeId, to: v, distM, baseWeight, wayKind });
    adj[v].push({ id: edgeId, to: u, distM, baseWeight, wayKind });
    segments.push({ edgeBaseId: edgeId, u, v, wayKind, baseWeightFactor: factor });
  };

  for (const f of terrain) {
    if (f.points.length < 2) continue;

    // Collect water barriers so short T-junction connectors never jump over rivers/canals!
    if (f.kind === 'waterway' || f.kind === 'water') {
      const step = f.points.length > 60 ? 2 : 1;
      for (let i = 0; i < f.points.length - step; i += step) {
        const a = toLocalXY(f.points[i].lat, f.points[i].lng, refLat, refLng, cosLat);
        const b = toLocalXY(f.points[i + step].lat, f.points[i + step].lng, refLat, refLng, cosLat);
        waterSegments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
      continue;
    }

    let wayKind: WalkWayKind | null = null;
    if (f.kind === 'bridge') {
      if (f.bridgeMode === 'rail') continue;
      wayKind = 'bridge';
    } else if (f.kind === 'path' || f.kind === 'steps' || f.kind === 'pier') {
      wayKind = 'trail';
    } else if (f.kind === 'plaza') {
      wayKind = 'plaza';
    } else if (f.kind === 'minor_road') {
      wayKind = 'minor_road';
    } else if (f.kind === 'major_road') {
      wayKind = 'major_road';
    }

    if (!wayKind) continue;

    const pts =
      f.kind === 'plaza' && f.points.length >= 3
        ? [...f.points, f.points[0]]
        : f.points;

    for (let i = 0; i < pts.length - 1; i++) {
      const pA = pts[i];
      const pB = pts[i + 1];
      const segLen = haversineMeters(pA.lat, pA.lng, pB.lat, pB.lng);
      // Subdivide segments longer than 22 m so intersections & POI projections snap tightly to real curves
      const subCount = Math.max(1, Math.min(24, Math.ceil(segLen / 18)));
      let prevNode = getOrCreateNode(pA.lat, pA.lng);
      for (let s = 1; s <= subCount; s++) {
        const t = s / subCount;
        const iLat = pA.lat + (pB.lat - pA.lat) * t;
        const iLng = pA.lng + (pB.lng - pA.lng) * t;
        const curNode = getOrCreateNode(iLat, iLng);
        addUndirectedEdge(prevNode, curNode, wayKind);
        prevNode = curNode;
      }
    }
  }

  if (nodes.length < 3 || segments.length < 2) return null;

  // Heal small T-junction gaps (<= 18 m) where an OSM footpath/steps ends right next to a street segment
  // without sharing the exact OSM node, while strictly forbidding any water crossing!
  const crossesWater = (ax: number, ay: number, bx: number, by: number): boolean => {
    for (let i = 0; i < waterSegments.length; i++) {
      const w = waterSegments[i];
      if (segmentsIntersect2D(ax, ay, bx, by, w.x1, w.y1, w.x2, w.y2)) {
        return true;
      }
    }
    return false;
  };

  const SNAP_GAP = 18;
  const SNAP_CELL = 20;
  const nodeGrid = new Map<string, number[]>();
  for (const n of nodes) {
    const key = `${Math.floor(n.x / SNAP_CELL)}_${Math.floor(n.y / SNAP_CELL)}`;
    const arr = nodeGrid.get(key);
    if (arr) arr.push(n.id);
    else nodeGrid.set(key, [n.id]);
  }

  for (const n of nodes) {
    if (adj[n.id].length > 1) continue; // Only heal dangling dead-end / T-junction tips
    const cx = Math.floor(n.x / SNAP_CELL);
    const cy = Math.floor(n.y / SNAP_CELL);
    let bestTarget = -1;
    let bestD2 = SNAP_GAP * SNAP_GAP;
    const directNeighbor = adj[n.id][0]?.to ?? -1;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = nodeGrid.get(`${cx + dx}_${cy + dy}`);
        if (!bucket) continue;
        for (const candId of bucket) {
          if (candId === n.id || candId === directNeighbor) continue;
          const c = nodes[candId];
          const d2 = (c.x - n.x) * (c.x - n.x) + (c.y - n.y) * (c.y - n.y);
          if (d2 < bestD2 && !crossesWater(n.x, n.y, c.x, c.y)) {
            bestD2 = d2;
            bestTarget = candId;
          }
        }
      }
    }
    if (bestTarget !== -1) {
      addUndirectedEdge(n.id, bestTarget, 'minor_road', 1.55);
    }
  }

  const graph: PedestrianRoadGraph = {
    refLat,
    refLng,
    cosLat,
    nodes,
    adj,
    segments,
    waterSegments,
  };
  graphCache.set(terrain, graph);
  return graph;
}

interface SnapResult {
  projLat: number;
  projLng: number;
  projX: number;
  projY: number;
  distMeters: number;
  seg: SegmentRecord;
  distToU: number;
  distToV: number;
}

function snapCoordinateToGraph(
  graph: PedestrianRoadGraph,
  lat: number,
  lng: number,
  maxSnapMeters = 280
): SnapResult | null {
  const { x, y } = toLocalXY(lat, lng, graph.refLat, graph.refLng, graph.cosLat);
  let best: SnapResult | null = null;
  let bestD2 = maxSnapMeters * maxSnapMeters;

  for (let i = 0; i < graph.segments.length; i++) {
    const seg = graph.segments[i];
    const nu = graph.nodes[seg.u];
    const nv = graph.nodes[seg.v];
    // Quick bounding box reject
    const minX = (nu.x < nv.x ? nu.x : nv.x) - maxSnapMeters;
    const maxX = (nu.x > nv.x ? nu.x : nv.x) + maxSnapMeters;
    if (x < minX || x > maxX) continue;
    const minY = (nu.y < nv.y ? nu.y : nv.y) - maxSnapMeters;
    const maxY = (nu.y > nv.y ? nu.y : nv.y) + maxSnapMeters;
    if (y < minY || y > maxY) continue;

    const proj = projectPointOnSegment2D(x, y, nu.x, nu.y, nv.x, nv.y);
    if (proj.distSq < bestD2) {
      bestD2 = proj.distSq;
      const ll = fromLocalXY(proj.projX, proj.projY, graph.refLat, graph.refLng, graph.cosLat);
      best = {
        projLat: ll.lat,
        projLng: ll.lng,
        projX: proj.projX,
        projY: proj.projY,
        distMeters: Math.sqrt(proj.distSq),
        seg,
        distToU: Math.hypot(proj.projX - nu.x, proj.projY - nu.y),
        distToV: Math.hypot(proj.projX - nv.x, proj.projY - nv.y),
      };
    }
  }
  return best;
}

export interface RoadLegResult {
  waypoints: Array<{ lat: number; lng: number }>;
  distanceMeters: number;
  trailMeters: number;
  usedEdgeIds: number[];
  snappedSuccessfully: boolean;
}

/**
 * Computes an exact road- & footpath-hugging leg between two coordinates on the real OSM graph.
 * Penalizes edges in `penalizedEdges` (`2.65x`) so loop return legs naturally choose alternate streets/paths!
 */
export function computeRoadSnappedLeg(
  graph: PedestrianRoadGraph | null,
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  penalizedEdges?: ReadonlySet<number>,
  includeFinalDoorstep = true
): RoadLegResult {
  const directDist = haversineMeters(fromLat, fromLng, toLat, toLng);
  if (!graph || directDist < 12) {
    return {
      waypoints: [{ lat: toLat, lng: toLng }],
      distanceMeters: directDist,
      trailMeters: 0,
      usedEdgeIds: [],
      snappedSuccessfully: false,
    };
  }

  const startSnap = snapCoordinateToGraph(graph, fromLat, fromLng, 280);
  const endSnap = snapCoordinateToGraph(graph, toLat, toLng, 280);
  if (!startSnap || !endSnap) {
    return {
      waypoints: [{ lat: toLat, lng: toLng }],
      distanceMeters: directDist,
      trailMeters: 0,
      usedEdgeIds: [],
      snappedSuccessfully: false,
    };
  }

  // Same road segment shortcut!
  if (startSnap.seg.edgeBaseId === endSnap.seg.edgeBaseId) {
    const segDist = haversineMeters(
      startSnap.projLat,
      startSnap.projLng,
      endSnap.projLat,
      endSnap.projLng
    );
    const pts: Array<{ lat: number; lng: number }> = [
      { lat: startSnap.projLat, lng: startSnap.projLng },
      { lat: endSnap.projLat, lng: endSnap.projLng },
    ];
    if (includeFinalDoorstep && endSnap.distMeters > 4 && endSnap.distMeters <= 45) {
      pts.push({ lat: toLat, lng: toLng });
    }
    const isTrail =
      startSnap.seg.wayKind === 'trail' ||
      startSnap.seg.wayKind === 'bridge' ||
      startSnap.seg.wayKind === 'plaza';
    return {
      waypoints: pts,
      distanceMeters: startSnap.distMeters + segDist + (includeFinalDoorstep ? Math.min(45, endSnap.distMeters) : 0),
      trailMeters: isTrail ? segDist : 0,
      usedEdgeIds: [startSnap.seg.edgeBaseId],
      snappedSuccessfully: true,
    };
  }

  const N = graph.nodes.length;
  const gScore = new Float64Array(N);
  gScore.fill(Infinity);
  const prevNode = new Int32Array(N);
  prevNode.fill(-1);
  const prevEdge = new Int32Array(N);
  prevEdge.fill(-1);
  const closed = new Uint8Array(N);

  const heapNodes: number[] = [];
  const heapPrio: number[] = [];
  const push = (node: number, prio: number) => {
    let idx = heapNodes.length;
    heapNodes.push(node);
    heapPrio.push(prio);
    while (idx > 0) {
      const p = (idx - 1) >> 1;
      if (heapPrio[p] <= heapPrio[idx]) break;
      const tn = heapNodes[p];
      const tp = heapPrio[p];
      heapNodes[p] = heapNodes[idx];
      heapPrio[p] = heapPrio[idx];
      heapNodes[idx] = tn;
      heapPrio[idx] = tp;
      idx = p;
    }
  };
  const pop = (): number => {
    const top = heapNodes[0];
    const ln = heapNodes.pop()!;
    const lp = heapPrio.pop()!;
    if (heapNodes.length > 0) {
      heapNodes[0] = ln;
      heapPrio[0] = lp;
      let idx = 0;
      const len = heapNodes.length;
      while (true) {
        const l = idx * 2 + 1;
        const r = l + 1;
        let s = idx;
        if (l < len && heapPrio[l] < heapPrio[s]) s = l;
        if (r < len && heapPrio[r] < heapPrio[s]) s = r;
        if (s === idx) break;
        const tn = heapNodes[s];
        const tp = heapPrio[s];
        heapNodes[s] = heapNodes[idx];
        heapPrio[s] = heapPrio[idx];
        heapNodes[idx] = tn;
        heapPrio[idx] = tp;
        idx = s;
      }
    }
    return top;
  };

  const heuristic = (nid: number) =>
    Math.hypot(graph.nodes[nid].x - endSnap.projX, graph.nodes[nid].y - endSnap.projY) * 0.76;

  // Seed both endpoints of startSnap's road segment
  const startFactor = startSnap.seg.baseWeightFactor;
  const sCostU = startSnap.distToU * startFactor;
  const sCostV = startSnap.distToV * startFactor;
  gScore[startSnap.seg.u] = sCostU;
  push(startSnap.seg.u, sCostU + heuristic(startSnap.seg.u));
  if (sCostV < gScore[startSnap.seg.v]) {
    gScore[startSnap.seg.v] = sCostV;
    push(startSnap.seg.v, sCostV + heuristic(startSnap.seg.v));
  }

  const goalU = endSnap.seg.u;
  const goalV = endSnap.seg.v;
  let expanded = 0;
  const MAX_EXPAND = 12000;

  while (heapNodes.length > 0 && expanded < MAX_EXPAND) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded++;

    if (closed[goalU] && closed[goalV]) break;

    const edges = graph.adj[cur];
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (closed[e.to]) continue;
      const reuseMult = penalizedEdges && penalizedEdges.has(e.id) ? 2.65 : 1.0;
      const candG = gScore[cur] + e.baseWeight * reuseMult;
      if (candG < gScore[e.to]) {
        gScore[e.to] = candG;
        prevNode[e.to] = cur;
        prevEdge[e.to] = e.id;
        push(e.to, candG + heuristic(e.to));
      }
    }
  }

  const endFactor = endSnap.seg.baseWeightFactor;
  const totalViaU = gScore[goalU] + endSnap.distToU * endFactor;
  const totalViaV = gScore[goalV] + endSnap.distToV * endFactor;
  const bestGoalNode = totalViaU <= totalViaV ? goalU : goalV;

  if (!Number.isFinite(gScore[bestGoalNode])) {
    // Disconnected road island fallback: find closest reachable road node to endSnap
    let closestReachable = -1;
    let closestRemSq = Infinity;
    for (let i = 0; i < N; i++) {
      if (!Number.isFinite(gScore[i])) continue;
      const dx = graph.nodes[i].x - endSnap.projX;
      const dy = graph.nodes[i].y - endSnap.projY;
      const d2 = dx * dx + dy * dy;
      if (d2 < closestRemSq) {
        closestRemSq = d2;
        closestReachable = i;
      }
    }
    if (closestReachable === -1 || Math.sqrt(closestRemSq) > directDist * 0.65) {
      return {
        waypoints: [{ lat: toLat, lng: toLng }],
        distanceMeters: directDist,
        trailMeters: 0,
        usedEdgeIds: [],
        snappedSuccessfully: false,
      };
    }

    const fallbackNodes: number[] = [];
    const usedIds: number[] = [];
    let cur = closestReachable;
    let guard = 0;
    while (cur !== -1 && guard < 3000) {
      fallbackNodes.push(cur);
      if (prevEdge[cur] !== -1) usedIds.push(prevEdge[cur]);
      cur = prevNode[cur];
      guard++;
    }
    fallbackNodes.reverse();
    const wps: Array<{ lat: number; lng: number }> = [
      { lat: startSnap.projLat, lng: startSnap.projLng },
      ...fallbackNodes.map((id) => ({ lat: graph.nodes[id].lat, lng: graph.nodes[id].lng })),
      { lat: toLat, lng: toLng },
    ];
    let distAcc = 0;
    for (let i = 1; i < wps.length; i++) {
      distAcc += haversineMeters(wps[i - 1].lat, wps[i - 1].lng, wps[i].lat, wps[i].lng);
    }
    return {
      waypoints: dedupeTightWaypoints(wps),
      distanceMeters: distAcc,
      trailMeters: distAcc * 0.4,
      usedEdgeIds: usedIds,
      snappedSuccessfully: true,
    };
  }

  // Reconstruct exact road node chain
  const chain: number[] = [];
  const usedIds: number[] = [startSnap.seg.edgeBaseId, endSnap.seg.edgeBaseId];
  let trace = bestGoalNode;
  let guard = 0;
  while (trace !== -1 && guard < 4000) {
    chain.push(trace);
    if (prevEdge[trace] !== -1) {
      usedIds.push(prevEdge[trace]);
    }
    trace = prevNode[trace];
    guard++;
  }
  chain.reverse();

  let trailMeters = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    const u = chain[i];
    const v = chain[i + 1];
    const edge = graph.adj[u].find((e) => e.to === v);
    if (edge && (edge.wayKind === 'trail' || edge.wayKind === 'bridge' || edge.wayKind === 'plaza')) {
      trailMeters += edge.distM;
    }
  }

  const rawWaypoints: Array<{ lat: number; lng: number }> = [];
  if (startSnap.distMeters > 3) {
    rawWaypoints.push({ lat: startSnap.projLat, lng: startSnap.projLng });
  }
  for (const nid of chain) {
    rawWaypoints.push({ lat: graph.nodes[nid].lat, lng: graph.nodes[nid].lng });
  }
  rawWaypoints.push({ lat: endSnap.projLat, lng: endSnap.projLng });

  // Only step off the road onto the monument entrance if it sits close to the street/path (<= 38 m)
  if (includeFinalDoorstep && endSnap.distMeters > 3 && endSnap.distMeters <= 38) {
    rawWaypoints.push({ lat: toLat, lng: toLng });
  } else if (includeFinalDoorstep && endSnap.distMeters > 38) {
    // Still end at target POI when explicitly walking to a rural monument, after following the closest trail all the way!
    rawWaypoints.push({ lat: toLat, lng: toLng });
  }

  const waypoints = dedupeTightWaypoints(rawWaypoints);
  let totalDist = 0;
  let prevLat = fromLat;
  let prevLng = fromLng;
  for (const wp of waypoints) {
    totalDist += haversineMeters(prevLat, prevLng, wp.lat, wp.lng);
    prevLat = wp.lat;
    prevLng = wp.lng;
  }

  return {
    waypoints,
    distanceMeters: Math.max(directDist, totalDist),
    trailMeters,
    usedEdgeIds: usedIds,
    snappedSuccessfully: true,
  };
}

function dedupeTightWaypoints(
  pts: Array<{ lat: number; lng: number }>
): Array<{ lat: number; lng: number }> {
  if (pts.length <= 1) return pts;
  const out: Array<{ lat: number; lng: number }> = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1];
    const d = haversineMeters(prev.lat, prev.lng, pts[i].lat, pts[i].lng);
    if (d >= 2.5 || i === pts.length - 1) {
      out.push(pts[i]);
    }
  }
  return out;
}

/**
 * Convenience single-target road-snapped path helper used by PixelMapCanvas click-to-walk.
 */
export function computeStrictRoadWalkPath(
  terrain: TerrainFeature[],
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Array<{ lat: number; lng: number }> | null {
  const graph = buildPedestrianRoadGraph(terrain);
  if (!graph) return null;
  const res = computeRoadSnappedLeg(graph, fromLat, fromLng, toLat, toLng, undefined, true);
  return res.snappedSuccessfully && res.waypoints.length > 0 ? res.waypoints : null;
}

/**
 * Builds a complete multi-stop road-snapped route (and optional closed return-to-start loop!)
 * from an explicit list of POI stops, penalizing already-walked road segments so loops don't backtrack.
 */
export function buildRoadSnappedPoiLoop(params: {
  originLat: number;
  originLng: number;
  stops: PoiItem[];
  unlockedIds: ReadonlySet<string>;
  terrain: TerrainFeature[];
  elevation: ElevationGrid | null;
  closeLoop: boolean;
  presetId?: LoopDurationPresetId | 'custom';
  titleFr?: string;
}): PlannedRoadLoop {
  const {
    originLat,
    originLng,
    stops,
    unlockedIds,
    terrain,
    elevation,
    closeLoop,
    presetId = 'custom',
    titleFr = 'Boucle d’Exploration sur Chemins & Rues',
  } = params;

  const graph = buildPedestrianRoadGraph(terrain);
  const usedEdges = new Set<number>();
  const allWaypoints: Array<{ lat: number; lng: number }> = [];
  const plannedStops: PlannedLoopStop[] = [];

  let curLat = originLat;
  let curLng = originLng;
  let totalMeters = 0;
  let trailMeters = 0;

  for (let i = 0; i < stops.length; i++) {
    const poi = stops[i];
    // Snap intermediate loop stops to the road edge if POI is slightly set back, while still passing within unlockRadius!
    const snapOnlyToRoad = closeLoop && poi.unlockRadiusMeters >= 32;
    const leg = computeRoadSnappedLeg(
      graph,
      curLat,
      curLng,
      poi.lat,
      poi.lng,
      usedEdges,
      !snapOnlyToRoad
    );
    for (const eid of leg.usedEdgeIds) usedEdges.add(eid);
    for (const wp of leg.waypoints) allWaypoints.push(wp);
    totalMeters += leg.distanceMeters;
    trailMeters += leg.trailMeters;

    plannedStops.push({
      poi,
      unlocked: unlockedIds.has(poi.id),
      cumulativeMeters: Math.round(totalMeters),
    });

    const lastWp = leg.waypoints[leg.waypoints.length - 1];
    curLat = lastWp ? lastWp.lat : poi.lat;
    curLng = lastWp ? lastWp.lng : poi.lng;
  }

  if (closeLoop && stops.length > 0) {
    const returnLeg = computeRoadSnappedLeg(
      graph,
      curLat,
      curLng,
      originLat,
      originLng,
      usedEdges,
      true
    );
    for (const wp of returnLeg.waypoints) allWaypoints.push(wp);
    totalMeters += returnLeg.distanceMeters;
    trailMeters += returnLeg.trailMeters;
  }

  // Elevation gain (D+) sampled along every actual road waypoint!
  let elevGain = 0;
  let prevAlt = sampleElevationMeters(elevation, originLat, originLng);
  for (const wp of allWaypoints) {
    const nextAlt = sampleElevationMeters(elevation, wp.lat, wp.lng);
    if (prevAlt !== null && nextAlt !== null && nextAlt > prevAlt + 0.4) {
      elevGain += nextAlt - prevAlt;
    }
    if (nextAlt !== null) prevAlt = nextAlt;
  }

  const roundedMeters = Math.max(40, Math.round(totalMeters));
  // Average leisurely exploration pace: ~72 m/min (+ brief pause per stop)
  const estMinutes = Math.max(
    3,
    Math.round(roundedMeters / 72 + plannedStops.length * 1.2)
  );
  const trailSharePct =
    totalMeters > 10 ? Math.min(100, Math.max(0, Math.round((trailMeters / totalMeters) * 100))) : 0;
  const undiscoveredCount = plannedStops.filter((s) => !s.unlocked).length;

  return {
    id: `loop_${presetId}_${Date.now()}`,
    presetId,
    titleFr,
    waypoints: dedupeTightWaypoints(allWaypoints),
    stops: plannedStops,
    totalMeters: roundedMeters,
    estMinutes,
    elevGainM: Math.round(elevGain),
    trailSharePct,
    undiscoveredCount,
    isClosedLoop: closeLoop,
  };
}

/**
 * Generates a curated 15 / 35 / 60 min closed walking loop around `(originLat, originLng)`
 * whose stops sit along real roads & trails and sweep an authentic non-backtracking circuit!
 */
export function generatePresetWalkingLoop(params: {
  presetId: LoopDurationPresetId;
  originLat: number;
  originLng: number;
  pois: PoiItem[];
  unlockedIds: ReadonlySet<string>;
  terrain: TerrainFeature[];
  elevation: ElevationGrid | null;
  priorityPoiIds?: ReadonlySet<string>;
}): PlannedRoadLoop | null {
  const {
    presetId,
    originLat,
    originLng,
    pois,
    unlockedIds,
    terrain,
    elevation,
    priorityPoiIds,
  } = params;

  const preset =
    LOOP_DURATION_PRESETS.find((p) => p.id === presetId) || LOOP_DURATION_PRESETS[0];
  const graph = buildPedestrianRoadGraph(terrain);
  const cosLat = Math.max(0.2, Math.cos((originLat * Math.PI) / 180));

  // Filter candidate POIs in a comfortable annulus & near walkable roads/paths
  const scoredCandidates: Array<{
    poi: PoiItem;
    distM: number;
    angleRad: number;
    score: number;
  }> = [];

  for (const poi of pois) {
    if (poi.isSubterranean) continue;
    const distM = haversineMeters(originLat, originLng, poi.lat, poi.lng);
    if (distM < preset.minRadiusMeters * 0.55 || distM > preset.maxRadiusMeters * 1.25) continue;

    if (graph) {
      const snap = snapCoordinateToGraph(graph, poi.lat, poi.lng, 165);
      if (!snap) continue; // Ensure every loop stop is genuinely reachable via roads/paths!
    }

    const dx = (poi.lng - originLng) * 111320 * cosLat;
    const dy = (poi.lat - originLat) * 110540;
    const angleRad = Math.atan2(dy, dx);

    const idealRadius = (preset.minRadiusMeters + preset.maxRadiusMeters) * 0.46;
    const radiusFit =
      1 - Math.min(1, Math.abs(distM - idealRadius) / Math.max(180, idealRadius));

    let score = 40 + radiusFit * 35;
    if (!unlockedIds.has(poi.id)) score += 45; // Strongly favor undiscovered seals!
    if (priorityPoiIds && priorityPoiIds.has(poi.id)) score += 35; // Favor Almanac / Hunt anchors!
    if (poi.nearWaterway) score += 10;

    scoredCandidates.push({ poi, distM, angleRad, score });
  }

  // Fallback if sector is sparse: widen radius filter slightly
  if (scoredCandidates.length === 0) {
    const anySurface = pois
      .filter((p) => !p.isSubterranean)
      .map((poi) => ({
        poi,
        distM: haversineMeters(originLat, originLng, poi.lat, poi.lng),
      }))
      .sort((a, b) => a.distM - b.distM)
      .slice(0, preset.desiredStops);

    if (anySurface.length === 0) return null;
    return buildRoadSnappedPoiLoop({
      originLat,
      originLng,
      stops: anySurface.map((s) => s.poi),
      unlockedIds,
      terrain,
      elevation,
      closeLoop: true,
      presetId,
      titleFr: preset.titleFr,
    });
  }

  scoredCandidates.sort((a, b) => b.score - a.score);

  // Pick angularly separated stops + distinct categories so the loop sweeps a genuine circuit!
  const chosen: typeof scoredCandidates = [];
  const usedCategories = new Set<string>();
  const minAngleSep = (Math.PI * 2) / (preset.desiredStops + 1.35);

  for (const cand of scoredCandidates) {
    if (chosen.length >= preset.desiredStops) break;
    const tooCloseAngle = chosen.some((ex) => {
      let diff = Math.abs(cand.angleRad - ex.angleRad);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      const dBetween = haversineMeters(cand.poi.lat, cand.poi.lng, ex.poi.lat, ex.poi.lng);
      return diff < minAngleSep * 0.65 || dBetween < preset.minRadiusMeters * 0.65;
    });
    if (tooCloseAngle) continue;

    if (usedCategories.has(cand.poi.category) && scoredCandidates.length > preset.desiredStops * 2) {
      // Softly prefer category variety on first pass
      if (cand.score < scoredCandidates[0].score - 25) continue;
    }
    chosen.push(cand);
    usedCategories.add(cand.poi.category);
  }

  // Top up if angular constraint was tight
  if (chosen.length < Math.min(2, scoredCandidates.length)) {
    for (const cand of scoredCandidates) {
      if (chosen.length >= preset.desiredStops) break;
      if (chosen.some((c) => c.poi.id === cand.poi.id)) continue;
      const tooTight = chosen.some(
        (c) => haversineMeters(c.poi.lat, c.poi.lng, cand.poi.lat, cand.poi.lng) < 75
      );
      if (!tooTight) chosen.push(cand);
    }
  }

  // Order stops angularly around the centroid of (origin + chosen stops) for a smooth, non-crossing loop!
  let cx = 0;
  let cy = 0;
  for (const c of chosen) {
    cx += (c.poi.lng - originLng) * 111320 * cosLat;
    cy += (c.poi.lat - originLat) * 110540;
  }
  cx /= chosen.length + 1;
  cy /= chosen.length + 1;

  const originAngle = Math.atan2(-cy, -cx);
  chosen.sort((a, b) => {
    const ax = (a.poi.lng - originLng) * 111320 * cosLat - cx;
    const ay = (a.poi.lat - originLat) * 110540 - cy;
    const bx = (b.poi.lng - originLng) * 111320 * cosLat - cx;
    const by = (b.poi.lat - originLat) * 110540 - cy;
    const angA = ((Math.atan2(ay, ax) - originAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const angB = ((Math.atan2(by, bx) - originAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return angA - angB;
  });

  return buildRoadSnappedPoiLoop({
    originLat,
    originLng,
    stops: chosen.map((c) => c.poi),
    unlockedIds,
    terrain,
    elevation,
    closeLoop: true,
    presetId,
    titleFr: preset.titleFr,
  });
}
