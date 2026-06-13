import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROUTE } from './config';
import {
  canvasTexture,
  rand,
  pick,
  box,
  lambert,
  blobShadow,
  approach,
  chromaKeySheet,
  chromaKeyTex,
} from './util';
import {
  makeSaddarFacade,
  makeCliftonFacade,
  makePlazaFacade,
  makeEmpressWall,
  makeBuntingTexture,
  makeBillboard,
  BILLBOARD_ADS,
} from './facades';
import type { FacadeStyle } from './facades';

export interface World {
  potholes: { x: number; z: number; r: number }[];
  update(playerZ: number, dt: number): void;
  /** live crowd-density lever (1 = full). Hides a fraction of the animated
   *  walkers/crossers/pigeons — only used as a last resort on weak devices. */
  setCrowdScale(scale: number): void;
}

// ---------------------------------------------------------------- helpers

const texLoader = new THREE.TextureLoader();
/** AI-generated painted boards/posters (public/img) — for things that are photographic in real Saddar. */
function photoTex(url: string): THREE.Texture {
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function signTex(text: string, bg: string, fg: string): THREE.CanvasTexture {
  return canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.fillStyle = fg;
    ctx.font = '800 52px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 52;
    while (ctx.measureText(text).width > 460 && size > 22) {
      size -= 4;
      ctx.font = `800 ${size}px "Arial Black", sans-serif`;
    }
    ctx.fillText(text, 256, 68);
  });
}

function greenBoardTex(text: string): THREE.CanvasTexture {
  return canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = '#156b35';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, 492, 108);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 44;
    while (ctx.measureText(text).width > 440 && size > 20) {
      size -= 4;
      ctx.font = `700 ${size}px Arial, sans-serif`;
    }
    ctx.fillText(text, 256, 64);
  });
}

/** Collects colored geometry into ONE merged mesh (1 draw call for all static props). */
class StaticMerge {
  private parts: THREE.BufferGeometry[] = [];
  private tmpColor = new THREE.Color();

  add(
    geo: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    ry = 0,
    rx = 0,
    rz = 0,
  ) {
    const g = geo.toNonIndexed();
    g.rotateX(rx);
    g.rotateZ(rz);
    g.rotateY(ry);
    g.translate(x, y, z);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    this.tmpColor.set(color);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = this.tmpColor.r;
      colors[i * 3 + 1] = this.tmpColor.g;
      colors[i * 3 + 2] = this.tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g.computeVertexNormals();
    this.parts.push(g);
    geo.dispose();
  }

  build(): THREE.Mesh {
    const merged = mergeGeometries(this.parts, false)!;
    return new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
  }
}

interface Walker {
  g: THREE.Group;
  z0: number;
  z1: number;
  dir: number;
  speed: number;
  phase: number;
}

interface Pigeon {
  g: THREE.Group;
  bx: number;
  bz: number;
  t: number;
  seed: number;
}

// ---------------------------------------------------------------- world

export function buildWorld(scene: THREE.Scene): World {
  const g = new THREE.Group();
  scene.add(g);
  const S = new StaticMerge();
  // The animated crowd (walkers/crossers/pigeons) is always built at FULL count —
  // each is its own draw call + per-frame update, so it's the real mobile cost,
  // but capable devices should see the whole packed street. On weak hardware the
  // adaptive controller thins it LIVE via setCrowdScale (below), never below ~60%.

  // AI sprite people sheets (sliced into individual characters at runtime).
  // Each slice keeps its source aspect (sheet 1440x480): front 6-col = 0.5,
  // side 5-col = 0.6, seated 4-col = 0.75 — plane w must track h by that ratio
  // or the figures stretch. ~1 unit ≈ 1m, so a ~1.6 tall plane ≈ a real adult.
  const PEOPLE_FRONT = chromaKeySheet('/img/people_front.jpg', 6);
  const PEOPLE_SIDE = chromaKeySheet('/img/people_side.jpg', 5);
  const PEOPLE_SEATED = chromaKeySheet('/img/people_seated.jpg', 4);
  const personBillboard = (tex: THREE.Texture, w = 0.8, h = 1.6) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    m.position.y = h / 2;
    return m;
  };
  // static people are collected, then merged into ONE mesh per character texture
  const staticPeople: { x: number; z: number; tex: number; seated: boolean }[] = [];

  // AI photoreal Karachi garbage heaps (4 variants, lime-green keyed). Source
  // images are 4:3 (768x576) with the heap sitting on the bottom edge, so a
  // billboard with its base at y=0 plants the pile on the ground. Collected here
  // and merged into ONE mesh per texture (few draw calls). Saddar only — Clifton
  // stays clean, so addTrashPile is never called past the bazaar.
  const TRASH_TEX = [1, 2, 3, 4].map((n) => chromaKeyTex(`/img/trash${n}.jpg`));
  const trashPiles: { x: number; z: number; tex: number; w: number; h: number; flip: boolean }[] =
    [];
  function addTrashPile(
    x: number,
    z: number,
    h = rand(1.05, 1.6),
    tex = (Math.random() * TRASH_TEX.length) | 0,
  ) {
    trashPiles.push({ x, z, tex, w: h * 1.333 * rand(0.95, 1.06), h, flip: Math.random() < 0.5 });
  }

  // ---------- atmosphere: hazy Karachi morning ----------
  scene.fog = new THREE.Fog('#d8d2c2', 80, 470);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 14),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        top: { value: new THREE.Color('#6fa3cc') },
        mid: { value: new THREE.Color('#c8d4d6') },
        bot: { value: new THREE.Color('#e8e0cc') },
      },
      vertexShader: `
        varying float vH;
        void main() {
          vH = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
        varying float vH;
        void main() {
          vec3 c = mix(bot, mid, smoothstep(0.0, 0.3, vH));
          c = mix(c, top, smoothstep(0.24, 0.95, vH));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  g.add(dome);

  const sunTex = canvasTexture(128, 128, (ctx) => {
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,248,1)');
    grad.addColorStop(0.2, 'rgba(255,244,214,0.85)');
    grad.addColorStop(1, 'rgba(255,238,200,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  });
  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  sun.scale.setScalar(120);
  sun.position.set(130, 150, 620);
  g.add(sun);

  scene.add(new THREE.HemisphereLight('#dce8ee', '#8a7a62', 1.3));
  const dir = new THREE.DirectionalLight('#fff2da', 2.1);
  dir.position.set(70, 95, 60);
  scene.add(dir);

  // ---------- ground (urban dust, not desert) ----------
  const groundTex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#8f8070';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(60,50,40,0.18)' : 'rgba(190,175,150,0.12)';
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 2.5, 2.5);
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(90, 140);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 2400),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 750);
  g.add(ground);

  // ---------- road (weathered Karachi asphalt) ----------
  const roadLen = ROUTE.length + 200;
  const roadTex = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#3b3b41';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.2)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const xPix = (xw: number) => ((xw + 12.5) / 25) * 512;
    const dust = ctx.createLinearGradient(0, 0, 60, 0);
    dust.addColorStop(0, 'rgba(140,108,70,0.35)');
    dust.addColorStop(1, 'rgba(140,108,70,0)');
    ctx.fillStyle = dust;
    ctx.fillRect(0, 0, 60, 512);
    const dust2 = ctx.createLinearGradient(512, 0, 452, 0);
    dust2.addColorStop(0, 'rgba(140,108,70,0.35)');
    dust2.addColorStop(1, 'rgba(140,108,70,0)');
    ctx.fillStyle = dust2;
    ctx.fillRect(452, 0, 60, 512);
    for (let y = 0; y < 512; y += 48) {
      if (Math.random() < 0.7) {
        ctx.fillStyle = 'rgba(235,235,225,0.4)';
        ctx.fillRect(xPix(-11.7), y, 4, 34);
        ctx.fillRect(xPix(11.5), y, 4, 34);
      }
    }
    for (let y = 0; y < 512; y += 36) {
      if (Math.random() < 0.85) {
        ctx.fillStyle = 'rgba(199,154,46,0.75)';
        ctx.fillRect(xPix(-6.15), y, 4, 30);
        ctx.fillRect(xPix(-5.75), y, 4, 30);
      }
    }
    for (let y = 0; y < 512; y += 128) {
      for (const lx of [0, 6]) {
        if (Math.random() < 0.8) {
          ctx.fillStyle = `rgba(235,235,225,${0.35 + Math.random() * 0.25})`;
          ctx.fillRect(xPix(lx) + (Math.random() * 3 - 1.5), y + Math.random() * 14, 5, 52);
        }
      }
    }
    // faint oil stains only — kept subtle so they don't read as shadows
    for (let i = 0; i < 4; i++) {
      const ox = xPix([-9, -3, 3, 9][(Math.random() * 4) | 0]) + (Math.random() * 14 - 7);
      const oy = Math.random() * 512;
      const og = ctx.createRadialGradient(ox, oy, 1, ox, oy, 8 + Math.random() * 8);
      og.addColorStop(0, 'rgba(12,12,16,0.18)');
      og.addColorStop(1, 'rgba(12,12,16,0)');
      ctx.fillStyle = og;
      ctx.fillRect(ox - 18, oy - 18, 36, 36);
    }
  });
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, roadLen / 16);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(25, roadLen),
    new THREE.MeshLambertMaterial({ map: roadTex }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, roadLen / 2 - 80);
  g.add(road);

  // Saddar: WIDE footpaths squeeze the road — bazaar streets are narrow
  for (const side of [-1, 1]) {
    g.add(box(4.4, 0.3, 1030, '#8e8e86', side * 13.1, 0.15, 495));
    g.add(box(3.2, 0.3, 620, '#9a9a92', side * 14.1, 0.15, 1310));
  }
  const curbTex = canvasTexture(128, 16, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#222222' : '#e8c63d';
      ctx.fillRect(i * 16, 0, 16, 16);
    }
  });
  curbTex.wrapS = THREE.RepeatWrapping;
  curbTex.repeat.set(72, 1);
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.34, 1020),
      new THREE.MeshLambertMaterial({ map: curbTex }),
    );
    curb.position.set(side * 11.0, 0.17, 490);
    g.add(curb);
    // Clifton curbs: clean, freshly painted
    const ccurb = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.34, 240),
      new THREE.MeshLambertMaterial({ map: curbTex }),
    );
    ccurb.position.set(side * 12.55, 0.17, 1260);
    g.add(ccurb);
  }

  // ---------- potholes ----------
  const potholes: World['potholes'] = [];
  const phMat = lambert('#17171c');
  for (let i = 0; i < 19; i++) {
    // Saddar is crater country; Clifton roads are kept smooth
    const z = i < 16 ? rand(60, 990) : rand(1160, 1330);
    const x = rand(-9.2, 9.2);
    const r = rand(0.85, 1.3);
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 12), phMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.05, z);
    g.add(m);
    potholes.push({ x, z, r });
  }

  // ---------- zebra crossings ----------
  for (const cz of [775, 870]) {
    for (let i = 0; i < 7; i++) {
      S.add(new THREE.BoxGeometry(1.7, 0.03, 0.9), '#ddd8cc', -10.2 + i * 3.4, 0.03, cz);
    }
    for (const side of [-1, 1]) {
      const stub = new THREE.Mesh(new THREE.PlaneGeometry(30, 11), lambert('#3a3a40'));
      stub.rotation.x = -Math.PI / 2;
      stub.position.set(side * 29, 0.005, cz + 8);
      g.add(stub);
    }
  }

  // ================= FRONT-ROW FACADE BUILDINGS =================
  // Just a few procedural facades for variety; the photoreal AI ones now carry
  // the look (8 of them → ~73% of Saddar buildings).
  const saddarStyles: FacadeStyle[] = Array.from({ length: 3 }, makeSaddarFacade);
  // AI-photographed Saddar facades (public/img/facade_*.jpg). 1-4 are 3-storey
  // colonial blocks; 5-8 are taller weathered 4-storey commercial fronts with
  // signboard ground floors — floors set so the texture maps without stretching.
  saddarStyles.push(
    { tex: photoTex('/img/facade_1.jpg'), base: '#cbb892', floors: 3 },
    { tex: photoTex('/img/facade_2.jpg'), base: '#c08a76', floors: 3 },
    { tex: photoTex('/img/facade_3.jpg'), base: '#d9c27e', floors: 3 },
    { tex: photoTex('/img/facade_4.jpg'), base: '#d8a892', floors: 3 },
    { tex: photoTex('/img/facade_5.jpg'), base: '#cdbd96', floors: 4 },
    { tex: photoTex('/img/facade_6.jpg'), base: '#d3c39a', floors: 4 },
    { tex: photoTex('/img/facade_7.jpg'), base: '#c9b888', floors: 4 },
    { tex: photoTex('/img/facade_8.jpg'), base: '#d6c69e', floors: 4 },
  );
  // A couple of procedural towers + photoreal AI tower facades (9:16, mapped onto
  // the tall Clifton tower planes). floors is unused for Clifton (height = rand 26-48).
  const cliftonStyles: FacadeStyle[] = Array.from({ length: 2 }, makeCliftonFacade);
  cliftonStyles.push(
    { tex: photoTex('/img/tower_1.jpg'), base: '#cfc8b8', floors: 12 },
    { tex: photoTex('/img/tower_2.jpg'), base: '#d2cdc0', floors: 12 },
    { tex: photoTex('/img/tower_3.jpg'), base: '#c8c2b4', floors: 12 },
    { tex: photoTex('/img/tower_4.jpg'), base: '#cdc7ba', floors: 12 },
  );
  const plazaStyle = makePlazaFacade();
  const allStyles = [...saddarStyles, ...cliftonStyles, plazaStyle];
  const facadeGeos: THREE.BufferGeometry[][] = allStyles.map(() => []);

  interface Volume {
    x: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    color: string;
  }
  const volumes: Volume[] = [];

  // Rooftop clutter — the thing that kills the flat box-top skyline. Every real
  // Karachi roof carries water tanks on steel stands, a parapet rim, a stair-head
  // mumty, dish antennas, tangled cable. All solid colour → folds into the one
  // merged static mesh (≈free). Saddar roofs are grimier/lower; Clifton adds an
  // AC/water plant block + taller parapet.
  function addRooftop(
    side: number,
    faceX: number,
    depth: number,
    h: number,
    w: number,
    z: number,
    clifton: boolean,
  ) {
    const frontX = side * faceX; // road-facing edge
    const backX = side * (faceX + depth);
    const midX = (frontX + backX) / 2;
    const parH = clifton ? 1.0 : rand(0.55, 0.85);
    const parCol = clifton
      ? pick(['#d4cdba', '#cdc6b4', '#c8c2b0'])
      : pick(['#cfc3a4', '#c8b896', '#bfb59a', '#c4b8a0', '#b8ad90']);
    // parapet rim: front edge (runs along z) + the two side edges (run along x, seen as you pass)
    S.add(new THREE.BoxGeometry(0.34, parH, w * 0.98), parCol, frontX, h + parH / 2, z);
    for (const sez of [z - w / 2 + 0.17, z + w / 2 - 0.17]) {
      S.add(new THREE.BoxGeometry(depth * 0.96, parH, 0.34), parCol, midX, h + parH / 2, sez);
    }
    // water tanks on steel stands (plastic green/blue/black + the odd stainless)
    const nTanks = 1 + ((Math.random() * (clifton ? 3 : 2.3)) | 0);
    for (let t = 0; t < nTanks; t++) {
      const tx = midX + rand(-depth * 0.28, depth * 0.28);
      const tz = z + rand(-w * 0.34, w * 0.34);
      const plastic = Math.random() < 0.68;
      const tr = rand(0.4, 0.58);
      const th = rand(0.95, 1.4);
      S.add(new THREE.BoxGeometry(tr * 1.7, 0.46, tr * 1.7), '#6a6a64', tx, h + 0.23, tz); // stand
      const col = plastic
        ? pick(['#2e7d32', '#1f6b2e', '#2e5e8c', '#1a1a1a', '#3a6ea5'])
        : '#b9bdc2';
      S.add(new THREE.CylinderGeometry(tr, tr, th, 8), col, tx, h + 0.46 + th / 2, tz); // tank body
      S.add(
        new THREE.CylinderGeometry(tr * 0.5, tr * 0.6, 0.12, 7),
        plastic ? '#141414' : '#9aa0a4',
        tx,
        h + 0.46 + th + 0.05,
        tz,
      ); // lid
    }
    // stair-head mumty toward the back of the roof (also breaks the silhouette)
    if (Math.random() < (clifton ? 0.5 : 0.4)) {
      const mw = rand(1.8, 2.6),
        mh = rand(2.0, 2.8),
        md = rand(1.7, 2.5);
      const mx = backX - side * depth * 0.28;
      const mz = z + rand(-w * 0.18, w * 0.18);
      S.add(new THREE.BoxGeometry(md, mh, mw), parCol, mx, h + mh / 2, mz);
      S.add(new THREE.BoxGeometry(md + 0.22, 0.22, mw + 0.22), parCol, mx, h + mh + 0.11, mz); // little cap
    }
    // satellite dish on a short pole, tilted skyward
    if (Math.random() < 0.3) {
      const dx = midX + rand(-depth * 0.22, depth * 0.22);
      const dz = z + rand(-w * 0.32, w * 0.32);
      S.add(new THREE.CylinderGeometry(0.035, 0.035, 0.66, 5), '#d8d8d0', dx, h + 0.33, dz);
      S.add(
        new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12),
        '#edeae0',
        dx,
        h + 0.66,
        dz,
        0,
        0,
        0.55,
      );
    }
    // Clifton roofs carry a grey AC / water plant block
    if (clifton) {
      S.add(new THREE.BoxGeometry(depth * 0.42, 0.95, w * 0.32), '#9a9a94', midX, h + 0.48, z);
    }
  }

  const inGap = (side: number, z: number, w: number) => {
    const zones: [number, number][] =
      side < 0
        ? [
            [2, 95],
            [166, 198],
            [446, 480],
            [765, 792],
            [842, 898],
            [990, 1145],
          ]
        : [
            [274, 326],
            [586, 618],
            [762, 814],
            [896, 1145],
          ];
    return zones.some(([a, b]) => z + w / 2 > a && z - w / 2 < b);
  };

  function placeFacade(
    side: number,
    z: number,
    styleIdx: number,
    h: number,
    w: number,
    faceX: number,
    depth: number,
    clifton = false,
  ) {
    const style = allStyles[styleIdx];
    const p = new THREE.PlaneGeometry(w * 0.985, h);
    p.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    p.translate(side * (faceX - 0.06), h / 2, z);
    facadeGeos[styleIdx].push(p);
    volumes.push({ x: side * (faceX + depth / 2), z, sx: depth, sy: h, sz: w, color: style.base });
    addRooftop(side, faceX, depth, h, w, z, clifton);
  }

  // Saddar + Zainab + Regal stretch (dense low-rise colonial)
  for (const side of [-1, 1]) {
    let z = -30;
    while (z < 1000) {
      const w = rand(10, 13);
      z += w / 2;
      if (!inGap(side, z, w)) {
        const styleIdx = (Math.random() * saddarStyles.length) | 0;
        const floors = saddarStyles[styleIdx].floors;
        // wider height jitter (+occasional extra storey) so the cornice line isn't ruler-flat
        const h = floors * 3.1 + rand(0.2, 1.6) + (Math.random() < 0.28 ? rand(2.4, 4.2) : 0);
        placeFacade(side, z, styleIdx, h, w, 15.0 + rand(0, 0.8), rand(8, 12));
      }
      z += w / 2 + rand(0.2, 0.8);
    }
  }
  // Rainbow Centre (left, Zaibunnisa)
  placeFacade(-1, 182, allStyles.length - 1, 16, 26, 15.4, 16);

  // Clifton towers + bungalow walls
  for (const side of [-1, 1]) {
    let z = 1150;
    while (z < 1370) {
      const w = rand(16, 22);
      z += w / 2;
      if (Math.random() < 0.65) {
        const styleIdx = saddarStyles.length + ((Math.random() * cliftonStyles.length) | 0);
        const h = rand(26, 48);
        placeFacade(side, z, styleIdx, h, w, 16.5 + rand(0, 3), rand(14, 18), true);
      } else {
        const wl = w * 0.9;
        S.add(new THREE.BoxGeometry(0.4, 2.3, wl), '#d8cfbc', side * 15.2, 1.15, z);
        for (let b = 0; b < 6; b++) {
          S.add(
            new THREE.SphereGeometry(rand(0.5, 0.85), 6, 5),
            pick(['#c2185b', '#e91e8c', '#ad1457', '#3e7d3a']),
            side * 15.2 + rand(-0.4, 0.4),
            2.3 + rand(0, 0.5),
            z - wl / 2 + (b + 0.5) * (wl / 6),
          );
        }
        S.add(new THREE.BoxGeometry(8, 4.5, wl * 0.7), '#cfc5b0', side * 21, 2.25, z);
      }
      z += w / 2 + rand(2, 5);
    }
  }

  allStyles.forEach((style, i) => {
    if (!facadeGeos[i].length) return;
    const merged = mergeGeometries(facadeGeos[i], false)!;
    g.add(new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ map: style.tex })));
  });

  const volGeo = new THREE.BoxGeometry(1, 1, 1);
  volGeo.translate(0, 0.5, 0);
  const volMesh = new THREE.InstancedMesh(volGeo, new THREE.MeshLambertMaterial(), volumes.length);
  {
    const mtx = new THREE.Matrix4();
    const col = new THREE.Color();
    volumes.forEach((v, i) => {
      mtx.makeScale(v.sx, v.sy, v.sz).setPosition(v.x, 0, v.z);
      volMesh.setMatrixAt(i, mtx);
      volMesh.setColorAt(i, col.set(v.color));
    });
    volMesh.instanceMatrix.needsUpdate = true;
    if (volMesh.instanceColor) volMesh.instanceColor.needsUpdate = true;
  }
  g.add(volMesh);

  // ---------- back rows + skyline silhouettes (kill the empty horizon) ----------
  const winTex = canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = '#f7f1e6';
    ctx.fillRect(0, 0, 128, 256);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 4; col++) {
        const lit = Math.random() < 0.18;
        ctx.fillStyle = lit ? 'rgba(255,190,90,0.6)' : 'rgba(38,42,62,0.42)';
        ctx.fillRect(10 + col * 30, 14 + row * 28, 18, 16);
      }
    }
  });
  const WARM = ['#d9b38c', '#cfa176', '#e3c79d', '#bf8f6f', '#d6c0a4', '#c4a78a'];
  const COOL = ['#9fb0bd', '#b6c3cc', '#8fa3b5', '#cfd8da'];
  interface Inst {
    x: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    color: string;
  }
  const backInsts: Inst[] = [];
  for (const side of [-1, 1]) {
    for (let z = -40; z < ROUTE.length + 40; z += rand(14, 20)) {
      if (z > 990 && z < 1150) continue;
      const clifton = z > 1150;
      backInsts.push({
        x: side * (30 + rand(4, 14)),
        z,
        sx: rand(10, 16),
        sy: clifton ? rand(30, 70) : rand(12, 26),
        sz: rand(10, 14),
        color: pick(clifton ? COOL : WARM),
      });
      // third row silhouettes — always something on the horizon
      backInsts.push({
        x: side * (52 + rand(6, 30)),
        z: z + rand(-6, 6),
        sx: rand(12, 20),
        sy: clifton ? rand(20, 55) : rand(16, 34),
        sz: rand(12, 18),
        color: pick(clifton ? COOL : WARM),
      });
    }
  }
  // far shore skyline across the water (bridge view)
  for (const side of [-1, 1]) {
    for (let z = 1000; z < 1150; z += 16) {
      backInsts.push({
        x: side * rand(46, 130),
        z,
        sx: rand(10, 18),
        sy: rand(10, 30),
        sz: rand(10, 16),
        color: pick(WARM),
      });
    }
  }
  const backMesh = new THREE.InstancedMesh(
    volGeo.clone(),
    new THREE.MeshLambertMaterial({ map: winTex }),
    backInsts.length,
  );
  {
    const mtx = new THREE.Matrix4();
    const col = new THREE.Color();
    backInsts.forEach((b, i) => {
      mtx.makeScale(b.sx, b.sy, b.sz).setPosition(b.x, 0, b.z);
      backMesh.setMatrixAt(i, mtx);
      backMesh.setColorAt(i, col.set(b.color));
    });
    backMesh.instanceMatrix.needsUpdate = true;
    if (backMesh.instanceColor) backMesh.instanceColor.needsUpdate = true;
  }
  g.add(backMesh);

  // white mosque minaret + dome behind Saddar (every skyline photo has one)
  {
    const mTex = lambert('#f0ece0');
    const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 22, 8), mTex);
    minaret.position.set(-40, 11, 250);
    g.add(minaret);
    S.add(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 8), '#f0ece0', -40, 16.5, 250);
    S.add(new THREE.SphereGeometry(1.1, 8, 6), '#2c8c6a', -40, 23, 250);
    S.add(new THREE.CylinderGeometry(0.04, 0.04, 2, 4), '#caa84a', -40, 24.8, 250);
    S.add(
      new THREE.SphereGeometry(4.2, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      '#2c8c6a',
      -47,
      12,
      258,
    );
    S.add(new THREE.BoxGeometry(12, 12, 12), '#e8e0d0', -47, 6, 258);
  }

  // ---------- hanging shop signs ----------
  const hangSigns = [
    signTex('ZAINAB MARKET', '#1f5c8c', '#ffffff'),
    signTex('DISCO BAKERY', '#8c1f3a', '#ffffff'),
    signTex('UNITED MOBILE', '#222222', '#3ddc84'),
    signTex('BOMBAY SWEETS', '#176b38', '#ffe9b0'),
    signTex('SARVIS SHOES', '#c0392b', '#ffffff'),
    signTex('GULF JEWELLERS', '#23355c', '#ffd23d'),
  ];
  for (let i = 0; i < 12; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.0),
      new THREE.MeshBasicMaterial({ map: hangSigns[i % hangSigns.length], side: THREE.DoubleSide }),
    );
    sign.position.set(side * 13.6, 3.6 + rand(0, 1), 50 + i * 72 + rand(-15, 15));
    g.add(sign);
  }

  // vertical stacked-letter signs
  const vertTex = (text: string, bg: string, fg: string) =>
    canvasTexture(96, 512, (ctx) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 96, 512);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 88, 504);
      ctx.fillStyle = fg;
      ctx.font = '800 46px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const chars = text.slice(0, 9).split('');
      chars.forEach((ch, i) =>
        ctx.fillText(ch, 48, 40 + i * (440 / Math.max(chars.length - 1, 1))),
      );
    });
  const vertSigns: { z: number; side: number; text: string; bg: string; fg: string }[] = [
    { z: 120, side: 1, text: 'HOTEL', bg: '#8c1f3a', fg: '#ffffff' },
    { z: 240, side: -1, text: 'MOBILE', bg: '#23355c', fg: '#7fd4ff' },
    { z: 395, side: 1, text: 'WATCHES', bg: '#15364a', fg: '#ffd23d' },
    { z: 520, side: -1, text: 'CLOTH', bg: '#176b38', fg: '#ffe9b0' },
    { z: 660, side: 1, text: 'FABRICS', bg: '#c0392b', fg: '#ffffff' },
    { z: 845, side: 1, text: 'BOOKS', bg: '#7d2640', fg: '#ffe9b0' },
    { z: 935, side: -1, text: 'BIRYANI', bg: '#b3551f', fg: '#ffffff' },
  ];
  for (const vs of vertSigns) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 4.8),
      new THREE.MeshBasicMaterial({ map: vertTex(vs.text, vs.bg, vs.fg) }),
    );
    m.position.set(vs.side * 14.9, 4.4, vs.z);
    m.rotation.y = vs.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(m);
  }

  // ---------- poles + wires ----------
  const poleGeo = new THREE.CylinderGeometry(0.13, 0.16, 7.6, 6);
  const poleZs: number[] = [];
  for (let z = -40; z < ROUTE.length + 40; z += 40) poleZs.push(z);
  const poles = new THREE.InstancedMesh(poleGeo, lambert('#4a4038'), poleZs.length * 2);
  {
    const mtx = new THREE.Matrix4();
    let pi = 0;
    for (const side of [-1, 1]) {
      for (const z of poleZs) {
        mtx.makeTranslation(side * 13.9, 3.8, z);
        poles.setMatrixAt(pi++, mtx);
      }
    }
  }
  g.add(poles);

  const wirePts: number[] = [];
  const addWire = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    sag: number,
    sub: number,
  ) => {
    let px = x1,
      py = y1,
      pz = z1;
    for (let k = 1; k <= sub; k++) {
      const t = k / sub;
      const nx = x1 + (x2 - x1) * t;
      const nz = z1 + (z2 - z1) * t;
      const ny = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * sag;
      wirePts.push(px, py, pz, nx, ny, nz);
      px = nx;
      py = ny;
      pz = nz;
    }
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < poleZs.length - 1; i++) {
      addWire(side * 13.9, 7.4, poleZs[i], side * 13.9, 7.4, poleZs[i + 1], 0.8, 5);
      addWire(side * 13.9, 7.0, poleZs[i], side * 13.9, 7.0, poleZs[i + 1], 1.1, 5);
      addWire(side * 13.9, 6.7, poleZs[i], side * 13.9, 6.6, poleZs[i + 1], 1.4, 5);
    }
  }
  for (let z = 50; z < 1000; z += 90) addWire(-13.9, 7.4, z, 13.9, 7.4, z, 1.5, 8);
  for (let z = 1180; z < ROUTE.length; z += 180) addWire(-13.9, 7.4, z, 13.9, 7.4, z, 1.5, 8);
  for (const side of [-1, 1]) {
    for (let z = 20; z < 1000; z += 70) {
      addWire(side * 13.9, 7.0, z, side * 15.0, rand(4.5, 6.2), z + rand(-12, 12), 0.3, 3);
      addWire(side * 13.9, 7.4, z, side * 15.0, rand(5, 6.6), z + rand(-18, 18), 0.4, 3);
    }
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  g.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: '#1c1814' })));

  for (let i = 0; i < 7; i++) {
    const wz = 50 + ((i * 180) % 950);
    const wx = rand(-8, 8);
    const sag = Math.sin(((wx + 13.9) / 27.8) * Math.PI) * 1.5;
    S.add(new THREE.SphereGeometry(0.12, 6, 5), '#141414', wx, 7.46 - sag, wz);
  }

  // ---------- banners + bunting (dense bazaar canopy) ----------
  const bannerData = [
    { z: 90, text: 'SADDAR SUNDAY BAZAAR', bg: '#c0392b' },
    { z: 300, text: 'EID SALE — SAB KUCH 50% OFF', bg: '#176b38' },
    { z: 560, text: 'ZAINAB MARKET — LAWN VOL. 9', bg: '#8c1f3a' },
    { z: 700, text: 'WELCOME TO BOHRI BAZAAR', bg: '#1f5c8c' },
  ];
  for (const b of bannerData) {
    const tex = canvasTexture(1024, 128, (ctx) => {
      ctx.fillStyle = b.bg;
      ctx.fillRect(0, 0, 1024, 118);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 64px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.text, 512, 60);
      ctx.fillStyle = b.bg;
      for (let x = 0; x < 1024; x += 32) {
        ctx.beginPath();
        ctx.arc(x + 16, 118, 10, 0, Math.PI);
        ctx.fill();
      }
    });
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 2.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    banner.position.set(0, 7.4, b.z);
    banner.rotation.y = Math.PI;
    g.add(banner);
  }
  const buntingTex = makeBuntingTexture();
  for (const bz of [55, 150, 250, 360, 470, 600, 660, 750, 830]) {
    const bunt = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 1.6),
      new THREE.MeshBasicMaterial({ map: buntingTex, transparent: true, side: THREE.DoubleSide }),
    );
    bunt.position.set(0, 6.3, bz);
    bunt.rotation.y = Math.PI;
    g.add(bunt);
  }

  // ---------- green road boards ----------
  const boards = [
    { z: 48, text: 'Empress Market' },
    { z: 585, text: 'Zainab Market →' },
    { z: 758, text: 'Regal Chowk' },
    { z: 1012, text: 'Clifton Bridge' },
    { z: 1290, text: 'Teen Talwar' },
  ];
  for (const b of boards) {
    g.add(box(0.18, 6, 0.18, '#6a6a6a', 11.2, 3, b.z));
    g.add(box(5.4, 0.16, 0.16, '#6a6a6a', 8.4, 5.9, b.z));
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(6.6, 1.7),
      new THREE.MeshBasicMaterial({ map: greenBoardTex(b.text) }),
    );
    board.position.set(7.6, 5, b.z);
    board.rotation.y = Math.PI;
    g.add(board);
  }

  // ---------- billboards ----------
  const bbSpots: { side: number; z: number; y: number }[] = [
    { side: 1, z: 160, y: 12 },
    { side: -1, z: 1190, y: 30 },
    { side: 1, z: 1265, y: 34 },
    { side: -1, z: 1330, y: 28 },
  ];
  bbSpots.forEach((spot, i) => {
    // the Saddar hoarding gets the printed Stoodent Biryani ad; the rest stay painted
    const photo = i === 0;
    const bb = new THREE.Mesh(
      new THREE.PlaneGeometry(photo ? 9.6 : 10, photo ? 5.4 : 3.9),
      new THREE.MeshBasicMaterial({
        map: photo
          ? photoTex('/img/billboard_biryani.jpg')
          : makeBillboard(BILLBOARD_ADS[i % BILLBOARD_ADS.length]),
      }),
    );
    const x = spot.side * 19;
    bb.position.set(x, spot.y + 2, spot.z);
    bb.rotation.y = Math.PI + spot.side * -0.35;
    g.add(bb);
    S.add(
      new THREE.BoxGeometry(0.3, spot.y + 2, 0.3),
      '#4a4a4a',
      x - 3 * spot.side,
      (spot.y + 2) / 2,
      spot.z,
    );
    S.add(
      new THREE.BoxGeometry(0.3, spot.y + 2, 0.3),
      '#4a4a4a',
      x + 3 * spot.side,
      (spot.y + 2) / 2,
      spot.z,
    );
  });

  // ================= EMPRESS MARKET (z 35, left) =================
  {
    const BUFF = '#c1955f';
    const TRIM = '#e8d8b0';
    const em = new THREE.Group();
    em.position.set(-38, 0, 38);
    em.add(box(16, 6, 52, BUFF, 0, 3.1, 0));
    const wallTex = makeEmpressWall();
    const gallery = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 5.6),
      new THREE.MeshLambertMaterial({ map: wallTex }),
    );
    gallery.position.set(8.06, 3.1, 0);
    gallery.rotation.y = Math.PI / 2;
    em.add(gallery);
    em.add(box(16.6, 0.5, 52.6, TRIM, 0, 6.3, 0));
    const roofL = box(9, 0.35, 52, '#7a6a58', -4, 7.2, 0);
    roofL.rotation.z = 0.3;
    const roofR = box(9, 0.35, 52, '#6e6052', 4, 7.2, 0);
    roofR.rotation.z = -0.3;
    em.add(roofL, roofR);

    const tower = new THREE.Group();
    tower.position.set(16, 0, 0);
    const towerGateTex = canvasTexture(256, 256, (ctx) => {
      ctx.fillStyle = BUFF;
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(90,55,25,0.3)';
      for (let y = 0; y < 256; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
      const arch = (w: number, peak: number, col: string) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(128 - w, 256);
        ctx.lineTo(128 - w, 140);
        ctx.quadraticCurveTo(128 - w, peak + 30, 128, peak);
        ctx.quadraticCurveTo(128 + w, peak + 30, 128 + w, 140);
        ctx.lineTo(128 + w, 256);
        ctx.closePath();
        ctx.fill();
      };
      arch(62, 48, TRIM);
      arch(54, 60, '#8a5a34');
      arch(46, 72, '#241d14');
      ctx.fillStyle = 'rgba(255,210,140,0.25)';
      ctx.fillRect(96, 200, 64, 56);
    });
    const towerMidTex = canvasTexture(256, 512, (ctx) => {
      ctx.fillStyle = BUFF;
      ctx.fillRect(0, 0, 256, 512);
      ctx.strokeStyle = 'rgba(90,55,25,0.28)';
      for (let y = 0; y < 512; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
      for (const top of [38, 286]) {
        for (const cx of [78, 178]) {
          ctx.fillStyle = '#ece0c4';
          ctx.beginPath();
          ctx.moveTo(cx - 34, top + 124);
          ctx.lineTo(cx - 34, top + 34);
          ctx.quadraticCurveTo(cx - 34, top, cx, top - 10);
          ctx.quadraticCurveTo(cx + 34, top, cx + 34, top + 34);
          ctx.lineTo(cx + 34, top + 124);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#23301f';
          ctx.beginPath();
          ctx.moveTo(cx - 24, top + 120);
          ctx.lineTo(cx - 24, top + 38);
          ctx.quadraticCurveTo(cx - 24, top + 10, cx, top + 2);
          ctx.quadraticCurveTo(cx + 24, top + 10, cx + 24, top + 38);
          ctx.lineTo(cx + 24, top + 120);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#2c5c3c';
        ctx.fillRect(30, top + 126, 196, 8);
        ctx.strokeStyle = '#2c5c3c';
        ctx.lineWidth = 3;
        for (let px = 34; px < 226; px += 10) {
          ctx.beginPath();
          ctx.moveTo(px, top + 126);
          ctx.lineTo(px, top + 108);
          ctx.stroke();
        }
        ctx.fillRect(30, top + 104, 196, 4);
      }
      for (const cy of [258, 484]) {
        ctx.fillStyle = TRIM;
        for (let px = 8; px < 256; px += 18) {
          ctx.beginPath();
          ctx.arc(px + 7, cy, 7, Math.PI, 0);
          ctx.fill();
        }
      }
    });
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 7, 7.5),
      new THREE.MeshLambertMaterial({ map: towerGateTex }),
    );
    base.position.y = 3.5;
    tower.add(base);
    tower.add(box(8.1, 0.55, 8.1, TRIM, 0, 7.25, 0));
    const mid = new THREE.Mesh(
      new THREE.BoxGeometry(7, 9.4, 7),
      new THREE.MeshLambertMaterial({ map: towerMidTex }),
    );
    mid.position.y = 12.2;
    tower.add(mid);
    tower.add(box(7.7, 0.55, 7.7, TRIM, 0, 17.1, 0));
    const clockTex = canvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#f5efe0';
      ctx.fillRect(0, 0, 128, 128);
      ctx.beginPath();
      ctx.arc(64, 64, 52, 0, Math.PI * 2);
      ctx.fillStyle = '#fffef5';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#2a2a2a';
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(64 + Math.cos(a) * 42 - 2, 64 + Math.sin(a) * 42 - 2, 5, 5);
      }
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(64, 64);
      ctx.lineTo(64, 30);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(64, 64);
      ctx.lineTo(88, 70);
      ctx.stroke();
    });
    tower.add(box(6.6, 4.4, 6.6, '#cfa86e', 0, 19.6, 0));
    for (let f = 0; f < 4; f++) {
      const clock = new THREE.Mesh(
        new THREE.PlaneGeometry(2.7, 2.7),
        new THREE.MeshBasicMaterial({ map: clockTex }),
      );
      const a = (f / 4) * Math.PI * 2;
      clock.position.set(Math.sin(a) * 3.32, 19.8, Math.cos(a) * 3.32);
      clock.rotation.y = a;
      tower.add(clock);
    }
    for (const [px, pz] of [
      [-2.9, -2.9],
      [2.9, -2.9],
      [-2.9, 2.9],
      [2.9, 2.9],
    ]) {
      tower.add(box(1.1, 0.9, 1.1, TRIM, px, 22.2, pz));
      tower.add(box(0.7, 0.7, 0.7, TRIM, px, 23.0, pz));
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(5.0, 7.6, 4), lambert('#7a4a36'));
    spire.rotation.y = Math.PI / 4;
    spire.position.y = 25.4;
    tower.add(spire);
    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * Math.PI * 2;
      const dormer = box(1.2, 1.4, 1.2, '#5e3a2a', Math.sin(a) * 2.3, 24.4, Math.cos(a) * 2.3);
      dormer.rotation.y = a;
      tower.add(dormer);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), lambert('#3a3a3a'));
    rod.position.y = 30.4;
    tower.add(rod);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), lambert('#caa84a'));
    orb.position.y = 31.4;
    tower.add(orb);
    em.add(tower);
    for (const pz of [-26, 26]) {
      const pav = new THREE.Group();
      pav.position.set(5, 0, pz);
      pav.add(box(9, 8, 9, BUFF, 0, 4, 0));
      const pavFace = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 7.6),
        new THREE.MeshLambertMaterial({ map: wallTex }),
      );
      pavFace.position.set(4.56, 4, 0);
      pavFace.rotation.y = Math.PI / 2;
      pav.add(pavFace);
      pav.add(box(9.6, 0.5, 9.6, TRIM, 0, 8.2, 0));
      const pavRoof = new THREE.Mesh(new THREE.ConeGeometry(7.4, 4.4, 4), lambert('#7a5a40'));
      pavRoof.rotation.y = Math.PI / 4;
      pavRoof.position.y = 10.4;
      pav.add(pavRoof);
      const pavFin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4),
        lambert('#3a3a3a'),
      );
      pavFin.position.y = 13.2;
      pav.add(pavFin);
      em.add(pav);
    }
    g.add(em);
  }

  // ================= KHYBER HOTEL (right, z 300) =================
  {
    const khTex = canvasTexture(512, 512, (ctx) => {
      ctx.fillStyle = '#c8a468';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = 'rgba(90,55,25,0.25)';
      for (let y = 0; y < 512; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      for (const top of [44, 168, 292]) {
        for (let c = 0; c < 7; c++) {
          const cx = 40 + c * 72;
          ctx.fillStyle = '#ece0c4';
          ctx.beginPath();
          ctx.moveTo(cx - 22, top + 88);
          ctx.lineTo(cx - 22, top + 24);
          ctx.arc(cx, top + 24, 22, Math.PI, 0);
          ctx.lineTo(cx + 22, top + 88);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#2a2620';
          ctx.beginPath();
          ctx.moveTo(cx - 15, top + 86);
          ctx.lineTo(cx - 15, top + 26);
          ctx.arc(cx, top + 26, 15, Math.PI, 0);
          ctx.lineTo(cx + 15, top + 86);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = '#2e2822';
      ctx.fillRect(0, 416, 512, 96);
      const bgs = ['#23355c', '#8c1f3a', '#176b38', '#c0392b', '#15364a'];
      const names = ['CHOICE CENTRE', 'STABIMATIC UPS', 'NAYAB HOTEL', 'FOTO FLASH', 'AKBAR CLOTH'];
      for (let s2 = 0; s2 < 5; s2++) {
        ctx.fillStyle = bgs[s2];
        ctx.fillRect(s2 * 103 + 2, 420, 99, 40);
        ctx.fillStyle = '#fff';
        ctx.font = '800 13px "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(names[s2], s2 * 103 + 51, 444);
        ctx.fillStyle = Math.random() < 0.5 ? '#1c1813' : '#7a8a92';
        ctx.fillRect(s2 * 103 + 4, 462, 95, 48);
      }
    });
    const kh = new THREE.Group();
    kh.position.set(21.5, 0, 300);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(12, 11.4, 44),
      new THREE.MeshLambertMaterial({ map: khTex }),
    );
    body.position.y = 5.7;
    kh.add(body);
    kh.add(box(12.6, 0.6, 44.6, '#e8d8b0', 0, 11.6, 0));
    for (const by of [3.9, 6.6, 9.3]) {
      kh.add(box(0.8, 0.16, 42, '#e0d4ba', -6.3, by, 0));
      kh.add(box(0.06, 0.55, 42, '#2c5c3c', -6.65, by + 0.36, 0));
      kh.add(box(0.06, 0.06, 42, '#2c5c3c', -6.65, by + 0.66, 0));
    }
    const khSign = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 1.5),
      new THREE.MeshBasicMaterial({
        map: signTex('KHYBER HOTEL', '#f0e8d0', '#1a3a2a'),
        side: THREE.DoubleSide,
      }),
    );
    khSign.position.set(-6.4, 12.5, -6);
    khSign.rotation.y = -Math.PI / 2;
    kh.add(khSign);
    g.add(kh);
  }

  // ================= BOHRI BAZAAR arch (left, z 462) =================
  {
    S.add(new THREE.BoxGeometry(0.9, 7, 0.9), '#176b38', -15, 3.5, 452);
    S.add(new THREE.BoxGeometry(0.9, 7, 0.9), '#176b38', -15, 3.5, 474);
    const archSign = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 2),
      new THREE.MeshBasicMaterial({
        map: signTex('BOHRI BAZAAR بوہری بازار', '#176b38', '#ffffff'),
        side: THREE.DoubleSide,
      }),
    );
    archSign.position.set(-15, 7.6, 463);
    archSign.rotation.y = Math.PI / 2;
    g.add(archSign);
    const stub = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), lambert('#3a3a40'));
    stub.rotation.x = -Math.PI / 2;
    stub.position.set(-28, 0.004, 463);
    g.add(stub);
  }

  // ================= ZAINAB MARKET (z 520-760) =================
  {
    // gate arch on the right
    S.add(new THREE.BoxGeometry(1, 7.5, 1), '#1f5c8c', 15, 3.75, 590);
    S.add(new THREE.BoxGeometry(1, 7.5, 1), '#1f5c8c', 15, 3.75, 614);
    const gateSign = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 2.2),
      new THREE.MeshBasicMaterial({
        map: signTex('ZAINAB MARKET زینب مارکیٹ', '#1f5c8c', '#ffd23d'),
        side: THREE.DoubleSide,
      }),
    );
    gateSign.position.set(15, 8.2, 602);
    gateSign.rotation.y = -Math.PI / 2; // text faces the road
    g.add(gateSign);
    const stub = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), lambert('#3a3a40'));
    stub.rotation.x = -Math.PI / 2;
    stub.position.set(28, 0.004, 602);
    g.add(stub);

    // hanging clothes along the shopfronts — the cloth-bazaar look
    const CLOTH = [
      '#c0392b',
      '#e91e8c',
      '#f1c40f',
      '#2ecc71',
      '#3498db',
      '#8e44ad',
      '#e67e22',
      '#1abc9c',
      '#d35400',
      '#ad1457',
    ];
    for (const side of [-1, 1]) {
      for (let z = 524; z < 756; z += 1.1) {
        if (Math.abs(z - 602) < 16 && side > 0) continue; // gate gap
        if (Math.random() < 0.8) {
          const h = pick([2.4, 3.1]);
          S.add(
            new THREE.BoxGeometry(0.04, rand(0.55, 0.8), 0.5),
            pick(CLOTH),
            side * (14.55 + rand(-0.1, 0.1)),
            h,
            z,
          );
        }
      }
      // rails the clothes hang from
      S.add(new THREE.BoxGeometry(0.05, 0.05, 232), '#3a3a3a', side * 14.55, 2.85, 638);
      S.add(new THREE.BoxGeometry(0.05, 0.05, 232), '#3a3a3a', side * 14.55, 3.55, 638);
    }
    // cloth-bolt tables
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const tz = 540 + i * 36;
      S.add(new THREE.BoxGeometry(2, 0.8, 1.4), '#8a6a42', side * 13.3, 0.6, tz);
      for (let b = 0; b < 5; b++) {
        S.add(
          new THREE.BoxGeometry(1.7, 0.18, 0.22),
          pick(CLOTH),
          side * 13.3,
          1.1 + b * 0.19,
          tz - 0.5 + b * 0.22,
        );
      }
    }
  }

  // ================= REGAL CHOWK: dome building + book stalls =================
  {
    const dm = new THREE.Group();
    dm.position.set(21, 0, 792);
    dm.add(box(11, 12, 14, '#d8cabc', 0, 6, 0));
    dm.add(box(11.6, 0.7, 14.6, '#b8a68e', 0, 12.3, 0));
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 2.2, 12), lambert('#cfc0ae'));
    drum.position.set(-2.8, 13.6, -4.8);
    dm.add(drum);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2),
      lambert('#6e4a30'),
    );
    dome.position.set(-2.8, 14.7, -4.8);
    dm.add(dome);
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 5), lambert('#3a3a3a'));
    fin.position.set(-2.8, 19, -4.8);
    dm.add(fin);
    const wallSign = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 1.3),
      new THREE.MeshBasicMaterial({ map: signTex('LIMTOWN WATCH CO.', '#1a1a1a', '#ffd23d') }),
    );
    wallSign.position.set(-5.56, 10.6, 0);
    wallSign.rotation.y = -Math.PI / 2;
    dm.add(wallSign);
    g.add(dm);

    // Sunday book stalls on the left footpath
    for (let i = 0; i < 4; i++) {
      const bz = 762 + i * 8;
      S.add(new THREE.BoxGeometry(2.4, 0.7, 1.6), '#7a5a3a', -13.4, 0.55, bz);
      for (let b = 0; b < 8; b++) {
        S.add(
          new THREE.BoxGeometry(0.5, 0.08 + Math.random() * 0.16, 0.36),
          pick(['#c0392b', '#23355c', '#176b38', '#e8b54a', '#7d2640', '#f0e8d0']),
          -13.4 - 0.9 + (b % 4) * 0.6,
          1.0 + Math.floor(b / 4) * 0.2,
          bz + rand(-0.5, 0.5),
        );
      }
    }
  }

  // ================= HOTEL METROPOLE curved corner (left, z 868) =================
  {
    const met = new THREE.Group();
    met.position.set(-17.5, 0, 868);
    const curved = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 8.5, 13, 24, 1, false, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: saddarStyles[2].tex }),
    );
    curved.position.y = 6.5;
    curved.rotation.y = Math.PI / 4 + Math.PI / 2;
    met.add(curved);
    met.add(box(14, 13, 10, saddarStyles[2].base, -4, 6.5, -6));
    met.add(box(15, 0.6, 11, '#e8ddc8', -3.5, 13.2, -5.5));
    const metSign = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 1.2),
      new THREE.MeshBasicMaterial({ map: signTex('HOTEL METROPOLE', '#2a2a2e', '#ffd9a0') }),
    );
    metSign.position.set(2.5, 11, 6.2);
    metSign.rotation.y = Math.PI + 0.6;
    met.add(metSign);
    g.add(met);
  }

  // ================= FRERE HALL (right, z 945 — Venetian-Gothic, two-tone) =================
  {
    const frereTex = canvasTexture(512, 256, (ctx) => {
      ctx.fillStyle = '#c2986a';
      ctx.fillRect(0, 0, 512, 256);
      // alternating red-brown stone bands
      for (let y = 0; y < 256; y += 30) {
        ctx.fillStyle = 'rgba(125,70,45,0.5)';
        ctx.fillRect(0, y, 512, 9);
      }
      for (let row = 0; row < 2; row++) {
        const top = row === 0 ? 18 : 140;
        for (let i = 0; i < 8; i++) {
          const cx = 34 + i * 64;
          const aw = 38;
          ctx.fillStyle = '#ece0c4';
          ctx.beginPath();
          ctx.moveTo(cx - aw / 2, top + 96);
          ctx.lineTo(cx - aw / 2, top + 30);
          ctx.quadraticCurveTo(cx - aw / 2, top, cx, top - 8);
          ctx.quadraticCurveTo(cx + aw / 2, top, cx + aw / 2, top + 30);
          ctx.lineTo(cx + aw / 2, top + 96);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#352a1c';
          ctx.beginPath();
          ctx.moveTo(cx - aw / 2 + 7, top + 94);
          ctx.lineTo(cx - aw / 2 + 7, top + 32);
          ctx.quadraticCurveTo(cx - aw / 2 + 7, top + 8, cx, top);
          ctx.quadraticCurveTo(cx + aw / 2 - 7, top + 8, cx + aw / 2 - 7, top + 32);
          ctx.lineTo(cx + aw / 2 - 7, top + 94);
          ctx.closePath();
          ctx.fill();
        }
      }
    });
    const fh = new THREE.Group();
    fh.position.set(34, 0, 945);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(56, 46), lambert('#5e7d4a'));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = 0.06;
    fh.add(lawn);
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(18, 9.5, 30),
      new THREE.MeshLambertMaterial({ map: frereTex }),
    );
    block.position.set(2, 4.75, 0);
    fh.add(block);
    fh.add(box(18.6, 0.6, 30.6, '#a8845c', 2, 9.8, 0));
    // gabled roof ridge
    const gL = box(7.4, 0.4, 30, '#5a4a42', -1.5, 11.3, 0);
    gL.rotation.z = 0.42;
    const gR = box(7.4, 0.4, 30, '#52443e', 5.5, 11.3, 0);
    gR.rotation.z = -0.42;
    fh.add(gL, gR);
    // central tower with octagonal spire (the icon)
    const ft = new THREE.Group();
    ft.position.set(-7, 0, 0);
    const ftBody = new THREE.Mesh(
      new THREE.BoxGeometry(6, 17, 6),
      new THREE.MeshLambertMaterial({ map: frereTex }),
    );
    ftBody.position.y = 8.5;
    ft.add(ftBody);
    ft.add(box(6.6, 0.5, 6.6, '#a8845c', 0, 17.2, 0));
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 2, 8), lambert('#c2986a'));
    drum.position.y = 18.4;
    ft.add(drum);
    const ftSpire = new THREE.Mesh(new THREE.ConeGeometry(3.0, 7, 8), lambert('#4a4248'));
    ftSpire.position.y = 22.9;
    ft.add(ftSpire);
    for (const [px, pz] of [
      [-2.6, -2.6],
      [2.6, -2.6],
      [-2.6, 2.6],
      [2.6, 2.6],
    ]) {
      const pin = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 4), lambert('#a8845c'));
      pin.position.set(px, 18.4, pz);
      ft.add(pin);
    }
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.9),
      new THREE.MeshBasicMaterial({ color: '#157a38', side: THREE.DoubleSide }),
    );
    flag.position.set(0.7, 27.2, 0);
    ft.add(flag);
    const fpole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.6, 4),
      lambert('#3a3a3a'),
    );
    fpole.position.y = 27;
    ft.add(fpole);
    fh.add(ft);
    // rose window on the gable end facing the road
    const rose = new THREE.Mesh(new THREE.CircleGeometry(1.5, 12), lambert('#352a1c'));
    rose.position.set(-7.06, 7, 15.06);
    fh.add(rose);
    g.add(fh);
    // lawn fence + trees
    for (let i = 0; i < 14; i++) {
      S.add(new THREE.BoxGeometry(0.12, 0.9, 0.12), '#3a5a42', 34 - 26 + i * 4, 0.45, 922);
    }
    S.add(new THREE.BoxGeometry(56, 0.08, 0.08), '#3a5a42', 34, 0.85, 922);
  }

  // ---------- street life: stalls, vendor carts, dhaba, bus stop, taxis ----------
  const stallCols = ['#c0392b', '#e67e22', '#176b38', '#8e44ad', '#1f5c8c', '#c2a23a'];
  for (let i = 0; i < 12; i++) {
    const z = 6 + i * 7 + rand(-2, 2);
    const side = i % 3 === 0 ? 1 : -1;
    const x = side * rand(12.2, 14.2);
    S.add(new THREE.BoxGeometry(2.2, 1.1, 2), '#8a5c34', x, 0.85, z);
    S.add(new THREE.ConeGeometry(1.9, 0.9, 8), pick(stallCols), x, 2.6, z);
    S.add(new THREE.BoxGeometry(0.14, 1.8, 0.14), '#5a4632', x, 1.6, z);
    for (let f = 0; f < 3; f++) {
      S.add(
        new THREE.BoxGeometry(0.5, 0.3, 0.5),
        pick(['#d35400', '#c0392b', '#f1c40f', '#27ae60']),
        x - 0.6 + f * 0.6,
        1.55,
        z + 0.4,
      );
    }
    // every stall has its seller
    addStaticPerson(x + side * 1.5, z, side > 0 ? -Math.PI / 2 : Math.PI / 2);
  }

  // ---------- Saddar trash: litter + the corner piles ----------
  for (let i = 0; i < 110; i++) {
    const side = pick([-1, 1]);
    // litter thins out as you leave the bazaar
    const lz = i < 80 ? rand(2, 520) : rand(520, 990);
    S.add(
      new THREE.BoxGeometry(rand(0.12, 0.32), 0.04, rand(0.12, 0.3)),
      pick(['#8a8578', '#b8b2a0', '#5d8aa8', '#3a3a32', '#c9c2b0', '#7a4a3a']),
      side * rand(9.6, 13.6),
      0.07,
      lz,
      rand(0, 3),
    );
  }
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const tz = 40 + i * 82 + rand(-15, 15);
    const tx = side * rand(11.6, 12.8);
    // mound of garbage
    S.add(new THREE.SphereGeometry(rand(0.7, 1.0), 7, 5), '#3f3c32', tx, 0.3, tz);
    S.add(new THREE.SphereGeometry(rand(0.5, 0.7), 6, 5), '#4a4538', tx + 0.7, 0.25, tz + 0.4);
    S.add(new THREE.SphereGeometry(0.45, 6, 5), '#55503f', tx - 0.5, 0.2, tz - 0.4);
    for (let b = 0; b < 6; b++) {
      S.add(
        new THREE.BoxGeometry(0.2, 0.06, 0.2),
        pick(['#5d8aa8', '#c0392b', '#c9c2b0', '#e8b54a']),
        tx + rand(-0.9, 0.9),
        0.5 + rand(0, 0.3),
        tz + rand(-0.7, 0.7),
        rand(0, 3),
      );
    }
    // a crow on the pile
    if (i % 2 === 0) S.add(new THREE.SphereGeometry(0.11, 6, 5), '#141414', tx, 0.95, tz);
  }
  // overflowing KMC dumpsters — garbage heaped over the rim, halo of litter around
  for (const [dside, dz] of [
    [-1, 185],
    [1, 415],
  ] as const) {
    const dx = dside * 12.4;
    S.add(new THREE.BoxGeometry(2.3, 1.25, 1.3), '#2e5e8c', dx, 0.62, dz);
    S.add(new THREE.BoxGeometry(2.3, 0.18, 1.3), '#24496e', dx, 1.3, dz, 0, 0, 0.06);
    // rust bleeding down the side
    S.add(new THREE.BoxGeometry(2.32, 0.4, 1.32), '#6e4a2a', dx, 0.32, dz);
    S.add(new THREE.SphereGeometry(0.85, 7, 5), '#3f3c32', dx, 1.45, dz);
    S.add(new THREE.SphereGeometry(0.55, 6, 5), '#55503f', dx + 0.6, 1.35, dz + 0.3);
    for (let b = 0; b < 8; b++) {
      S.add(
        new THREE.BoxGeometry(0.22, 0.05, 0.22),
        pick(['#5d8aa8', '#c0392b', '#c9c2b0', '#e8b54a', '#8a8578']),
        dx + rand(-1.8, 1.8),
        0.07,
        dz + rand(-1.4, 1.4),
        rand(0, 3),
      );
    }
    S.add(new THREE.SphereGeometry(0.11, 6, 5), '#141414', dx - 0.4, 1.95, dz); // crow on the rim
  }

  // ---------- Saddar hero trash heaps (photoreal AI sprites) ----------
  // Karachi reality: garbage piled along the gutter and against shop walls the
  // whole length of the bazaar — densest at the Empress Market frontage, thinning
  // toward Clifton, and NONE past it (addTrashPile is never called in Clifton).
  // Curb/footpath zone only (|x| 11–13.7) so heaps never block the drivable lanes
  // (forward -3/3/9, oncoming -9). A heap usually spawns a smaller companion
  // beside it so the corners read as genuinely overflowing.
  function trashCluster(side: number, z: number, h: number) {
    addTrashPile(side * rand(11.2, 13.7), z, h);
    if (Math.random() < 0.55)
      addTrashPile(side * rand(11.0, 13.5), z + rand(-2.4, 2.4), h * rand(0.5, 0.78));
  }
  for (let i = 0; i < 26; i++) trashCluster(pick([-1, 1]), rand(5, 270), rand(1.45, 2.15)); // Empress + bazaar — overflowing
  for (let i = 0; i < 16; i++) trashCluster(pick([-1, 1]), rand(270, 520), rand(1.2, 1.7)); // rest of the bazaar
  for (let i = 0; i < 8; i++)
    addTrashPile(pick([-1, 1]) * rand(11.0, 13.3), rand(560, 960), rand(0.95, 1.4)); // thinning toward the bridge
  // big heaps spilling out of the two overflowing KMC dumpsters
  trashCluster(-1, 186, 1.95);
  trashCluster(1, 416, 1.95);

  // ---------- dry-fruit aunties seated in front of Empress Market ----------
  // (the whole Empress frontage is theirs — bright sarees, open sacks, hand scales)
  const DRYFRUIT = ['#b5854a', '#c9952e', '#7d3a28', '#a8762e', '#9bab4a', '#5e3420', '#d98e32'];
  for (let i = 0; i < 8; i++) {
    const sz = 8 + i * 9.5 + rand(-1.5, 1.5);
    const sx = -rand(10.2, 11.2);
    // bright mat
    S.add(
      new THREE.BoxGeometry(1.9, 0.04, 1.5),
      pick(['#c2185b', '#e67e22', '#8e44ad', '#1f8c5c', '#c0392b']),
      sx,
      0.05,
      sz,
    );
    // open sacks with the rims rolled down, heaped with pista / badam / khubani
    for (let s2 = 0; s2 < 4; s2++) {
      const fx = sx - 0.65 + s2 * 0.45;
      S.add(new THREE.CylinderGeometry(0.24, 0.28, 0.32, 8), '#c8b08a', fx, 0.21, sz - 0.35);
      S.add(new THREE.SphereGeometry(0.17, 6, 5), pick(DRYFRUIT), fx, 0.4, sz - 0.35);
    }
    // a woven basket with a taller heap
    S.add(new THREE.CylinderGeometry(0.3, 0.22, 0.26, 8), '#a8804a', sx + 0.75, 0.18, sz + 0.1);
    S.add(new THREE.SphereGeometry(0.2, 6, 5), pick(DRYFRUIT), sx + 0.75, 0.38, sz + 0.1);
    // the old two-pan hand scale sitting beside her
    if (i % 2 === 0) {
      S.add(
        new THREE.CylinderGeometry(0.025, 0.025, 0.55, 5),
        '#8a8578',
        sx + 0.35,
        0.32,
        sz + 0.45,
      );
      S.add(new THREE.BoxGeometry(0.5, 0.025, 0.025), '#8a8578', sx + 0.35, 0.58, sz + 0.45);
      S.add(new THREE.CylinderGeometry(0.1, 0.13, 0.05, 7), '#c9a84a', sx + 0.12, 0.46, sz + 0.45);
      S.add(new THREE.CylinderGeometry(0.1, 0.13, 0.05, 7), '#c9a84a', sx + 0.58, 0.46, sz + 0.45);
    }
    // the seller, seated, bright saree + dupatta over the head
    const saree = pick(['#c2185b', '#e67e22', '#8e44ad', '#d4621f', '#ad1457', '#c0392b']);
    S.add(new THREE.BoxGeometry(0.4, 0.18, 0.55), '#3a3a3a', sx + 0.2, 0.32, sz + 0.75, Math.PI);
    S.add(new THREE.BoxGeometry(0.5, 0.72, 0.34), saree, sx, 0.85, sz + 0.75, Math.PI);
    S.add(new THREE.SphereGeometry(0.15, 7, 6), '#b87f55', sx, 1.45, sz + 0.75);
    S.add(new THREE.SphereGeometry(0.18, 7, 5), saree, sx, 1.5, sz + 0.75);
    // gold bangles — a thin warm stripe at the wrist
    S.add(new THREE.BoxGeometry(0.09, 0.07, 0.09), '#d8b32a', sx - 0.28, 0.62, sz + 0.55);
  }

  // ---------- camera market + dentists opposite Empress Market ----------
  // (the real strip: NIKON / Canon boards shoulder to shoulder, then the danton-ka-ilaj clinics)
  {
    const shopSigns = [
      { tex: signTex('NIKON', '#f5c518', '#111111'), z: 8 },
      { tex: signTex('Canon — DIGITAL CAMERA', '#c0392b', '#ffffff'), z: 19 },
      { tex: signTex('AZIZ PHOTO STUDIO', '#15364a', '#7fd4ff'), z: 30 },
      { tex: signTex('FUJIFILM COLOR LAB', '#1f8c5c', '#ffffff'), z: 41 },
      { tex: signTex('SONY — HANDYCAM', '#1a1a1a', '#ffffff'), z: 52 },
      { tex: signTex('KODAK FILM — CAMERA', '#e8b54a', '#1a1a1a'), z: 63 },
      { tex: signTex('SMILE DENTAL CLINIC', '#f0f0f0', '#1f5c8c'), z: 78 },
      { tex: signTex('DR. BATRISA — DANTON KA ILAJ', '#1f5c8c', '#ffffff'), z: 90 },
    ];
    for (const sgn of shopSigns) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(5.4, 1.25),
        new THREE.MeshBasicMaterial({ map: sgn.tex }),
      );
      m.position.set(14.92, 3.4, sgn.z);
      m.rotation.y = -Math.PI / 2;
      g.add(m);
    }
    // second storey of boards — shops stack signs on every free inch of wall
    const upperSigns = [
      { tex: signTex('PASSPORT PHOTO 10 MINUTE', '#7d2640', '#ffffff'), z: 14 },
      { tex: signTex('CAMERA REPAIR CENTRE', '#23355c', '#ffd23d'), z: 47 },
      { tex: signTex('DENTURE SPECIALIST', '#f0f0f0', '#c0392b'), z: 84 },
    ];
    for (const sgn of upperSigns) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 1.0),
        new THREE.MeshBasicMaterial({ map: sgn.tex }),
      );
      m.position.set(14.92, 4.75, sgn.z);
      m.rotation.y = -Math.PI / 2;
      g.add(m);
    }
    // big painted dealer board hanging over the footpath, facing the riders
    const camSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({
        map: photoTex('/img/sign_camera.jpg'),
        side: THREE.DoubleSide,
      }),
    );
    camSign.position.set(13.6, 5.0, 25);
    camSign.rotation.y = Math.PI; // face the riders coming up the road
    g.add(camSign);
    // painted denture board — pink gums, white teeth, no dentist strip is complete without it
    const denture = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 2.0),
      new THREE.MeshBasicMaterial({
        map: photoTex('/img/sign_dentist.jpg'),
        side: THREE.DoubleSide,
      }),
    );
    denture.position.set(13.7, 4.9, 95);
    denture.rotation.y = Math.PI; // face the riders coming up the road
    g.add(denture);
    // the giant tooth sign — every dentist strip has one
    const toothTex = canvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#1f5c8c';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(34, 36);
      ctx.bezierCurveTo(34, 12, 94, 12, 94, 36);
      ctx.bezierCurveTo(94, 58, 86, 60, 84, 84);
      ctx.bezierCurveTo(82, 104, 72, 104, 70, 86);
      ctx.bezierCurveTo(68, 70, 60, 70, 58, 86);
      ctx.bezierCurveTo(56, 104, 46, 104, 44, 84);
      ctx.bezierCurveTo(42, 60, 34, 58, 34, 36);
      ctx.closePath();
      ctx.fill();
    });
    const tooth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({ map: toothTex, side: THREE.DoubleSide }),
    );
    tooth.position.set(13.7, 4.8, 73);
    g.add(tooth);
    // camera-on-tripod street setup
    S.add(new THREE.BoxGeometry(0.4, 0.3, 0.5), '#2a2a2a', 12.4, 1.45, 27);
    S.add(new THREE.CylinderGeometry(0.03, 0.05, 1.3, 4), '#4a4a4a', 12.3, 0.65, 26.8, 0, 0, 0.16);
    S.add(new THREE.CylinderGeometry(0.03, 0.05, 1.3, 4), '#4a4a4a', 12.5, 0.65, 26.8, 0, 0, -0.16);
    S.add(new THREE.CylinderGeometry(0.03, 0.05, 1.3, 4), '#4a4a4a', 12.4, 0.65, 27.2, 0, 0.16, 0);
    addStaticPerson(12.4, 25.6, Math.PI);
  }

  // ---------- akhbar stall (left, z 92 — just past the Empress frontage) ----------
  {
    const nx = -12.9;
    const nz = 92;
    // front page: masthead + columns of grey text + one photo block
    const paperTex = canvasTexture(128, 160, (ctx) => {
      ctx.fillStyle = '#ece8da';
      ctx.fillRect(0, 0, 128, 160);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '800 22px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('AWAAM', 64, 24);
      ctx.fillStyle = '#888478';
      for (let row = 0; row < 14; row++) {
        for (const col of [8, 70]) {
          ctx.fillRect(col, 38 + row * 8, 50 * (0.6 + Math.random() * 0.4), 3);
        }
      }
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(8, 70, 50, 38);
    });
    const paperMat = new THREE.MeshBasicMaterial({ map: paperTex, side: THREE.DoubleSide });
    // low wooden table stacked with today's bundles
    S.add(new THREE.BoxGeometry(2.4, 0.1, 1.3), '#7a5a3a', nx, 0.55, nz);
    for (const [lx, lz] of [
      [-1, -0.5],
      [1, -0.5],
      [-1, 0.5],
      [1, 0.5],
    ]) {
      S.add(new THREE.BoxGeometry(0.1, 0.55, 0.1), '#5a4632', nx + lx, 0.28, nz + lz);
    }
    for (let p = 0; p < 5; p++) {
      S.add(
        new THREE.BoxGeometry(0.5, 0.16, 0.65),
        '#e4e0d2',
        nx - 0.85 + p * 0.42,
        0.69,
        nz + rand(-0.2, 0.2),
        rand(-0.1, 0.1),
      );
    }
    // papers clipped to a string between two poles — headlines facing the road
    S.add(new THREE.BoxGeometry(0.07, 2.1, 0.07), '#5a4632', nx, 1.05, nz - 1.5);
    S.add(new THREE.BoxGeometry(0.07, 2.1, 0.07), '#5a4632', nx, 1.05, nz + 1.5);
    S.add(new THREE.BoxGeometry(0.02, 0.02, 3), '#3a3a3a', nx, 2.0, nz);
    for (let p = 0; p < 4; p++) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), paperMat);
      sheet.position.set(nx, 1.62, nz - 1.1 + p * 0.74);
      sheet.rotation.y = Math.PI / 2 + rand(-0.08, 0.08);
      g.add(sheet);
    }
    // the akhbar-wala, paper held overhead, calling the headline
    addStaticPerson(nx + 1.1, nz, Math.PI / 2);
    const heldPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), paperMat);
    heldPaper.position.set(nx + 1.05, 2.05, nz + 0.3);
    heldPaper.rotation.y = Math.PI / 2;
    heldPaper.rotation.z = 0.15;
    g.add(heldPaper);
    // newsboy working the bus stop queue further up
    addStaticPerson(-12.2, 334, Math.PI / 2);
    const boyPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.55), paperMat);
    boyPaper.position.set(-12.15, 1.95, 334.3);
    boyPaper.rotation.y = Math.PI / 2;
    boyPaper.rotation.z = -0.12;
    g.add(boyPaper);
  }

  function addStaticPerson(x: number, z: number, _ry: number, sitting = false) {
    // sprite billboard person — facing the road axis (toward the approaching rider)
    const n = sitting ? PEOPLE_SEATED.length : PEOPLE_FRONT.length;
    staticPeople.push({ x, z, tex: (Math.random() * n) | 0, seated: sitting });
  }

  // vendor carts (thelas) with sellers — the heart of Saddar
  type CartKind = 'fruit' | 'corn' | 'cloth' | 'juice';
  function vendorCart(side: number, z: number, kind: CartKind) {
    const x = side * rand(12.4, 13.2); // carts eat into the road, like real Saddar
    S.add(new THREE.BoxGeometry(1.8, 0.14, 2.7), '#9a6a3a', x, 1.05, z);
    S.add(
      new THREE.CylinderGeometry(0.62, 0.62, 0.12, 10),
      '#2c2c2c',
      x - 0.95,
      0.62,
      z,
      0,
      0,
      Math.PI / 2,
    );
    S.add(
      new THREE.CylinderGeometry(0.62, 0.62, 0.12, 10),
      '#2c2c2c',
      x + 0.95,
      0.62,
      z,
      0,
      0,
      Math.PI / 2,
    );
    S.add(new THREE.BoxGeometry(0.08, 0.08, 1.4), '#7a5a3a', x - 0.6, 1.0, z + 1.9);
    S.add(new THREE.BoxGeometry(0.08, 0.08, 1.4), '#7a5a3a', x + 0.6, 1.0, z + 1.9);
    if (kind === 'fruit') {
      const fruit = pick([
        ['#e67e22', '#d35400'],
        ['#f1c40f', '#e8b54a'],
        ['#c0392b', '#a93226'],
        ['#7dba4a', '#5e9d3a'],
      ]);
      for (let r = 0; r < 12; r++) {
        S.add(
          new THREE.SphereGeometry(0.16, 6, 5),
          pick(fruit),
          x - 0.6 + (r % 4) * 0.4,
          1.26 + Math.floor(r / 4) * 0.18,
          z - 0.8 + Math.floor(r / 4) * 0.3 + (r % 2) * 0.35,
        );
      }
    } else if (kind === 'corn') {
      S.add(new THREE.BoxGeometry(1.2, 0.5, 1.2), '#4a4a4a', x, 1.4, z - 0.4);
      for (let r = 0; r < 5; r++) {
        S.add(
          new THREE.CylinderGeometry(0.07, 0.07, 0.5, 5),
          '#e8c63d',
          x - 0.4 + r * 0.2,
          1.75,
          z - 0.4,
          0,
          0,
          Math.PI / 2.2,
        );
      }
      S.add(new THREE.SphereGeometry(0.32, 6, 5), '#9a9a96', x, 2.1, z - 0.4); // smoke puff
    } else if (kind === 'cloth') {
      for (let r = 0; r < 6; r++) {
        S.add(
          new THREE.BoxGeometry(1.5, 0.16, 0.3),
          pick(['#c0392b', '#e91e8c', '#3498db', '#f1c40f', '#8e44ad', '#2ecc71']),
          x,
          1.25 + r * 0.17,
          z - 0.7 + r * 0.25,
        );
      }
    } else {
      // juice: orange pyramid + glasses
      for (let r = 0; r < 9; r++) {
        S.add(
          new THREE.SphereGeometry(0.15, 6, 5),
          '#e67e22',
          x - 0.4 + (r % 3) * 0.4,
          1.26 + Math.floor(r / 3) * 0.2,
          z - 0.9 + Math.floor(r / 3) * 0.2,
        );
      }
      S.add(new THREE.BoxGeometry(0.9, 0.5, 0.5), '#8a9a9a', x + 0.3, 1.5, z + 0.6);
    }
    // umbrella
    S.add(new THREE.BoxGeometry(0.1, 2.2, 0.1), '#5a4632', x + 0.6, 2.2, z + 0.6);
    S.add(new THREE.ConeGeometry(1.7, 0.8, 8), pick(stallCols), x + 0.4, 3.5, z + 0.4);
    // the vendor behind the cart + a customer
    addStaticPerson(x + side * 1.6, z, side > 0 ? -Math.PI / 2 : Math.PI / 2);
    if (Math.random() < 0.55)
      addStaticPerson(x - side * 1.7, z + rand(-0.8, 0.8), side > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  const cartKinds: CartKind[] = ['fruit', 'corn', 'cloth', 'juice'];
  for (let i = 0; i < 16; i++) {
    vendorCart(i % 2 === 0 ? -1 : 1, 30 + i * 58 + rand(-12, 12), cartKinds[i % 4]);
  }
  // (no carts in Clifton — that side of town is kept clean)

  // patri-walas: goods spread on a chadar at the road edge — sunglasses, toys, chappals
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const pz = 105 + i * 52 + rand(-10, 10);
    const px = side * rand(12.1, 12.8);
    S.add(
      new THREE.BoxGeometry(1.8, 0.03, 1.4),
      pick(['#3a5a8c', '#f0ead8', '#8c3a3a', '#3a6a4a']),
      px,
      0.045,
      pz,
    );
    const wares = pick(['glasses', 'toys', 'chappal'] as const);
    for (let r = 0; r < 9; r++) {
      const wx = px - 0.6 + (r % 3) * 0.6;
      const wz = pz - 0.45 + Math.floor(r / 3) * 0.45;
      if (wares === 'glasses') {
        S.add(new THREE.BoxGeometry(0.3, 0.05, 0.1), '#1a1a1a', wx, 0.08, wz);
      } else if (wares === 'toys') {
        S.add(
          new THREE.BoxGeometry(0.18, 0.14, 0.18),
          pick(['#c0392b', '#f1c40f', '#3498db', '#2ecc71', '#e91e8c']),
          wx,
          0.12,
          wz,
        );
      } else {
        S.add(
          new THREE.BoxGeometry(0.14, 0.05, 0.34),
          pick(['#7a4a2c', '#2a2a2a', '#c2a23a']),
          wx - 0.08,
          0.07,
          wz,
        );
        S.add(
          new THREE.BoxGeometry(0.14, 0.05, 0.34),
          pick(['#7a4a2c', '#2a2a2a', '#c2a23a']),
          wx + 0.08,
          0.07,
          wz,
        );
      }
    }
    addStaticPerson(px + side * 1.2, pz, side > 0 ? -Math.PI / 2 : Math.PI / 2, true);
  }

  // chai dhaba (right, z 235)
  {
    const x = 13.6;
    S.add(new THREE.BoxGeometry(3, 1.2, 2), '#6a4a32', x, 0.9, 235);
    S.add(new THREE.BoxGeometry(3.4, 0.1, 2.4), '#c0392b', x, 2.7, 235);
    S.add(new THREE.BoxGeometry(0.12, 1.5, 0.12), '#5a4632', x - 1.4, 1.95, 234.2);
    S.add(new THREE.BoxGeometry(0.12, 1.5, 0.12), '#5a4632', x + 1.4, 1.95, 234.2);
    S.add(new THREE.BoxGeometry(2.4, 0.12, 0.5), '#8a6a42', x - 0.4, 0.5, 232.4);
    S.add(new THREE.BoxGeometry(2.2, 0.16, 1.1), '#a8845a', x + 0.6, 0.45, 237.8);
    const dhabaSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.9),
      new THREE.MeshBasicMaterial({
        map: signTex('CHAI DHABA ☕', '#5c3a1f', '#ffd9a0'),
        side: THREE.DoubleSide,
      }),
    );
    dhabaSign.position.set(x - 0.2, 3.3, 235);
    g.add(dhabaSign);
    addStaticPerson(13.2, 232.4, Math.PI, true);
    addStaticPerson(14, 232.4, Math.PI, true);
    addStaticPerson(14.2, 237.8, Math.PI / 2, true);
  }

  // bus stop + parked minibus (left, z 340)
  {
    const x = -13.8;
    S.add(new THREE.BoxGeometry(0.14, 2.6, 0.14), '#4a6a52', x, 1.3, 337.5);
    S.add(new THREE.BoxGeometry(0.14, 2.6, 0.14), '#4a6a52', x, 1.3, 342.5);
    S.add(new THREE.BoxGeometry(2, 0.12, 6), '#3a7d44', x - 0.4, 2.7, 340);
    S.add(new THREE.BoxGeometry(0.1, 1.1, 5.6), '#9aa49c', x - 1.2, 1.7, 340);
    S.add(new THREE.BoxGeometry(1.4, 0.1, 4.6), '#8a8a82', x - 0.3, 0.55, 340);
    const stopSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.8),
      new THREE.MeshBasicMaterial({
        map: signTex('BUS STOP بس اسٹاپ', '#176b38', '#ffffff'),
        side: THREE.DoubleSide,
      }),
    );
    stopSign.position.set(x + 0.4, 3.2, 340);
    g.add(stopSign);
    for (let i = 0; i < 4; i++) {
      addStaticPerson(-13.3 + rand(-0.2, 0.2), 337 + i * 1.6, Math.PI / 2 + rand(-0.4, 0.4));
    }
    // parked minibus, painted up
    const mx = -12.1;
    S.add(new THREE.BoxGeometry(2.5, 2.6, 8.5), '#f5ead0', mx, 1.65, 352);
    S.add(new THREE.BoxGeometry(2.55, 0.5, 8.55), '#c0392b', mx, 0.7, 352);
    S.add(new THREE.BoxGeometry(2.55, 0.4, 8.55), '#176b38', mx, 2.6, 352);
    S.add(new THREE.BoxGeometry(2.2, 0.4, 7.5), '#8c5a2a', mx, 3.15, 352);
    for (const wz of [349.5, 354.5]) {
      S.add(
        new THREE.CylinderGeometry(0.55, 0.55, 0.3, 10),
        '#1a1a1a',
        mx - 1.1,
        0.55,
        wz,
        0,
        0,
        Math.PI / 2,
      );
    }
  }

  // parked yellow-black taxis
  for (const [tside, tz] of [
    [-1, 140],
    [1, 480],
    [-1, 720],
  ] as const) {
    const tx = tside * 12.35;
    S.add(new THREE.BoxGeometry(1.9, 0.7, 4.0), '#e8c63d', tx, 0.7, tz);
    S.add(new THREE.BoxGeometry(1.7, 0.6, 2.0), '#1a1a1a', tx, 1.3, tz - 0.2);
    for (const [wx, wz] of [
      [-0.9, 1.3],
      [0.9, 1.3],
      [-0.9, -1.3],
      [0.9, -1.3],
    ]) {
      S.add(new THREE.BoxGeometry(0.26, 0.55, 0.55), '#111111', tx + wx, 0.3, tz + wz);
    }
  }

  // ---------- trees + palms ----------
  function palm(px: number, pz: number, h: number) {
    S.add(new THREE.CylinderGeometry(0.14, 0.22, h, 6), '#8a6a4a', px, h / 2, pz);
    for (let f = 0; f < 7; f++) {
      const a = (f / 7) * Math.PI * 2;
      S.add(
        new THREE.BoxGeometry(0.14, 0.05, 2.0),
        pick(['#3e7d3a', '#4e8d42', '#35702f']),
        px + Math.sin(a) * 0.85,
        h + 0.1 - (f % 2) * 0.18,
        pz + Math.cos(a) * 0.85,
        a,
        0.5,
        0,
      );
    }
    S.add(new THREE.SphereGeometry(0.22, 5, 4), '#5a4632', px, h, pz);
  }
  const treeSpots: [number, number, number][] = [
    [-14.8, 420, 1],
    [14.8, 640, 1],
    [-14.8, 905, 1],
    [20, 940, 1.6],
    [44, 958, 1.5],
    [30, 925, 1.4],
    [44, 930, 1.3],
  ];
  for (const [tx, tz, s] of treeSpots) {
    S.add(new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 2.6 * s, 6), '#5a4632', tx, 1.3 * s, tz);
    S.add(new THREE.SphereGeometry(1.9 * s, 7, 6), '#3a6634', tx, 3.6 * s, tz);
    S.add(new THREE.SphereGeometry(1.4 * s, 6, 5), '#46763c', tx + 0.9 * s, 4.2 * s, tz + 0.4);
    S.add(new THREE.SphereGeometry(1.2 * s, 6, 5), '#41703a', tx - 0.8 * s, 4.3 * s, tz - 0.5);
  }

  // Clifton median: palms + leafy trees + KMC railing
  S.add(new THREE.BoxGeometry(1.5, 0.38, 220), '#9a9a90', -6, 0.19, 1260);
  for (let z = 1155, k = 0; z < 1370; z += 36, k++) {
    if (k % 2 === 0) palm(-6, z, rand(4.5, 6));
    else {
      S.add(new THREE.CylinderGeometry(0.16, 0.22, 2.2, 6), '#5a4632', -6, 1.1, z);
      S.add(new THREE.SphereGeometry(1.6, 7, 6), '#3a6634', -6, 3.1, z);
      S.add(new THREE.SphereGeometry(1.1, 6, 5), '#46763c', -5.4, 3.7, z + 0.4);
    }
  }
  for (let z = 1152; z < 1368; z += 4.6) {
    S.add(new THREE.BoxGeometry(0.08, 0.5, 0.08), '#2c8c46', -6.72, 0.6, z);
    S.add(new THREE.BoxGeometry(0.08, 0.5, 0.08), '#2c8c46', -5.28, 0.6, z);
  }
  S.add(new THREE.BoxGeometry(0.06, 0.1, 216), '#2c8c46', -6.72, 0.88, 1260);
  S.add(new THREE.BoxGeometry(0.06, 0.1, 216), '#2c8c46', -5.28, 0.88, 1260);

  // ---------- Clifton Bridge (short) ----------
  const stripeTex = canvasTexture(128, 32, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#222222' : '#ffc63d';
      ctx.fillRect(i * 16, 0, 16, 32);
    }
  });
  stripeTex.wrapS = THREE.RepeatWrapping;
  stripeTex.repeat.set(12, 1);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.1, 150),
      new THREE.MeshLambertMaterial({ map: stripeTex }),
    );
    rail.position.set(side * 12.5, 0.85, 1070);
    g.add(rail);
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 170), lambert('#2e7a8a'));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -2.4, 1070);
  g.add(water);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const cx = side * (60 + i * 26);
      const cz = 1035 + i * 60;
      S.add(new THREE.BoxGeometry(2, 26, 2), '#3a4248', cx - 6, 13, cz);
      S.add(new THREE.BoxGeometry(2, 26, 2), '#3a4248', cx + 6, 13, cz);
      S.add(new THREE.BoxGeometry(30, 2, 2.4), '#3a4248', cx, 26, cz);
      S.add(new THREE.BoxGeometry(2, 8, 2), '#3a4248', cx - 12, 30, cz);
    }
    for (let i = 0; i < 5; i++) {
      S.add(
        new THREE.BoxGeometry(6, 2.5, 2.5),
        pick(['#7d2640', '#1f5c8c', '#3a7d44', '#b3551f']),
        side * rand(45, 95),
        1.25 + (i % 3) * 2.5,
        rand(1010, 1130),
      );
    }
  }
  for (let z = 1010; z < 1140; z += 50) {
    for (const side of [-1, 1]) {
      S.add(new THREE.BoxGeometry(0.16, 6, 0.16), '#5a5a5a', side * 12, 3, z);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffd9a0' }),
      );
      lamp.position.set(side * 11.2, 6, z);
      g.add(lamp);
    }
  }

  // ---------- PARK TOWERS (right, z 1230) ----------
  {
    const pt = new THREE.Group();
    pt.position.set(26, 0, 1230);
    pt.add(box(22, 14, 26, '#d8cdb2', 0, 7, 0));
    pt.add(box(23, 1.2, 27, '#b8a888', 0, 14.6, 0));
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.4, 1.2, 16, 1, false, 0, Math.PI),
      lambert('#8a7a62'),
    );
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(-11, 4.5, 0);
    pt.add(arch);
    const ptSign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 1.5),
      new THREE.MeshBasicMaterial({ map: signTex('PARK TOWERS', '#23355c', '#ffffff') }),
    );
    ptSign.position.set(-11.2, 10.5, 0);
    ptSign.rotation.y = -Math.PI / 2;
    pt.add(ptSign);
    g.add(pt);
  }

  // buff stone underpass walls on the Teen Talwar approach
  const stoneTex = canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = 'rgba(110,75,35,0.5)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 256; x += 42) ctx.strokeRect(x + 4, 8, 34, 48);
  });
  stoneTex.wrapS = THREE.RepeatWrapping;
  stoneTex.repeat.set(14, 1);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 2.8, 120),
      new THREE.MeshLambertMaterial({ map: stoneTex }),
    );
    wall.position.set(side * 13.2, 1.4, 1310);
    g.add(wall);
  }

  // ZAIB FABRIC fashion billboard near the roundabout
  {
    const fashTex = canvasTexture(512, 640, (ctx) => {
      ctx.fillStyle = '#7d1f4a';
      ctx.fillRect(0, 0, 512, 640);
      ctx.fillStyle = '#e8b54a';
      ctx.fillRect(0, 0, 512, 14);
      ctx.fillRect(0, 626, 512, 14);
      ctx.strokeStyle = '#e8b54a';
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.arc(180, 300, 130, 0.4, 2.4);
      ctx.stroke();
      ctx.strokeStyle = '#c2185b';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(300, 280, 100, 2.8, 4.9);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic 800 64px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('ZAIB', 256, 480);
      ctx.font = '700 34px Georgia, serif';
      ctx.fillText('FABRIC — EID VOL. 4', 256, 540);
    });
    const fash = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 11.5),
      new THREE.MeshBasicMaterial({ map: fashTex }),
    );
    fash.position.set(-17.5, 16, 1352);
    fash.rotation.y = Math.PI / 2 + 0.25;
    g.add(fash);
  }

  // ================= TEEN TALWAR (z 1422) =================
  {
    const MARBLE = '#f4f1e8';
    const TTZ = 1422;
    S.add(new THREE.CylinderGeometry(12.6, 12.6, 0.24, 32), '#4a7d3c', 0, 0.12, TTZ);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      S.add(
        new THREE.BoxGeometry(2.3, 0.34, 0.5),
        i % 2 ? '#1a1a1a' : '#e8c63d',
        Math.cos(a) * 13,
        0.17,
        TTZ + Math.sin(a) * 13,
        -a + Math.PI / 2,
      );
    }
    S.add(new THREE.CylinderGeometry(9.8, 9.8, 0.5, 32), '#7a3a30', 0, 0.25, TTZ);
    S.add(new THREE.CylinderGeometry(8.4, 8.4, 0.8, 32), '#ece8de', 0, 0.4, TTZ);

    const labelTex = (text: string) =>
      canvasTexture(256, 56, (ctx) => {
        ctx.fillStyle = '#e9e5d8';
        ctx.fillRect(0, 0, 256, 56);
        ctx.fillStyle = '#3a3a35';
        ctx.font = '700 30px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 30);
      });

    const LABELS = ['UNITY', 'FAITH', 'DISCIPLINE'];
    [-5.2, 0, 5.2].forEach((sx, si) => {
      const baseY = 0.8;
      for (const [lx, lz, rz, rx] of [
        [-1.45, 0, 0.4, 0],
        [1.45, 0, -0.4, 0],
        [0, -1.45, 0, -0.4],
        [0, 1.45, 0, 0.4],
      ] as const) {
        S.add(
          new THREE.BoxGeometry(0.9, 3.4, 0.9),
          MARBLE,
          sx + lx,
          baseY + 1.5,
          TTZ + lz,
          0,
          rx,
          rz,
        );
      }
      S.add(new THREE.BoxGeometry(1.9, 0.55, 1.4), '#e6e2d6', sx, baseY + 3.35, TTZ);
      const bladeGeo = new THREE.CylinderGeometry(0.62, 1.05, 12.6, 4);
      bladeGeo.rotateY(Math.PI / 4);
      bladeGeo.scale(1, 1, 0.5);
      S.add(bladeGeo, MARBLE, sx, baseY + 9.8, TTZ);
      const tipGeo = new THREE.CylinderGeometry(0.05, 0.58, 1.8, 4);
      tipGeo.rotateY(Math.PI / 4);
      tipGeo.scale(1, 1, 0.5);
      tipGeo.rotateZ(0.2);
      S.add(tipGeo, MARBLE, sx + 0.14, baseY + 16.9, TTZ);
      for (const fz of [0.36, -0.36]) {
        S.add(new THREE.BoxGeometry(0.24, 11.4, 0.04), '#4a4238', sx, baseY + 9.6, TTZ + fz);
      }
      const lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.48),
        new THREE.MeshBasicMaterial({ map: labelTex(LABELS[si]) }),
      );
      lbl.position.set(sx, baseY + 3.35, TTZ - 1.55);
      lbl.rotation.y = Math.PI;
      g.add(lbl);
    });
    for (const bx of [-2.6, 2.6]) {
      S.add(new THREE.BoxGeometry(3.2, 0.8, 1.1), MARBLE, bx, 3.2, TTZ);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      palm(Math.cos(a) * 15.5, TTZ + Math.sin(a) * 15.5, rand(5, 7));
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      S.add(
        new THREE.SphereGeometry(0.55, 6, 5),
        '#3e7d3a',
        Math.cos(a) * 11.2,
        0.45,
        TTZ + Math.sin(a) * 11.2,
      );
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.8;
      const fx = Math.cos(a) * 11.8;
      const fz = TTZ + Math.sin(a) * 11.8;
      S.add(new THREE.CylinderGeometry(0.05, 0.07, 5, 5), '#cccccc', fx, 2.5, fz);
      S.add(new THREE.BoxGeometry(1.3, 0.8, 0.04), '#157a38', fx + 0.65, 4.6, fz);
    }
    const ttShadow = blobShadow(13, 13, 0.18);
    ttShadow.position.set(0, 0.02, TTZ);
    g.add(ttShadow);

    // OCEAN TOWER
    {
      const ot = new THREE.Group();
      ot.position.set(30, 0, 1452);
      ot.add(box(34, 16, 24, '#f0f0f2', 0, 8, 0));
      const panelTex = canvasTexture(512, 128, (ctx) => {
        ctx.fillStyle = '#f0f0f2';
        ctx.fillRect(0, 0, 512, 128);
        const cols = ['#e91e8c', '#ffd23d', '#1f8c5c', '#5b48a2', '#ff7a2f'];
        for (let i = 0; i < 9; i++) {
          if (Math.random() < 0.7) {
            ctx.fillStyle = cols[i % cols.length];
            ctx.fillRect(12 + i * 55, 14 + Math.random() * 30, 42, 64);
          }
        }
        ctx.fillStyle = '#23355c';
        ctx.font = '800 40px "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OCEAN MALL', 256, 110);
      });
      const panels = new THREE.Mesh(
        new THREE.PlaneGeometry(32, 7),
        new THREE.MeshBasicMaterial({ map: panelTex }),
      );
      panels.position.set(-17.06, 9, 0);
      panels.rotation.y = -Math.PI / 2;
      ot.add(panels);
      ot.add(box(17, 88, 17, '#e8e8ea', 0, 60, 0));
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 9, 62, 18, 1, true, Math.PI * 0.6, Math.PI * 0.55),
        new THREE.MeshLambertMaterial({ color: '#5fa8c8', side: THREE.DoubleSide }),
      );
      glass.position.set(-5, 48, 0);
      ot.add(glass);
      ot.add(box(17.6, 3.4, 17.6, '#d8d8dc', 0, 105.5, 0));
      const otSign = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 2.2),
        new THREE.MeshBasicMaterial({ map: signTex('OCEAN TOWER', '#ffffff', '#c0392b') }),
      );
      otSign.position.set(-8.86, 101, 0);
      otSign.rotation.y = -Math.PI / 2;
      ot.add(otSign);
      for (let i = 0; i < 4; i++) palm(20 - i * 9, 1434, rand(4, 5.5));
      g.add(ot);
    }

    // under-construction tower + crane
    {
      const gridTex = canvasTexture(128, 256, (ctx) => {
        ctx.fillStyle = '#9a9a94';
        ctx.fillRect(0, 0, 128, 256);
        ctx.fillStyle = '#3a3a38';
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 4; c++) {
            ctx.fillRect(6 + c * 31, 6 + r * 25, 24, 18);
          }
        }
      });
      const uc = new THREE.Mesh(
        new THREE.BoxGeometry(16, 58, 16),
        new THREE.MeshLambertMaterial({ map: gridTex }),
      );
      uc.position.set(-42, 29, 1390);
      g.add(uc);
      S.add(new THREE.BoxGeometry(1, 70, 1), '#d8b32a', -52, 35, 1390);
      S.add(new THREE.BoxGeometry(26, 1, 1), '#d8b32a', -42, 70, 1390);
      S.add(new THREE.BoxGeometry(0.1, 12, 0.1), '#444444', -33, 64, 1390);
    }
  }

  // ================= PEOPLE (walkers + crowds) =================
  // Saddar footpaths are 3x as packed as before (Clifton stays sparse).
  for (let i = 0; i < 36; i++) {
    addStaticPerson(-rand(13, 15.6), rand(6, 80), rand(0, Math.PI * 2));
  }
  for (let i = 0; i < 24; i++) {
    addStaticPerson(pick([-1, 1]) * rand(13, 15.2), rand(530, 750), rand(0, Math.PI * 2));
  }

  const walkers: Walker[] = [];
  function makeWalker(zone: [number, number]): Walker {
    const wg = new THREE.Group();
    wg.add(personBillboard(pick(PEOPLE_FRONT)));
    const side = pick([-1, 1]);
    const z = rand(zone[0], zone[1]);
    wg.position.set(side * rand(13, 15), 0, z);
    g.add(wg);
    return {
      g: wg,
      z0: zone[0],
      z1: zone[1],
      dir: pick([-1, 1]),
      speed: rand(1, 2),
      phase: rand(0, 9),
    };
  }
  for (let i = 0; i < 54; i++) walkers.push(makeWalker([15, 980]));
  for (let i = 0; i < 24; i++) walkers.push(makeWalker([15, 510])); // extra Saddar rush
  for (let i = 0; i < 4; i++) walkers.push(makeWalker([1150, 1360]));

  // people crossing the road, Saddar style (anywhere, anytime) — 3x crowd
  interface Crosser {
    g: THREE.Group;
    dir: number;
    speed: number;
  }
  const crossers: Crosser[] = [];
  const BAZAAR_CROSSERS = 45; // densest jaywalking in the bazaar stretch
  const LATER_CROSSERS = 21;
  for (let i = 0; i < BAZAAR_CROSSERS + LATER_CROSSERS; i++) {
    const cg = new THREE.Group();
    cg.add(personBillboard(pick(PEOPLE_SIDE), 0.96, 1.6)); // side slice = 0.6 aspect
    const cz =
      i < BAZAAR_CROSSERS
        ? 25 + i * (500 / BAZAAR_CROSSERS) + rand(-10, 10)
        : 560 + (i - BAZAAR_CROSSERS) * (400 / LATER_CROSSERS) + rand(-18, 18);
    cg.position.set(rand(-12, 12), 0, cz);
    g.add(cg);
    crossers.push({ g: cg, dir: pick([-1, 1]), speed: rand(0.9, 1.6) });
  }

  // pigeons at Empress Market
  const pigeons: Pigeon[] = [];
  for (let i = 0; i < 14; i++) {
    const pg = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 7, 6),
      lambert(pick(['#8a8a92', '#b8b8be', '#6a6a72'])),
    );
    body.scale.set(1, 0.85, 1.4);
    body.position.y = 0.1;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), lambert('#5a5a64'));
    head.position.set(0, 0.2, 0.12);
    pg.add(body, head);
    const bx = -rand(12.6, 16);
    const bz = rand(6, 75);
    pg.position.set(bx, 0, bz);
    pg.rotation.y = rand(0, Math.PI * 2);
    g.add(pg);
    pigeons.push({ g: pg, bx, bz, t: 0, seed: rand(0, 9) });
  }

  // merge static people into one mesh per character texture (few draw calls)
  {
    const groups = new Map<string, THREE.BufferGeometry[]>();
    for (const p of staticPeople) {
      const h = p.seated ? 0.92 : 1.6;
      const w = p.seated ? 0.69 : 0.8; // seated slice = 0.75 aspect, standing = 0.5
      const geo = new THREE.PlaneGeometry(w, h);
      geo.rotateY(Math.PI); // face -z, toward the rider coming up the road
      geo.translate(p.x, h / 2, p.z);
      const key = (p.seated ? 's' : 'f') + p.tex;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(geo);
    }
    for (const [key, geos] of groups) {
      const tex = key[0] === 's' ? PEOPLE_SEATED[+key.slice(1)] : PEOPLE_FRONT[+key.slice(1)];
      const merged = mergeGeometries(geos, false)!;
      g.add(
        new THREE.Mesh(
          merged,
          new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            alphaTest: 0.35,
            side: THREE.DoubleSide,
          }),
        ),
      );
    }
  }

  // merge trash heaps into one mesh per texture (billboards facing the rider)
  {
    const groups = new Map<number, THREE.BufferGeometry[]>();
    for (const t of trashPiles) {
      const geo = new THREE.PlaneGeometry(t.w, t.h);
      if (t.flip) geo.scale(-1, 1, 1); // mirror so repeated heaps don't read as copies
      geo.rotateY(Math.PI); // face -z, toward the rider
      geo.translate(t.x, t.h / 2, t.z);
      if (!groups.has(t.tex)) groups.set(t.tex, []);
      groups.get(t.tex)!.push(geo);
    }
    for (const [tex, geos] of groups) {
      const merged = mergeGeometries(geos, false)!;
      g.add(
        new THREE.Mesh(
          merged,
          new THREE.MeshBasicMaterial({
            map: TRASH_TEX[tex],
            transparent: true,
            alphaTest: 0.4,
            side: THREE.DoubleSide,
          }),
        ),
      );
    }
  }

  g.add(S.build());

  // live crowd cutoffs — everyone visible until setCrowdScale thins the tail
  let walkCut = walkers.length;
  let crossCut = crossers.length;
  let pigeonCut = pigeons.length;

  let time = 0;
  return {
    potholes,
    setCrowdScale(scale: number) {
      walkCut = Math.max(1, Math.ceil(walkers.length * scale));
      crossCut = Math.max(1, Math.ceil(crossers.length * scale));
      pigeonCut = Math.max(1, Math.ceil(pigeons.length * scale));
      for (let i = 0; i < walkers.length; i++) walkers[i].g.visible = i < walkCut;
      for (let i = 0; i < crossers.length; i++) crossers[i].g.visible = i < crossCut;
      for (let i = 0; i < pigeons.length; i++) pigeons[i].g.visible = i < pigeonCut;
    },
    update(playerZ: number, dt: number) {
      time += dt;
      dome.position.z = playerZ;
      sun.position.z = playerZ + 620;

      for (let i = 0; i < walkCut; i++) {
        const w = walkers[i];
        if (Math.abs(w.g.position.z - playerZ) > 160) continue;
        w.phase += dt * 9;
        w.g.position.z += w.dir * w.speed * dt;
        w.g.position.y = Math.abs(Math.sin(w.phase)) * 0.05;
        if (w.g.position.z < w.z0 || w.g.position.z > w.z1) w.dir *= -1;
        w.g.rotation.y = w.dir > 0 ? 0 : Math.PI;
      }

      for (let i = 0; i < crossCut; i++) {
        const c = crossers[i];
        if (Math.abs(c.g.position.z - playerZ) > 160) continue;
        c.g.position.x += c.dir * c.speed * dt;
        if (c.g.position.x > 13.5 || c.g.position.x < -13.5) c.dir *= -1;
        c.g.scale.x = c.dir > 0 ? 1 : -1; // sheet figures face +x (right); mirror when heading -x
        c.g.position.y = Math.abs(Math.sin(time * 8 + c.speed * 7)) * 0.05;
      }

      const near = playerZ > -25 && playerZ < 80;
      for (let i = 0; i < pigeonCut; i++) {
        const p = pigeons[i];
        p.t = approach(p.t, near ? 1 : 0, dt * (near ? 1.8 : 0.5));
        if (p.t > 0.01) {
          const a = time * 2 + p.seed;
          p.g.position.set(
            p.bx + Math.cos(a) * 2.5 * p.t,
            p.t * (2.6 + (p.seed % 3)),
            p.bz + Math.sin(a) * 2.5 * p.t,
          );
          p.g.rotation.y = a + Math.PI / 2;
        } else {
          p.g.position.set(p.bx, 0, p.bz);
        }
      }
    },
  };
}
