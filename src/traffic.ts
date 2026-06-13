import * as THREE from 'three';
import { rand, pick, box, lambert, blobShadow, approach, clamp, chromaKeyTex } from './util';
import type { ChromaKey } from './util';

export type VehicleKind = 'car' | 'rickshaw' | 'bike' | 'bus' | 'cart';

export interface Vehicle {
  kind: VehicleKind;
  group: THREE.Group;
  z: number;
  laneX: number;
  offsetX: number;
  targetOffset: number;
  dir: 1 | -1;
  speed: number;
  baseSpeed: number;
  halfLen: number;
  halfWid: number;
  moveTimer: number;
  stopTimer: number;
  nudgeTimer: number;
  passed: boolean; // already behind player (kata bookkeeping)
  brakeMat: THREE.MeshBasicMaterial | null;
  x: number;
  racing: boolean; // bus race pair — speeds oscillate so they trade the lead
  racePhase: number;
  hornTimer: number;
  wrongSide: boolean; // driving against the flow — Ganji's favorite target
  weaver: boolean; // forward vehicle that randomly changes lanes / overtakes
  weaveTimer: number; // countdown to the next lane change
}

const SHIRTS = ['#2563a8', '#8c2f2f', '#3a7d44', '#5c5c5c', '#b3551f'];

// the famous Saddar routes — paint jobs modelled on the real decorated Mazdas:
// 'swoosh' = blue minibus w/ white wave (the classic W-11), 'jingle' = full
// red truck-art bus w/ roof sitters, 'classic' = cream old-timer
interface BusRoute {
  code: string;
  suffix: string;
  style: 'swoosh' | 'jingle' | 'classic';
  base: string;
  top: string;
  bottom: string;
  accent: string;
  gold: string;
}
const BUS_ROUTES: BusRoute[] = [
  {
    code: 'W-11',
    suffix: 'EXPRESS',
    style: 'swoosh',
    base: '#2456a8',
    top: '#c0392b',
    bottom: '#17345e',
    accent: '#ece8f4',
    gold: '#ffd23d',
  },
  {
    code: 'G-7',
    suffix: 'SUPER',
    style: 'jingle',
    base: '#a8242e',
    top: '#1f8c5c',
    bottom: '#7d1f28',
    accent: '#ff7ab8',
    gold: '#ffd23d',
  },
  {
    code: 'M-1',
    suffix: 'SPECIAL',
    style: 'classic',
    base: '#f5e2c8',
    top: '#7d2640',
    bottom: '#2e6e46',
    accent: '#e8b54a',
    gold: '#c0392b',
  },
];

// --- W-11 sprite cutouts: AI-generated views on lime green, keyed at runtime ---
let busSprites: {
  side: THREE.CanvasTexture;
  sideFlip: THREE.CanvasTexture;
  rear: THREE.CanvasTexture;
  front: THREE.CanvasTexture;
} | null = null;
function getBusSprites() {
  if (!busSprites) {
    busSprites = {
      side: chromaKeyTex('/img/bus_side.jpg'),
      sideFlip: chromaKeyTex('/img/bus_side.jpg'),
      rear: chromaKeyTex('/img/bus_rear.jpg'),
      front: chromaKeyTex('/img/bus_front.jpg'),
    };
    // mirrored copy so the kerb-side text still reads left-to-right
    busSprites.sideFlip.wrapS = THREE.RepeatWrapping;
    busSprites.sideFlip.repeat.x = -1;
  }
  return busSprites;
}

// --- generic sprite-cutout vehicle helpers (same recipe as the bus) ---
interface CutoutSprites {
  side: THREE.CanvasTexture;
  sideFlip: THREE.CanvasTexture;
  front: THREE.CanvasTexture;
  rear: THREE.CanvasTexture;
}
export function loadCutout(base: string, key: ChromaKey): CutoutSprites {
  const s = {
    side: chromaKeyTex(`/img/${base}_side.jpg`, key),
    sideFlip: chromaKeyTex(`/img/${base}_side.jpg`, key),
    front: chromaKeyTex(`/img/${base}_front.jpg`, key),
    rear: chromaKeyTex(`/img/${base}_rear.jpg`, key),
  };
  s.sideFlip.wrapS = THREE.RepeatWrapping;
  s.sideFlip.repeat.x = -1; // kerb-side copy mirrored so text reads correctly
  return s;
}
export function cutoutBody(
  s: CutoutSprites,
  sideW: number,
  sideH: number,
  halfW: number,
  faceW: number,
  faceH: number,
  faceZ: number,
  blocker: { w: number; h: number; d: number; color: string },
): THREE.Group {
  const g = new THREE.Group();
  const mat = (map: THREE.Texture) =>
    new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.35 });
  const sideGeo = new THREE.PlaneGeometry(sideW, sideH);
  const right = new THREE.Mesh(sideGeo, mat(s.side));
  right.position.set(halfW, sideH / 2 + 0.02, 0);
  right.rotation.y = Math.PI / 2;
  const left = new THREE.Mesh(sideGeo, mat(s.sideFlip));
  left.position.set(-halfW, sideH / 2 + 0.02, 0);
  left.rotation.y = -Math.PI / 2;
  const faceGeo = new THREE.PlaneGeometry(faceW, faceH);
  const front = new THREE.Mesh(faceGeo, mat(s.front));
  front.position.set(0, faceH / 2 + 0.02, faceZ);
  const rear = new THREE.Mesh(faceGeo, mat(s.rear));
  rear.position.set(0, faceH / 2 + 0.02, -faceZ);
  rear.rotation.y = Math.PI;
  right.name = left.name = 'side';
  front.name = 'front';
  rear.name = 'rear';
  g.add(right, left, front, rear);
  // interior blocker so you cannot see through between the cutouts
  const bl = box(blocker.w, blocker.h, blocker.d, blocker.color, 0, blocker.h / 2 + 0.05, 0);
  bl.name = 'blocker';
  g.add(bl);
  return g;
}

let carSprites: CutoutSprites | null = null;
let carTopTex: THREE.CanvasTexture | null = null;
const CAR_TINTS = [
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#e2e2e2',
  '#cfd6dc',
  '#e6d9b8',
  '#d9b8b8',
  '#b8c4d9',
];
function buildCar(): { group: THREE.Group; brakeMat: THREE.MeshBasicMaterial } {
  if (!carSprites) carSprites = loadCutout('car', 'green');
  // white Mehran sprite, tinted per car for variety (3:1 side, 4:3 faces)
  // small, low interior blocker — only there to kill corner see-through; kept
  // narrower/shorter than the roof sprite's car silhouette so it never pokes out
  // around the car as a slab when seen from above.
  const gr = cutoutBody(carSprites, 4.35, 1.45, 0.95, 2.08, 1.56, 2.08, {
    w: 1.3,
    h: 0.85,
    d: 3.2,
    color: '#e0e0e0',
  });
  // The cutout car has no top face, so the chase cam (looking down) used to see
  // into the open roof. Instead of a boxy cap, lay a real top-down roof sprite
  // FLAT across the car — from above it reads as an actual car roof. Shared
  // texture, rotated 90° so the sprite's length runs along the road (world Z).
  if (!carTopTex) {
    carTopTex = chromaKeyTex('/img/car_top.jpg', 'green');
    carTopTex.center.set(0.5, 0.5);
    carTopTex.rotation = Math.PI / 2;
  }
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 4.2),
    new THREE.MeshBasicMaterial({ map: carTopTex, transparent: true, alphaTest: 0.35 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 1.32; // seated down onto the roofline (1.46 floated too high)
  gr.add(top); // before the tint traverse so the roof takes the car's colour
  const tint = pick(CAR_TINTS);
  gr.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial)
      o.material.color.set(tint);
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial)
      o.material.color.set(tint);
  });
  // wheels inset behind the painted ones
  for (const wz of [1.4, -1.4]) {
    for (const wx of [-0.78, 0.78]) {
      gr.add(box(0.24, 0.6, 0.6, '#16161a', wx, 0.32, wz));
    }
  }
  const brakeMat = new THREE.MeshBasicMaterial({ color: '#3a0d0d' });
  for (const bx of [-0.7, 0.7]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.05), brakeMat);
    b.position.set(bx, 0.8, -2.12);
    gr.add(b);
  }
  gr.add(blobShadow(1.5, 2.6));
  return { group: gr, brakeMat };
}

// magenta-keyed sprite cutouts (rick_side / rick_front / rick_rear in public/img)
let rickSprites: CutoutSprites | null = null;
function buildRickshaw(): THREE.Group {
  if (!rickSprites) rickSprites = loadCutout('rick', 'magenta');
  // side sprite is 4:3 → 2.5m long × 1.88m tall; faces are 3:4
  const gr = cutoutBody(rickSprites, 2.5, 1.88, 0.58, 1.42, 1.9, 1.12, {
    w: 1.0,
    h: 1.3,
    d: 1.8,
    color: '#2a4a32',
  });
  // wheels inset behind the painted ones
  const wf = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.14, 10), lambert('#101014'));
  wf.rotation.z = Math.PI / 2;
  wf.position.set(0, 0.38, 0.9);
  gr.add(wf);
  for (const wx of [-0.45, 0.45]) {
    const w = wf.clone();
    w.position.set(wx, 0.38, -0.65);
    gr.add(w);
  }
  gr.add(blobShadow(1.1, 1.6));
  return gr;
}

let bikeSprites: CutoutSprites | null = null;
export function buildNpcBike(headlight: boolean): THREE.Group {
  if (!bikeSprites) bikeSprites = loadCutout('bike', 'green');
  // CD-70 with rider painted in the sprite (4:3 side, 3:4 faces), very thin body
  const gr = cutoutBody(bikeSprites, 2.25, 1.69, 0.09, 1.28, 1.71, 0.92, {
    w: 0.16,
    h: 1.1,
    d: 1.6,
    color: '#3a2e28',
  });
  if (headlight) {
    const hl = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#fff8d8' }),
    );
    hl.position.set(0, 0.85, 1.0);
    gr.add(hl);
  }
  gr.add(blobShadow(0.6, 1.3));
  return gr;
}

function buildBus(_route: BusRoute): { group: THREE.Group; brakeMat: THREE.MeshBasicMaterial } {
  const gr = new THREE.Group();
  const spr = getBusSprites();
  // painted side cutouts — the whole bus art lives in these (1440x480 sprite)
  const sideGeo = new THREE.PlaneGeometry(10.44, 3.48);
  const right = new THREE.Mesh(
    sideGeo,
    new THREE.MeshBasicMaterial({ map: spr.side, transparent: true, alphaTest: 0.35 }),
  );
  right.position.set(1.28, 1.79, 0);
  right.rotation.y = Math.PI / 2;
  gr.add(right);
  const left = new THREE.Mesh(
    sideGeo,
    new THREE.MeshBasicMaterial({ map: spr.sideFlip, transparent: true, alphaTest: 0.35 }),
  );
  left.position.set(-1.28, 1.79, 0);
  left.rotation.y = -Math.PI / 2;
  gr.add(left);
  // front + rear cutouts (768x1024 sprites)
  const rear = new THREE.Mesh(
    new THREE.PlaneGeometry(2.72, 3.62),
    new THREE.MeshBasicMaterial({ map: spr.rear, transparent: true, alphaTest: 0.35 }),
  );
  rear.position.set(0, 1.83, -5.18);
  rear.rotation.y = Math.PI;
  gr.add(rear);
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(2.72, 3.62),
    new THREE.MeshBasicMaterial({ map: spr.front, transparent: true, alphaTest: 0.35 }),
  );
  front.position.set(0, 1.83, 5.18);
  gr.add(front);
  // interior blocker so you cannot see through between the cutouts
  gr.add(box(2.4, 2.5, 10.0, '#7a6a52', 0, 1.35, 0));
  // roof cargo — the chase camera looks down on the roof
  gr.add(box(2.2, 0.4, 7.8, '#8c5a2a', 0, 2.85, -0.4));
  for (let i = 0; i < 4; i++) {
    gr.add(
      box(
        0.9,
        0.55,
        1.4,
        pick(['#b59b6a', '#8a9b6a', '#9b6a6a']),
        rand(-0.6, 0.6),
        3.3,
        -3.6 + i * 2.1,
      ),
    );
  }
  // wheels inset behind the painted ones
  for (const wz of [3.4, -3.4]) {
    for (const wx of [-1.05, 1.05]) {
      gr.add(box(0.3, 0.85, 0.85, '#16161a', wx, 0.45, wz));
    }
  }
  // two hangers off the kerb-side door
  for (const [hz, lean, armUp] of [
    [-2.9, -0.22, -0.7],
    [-1.6, -0.14, -1.1],
  ] as const) {
    const cond = new THREE.Group();
    cond.add(box(0.3, 0.75, 0.24, '#3a3a42', 0, 0.38, 0));
    cond.add(box(0.42, 0.6, 0.28, pick(SHIRTS), 0, 1.05, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 6), lambert('#c98e63'));
    head.position.y = 1.5;
    cond.add(head);
    const arm = box(0.1, 0.55, 0.1, '#c98e63', 0.28, 1.45, 0);
    arm.rotation.z = armUp;
    cond.add(arm);
    cond.position.set(1.3, 0.45, hz);
    cond.rotation.z = lean; // leaning out
    gr.add(cond);
  }
  // brake lights on top of the painted ones — the flash reads at gameplay speed
  const brakeMat = new THREE.MeshBasicMaterial({ color: '#3a0d0d' });
  for (const bx of [-0.95, 0.95]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.06), brakeMat);
    b.position.set(bx, 1.0, -5.24);
    gr.add(b);
  }
  gr.add(blobShadow(1.8, 5.6));
  return { group: gr, brakeMat };
}

let cartSprites: CutoutSprites | null = null;
function buildCart(): THREE.Group {
  if (!cartSprites) cartSprites = loadCutout('cart', 'green');
  // donkey + cart sprite (2:1 side, 3:4 faces) — donkey faces +z, load at the back
  const gr = cutoutBody(cartSprites, 3.85, 1.92, 0.55, 1.35, 1.8, 1.85, {
    w: 0.95,
    h: 1.15,
    d: 3.1,
    color: '#7a5c3e',
  });
  gr.add(blobShadow(1.1, 2.4));
  return gr;
}

export type KindCounts = Record<VehicleKind, number>;
const KINDS: VehicleKind[] = ['car', 'rickshaw', 'bike', 'bus', 'cart'];

// Explicit per-kind population targets (NOT a weighted roll). Thin bikes pack
// tightly and crowd big vehicles out of the lanes, so weighted-random spawning
// never produced the requested mix — fixed targets guarantee it. Buses +
// rickshaws bumped another 50% (24→36, 11→17; bus rounded up since big vehicles
// under-fill slightly). Empress Market (z80) is inside this zone, so it's
// covered too — including the start, which prefills from SADDAR_TARGETS.
export const SADDAR_TARGETS: KindCounts = { car: 14, rickshaw: 36, bike: 36, bus: 17, cart: 3 };
export const CLIFTON_TARGETS: KindCounts = { car: 4, rickshaw: 3, bike: 3, bus: 1, cart: 1 };

// fraction of the standing population that drives the WRONG WAY against the
// flow. Enforced live in spawn() (not a per-spawn dice roll, which let bikes
// balloon to 60%+). Big vehicles take the far oncoming lane; nimble bikes cut
// straight into the player's lane. Bumped to 0.4 — more bikes/rickshaws (the
// bulk of the mix) come head-on.
const WRONG_SIDE_FRACTION = 0.4;

// share of forward bikes/cars/rickshaws that weave between lanes to overtake.
// Set high (0.8 of the eligible) so ~40% of ALL vehicles are active overtakers
// — the rest of the population is buses/carts/wrong-side, which don't weave.
// They slide between the forward lanes only (never -9 oncoming — no wrong-way).
const WEAVE_FRACTION = 0.8;
const WEAVE_LANES = [-3, 3, 9];

export class Traffic {
  vehicles: Vehicle[] = [];
  private root = new THREE.Group();
  private time = 0;
  targets: KindCounts = { ...SADDAR_TARGETS }; // main swaps per zone
  onBusStop: ((z: number) => void) | null = null;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    // warm ALL sprite textures at boot so no vehicle ever spawns as a bare box
    getBusSprites();
    if (!rickSprites) rickSprites = loadCutout('rick', 'magenta');
    if (!carSprites) carSprites = loadCutout('car', 'green');
    if (!bikeSprites) bikeSprites = loadCutout('bike', 'green');
    if (!cartSprites) cartSprites = loadCutout('cart', 'green');
  }

  reset() {
    for (const v of this.vehicles) this.root.remove(v.group);
    this.vehicles = [];
  }

  /** Front-load the road so a ride opens already bumper-to-bumper. A one-shot
   *  fill only reaches ~half the real density (spawn spacing), so instead we
   *  fast-forward a short approach drive that ENDS at playerZ — vehicles drift
   *  into their natural moving-traffic spread, packing the start to steady-state. */
  prefill(playerZ: number) {
    const STEP = 0.05,
      SPEED = 18,
      STEPS = 320; // 320*0.9 = 288m simulated run-up
    const cb = this.onBusStop;
    this.onBusStop = null; // silent warm-up — no phantom bus horns before the ride
    let z = playerZ - SPEED * STEP * STEPS;
    for (let i = 0; i < STEPS; i++) {
      z += SPEED * STEP;
      this.update(STEP, z);
    }
    this.onBusStop = cb;
  }

  /** Top each kind up toward its target. Tries the neediest kind first and
   *  falls through to the next if spacing rejects it, so one un-placeable kind
   *  (e.g. a bus with no gap) never blocks the rest. */
  private fill(playerZ: number, maxPasses: number) {
    let miss = 0;
    for (let pass = 0; pass < maxPasses && miss < 30; pass++) {
      const have: KindCounts = { car: 0, rickshaw: 0, bike: 0, bus: 0, cart: 0 };
      for (const v of this.vehicles) have[v.kind]++;
      // neediest first, by proportional deficit so the mix stays balanced
      const order = KINDS.filter((k) => have[k] < this.targets[k]).sort(
        (a, b) =>
          (this.targets[b] - have[b]) / this.targets[b] -
          (this.targets[a] - have[a]) / this.targets[a],
      );
      if (order.length === 0) return;
      let placed = false;
      for (const k of order) {
        const before = this.vehicles.length;
        this.spawn(playerZ, k);
        if (this.vehicles.length > before) {
          placed = true;
          break;
        }
      }
      // a single random attempt can miss by bad luck; keep retrying through a
      // streak of misses before concluding the lanes are genuinely full
      miss = placed ? 0 : miss + 1;
    }
  }

  private spawn(playerZ: number, kind: VehicleKind) {
    // Saddar special: two buses dead-even, racing for the next stop's sawariyan
    if (
      kind === 'bus' &&
      playerZ < 880 &&
      Math.random() < 0.55 &&
      !this.vehicles.some((v) => v.racing)
    ) {
      const z = playerZ + rand(100, 240);
      const i = (Math.random() * BUS_ROUTES.length) | 0;
      const j = (i + 1 + ((Math.random() * (BUS_ROUTES.length - 1)) | 0)) % BUS_ROUTES.length;
      this.addBus(-3, z, BUS_ROUTES[i], true, 0);
      this.addBus(3, z - rand(3, 8), BUS_ROUTES[j], true, Math.PI);
      return;
    }
    // Keep ~30% of the standing traffic driving against the flow. A flat
    // per-spawn chance doesn't work: wrong-way bikes ignore each other's
    // spacing (so juloos can pack) and cull fast, so they win the refill race
    // and balloon to 60%+. Instead, gate on the live wrong-side fraction — this
    // holds the target exactly and spreads wrong-way across all kinds. Carts
    // (plodding donkey carts) never do it; the racing bus pair is committed.
    const wrong = this.vehicles.reduce((n, v) => n + (v.wrongSide ? 1 : 0), 0);
    const wrongSide = kind !== 'cart' && wrong < WRONG_SIDE_FRACTION * (this.vehicles.length + 1);

    // a wrong-way bike is rarely alone — often a poora juloos (2-3 bikes), and
    // unlike the big vehicles it cuts straight into the player's lane
    if (wrongSide && kind === 'bike') {
      const intoPath = Math.random() < 0.55;
      const lane = intoPath ? pick([3, 9]) : -9; // cut into your lane, or join the oncoming line
      const z0 = playerZ + rand(140, 330);
      const n = Math.random() < 0.4 ? 2 + ((Math.random() * 2) | 0) : 1;
      for (let i = 0; i < n; i++) {
        this.addWrongBike(lane + rand(-0.7, 0.7), z0 + i * rand(5, 9));
      }
      return;
    }

    let laneX: number;
    let dir: 1 | -1;
    let speed: number;
    if (wrongSide) {
      // cars / rickshaws / buses come head-on up the far-left oncoming lane so
      // they never clip the forward flow (which owns -3/3/9)
      laneX = -9;
      dir = -1;
      speed = kind === 'car' ? rand(12, 17) : kind === 'rickshaw' ? rand(10, 14) : 12;
    } else {
      switch (kind) {
        case 'cart':
          laneX = 9;
          dir = 1;
          speed = rand(3.5, 5);
          break;
        case 'bus':
          laneX = pick([-3, 3]);
          dir = 1;
          speed = 13;
          break;
        default:
          laneX = pick([-3, 3, 9]);
          dir = 1;
          speed = kind === 'car' ? rand(15, 21) : kind === 'rickshaw' ? rand(12, 16) : rand(18, 24);
      }
    }
    // wide spawn window (was 70..280): the denser jam needs the whole visible
    // stretch fillable so big buses can find gaps instead of being crowded out
    const z = playerZ + (dir === 1 ? rand(70, 410) : rand(140, 410));

    let halfLen = 2.3,
      halfWid = 1.2;
    let group: THREE.Group;
    let brakeMat: THREE.MeshBasicMaterial | null = null;
    switch (kind) {
      case 'car': {
        const c = buildCar();
        group = c.group;
        brakeMat = c.brakeMat;
        break;
      }
      case 'rickshaw':
        group = buildRickshaw();
        halfLen = 1.5;
        halfWid = 1.0;
        break;
      case 'bike':
        group = buildNpcBike(dir === -1); // oncoming bikes get a headlight glow
        halfLen = 1.1;
        halfWid = 0.55;
        break;
      case 'bus': {
        const b = buildBus(pick(BUS_ROUTES));
        group = b.group;
        brakeMat = b.brakeMat;
        halfLen = 5.4;
        halfWid = 1.5;
        break;
      }
      case 'cart':
        group = buildCart();
        halfLen = 2.6;
        halfWid = 1.05;
        break;
    }

    // keep spacing in lane
    for (const v of this.vehicles) {
      if (Math.abs(v.laneX - laneX) < 1 && Math.abs(v.z - z) < v.halfLen + halfLen + 16) return;
    }

    if (dir === -1) group.rotation.y = Math.PI;
    group.position.set(laneX, 0, z);
    this.root.add(group);
    // 40% of forward bikes/cars/rickshaws weave between lanes, overtaking the
    // rest — Saddar lane discipline is fiction. (Stays in the forward flow.)
    const weaver = dir === 1 && kind !== 'cart' && kind !== 'bus' && Math.random() < WEAVE_FRACTION;
    this.vehicles.push({
      kind,
      group,
      z,
      laneX,
      offsetX: 0,
      targetOffset: 0,
      dir,
      speed,
      baseSpeed: speed,
      halfLen,
      halfWid,
      moveTimer: rand(3, 8),
      stopTimer: 0,
      nudgeTimer: 0,
      passed: false,
      brakeMat,
      x: laneX,
      racing: false,
      racePhase: 0,
      hornTimer: 0,
      wrongSide,
      weaver,
      weaveTimer: rand(0.6, 3),
    });
  }

  private addWrongBike(laneX: number, z: number) {
    for (const v of this.vehicles) {
      // wrong-way bikes pack tightly together — only a forward vehicle blocks the spot
      if (!v.wrongSide && Math.abs(v.laneX - laneX) < 1 && Math.abs(v.z - z) < v.halfLen + 1.1 + 12)
        return;
    }
    const sp = rand(11, 15);
    const group = buildNpcBike(true);
    group.rotation.y = Math.PI;
    group.position.set(laneX, 0, z);
    this.root.add(group);
    this.vehicles.push({
      kind: 'bike',
      group,
      z,
      laneX,
      offsetX: 0,
      targetOffset: 0,
      dir: -1,
      speed: sp,
      baseSpeed: sp,
      halfLen: 1.1,
      halfWid: 0.55,
      moveTimer: rand(3, 8),
      stopTimer: 0,
      nudgeTimer: 0,
      passed: false,
      brakeMat: null,
      x: laneX,
      racing: false,
      racePhase: 0,
      hornTimer: 0,
      wrongSide: true,
      weaver: false,
      weaveTimer: 0,
    });
  }

  private addBus(laneX: number, z: number, route: BusRoute, racing: boolean, racePhase: number) {
    for (const v of this.vehicles) {
      if (Math.abs(v.laneX - laneX) < 1 && Math.abs(v.z - z) < v.halfLen + 5.4 + 16) return;
    }
    const b = buildBus(route);
    b.group.position.set(laneX, 0, z);
    this.root.add(b.group);
    this.vehicles.push({
      kind: 'bus',
      group: b.group,
      z,
      laneX,
      offsetX: 0,
      targetOffset: 0,
      dir: 1,
      speed: racing ? rand(15.5, 16.5) : 13,
      baseSpeed: racing ? 16 : 13,
      halfLen: 5.4,
      halfWid: 1.5,
      moveTimer: rand(3, 8),
      stopTimer: 0,
      nudgeTimer: 0,
      passed: false,
      brakeMat: b.brakeMat,
      x: laneX,
      racing,
      racePhase,
      hornTimer: rand(1.5, 4),
      wrongSide: false,
      weaver: false,
      weaveTimer: 0,
    });
  }

  /** Vehicle directly ahead of player gets honked aside. Returns true if someone moved. */
  honk(playerZ: number, playerX: number): boolean {
    let nudged = false;
    for (const v of this.vehicles) {
      if (v.dir !== 1 || v.kind === 'bus' || v.kind === 'cart') continue;
      const dz = v.z - playerZ;
      if (
        dz > 3 &&
        dz < 30 &&
        Math.abs(v.x - playerX) < 3 &&
        v.nudgeTimer <= 0 &&
        Math.random() < 0.6
      ) {
        const side = v.x >= playerX ? 1 : -1;
        v.targetOffset = clamp(v.x + side * 2.3, -10.4, 10.4) - v.laneX;
        v.nudgeTimer = 1.6;
        nudged = true;
      }
    }
    return nudged;
  }

  update(dt: number, playerZ: number) {
    this.time += dt;
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.racing) {
        // trade the lead back and forth; never stop for anything
        v.speed = v.baseSpeed + Math.sin(this.time * 1.1 + v.racePhase) * 3.4;
        v.hornTimer -= dt;
        if (v.hornTimer <= 0) {
          v.hornTimer = rand(7, 14); // sparing — the horn was drowning the character
          this.onBusStop?.(v.z); // main plays the truck horn if the player is close
        }
      } else if (v.kind === 'bus') {
        // W-11 stops without warning
        if (v.stopTimer > 0) {
          v.stopTimer -= dt;
          v.speed = approach(v.speed, 0, 26 * dt);
          if (v.brakeMat) v.brakeMat.color.set('#ff2222');
          if (v.stopTimer <= 0) v.moveTimer = rand(4, 9);
        } else {
          v.moveTimer -= dt;
          v.speed = approach(v.speed, v.baseSpeed, 8 * dt);
          if (v.brakeMat) v.brakeMat.color.set('#3a0d0d');
          if (v.moveTimer <= 0) {
            v.stopTimer = rand(1.6, 3);
            this.onBusStop?.(v.z);
          }
        }
      }
      if (v.nudgeTimer > 0) {
        // being honked aside owns the offset briefly; weavers re-pick after
        v.nudgeTimer -= dt;
        if (v.nudgeTimer <= 0) {
          v.targetOffset = 0;
          v.weaveTimer = 0;
        }
      } else if (v.weaver) {
        v.weaveTimer -= dt;
        if (v.weaveTimer <= 0) {
          v.targetOffset = pick(WEAVE_LANES) - v.laneX; // slide to another forward lane
          v.weaveTimer = rand(1.2, 3.5);
        }
      }
      v.offsetX = approach(v.offsetX, v.targetOffset, 4.5 * dt);
      v.z += v.dir * v.speed * dt;
      v.x = v.laneX + v.offsetX;
      v.group.position.set(v.x, 0, v.z);
      v.group.rotation.z =
        v.kind === 'bike'
          ? Math.sin(v.z * 0.1) * 0.04
          : v.racing
            ? Math.sin(this.time * 8 + v.racePhase) * 0.014
            : 0; // racing buses rattle

      if (v.z < playerZ - 60 || v.z > playerZ + 430) {
        this.root.remove(v.group);
        this.vehicles.splice(i, 1);
      }
    }
    this.fill(playerZ, 8); // top up a few per frame as vehicles cull / road opens
  }
}
