import * as THREE from 'three';
import { ROAD, SPEED } from './config';
import { approach, clamp, box, lambert, blobShadow } from './util';
import { loadCutout, cutoutBody } from './traffic';
import type { PaxType } from './passengers';

// Bykea logo decal (asset in /public) — decals size themselves from the PNG's
// real dimensions, so the asset can be swapped freely
let logoAspect = 3;
const logoDecals: { mesh: THREE.Mesh; width: number }[] = [];
const bykeaLogoTex = new THREE.TextureLoader().load('/bykea-logo.png', (t) => {
  logoAspect = t.image.width / t.image.height;
  for (const { mesh, width } of logoDecals) mesh.scale.set(width, width / logoAspect, 1);
});
bykeaLogoTex.colorSpace = THREE.SRGBColorSpace;
bykeaLogoTex.anisotropy = 8;

function logoDecal(width: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: bykeaLogoTex, transparent: true }),
  );
  mesh.scale.set(width, width / logoAspect, 1);
  logoDecals.push({ mesh, width });
  return mesh;
}

export interface PlayerInput {
  steer: number; // -1..1
  boost: boolean;
  brake?: boolean; // ease to a stop (arrival)
}

export class Player {
  group = new THREE.Group();
  private lean = new THREE.Group();
  private soloBody!: THREE.Group;
  private ganjiBody!: THREE.Group;
  private auntyBody!: THREE.Group;
  private paxGroup: THREE.Group | null = null;
  private plateCanvas = document.createElement('canvas');
  private plateTex: THREE.CanvasTexture;

  x = 0;
  z = 0;
  speed = 0;
  vx = 0;
  weight = 1;
  crashT = 0;
  private bounce = 0;
  private bounceV = 0;

  constructor(scene: THREE.Scene) {
    this.plateCanvas.width = 256;
    this.plateCanvas.height = 128;
    this.plateTex = new THREE.CanvasTexture(this.plateCanvas);
    this.plateTex.colorSpace = THREE.SRGBColorSpace;
    this.buildBike();
    this.group.add(this.lean);
    this.group.add(blobShadow(1.15, 2.2));
    scene.add(this.group);
    this.setPlate('RIDER');
  }

  private buildBike() {
    const g = this.lean;
    // AI sprite-cutout bike (same recipe as the traffic fleet) — the green-helmet
    // Bykea captain is painted into the sprites. One body per passenger state:
    // solo captain vs Ganji riding pillion (phone up, recording Traffic Tales).
    // setPax toggles visibility so pickup swaps the whole art.
    const blocker = { w: 0.25, h: 1.66, d: 2.35, color: '#1d3a28' };
    this.soloBody = cutoutBody(
      loadCutout('bykea', 'magenta'),
      3.45,
      2.59,
      0.14,
      1.93,
      2.58,
      1.31,
      blocker,
    );
    this.ganjiBody = cutoutBody(
      loadCutout('bykea_ganji', 'magenta'),
      3.45,
      2.59,
      0.14,
      1.93,
      2.58,
      1.31,
      blocker,
    );
    this.auntyBody = cutoutBody(
      loadCutout('aunty', 'cyan'),
      3.45,
      2.59,
      0.14,
      1.93,
      2.58,
      1.31,
      blocker,
    );
    this.ganjiBody.visible = false;
    this.auntyBody.visible = false;
    // the chase cam only ever sees the player from behind — the side planes and
    // blocker box would peek through the rear cutout's transparent pixels as a
    // streaky sliver, so the player keeps only the front + rear planes
    for (const body of [this.soloBody, this.ganjiBody, this.auntyBody]) {
      for (const child of body.children) {
        if (child.name === 'side' || child.name === 'blocker') child.visible = false;
      }
    }
    g.add(this.soloBody, this.ganjiBody, this.auntyBody);
    // number plate (rear) — kept small now: the painted sprite is the star,
    // plate + board sit low over the fender like real bike mounts
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.28),
      new THREE.MeshBasicMaterial({ map: this.plateTex }),
    );
    plate.position.set(0, 0.69, -1.54);
    plate.rotation.y = Math.PI;
    g.add(plate);
    // bykea tail board above the plate (wordmark, green-on-transparent).
    // Unlit material like the plate, so it stays white instead of going gray in shade.
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.26, 0.05),
      new THREE.MeshBasicMaterial({ color: '#f2f6f0' }),
    );
    board.position.set(0, 1.13, -1.46);
    g.add(board);
    const tailMark = logoDecal(0.54);
    tailMark.position.set(0, 1.13, -1.488);
    tailMark.rotation.y = Math.PI;
    g.add(tailMark);
  }

  setPlate(name: string) {
    const ctx = this.plateCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffc63d';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#221409';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 244, 116);
    ctx.fillStyle = '#221409';
    ctx.font = '800 26px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KHI', 128, 38);
    let size = 44;
    ctx.font = `800 ${size}px "Arial Black", sans-serif`;
    const text = (name || 'RIDER').toUpperCase().slice(0, 12);
    while (ctx.measureText(text).width > 215 && size > 18) {
      size -= 3;
      ctx.font = `800 ${size}px "Arial Black", sans-serif`;
    }
    ctx.fillText(text, 128, 95);
    this.plateTex.needsUpdate = true;
  }

  setPax(type: PaxType | null) {
    if (this.paxGroup) {
      this.lean.remove(this.paxGroup);
      this.paxGroup = null;
    }
    this.weight = 1;
    // Ganji and Rishta Aunty are each painted into their own sprite set —
    // swap the whole bike art; only solo/student/uncle use the box pillion
    this.ganjiBody.visible = type === 'ganji';
    this.auntyBody.visible = type === 'aunty';
    this.soloBody.visible = type !== 'ganji' && type !== 'aunty';
    if (type === 'ganji') {
      this.weight = 1.1;
      return;
    }
    if (type === 'aunty') {
      this.weight = 1.25;
      return;
    }
    if (!type) return;
    const p = new THREE.Group();
    p.position.set(0, 0, -0.62);
    const skin = lambert('#c98e63');
    if (type === 'student') {
      p.add(box(0.46, 0.6, 0.32, '#3d3d3d', 0, 1.52, 0));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), skin);
      head.position.set(0, 1.98, 0);
      p.add(head);
      p.add(box(0.42, 0.52, 0.2, '#2c6dbf', 0, 1.55, -0.3));
    } else {
      this.weight = 1.1;
      p.add(box(0.58, 0.62, 0.44, '#e3dccb', 0, 1.52, 0));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), skin);
      head.position.set(0, 2.0, 0);
      p.add(head);
      const beard = box(0.26, 0.16, 0.1, '#d8d8d8', 0, 1.88, 0.14);
      p.add(beard);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.17, 0.14, 10),
        lambert('#7a4a2c'),
      );
      cap.position.set(0, 2.16, 0);
      p.add(cap);
    }
    this.paxGroup = p;
    this.lean.add(p);
  }

  reset() {
    this.x = 3; // centered in the middle lane (left-hand traffic)
    this.z = 0;
    this.speed = 0;
    this.vx = 0;
    this.crashT = 0;
    this.bounce = 0;
    this.bounceV = 0;
    // update() only runs during the ride — sync the group now so the
    // haggle negotiation camera frames the bike at its spawn spot
    this.group.position.set(this.x, 0, this.z);
    this.lean.rotation.set(0, 0, 0);
  }

  crash() {
    this.crashT = 0.9;
    this.speed = SPEED.crash;
  }

  pothole() {
    this.bounceV = 3.2;
  }

  update(dt: number, input: PlayerInput) {
    this.crashT = Math.max(0, this.crashT - dt);
    const target = input.brake
      ? 0
      : this.crashT > 0
        ? SPEED.crash
        : input.boost
          ? SPEED.boost
          : SPEED.base;
    this.speed = approach(
      this.speed,
      target,
      ((input.brake ? 22 : SPEED.accel) / this.weight) * dt,
    );
    this.z += this.speed * dt;

    const steerTarget = input.steer * SPEED.steer;
    this.vx = approach(this.vx, steerTarget, 80 * dt);
    this.x = clamp(this.x + this.vx * dt, -ROAD.clampX, ROAD.clampX);
    if (Math.abs(this.x) >= ROAD.clampX) this.vx = 0;

    // pothole bounce spring
    this.bounceV += (-this.bounce * 90 - this.bounceV * 9) * dt;
    this.bounce += this.bounceV * dt;

    this.group.position.set(this.x, Math.max(0, this.bounce) * 0.3, this.z);
    this.lean.rotation.z = -this.vx * 0.038;
    // no yaw: it turns the sprite-cutout side planes into a streaky sliver
    // at the near-edge-on chase-cam angle (tilt alone keeps them invisible)
    this.lean.rotation.y = 0;
    this.lean.rotation.x = input.boost ? -0.03 : 0;
  }
}
