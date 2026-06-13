// Procedural Karachi building facades — drawn on canvas, used as textures.
// Saddar = weathered colonial: arched windows, balconies, signboard-choked ground floors.
// Clifton = beige apartment towers: balcony grids, AC units, the odd laundry line.
import * as THREE from 'three';
import { canvasTexture, pick, rand } from './util';

export interface FacadeStyle {
  tex: THREE.Texture; // canvas-drawn or AI-photographed (public/img/facade_*.jpg)
  base: string; // wall color for the box volume behind the facade plane
  floors: number;
}

const SADDAR_WALLS = [
  '#d8c49a',
  '#d9c27e',
  '#c89e8a',
  '#a8bba6',
  '#9fb3c0',
  '#ddd6c2',
  '#c9a878',
  '#b8a288',
];
const SIGN_BGS = [
  '#23355c',
  '#8c1f3a',
  '#176b38',
  '#c0392b',
  '#1f5c8c',
  '#222222',
  '#7d2640',
  '#b3551f',
  '#15364a',
];
const SIGN_FGS = ['#ffd23d', '#ffffff', '#ffe9b0', '#7fd4ff', '#3ddc84', '#ffb8d0'];

const SHOP_NAMES = [
  'BISMILLAH ELECTRONICS',
  'KARACHI OPTICS',
  'MEHRAN CLOTH',
  'AL-MADINA STORE',
  'SARVIS SHOES',
  'UNITED MOBILE',
  'DECENT GARMENTS',
  'NIMCO CORNER',
  'PAN PALACE',
  'KHAN HAIR SALOON',
  'CITY BOOK POINT',
  'STOODENT BIRYANI',
  'DISCO BAKERY',
  'QUETTA HOTEL',
  'GULF JEWELLERS',
  'MADINA MEDICOS',
  'BOMBAY SWEETS',
  'LIBERTY CROCKERY',
  'ANARKALI FABRICS',
  'SUPER ASIA FANS',
];
const URDU_WORDS = [
  'الیکٹرانکس',
  'کپڑے',
  'جوتے',
  'ہوٹل',
  'کتابیں',
  'موبائل',
  'دوائیں',
  'مٹھائی',
  'صرافہ',
];

function weather(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // grime streaks dripping from ledges — instant "old Karachi" feel
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.7;
    const len = 20 + Math.random() * 80;
    const grad = ctx.createLinearGradient(0, y, 0, y + len);
    grad.addColorStop(0, 'rgba(40,30,20,0.22)');
    grad.addColorStop(1, 'rgba(40,30,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, 2 + Math.random() * 4, len);
  }
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = 'rgba(60,45,30,0.10)';
    ctx.fillRect(
      Math.random() * w,
      Math.random() * h,
      12 + Math.random() * 40,
      8 + Math.random() * 20,
    );
  }
}

function drawSign(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
) {
  const bg = pick(SIGN_BGS);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = pick(SIGN_FGS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = Math.min(h * 0.42, 22);
  ctx.font = `800 ${size}px "Arial Black", sans-serif`;
  while (ctx.measureText(name).width > w - 10 && size > 8) {
    size -= 1;
    ctx.font = `800 ${size}px "Arial Black", sans-serif`;
  }
  ctx.fillText(name, x + w / 2, y + h * 0.34);
  // Urdu second line
  ctx.font = `${Math.min(h * 0.3, 15)}px "Geeza Pro", "Noto Nastaliq Urdu", serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(pick(URDU_WORDS), x + w / 2, y + h * 0.74);
}

export function makeSaddarFacade(): FacadeStyle {
  const W = 512;
  const H = 512;
  const base = pick(SADDAR_WALLS);
  const floors = 2 + ((Math.random() * 3) | 0); // 2-4 upper floors
  const tex = canvasTexture(W, H, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    const groundH = H * 0.27;
    const corniceH = H * 0.05;
    const floorH = (H - groundH - corniceH) / floors;
    const arched = Math.random() < 0.65;
    const trim = Math.random() < 0.5 ? 'rgba(255,255,255,0.75)' : 'rgba(90,60,40,0.6)';

    // upper floors
    const cols = 3 + ((Math.random() * 2) | 0);
    const winW = (W / cols) * 0.46;
    for (let f = 0; f < floors; f++) {
      const fy = corniceH + f * floorH;
      // floor divider ledge
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, fy + floorH - 3, W, 3);
      for (let c = 0; c < cols; c++) {
        const cx = (W / cols) * (c + 0.5);
        const wx = cx - winW / 2;
        const wy = fy + floorH * 0.16;
        const wh = floorH * 0.52;
        // window
        ctx.fillStyle = '#2c2620';
        if (arched) {
          ctx.beginPath();
          ctx.moveTo(wx, wy + wh);
          ctx.lineTo(wx, wy + winW * 0.3);
          ctx.arc(cx, wy + winW * 0.3, winW / 2, Math.PI, 0);
          ctx.lineTo(wx + winW, wy + wh);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = trim;
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          ctx.fillRect(wx, wy, winW, wh);
          ctx.strokeStyle = trim;
          ctx.lineWidth = 3;
          ctx.strokeRect(wx, wy, winW, wh);
        }
        // half-open wooden shutter sometimes
        if (Math.random() < 0.3) {
          ctx.fillStyle = 'rgba(122,82,58,0.85)';
          ctx.fillRect(wx, wy, winW * 0.45, wh);
        }
        // balcony rail under window
        const by = wy + wh + 2;
        ctx.strokeStyle = 'rgba(40,30,25,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx - 6, by, winW + 12, floorH * 0.14);
        for (let b = 0; b < 6; b++) {
          ctx.beginPath();
          ctx.moveTo(wx - 6 + ((winW + 12) / 6) * (b + 0.5), by);
          ctx.lineTo(wx - 6 + ((winW + 12) / 6) * (b + 0.5), by + floorH * 0.14);
          ctx.stroke();
        }
        // AC unit
        if (Math.random() < 0.35) {
          ctx.fillStyle = '#9a9a92';
          ctx.fillRect(wx + winW + 4, wy + wh * 0.4, 16, 12);
          ctx.fillStyle = '#6a6a62';
          ctx.fillRect(wx + winW + 4, wy + wh * 0.4 + 4, 16, 2);
        }
      }
    }

    // cornice
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, 0, W, corniceH * 0.6);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let d = 0; d < W; d += 16) ctx.fillRect(d, corniceH * 0.6, 8, 4);

    // ground floor — signboard chaos
    const gy = H - groundH;
    ctx.fillStyle = '#3a322a';
    ctx.fillRect(0, gy, W, groundH);
    const shops = 3;
    const shopW = W / shops;
    for (let s = 0; s < shops; s++) {
      const sx = s * shopW;
      // shutter / open shop
      const open = Math.random() < 0.5;
      ctx.fillStyle = open ? '#1c1813' : pick(['#7a8a92', '#8a7a62', '#6a7a6a']);
      ctx.fillRect(sx + 6, gy + groundH * 0.34, shopW - 12, groundH * 0.62);
      if (!open) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        for (let l = 0; l < 8; l++) {
          const ly = gy + groundH * 0.34 + ((groundH * 0.62) / 8) * l;
          ctx.beginPath();
          ctx.moveTo(sx + 6, ly);
          ctx.lineTo(sx + shopW - 6, ly);
          ctx.stroke();
        }
      } else {
        // goods glow inside
        ctx.fillStyle = 'rgba(255,190,90,0.35)';
        ctx.fillRect(sx + 10, gy + groundH * 0.42, shopW - 20, groundH * 0.3);
      }
      drawSign(ctx, sx + 3, gy + 4, shopW - 6, groundH * 0.28, pick(SHOP_NAMES));
    }
    weather(ctx, W, H);
  });
  return { tex, base, floors };
}

export function makeCliftonFacade(): FacadeStyle {
  const W = 512;
  const H = 512;
  const base = pick(['#cfc5b0', '#d8d2c2', '#bdb4a0', '#c8c8c0', '#b8c0c4']);
  const tex = canvasTexture(W, H, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    const rows = 8;
    const cols = 4;
    const cw = W / cols;
    const rh = (H * 0.9) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.12;
        const y = r * rh + rh * 0.16;
        const w = cw * 0.76;
        const h = rh * 0.62;
        // recessed balcony
        ctx.fillStyle = 'rgba(40,38,34,0.85)';
        ctx.fillRect(x, y, w, h);
        // glass
        ctx.fillStyle = 'rgba(120,140,150,0.5)';
        ctx.fillRect(x + 3, y + 3, w - 6, h * 0.5);
        // railing
        ctx.strokeStyle = 'rgba(220,215,205,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y + h * 0.55, w, h * 0.42);
        for (let b = 0; b < 7; b++) {
          ctx.beginPath();
          ctx.moveTo(x + (w / 7) * (b + 0.5), y + h * 0.55);
          ctx.lineTo(x + (w / 7) * (b + 0.5), y + h * 0.97);
          ctx.stroke();
        }
        // laundry
        if (Math.random() < 0.18) {
          for (let l = 0; l < 3; l++) {
            ctx.fillStyle = pick(['#c0392b', '#1f5c8c', '#e8b04a', '#7d4a8c']);
            ctx.fillRect(x + 4 + l * (w / 3), y + h * 0.6, w / 4.2, h * 0.3);
          }
        }
        // AC
        if (Math.random() < 0.4) {
          ctx.fillStyle = '#8a8a82';
          ctx.fillRect(x + w - 14, y + h + 2, 14, 9);
        }
      }
    }
    // lobby band
    ctx.fillStyle = 'rgba(60,55,48,0.9)';
    ctx.fillRect(0, H * 0.92, W, H * 0.08);
    weather(ctx, W, H);
  });
  return { tex, base, floors: 8 };
}

/** Rainbow Centre — the legendary blocky CD/DVD plaza on Zaibunnisa */
export function makePlazaFacade(): FacadeStyle {
  const W = 512;
  const H = 512;
  const base = '#9aa4ac';
  const tex = canvasTexture(W, H, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    // big top sign
    ctx.fillStyle = '#23355c';
    ctx.fillRect(0, 10, W, 78);
    ctx.fillStyle = '#ffd23d';
    ctx.font = '800 52px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RAINBOW CENTRE', W / 2, 50);
    // rainbow arc strip
    const cols7 = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#5b48a2', '#9b59b6'];
    cols7.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect((W / 7) * i, 92, W / 7, 10);
    });
    // floors of tiny shop windows with cluttered mini-signs
    for (let r = 0; r < 5; r++) {
      const y = 116 + r * 76;
      for (let c = 0; c < 6; c++) {
        const x = 8 + c * (W / 6);
        ctx.fillStyle = '#2a2e36';
        ctx.fillRect(x, y, W / 6 - 14, 44);
        ctx.fillStyle = pick(SIGN_BGS);
        ctx.fillRect(x, y + 46, W / 6 - 14, 18);
        ctx.fillStyle = pick(SIGN_FGS);
        ctx.font = '700 11px Arial, sans-serif';
        ctx.fillText(
          pick(['CD • DVD', 'GAMES', 'MOBILE', 'MEMORY', 'SOFTWARE', 'CAMERA']),
          x + (W / 6 - 14) / 2,
          y + 55,
        );
      }
    }
    weather(ctx, W, H);
  });
  return { tex, base, floors: 5 };
}

/** Empress Market gallery wall — pointed sandstone arches (buff stone, per the real thing) */
export function makeEmpressWall(): THREE.CanvasTexture {
  return canvasTexture(1024, 256, (ctx) => {
    ctx.fillStyle = '#c1955f';
    ctx.fillRect(0, 0, 1024, 256);
    // stone block lines
    ctx.strokeStyle = 'rgba(70,40,20,0.25)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < 256; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }
    // arched gallery
    for (let i = 0; i < 10; i++) {
      const cx = 51 + i * 102;
      const aw = 64;
      ctx.fillStyle = '#3a2a1d';
      ctx.beginPath();
      ctx.moveTo(cx - aw / 2, 240);
      ctx.lineTo(cx - aw / 2, 120);
      // pointed arch
      ctx.quadraticCurveTo(cx - aw / 2, 70, cx, 58);
      ctx.quadraticCurveTo(cx + aw / 2, 70, cx + aw / 2, 120);
      ctx.lineTo(cx + aw / 2, 240);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e8d8b8';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    // white trim band on top
    ctx.fillStyle = '#e8ddc8';
    ctx.fillRect(0, 0, 1024, 26);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let d = 0; d < 1024; d += 24) ctx.fillRect(d, 26, 12, 6);
    weather(ctx, 1024, 256);
  });
}

/** Frere Hall wall — Venetian-Gothic pointed arches on cream limestone */
export function makeFrereWall(): THREE.CanvasTexture {
  return canvasTexture(1024, 256, (ctx) => {
    ctx.fillStyle = '#ded2ac';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = 'rgba(120,90,50,0.2)';
    for (let y = 0; y < 256; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }
    for (let row = 0; row < 2; row++) {
      const top = row === 0 ? 30 : 140;
      for (let i = 0; i < 12; i++) {
        const cx = 42 + i * 85;
        const aw = 44;
        ctx.fillStyle = '#352a1c';
        ctx.beginPath();
        ctx.moveTo(cx - aw / 2, top + 90);
        ctx.lineTo(cx - aw / 2, top + 30);
        ctx.quadraticCurveTo(cx - aw / 2, top, cx, top - 8);
        ctx.quadraticCurveTo(cx + aw / 2, top, cx + aw / 2, top + 30);
        ctx.lineTo(cx + aw / 2, top + 90);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#8a6a42';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
    weather(ctx, 1024, 256);
  });
}

export function makeBuntingTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(1024, 96, (ctx) => {
    ctx.clearRect(0, 0, 1024, 96);
    ctx.strokeStyle = 'rgba(30,25,20,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(1024, 8);
    ctx.stroke();
    const cols = ['#e74c3c', '#f1c40f', '#2ecc71', '#ff2e88', '#3498db', '#e67e22'];
    for (let i = 0; i < 26; i++) {
      const x = i * 40 + 8;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x + 30, 10);
      ctx.lineTo(x + 15, 80);
      ctx.closePath();
      ctx.fill();
    }
  });
  return tex;
}

export interface BillboardAd {
  title: string;
  sub: string;
  bg: string;
  fg: string;
}

export const BILLBOARD_ADS: BillboardAd[] = [
  { title: 'JAZZBA 4G', sub: 'ab Clifton bhi FAST', bg: '#8c1f3a', fg: '#ffd23d' },
  { title: 'THANDA COLA', sub: 'garmi ka asli ilaaj', bg: '#1f5c8c', fg: '#ffffff' },
  { title: 'KHAALIS DOODH', sub: 'subah 6 baje, ghar pe', bg: '#176b38', fg: '#ffe9b0' },
  { title: 'CHAND DHABA', sub: 'chai Rs 50 — VIP wali', bg: '#23355c', fg: '#7fd4ff' },
];

export function makeBillboard(ad: BillboardAd): THREE.CanvasTexture {
  return canvasTexture(512, 200, (ctx) => {
    ctx.fillStyle = ad.bg;
    ctx.fillRect(0, 0, 512, 200);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 184);
    ctx.fillStyle = ad.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 58px "Arial Black", sans-serif';
    ctx.fillText(ad.title, 256, 78);
    ctx.font = 'italic 700 30px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(ad.sub, 256, 146);
  });
}

export function makeZebraStripes(): void {
  // stripes are plain geometry; placeholder kept for symmetry
}

export const KURTA_COLORS = [
  '#e8e0cc',
  '#9aa7b5',
  '#7d8c6e',
  '#b56e6e',
  '#5c7d99',
  '#c8b08a',
  '#8c8c94',
  '#a8927a',
];
export const DUPATTA_COLORS = ['#c0392b', '#8e44ad', '#d4621f', '#1f8c5c', '#c2185b'];

export { rand as _rand };
