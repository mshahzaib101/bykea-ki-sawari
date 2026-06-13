import * as THREE from 'three';

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const approach = (v: number, target: number, maxDelta: number) =>
  v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target);

export function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

let blobTex: THREE.CanvasTexture | null = null;
export function blobShadow(rx: number, rz: number, opacity = 0.32): THREE.Mesh {
  if (!blobTex) {
    blobTex = canvasTexture(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(20,10,5,1)');
      g.addColorStop(1, 'rgba(20,10,5,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(rx * 2, rz * 2),
    new THREE.MeshBasicMaterial({
      map: blobTex,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  m.renderOrder = 2;
  return m;
}

export function lambert(color: string | number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

/**
 * Loads an AI-generated sprite shot on a lime-green background and keys the
 * green out at runtime (JPEG keeps files small; PNG alpha would be 3x bigger).
 * The texture starts blank and fills in when the image arrives.
 */
export const SPRITE_VERSION = 15; // bump when sprites in public/img change — busts browser cache

export type ChromaKey = 'green' | 'magenta' | 'cyan';

export function chromaKeyTex(url: string, key: ChromaKey = 'green'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 2;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const img = new Image();
  let retries = 0;
  img.onerror = () => {
    // image missing/failed (e.g. tab loaded mid-deploy) — retry instead of staying a box
    if (retries++ < 5)
      setTimeout(() => {
        img.src = `${url}?v=${SPRITE_VERSION}&r=${retries}`;
      }, 1500);
    else console.error(`[sawari] sprite failed to load: ${url}`);
  };
  img.onload = () => {
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    keyPixels(ctx, c.width, c.height, key);
    // GPU texture storage is fixed-size once uploaded — if the placeholder 2x2
    // was already rendered, a plain needsUpdate won't grow it. dispose() forces
    // a fresh allocation at the real size on the next frame.
    tex.dispose();
    tex.needsUpdate = true;
    if (import.meta.env.DEV) console.log(`[sawari] sprite loaded: ${url} (v${SPRITE_VERSION})`);
  };
  img.src = `${url}?v=${SPRITE_VERSION}`;
  return tex;
}

function keyPixels(ctx: CanvasRenderingContext2D, w: number, h: number, key: ChromaKey) {
  const d = ctx.getImageData(0, 0, w, h);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i],
      g = p[i + 1],
      b = p[i + 2];
    if (key === 'green') {
      const diff = g - Math.max(r, b); // green dominance
      // bright lime only — painted flag/leaf greens are darker (g < 150) and stay
      if (g > 150 && diff > 20) {
        p[i + 3] = Math.max(0, 255 - (diff - 20) * 8); // fade so JPEG noise dies at alphaTest
        p[i + 1] = Math.max(r, b); // despill
      }
    } else if (key === 'cyan') {
      // cyan — for sprites that are BOTH pink and green (e.g. pink Rishta Aunty
      // on the green bike): magenta clashes with her dupatta, green with the bike.
      // cyan = low red, high green AND high blue together — unique to the bg.
      const diff = Math.min(g, b) - r;
      if (g > 150 && b > 150 && diff > 35) {
        p[i + 3] = Math.max(0, 255 - (diff - 35) * 8);
        p[i + 1] = p[i + 2] = Math.max(r, Math.min(g, b) - diff); // desaturate the spill
      }
    } else {
      // magenta — for green vehicles like rickshaws
      const diff = Math.min(r, b) - g;
      if (r > 160 && b > 160 && diff > 35) {
        p[i + 3] = Math.max(0, 255 - (diff - 35) * 8);
        p[i] = p[i + 2] = Math.max(g, Math.min(r, b) - diff); // desaturate the spill
      }
    }
  }
  ctx.putImageData(d, 0, 0);
}

/**
 * Loads a sprite SHEET (figures in a row, equal spacing) and slices it into
 * `cols` separate chroma-keyed textures — one generation, many characters.
 */
export function chromaKeySheet(
  url: string,
  cols: number,
  key: ChromaKey = 'green',
): THREE.CanvasTexture[] {
  const canvases: HTMLCanvasElement[] = [];
  const texes: THREE.CanvasTexture[] = [];
  for (let i = 0; i < cols; i++) {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    canvases.push(c);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texes.push(t);
  }
  const img = new Image();
  let retries = 0;
  img.onerror = () => {
    if (retries++ < 5)
      setTimeout(() => {
        img.src = `${url}?v=${SPRITE_VERSION}&r=${retries}`;
      }, 1500);
    else console.error(`[sawari] sprite sheet failed to load: ${url}`);
  };
  img.onload = () => {
    const cw = Math.floor(img.width / cols);
    canvases.forEach((c, i) => {
      c.width = cw;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, i * cw, 0, cw, img.height, 0, 0, cw, img.height);
      keyPixels(ctx, cw, img.height, key);
      // see chromaKeyTex: dispose so the resized canvas re-allocates on the GPU
      texes[i].dispose();
      texes[i].needsUpdate = true;
    });
    if (import.meta.env.DEV)
      console.log(`[sawari] sprite sheet loaded: ${url} (${cols} cols, v${SPRITE_VERSION})`);
  };
  img.src = `${url}?v=${SPRITE_VERSION}`;
  return texes;
}

export function box(
  w: number,
  h: number,
  d: number,
  color: string | number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
  m.position.set(x, y, z);
  return m;
}
