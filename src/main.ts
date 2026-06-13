import * as THREE from 'three';
import './style.css';
import { ROUTE, SPEED, MOOD, KATA_RUPEES, CAST } from './config';
import type { CastChar } from './config';
import { buildWorld } from './world';
import { Traffic, SADDAR_TARGETS, CLIFTON_TARGETS } from './traffic';
import type { KindCounts } from './traffic';
import { quality } from './quality';
import { Player } from './player';
import { SawariAudio } from './audio';
import { UI } from './ui';
import { paxFor, rollFare, makeRoast } from './passengers';
import type { Pax, RunStats } from './passengers';
import { VOICE_BASE } from './voices';
import {
  GANJI_AVATAR,
  GANJI_LINES,
  GANJI_VOICE_COUNTS,
  GANJI_FITCHECK,
  GANJI_FIXED,
  GANJI_HAGGLE,
  GANJI_SELECT,
  GANJI_REVIEWS,
  ganjiVoiceIds,
} from './rider';
import type { GanjiCat } from './rider';
import {
  RISHTA_AVATAR,
  RISHTA_LINES,
  RISHTA_COUNTS,
  RISHTA_HAGGLE,
  RISHTA_SELECT,
  RISHTA_REVIEWS,
  rishtaVoiceIds,
} from './aunty';
import type { RishtaCat } from './aunty';
import type { Vehicle } from './traffic';
import { clamp, lerp, rand, chromaKeyTex, blobShadow } from './util';

type GameState = 'menu' | 'haggle' | 'ride' | 'arrive' | 'card';

// ---------- renderer / scene ----------
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const PR_CAP = 2; // hard cap on devicePixelRatio (3× retina buys nothing here)
// antialias is fixed at construction, so it's decided once up front; render
// resolution + densities then adapt live (see quality.onChange + quality.sample).
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality.antialias,
    powerPreference: 'high-performance',
  });
} catch {
  // genuinely no WebGL (ancient device / GPU blocklist) — show a friendly note
  document.getElementById('webgl-fallback')?.classList.remove('hidden');
  (document.getElementById('app') as HTMLElement).style.visibility = 'visible';
  document.getElementById('boot')?.remove();
  throw new Error('WebGL unavailable');
}
// dynamic-resolution lever: capped DPR × the adaptive resScale (1 = full)
function applyPixelRatio() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PR_CAP) * quality.current.resScale);
}
applyPixelRatio();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
// the bundle (and its CSS) is in — drop the boot splash, reveal the game
document.getElementById('boot')?.remove();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1700);

// the world is built at FULL crowd density; thinning (if ever needed) happens
// live via world.setCrowdScale, so capable devices always get the full street
const world = buildWorld(scene);
const traffic = new Traffic(scene);
const player = new Player(scene);
const audio = new SawariAudio();
const ui = new UI();

// NPC vehicle targets, scaled by the live density lever. Recomputed whenever
// quality changes; the ride loop assigns the right zone's set each frame.
function scaleTargets(t: KindCounts, s: number): KindCounts {
  if (s >= 1) return { ...t };
  return {
    car: Math.max(1, Math.round(t.car * s)),
    rickshaw: Math.max(1, Math.round(t.rickshaw * s)),
    bike: Math.max(1, Math.round(t.bike * s)),
    bus: Math.max(1, Math.round(t.bus * s)),
    cart: Math.max(1, Math.round(t.cart * s)),
  };
}
let saddarT = scaleTargets(SADDAR_TARGETS, quality.current.densityScale);
let cliftonT = scaleTargets(CLIFTON_TARGETS, quality.current.densityScale);
world.setCrowdScale(quality.current.densityScale);

quality.onChange = (s) => {
  applyPixelRatio();
  saddarT = scaleTargets(SADDAR_TARGETS, s.densityScale);
  cliftonT = scaleTargets(CLIFTON_TARGETS, s.densityScale);
  world.setCrowdScale(s.densityScale);
};

// standing passenger at the kerb during the haggle — the same character who
// then hops on as the pillion sprite; the negotiation camera frames them with
// the captain. One plane, texture swapped per cast member in newRide().
const standeeTex = {
  ganji: chromaKeyTex('/img/ganji_stand.jpg', 'magenta'),
  aunty: chromaKeyTex('/img/aunty_stand.jpg', 'cyan'), // pink outfit → cyan key
};
// frustrated faces — swapped in when the rider lowballs ("Itne mein nahi")
const standeeTexAngry = {
  ganji: chromaKeyTex('/img/ganji_stand_angry.jpg', 'magenta'),
  aunty: chromaKeyTex('/img/aunty_stand_angry.jpg', 'cyan'),
};
const standee = new THREE.Group();
const standeeMat = new THREE.MeshBasicMaterial({
  map: standeeTex.ganji,
  transparent: true,
  alphaTest: 0.35,
});
{
  // full standing-adult height: the standee sits at z+1.6 (further from the
  // negotiation cam than the bike), so it must be physically taller than the
  // bike sprite to read as the same on-screen height beside the captain.
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.88, 2.5), standeeMat);
  m.position.y = 1.16; // ~4% bottom margin in the art → feet sit on the road
  standee.add(m);
  standee.add(blobShadow(0.5, 0.45));
  standee.rotation.y = Math.PI; // face the negotiation camera (behind the bike)
  standee.visible = false;
  scene.add(standee);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyPixelRatio(); // DPR can change when dragging between monitors
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
// some mobile browsers update innerWidth a tick after the orientation flips
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
// kill the engine drone if the tab is backgrounded mid-ride (rAF is throttled
// anyway, but the AudioContext keeps running) — restored on the next ride frame
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.setEngine(0);
});

// ---------- input ----------
const keys = new Set<string>();
let touchSteer = 0;
let buttonBoost = false;
const steerPointers = new Map<number, number>();

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
  if (e.key === ' ' && !e.repeat) doHorn();
  if (e.key === 'm' && !e.repeat) {
    audio.setMuted(!audio.muted);
  }
  if (e.key === 'Escape' && !e.repeat) togglePause();
  keys.add(e.key);
});
window.addEventListener('keyup', (e) => keys.delete(e.key));

const isUiTarget = (t: EventTarget | null) =>
  t instanceof Element &&
  (t.closest('button') || t.closest('.sheet-card') || t.closest('.screen') || t.closest('input'));

window.addEventListener('pointerdown', (e) => {
  if (isUiTarget(e.target)) return;
  // camera looks down +z, so screen-left = +x: left tap steers +1
  steerPointers.set(e.pointerId, e.clientX < window.innerWidth / 2 ? 1 : -1);
  recomputeTouchSteer();
  ui.hideSteerCoach(); // the first steer tap clears the tip (no-op otherwise)
});
window.addEventListener('pointerup', (e) => {
  steerPointers.delete(e.pointerId);
  recomputeTouchSteer();
});
window.addEventListener('pointercancel', (e) => {
  steerPointers.delete(e.pointerId);
  recomputeTouchSteer();
});
function recomputeTouchSteer() {
  touchSteer = 0;
  for (const s of steerPointers.values()) touchSteer += s;
  touchSteer = clamp(touchSteer, -1, 1);
}

// ---------- home-screen audio ----------
// Browsers refuse to play sound until the player interacts. Nothing is
// pre-selected, so the player's REQUIRED first move — picking a character —
// is that gesture: it unlocks audio AND plays that character's voice (via
// onCharPick). Here we just bring up the menu loop + soft street horns on the
// first interaction (a card, the name field, a key — anything). Fires once;
// the music carries into the haggle/card screens and stops when the ride begins.
let menuAudioBooted = false;
function bootMenuAudio() {
  if (menuAudioBooted) return;
  menuAudioBooted = true;
  audio.unlock(); // starts the engine bed + ambience (the soft distant horns)
  void audio.loadMusic(`${VOICE_BASE}music_menu.mp3`);
  audio.playMusic(); // begins the moment the clip decodes
}
window.addEventListener('pointerdown', bootMenuAudio);
window.addEventListener('keydown', bootMenuAudio);

function readInput() {
  let steer = touchSteer;
  // screen-left = +x (see pointerdown note)
  if (keys.has('ArrowLeft') || keys.has('a')) steer += 1;
  if (keys.has('ArrowRight') || keys.has('d')) steer -= 1;
  const boost = buttonBoost || keys.has('ArrowUp') || keys.has('w');
  return { steer: clamp(steer, -1, 1), boost };
}

// ---------- run state ----------
let state: GameState = 'menu';
// which cast member is your sawari today — picked on the start screen
let castPick: CastChar = 'ganji';
let pax: Pax = paxFor(castPick);
let fare = 0;
let counterRound = 0; // the 3-round haggle
let mood = MOOD.start;
let rideTime = 0;
let arriveT = 0;
let boostLineCD = 0;
let hornCD = 0;
let shake = 0;
let plateName = 'RIDER';
const potholesHit = new Set<number>();

// Ganji Swag's traffic rage (he's the pillion passenger) — BP boils in jams,
// maxing out means he records a Traffic Tale
const RANT_RUPEES = 30;
let bp = 0;
let jamT = 0;
let riderLineCD = 0;
let noiseCD = 0;
let rantCount = 0;
let silenceT = 0; // how long the mic has been quiet — the chatter watchdog
let storyCount = 0;
let wpIdx = 0; // next fixed route beat (GANJI_FIXED)
let overtakers = new WeakSet<Vehicle>();

// reactions blocked while a story/chatter line plays are REMEMBERED and fire
// right after it ends (if still fresh) — stories never starve reactions
const GANJI_REACTS = new Set<GanjiCat>([
  'jam',
  'cutoff',
  'nohelmet',
  'wrongway',
  'pothole',
  'crash',
  'noise',
  'bus',
  'boost',
]);
const RISHTA_REACTS = new Set<RishtaCat>(['jam', 'launde', 'crash', 'pothole', 'boost']);
let pendingReact: { who: CastChar; cat: GanjiCat | RishtaCat; at: number } | null = null;

// Rishta Aunty's approval — drive well and the 💍 meter fills; maxed = pakka
const RISHTA_RUPEES = 50;
let rs = 0.3;
let askIdx = 0; // her biodata questions fire IN ORDER — it's an interview
let rStoryCount = 0;
let nextIsAsk = true;
let pakkaCount = 0;

const LANDMARKS = [
  { z: 80, name: 'Empress Market', sub: 'Saddar, Karachi' },
  { z: 196, name: 'Rainbow Centre', sub: 'Zaibunnisa Street' },
  { z: 322, name: 'Khyber Hotel', sub: 'Saddar' },
  { z: 470, name: 'Bohri Bazaar', sub: 'Saddar' },
  { z: 620, name: 'Zainab Market', sub: 'Saddar, Karachi' },
  { z: 790, name: 'Regal Chowk', sub: 'Saddar' },
  { z: 890, name: 'Hotel Metropole', sub: 'Club Road' },
  { z: 962, name: 'Frere Hall', sub: 'Civil Lines' },
  { z: 1018, name: 'Clifton Bridge', sub: 'Karachi' },
  { z: 1240, name: 'Park Towers', sub: 'Clifton' },
  { z: 1352, name: 'Teen Talwar', sub: 'Clifton, Karachi' },
];
let landmarkIdx = 0;

const stats: RunStats = {
  fare: 0,
  payout: 0,
  stars: 5,
  timeSec: 0,
  horns: 0,
  bumps: 0,
  potholes: 0,
  kata: 0,
  paxName: '',
  paxAvatar: '',
};

function resetStats() {
  stats.fare = fare;
  stats.payout = 0;
  stats.stars = 5;
  stats.timeSec = 0;
  stats.horns = 0;
  stats.bumps = 0;
  stats.potholes = 0;
  stats.kata = 0;
  stats.paxName = pax.name;
  stats.paxAvatar = pax.avatar;
}

function newRide() {
  player.reset();
  player.setPax(null);
  traffic.reset();
  potholesHit.clear();
  pax = paxFor(castPick);
  fare = rollFare(pax);
  counterRound = 0;
  ui.hideCard();
  ui.hideHUD();
  ui.showHaggle(pax, fare);
  // the chosen cast member IS the passenger — load + play their voice.
  // The greet retries: on a phone the clip may still be downloading/decoding.
  audio.loadMany(castPick === 'ganji' ? ganjiVoiceIds() : rishtaVoiceIds());
  const greetId = castPick === 'ganji' ? 'ganji_greet' : 'rishta_greet';
  let greetTries = 0;
  const tryGreet = () => {
    if (state !== 'haggle') return;
    if (!audio.playVoice(greetId, true) && ++greetTries < 8) setTimeout(tryGreet, 450);
  };
  setTimeout(tryGreet, 350);
  audio.playMusic();
  // The chosen passenger stands at the kerb arguing the fare, then hops on.
  // Median side (-x): on the negotiation cam that's screen-RIGHT of the rider.
  standeeMat.map = standeeTex[castPick]; // start neutral — turns frustrated on a lowball
  standeeMat.needsUpdate = true;
  standee.visible = true;
  // portrait's narrow FOV clips the bigger standee at the right edge, so pull it
  // toward centre; landscape has room and keeps the original wider offset.
  standee.position.set(player.x - (camera.aspect < 0.8 ? 1.2 : 1.6), 0, player.z + 1.6);
  state = 'haggle';
}

// shuffle-bag per category: every line plays once before any can repeat
// (persists across rides — back-to-back runs stay fresh too)
const lineBags: Record<string, number[]> = {};
function pickLine(key: string, n: number, fixedIdx?: number): number {
  if (fixedIdx !== undefined) return Math.min(fixedIdx, n - 1);
  let bag = lineBags[key];
  if (!bag || bag.length === 0) {
    bag = Array.from({ length: n }, (_, i) => i);
    lineBags[key] = bag;
  }
  return bag.splice((Math.random() * bag.length) | 0, 1)[0];
}

/**
 * Ganji Swag speaks — STRICTLY one line at a time: a new line only starts
 * once the current one has finished (no mid-sentence cuts). Bleeped lines
 * play a censor tone where the slang word was.
 */
function sayGanji(cat: GanjiCat, ms = 2600, force = false, fixedIdx?: number): boolean {
  if (castPick !== 'ganji') return false;
  if (!force && audio.voiceBusy()) {
    if (GANJI_REACTS.has(cat)) pendingReact = { who: 'ganji', cat, at: rideTime };
    return false;
  }
  if (GANJI_REACTS.has(cat)) pendingReact = null;
  const lines = GANJI_LINES[cat];
  const n = Math.min(GANJI_VOICE_COUNTS[cat], lines.length);
  const idx = pickLine(`g_${cat}`, n, fixedIdx);
  const line = lines[idx];
  // Stories: keep the bubble up only as long as the line is actually spoken
  // (+ a short tail), so it CLEARS afterwards and a real ~1.5s gap shows before
  // the next qissa — instead of one story's text swapping straight into the
  // next. (clipDuration is 0 until the clip decodes → fall back to caller ms.)
  let bubbleMs = ms;
  if (cat === 'story') {
    const dur = audio.clipDuration(`ganji_${cat}${idx}`);
    if (dur > 0) bubbleMs = dur * 1000 + 500;
  }
  ui.bubble(GANJI_AVATAR, line.text, bubbleMs);
  if (line.bleep) {
    audio.bleep(); // claims the channel, then the clip takes over
    setTimeout(() => audio.playVoice(`ganji_${cat}${idx}`, true), 300);
  } else {
    audio.playVoice(`ganji_${cat}${idx}`, force);
  }
  return true;
}

function bumpBP(amount: number) {
  if (castPick !== 'ganji' || state !== 'ride') return;
  bp = clamp(bp + amount, 0, 1);
}

/** Rishta Aunty speaks — same strict one-line-at-a-time channel as Ganji */
function sayRishta(cat: RishtaCat, ms = 2600, force = false, fixedIdx?: number): boolean {
  if (castPick !== 'aunty') return false;
  if (!force && audio.voiceBusy()) {
    if (RISHTA_REACTS.has(cat)) pendingReact = { who: 'aunty', cat, at: rideTime };
    return false;
  }
  if (RISHTA_REACTS.has(cat)) pendingReact = null;
  const lines = RISHTA_LINES[cat];
  const n = Math.min(RISHTA_COUNTS[cat], lines.length);
  const idx = pickLine(`r_${cat}`, n, fixedIdx);
  // Stories: bubble tracks the spoken line (+ tail) so it clears and leaves a
  // real ~1.5s gap before her next qissa — see sayGanji.
  let bubbleMs = ms;
  if (cat === 'story') {
    const dur = audio.clipDuration(`rishta_${cat}${idx}`);
    if (dur > 0) bubbleMs = dur * 1000 + 500;
  }
  ui.bubble(RISHTA_AVATAR, lines[idx], bubbleMs);
  audio.playVoice(`rishta_${cat}${idx}`, force);
  return true;
}

function bumpRS(amount: number) {
  if (castPick !== 'aunty' || state !== 'ride') return;
  rs = clamp(rs + amount, 0, 1);
}

let paused = false;

function togglePause() {
  if (state !== 'ride' && state !== 'arrive') return;
  paused = !paused;
  if (paused) {
    ui.showPause();
    audio.setEngine(0);
  } else {
    ui.hidePause();
  }
}

function quitToTitle() {
  paused = false;
  ui.hidePause();
  ui.hideHUD();
  ui.hideHaggle();
  ui.hideCard();
  player.reset();
  player.setPax(null);
  standee.visible = false;
  traffic.reset();
  audio.stopVoice();
  audio.playMusic();
  state = 'menu';
  ui.showStart();
}

function doHorn() {
  if (state !== 'ride' || hornCD > 0 || paused) return;
  hornCD = 0.25;
  stats.horns++;
  audio.horn();
  ui.hornFx(); // shockwave ring on the horn button
  shake = Math.max(shake, 0.22); // quick camera kick for punch
  const moved = traffic.honk(player.z, player.x);
  if (moved && Math.random() < 0.3) ui.toast('rasta khul gaya 😤');
}

// ---------- ui wiring ----------
// a character's start-screen select line (comedy roulette, 3 each). Retries
// because the clip may still be downloading/decoding right after page load.
function playCharSelect(character: CastChar) {
  audio.unlock(); // the tap is a user gesture — safe to start the AudioContext
  audio.loadMany(
    [0, 1, 2].flatMap((i): [string, string][] => [
      [`ganji_select${i}`, `${VOICE_BASE}ganji_select${i}.mp3`],
      [`rishta_select${i}`, `${VOICE_BASE}rishta_select${i}.mp3`],
    ]),
  );
  const lines = character === 'ganji' ? GANJI_SELECT : RISHTA_SELECT;
  const idx = pickLine(`sel_${character}`, lines.length);
  const clip = `${character === 'ganji' ? 'ganji' : 'rishta'}_select${idx}`;
  let tries = 0;
  const trySay = () => {
    if (state !== 'menu') return;
    if (audio.playVoice(clip, true)) ui.charSay(lines[idx]);
    else if (++tries < 6) setTimeout(trySay, 300);
  };
  trySay();
}

// tap a character card → they react in voice
ui.onCharPick = (character) => playCharSelect(character);

ui.onStart = (name, character) => {
  audio.unlock();
  void audio.loadAmbienceFile(`${VOICE_BASE}sfx_ambience.mp3`);
  void audio.load('truckhorn', `${VOICE_BASE}sfx_truckhorn.mp3`);
  void audio.loadMusic(`${VOICE_BASE}music_menu.mp3`);
  castPick = character;
  plateName = name || 'RIDER';
  player.setPlate(plateName);
  ui.hideStart();
  newRide();
};

ui.onCounter = () => {
  // both characters haggle in 3 escalating rounds — each press = more fare,
  // more drama, and a grumpier passenger at the start of the ride
  if (counterRound >= 3) return;
  // the rider lowballed — the passenger's face turns frustrated for the rest
  // of the haggle (reset to neutral next ride in newRide)
  standeeMat.map = standeeTexAngry[castPick];
  standeeMat.needsUpdate = true;
  fare += [40, 30, 20][counterRound];
  const line = castPick === 'ganji' ? GANJI_HAGGLE[counterRound] : RISHTA_HAGGLE[counterRound];
  audio.playVoice(`${castPick === 'ganji' ? 'ganji' : 'rishta'}_haggle${counterRound}`, true);
  counterRound++;
  ui.updateHaggle(fare, line, counterRound < 3);
  audio.ding();
};

ui.onAccept = () => {
  ui.hideHaggle();
  standee.visible = false; // he hops on — the pillion sprite takes over
  player.setPax(pax.type);
  // greed has a price: every haggle round starts them grumpier
  mood = MOOD.start - counterRound * 0.4;
  rideTime = 0;
  landmarkIdx = 0;
  resetStats();
  bp = 0;
  jamT = 0;
  riderLineCD = 3;
  noiseCD = 8;
  rantCount = 0;
  // intro plays first; the watchdog brings the first qissa right after it
  silenceT = -3;
  storyCount = 0;
  wpIdx = 0;
  rs = 0.3;
  askIdx = 0;
  rStoryCount = 0;
  nextIsAsk = true;
  pakkaCount = 0;
  pendingReact = null;
  overtakers = new WeakSet();
  ui.setBP(castPick === 'ganji' ? 0 : 0.3, castPick === 'ganji' ? 'BP' : '💍');
  ui.showHUD();
  ui.showSteerCoach(); // every ride, mobile only — "tap left/right to steer"
  ui.setFare(fare);
  ui.setStars(mood);
  ui.setProgress(0);
  // ride starts NOW — set before the voice block: tryGo()'s state guard runs
  // synchronously and must already see 'ride' (this being last broke the intro)
  state = 'ride';
  // Saddar is busy the instant the run begins — front-load the jam instead of
  // letting it trickle in over the first few seconds (player starts at z=0)
  traffic.targets = player.z < 1000 ? saddarT : cliftonT;
  traffic.prefill(player.z);
  // the deal is done — passenger reacts in their own voice
  if (castPick === 'ganji') {
    // episode intro — retry until the clip has decoded so the ride never opens
    // silent; the FIT CHECK is queued right behind it, every ride
    const goIdx = (Math.random() * GANJI_VOICE_COUNTS.go) | 0;
    ui.bubble(GANJI_AVATAR, GANJI_LINES.go[goIdx].text, 7000);
    let goTries = 0;
    const tryGo = () => {
      if (state !== 'ride') return;
      if (audio.playVoice(`ganji_go${goIdx}`, true)) {
        // fit check is a FIXED beat — scheduled off the intro's real length;
        // queued (not forced) so it never talks over anyone, but always plays
        const wait = (audio.clipDuration(`ganji_go${goIdx}`) + 0.2) * 1000;
        setTimeout(() => {
          if (state !== 'ride') return;
          audio.queueVoice(
            'ganji_fitcheck',
            () => ui.bubble(GANJI_AVATAR, GANJI_FITCHECK, 3400),
            false,
          );
        }, wait);
      } else if (++goTries < 8) {
        setTimeout(tryGo, 450);
      }
    };
    tryGo();
  } else {
    // aunty's interview opener — same decode-retry pattern as ganji's intro
    const rGoIdx = (Math.random() * RISHTA_COUNTS.go) | 0;
    ui.bubble(RISHTA_AVATAR, RISHTA_LINES.go[rGoIdx], 6000);
    let rTries = 0;
    const tryRishtaGo = () => {
      if (state !== 'ride') return;
      if (!audio.playVoice(`rishta_go${rGoIdx}`, true) && ++rTries < 8)
        setTimeout(tryRishtaGo, 450);
    };
    tryRishtaGo();
  }
  audio.stopMusic();
  audio.ding();
};

ui.onAgain = () => newRide();
ui.onChangeChar = () => {
  quitToTitle();
  ui.resetCharPick();
}; // home screen, fresh "pick a character" state
let truckHornCD = 0; // the pressure horn was drowning everything — keep it rare
traffic.onBusStop = (z) => {
  if (state === 'ride' && Math.abs(z - player.z) < 45) {
    if (truckHornCD <= 0 && !audio.voiceBusy()) {
      audio.playClip('truckhorn', 0.26);
      truckHornCD = 9;
    }
    bumpBP(0.04); // the shor gets to him
    if (
      castPick === 'ganji' &&
      noiseCD <= 0 &&
      riderLineCD <= 0 &&
      Math.random() < 0.55 &&
      sayGanji(Math.random() < 0.5 ? 'bus' : 'noise')
    ) {
      noiseCD = 10;
      riderLineCD = 3;
    }
  }
};
ui.onPause = () => togglePause();
ui.onResume = () => togglePause();
ui.onQuit = () => quitToTitle();

ui.onHorn = () => doHorn();
ui.onBoost = (down) => {
  buttonBoost = down;
  if (down) ui.raceFx(); // boost-press shockwave (speed lines follow in the loop)
};
ui.onMute = () => {
  audio.setMuted(!audio.muted);
  return audio.muted;
};

ui.onShare = () => {
  const n = Math.max(1, Math.round(stats.stars));
  const starsTxt = '★'.repeat(n) + '☆'.repeat(5 - n);
  const text =
    `BYKEA KI SAWARI 🏍️ ${CAST[castPick].name} ko Teen Talwar pohnchaya — Rs ${stats.payout} kamaye\n` +
    `${starsTxt} | ${stats.bumps} takkrein | ${stats.horns} horns | ${stats.kata} kata ⚡` +
    (rantCount > 0 ? ` | ${rantCount} Traffic Tale 🎥` : '') +
    (pakkaCount > 0 ? ` | ${pakkaCount} rishta pakka 💍` : '') +
    `\n\nKhud chala ke dekho: ${location.href}`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
};

// ---------- gameplay systems ----------
function handleCollisions() {
  if (player.crashT > 0) return;
  for (const v of traffic.vehicles) {
    const dz = Math.abs(v.z - player.z);
    const dx = Math.abs(v.x - player.x);
    if (dz < v.halfLen + 1.3 && dx < v.halfWid + 0.75) {
      player.crash();
      audio.crash();
      stats.bumps++;
      mood = clamp(mood + MOOD.crash * pax.moodSens, 1, 5);
      shake = 0.8;
      ui.toast('TAKKAR! 💥', 'bad');
      bumpBP(0.16);
      bumpRS(-0.22); // a takkar tanks the rishta file
      if (castPick === 'ganji') sayGanji('crash');
      else sayRishta('crash');
      return;
    }
  }
}

function handleKata() {
  for (const v of traffic.vehicles) {
    if (v.passed) continue;
    if (v.z < player.z - (v.halfLen + 1.2)) {
      v.passed = true;
      if (player.crashT > 0) continue;
      const dx = Math.abs(v.x - player.x);
      const clear = v.halfWid + 0.8;
      const fastEnough = v.dir === -1 || player.speed > v.speed + 3;
      if (dx >= clear && dx < clear + 2.2 && fastEnough) {
        stats.kata++;
        bumpRS(0.05); // skillful — she notes it in the file
        audio.kata();
        ui.toast(`CUT MAARA! +Rs ${KATA_RUPEES} ⚡`, 'bonus');
        ui.setFare(fare + stats.kata * KATA_RUPEES + rantCount * RANT_RUPEES);
      }
    }
  }
}

function handlePotholes() {
  for (let i = 0; i < world.potholes.length; i++) {
    if (potholesHit.has(i)) continue;
    const p = world.potholes[i];
    if (Math.abs(p.z - player.z) < 1.5 && Math.abs(p.x - player.x) < p.r + 0.55) {
      potholesHit.add(i);
      stats.potholes++;
      mood = clamp(mood + MOOD.pothole * pax.moodSens, 1, 5);
      player.pothole();
      audio.pothole();
      ui.toast('GADDHA! 🕳️', 'bad');
      bumpBP(0.07);
      bumpRS(-0.08);
      if (Math.random() < 0.45) {
        if (castPick === 'ganji') sayGanji('pothole');
        else sayRishta('pothole');
      }
    }
  }
}

// ---------- Ganji Swag's rage ----------
function updateRage(dt: number, boosting: boolean) {
  riderLineCD = Math.max(0, riderLineCD - dt);
  noiseCD = Math.max(0, noiseCD - dt);

  // jams boil the BP; open road cools it
  const jammed = player.speed < 9 && player.crashT <= 0;
  jamT = jammed ? jamT + dt : Math.max(0, jamT - dt * 2);
  bp = clamp(bp + (jammed ? 0.05 : boosting ? -0.045 : -0.015) * dt, 0, 1);
  if (jamT > 2.2 && riderLineCD <= 0 && sayGanji('jam')) {
    riderLineCD = 4 + Math.random() * 2;
    jamT = 0;
  }

  // chatter watchdog. After a line ends: a remembered (blocked) reaction fires
  // first — only if none arrives within ~2s of quiet (≈1.5s of empty bubble once
  // the synced story bubble clears) does the next qissa start.
  if (audio.voiceBusy()) {
    silenceT = 0;
  } else {
    silenceT += dt;
  }
  if (silenceT > 0.4 && pendingReact?.who === 'ganji') {
    const p = pendingReact;
    pendingReact = null;
    if (rideTime - p.at < 5 && sayGanji(p.cat as GanjiCat)) {
      riderLineCD = Math.max(riderLineCD, 2.5);
    }
    // too old → dropped: a stale reaction is weirder than a short silence
  }
  // stories only START on open road — in a jam the mic belongs to reactions
  if (
    silenceT > 2 &&
    !pendingReact &&
    player.crashT <= 0 &&
    player.speed > 16 &&
    storyCount < 3 &&
    sayGanji('story', 9000)
  ) {
    storyCount++;
  }

  // overtakers get corrected — bare heads and one-way heroes especially
  for (const v of traffic.vehicles) {
    if (overtakers.has(v)) continue;
    const dz = v.z - player.z;
    if (
      v.dir === 1 &&
      v.speed > player.speed + 2 &&
      dz > 1.5 &&
      dz < 5 &&
      Math.abs(v.x - player.x) < 2.4
    ) {
      overtakers.add(v);
      bumpBP(0.1);
      // bikes are the worst lane-switchers — split between the helmet jab and a
      // lane-cutting jab so both reaction sets get heard; bigger vehicles cut off
      const cat = v.kind === 'bike' && Math.random() < 0.5 ? 'nohelmet' : 'cutoff';
      if (riderLineCD <= 0 && sayGanji(cat)) {
        riderLineCD = 2.5 + Math.random() * 2;
      }
    } else if (v.wrongSide && dz > 0 && dz < 30 && Math.abs(v.x - player.x) < 4.5) {
      // react while they're still approaching — and clock the whole juloos at once
      overtakers.add(v);
      bumpBP(0.12);
      if (riderLineCD <= 0) {
        const pack = traffic.vehicles.filter(
          (w) =>
            w.wrongSide &&
            Math.abs(w.x - player.x) < 5 &&
            w.z - player.z > -5 &&
            w.z - player.z < 45,
        ).length;
        if (sayGanji('wrongway', 2600, false, pack >= 2 ? 0 : undefined)) {
          riderLineCD = 2.5 + Math.random() * 2;
        }
      }
    }
  }

  // BP maxed: he records a Traffic Tale — rage becomes content. The rant
  // WAITS for the current line to finish (bp stays maxed until it lands).
  if (bp >= 1 && sayGanji('rant', 3600)) {
    rantCount++;
    ui.toast(`🎥 Traffic Tale viral! +Rs ${RANT_RUPEES}`);
    ui.setFare(fare + stats.kata * KATA_RUPEES + rantCount * RANT_RUPEES);
    shake = Math.max(shake, 0.45);
    riderLineCD = 5;
    bp = 0.12;
  }

  ui.setBP(bp);
}

// ---------- Rishta Aunty's interview ----------
function updateRishta(dt: number, boosting: boolean) {
  riderLineCD = Math.max(0, riderLineCD - dt);

  // steady confident driving impresses her; speeding does NOT
  rs = clamp(rs + (player.speed > 15 ? 0.028 : 0.005) * dt - (boosting ? 0.02 * dt : 0), 0, 1);

  const jammed = player.speed < 9 && player.crashT <= 0;
  jamT = jammed ? jamT + dt : Math.max(0, jamT - dt * 2);
  if (jamT > 2.6 && riderLineCD <= 0 && sayRishta('jam')) {
    riderLineCD = 5 + Math.random() * 3;
    jamT = 0;
  }

  // stunt-boys and wrong-way heroes — all "laundas" to her
  for (const v of traffic.vehicles) {
    if (overtakers.has(v)) continue;
    const dz = v.z - player.z;
    const overtaking =
      v.dir === 1 &&
      v.speed > player.speed + 2 &&
      dz > 1.5 &&
      dz < 5 &&
      Math.abs(v.x - player.x) < 2.4;
    const wrongway = v.wrongSide && dz > 0 && dz < 30 && Math.abs(v.x - player.x) < 4.5;
    if (overtaking || wrongway) {
      overtakers.add(v);
      if (riderLineCD <= 0 && sayRishta('launde')) {
        riderLineCD = 3 + Math.random() * 2;
      }
    }
  }

  // the interview watchdog — a remembered (blocked) reaction fires first;
  // biodata questions IN ORDER and qisse only fill genuinely quiet gaps
  if (audio.voiceBusy()) {
    silenceT = 0;
  } else {
    silenceT += dt;
  }
  if (silenceT > 0.4 && pendingReact?.who === 'aunty') {
    const p = pendingReact;
    pendingReact = null;
    if (rideTime - p.at < 5 && sayRishta(p.cat as RishtaCat)) {
      riderLineCD = Math.max(riderLineCD, 2.5);
    }
  }
  if (silenceT > 2 && !pendingReact && player.crashT <= 0) {
    let spoke = false;
    if ((nextIsAsk || rStoryCount >= 3) && askIdx < RISHTA_COUNTS.ask) {
      spoke = sayRishta('ask', 3600, false, askIdx);
      if (spoke) {
        askIdx++;
        nextIsAsk = false;
      }
    } else if (rStoryCount < 3 && player.speed > 16) {
      spoke = sayRishta('story', 8000);
      if (spoke) {
        rStoryCount++;
        nextIsAsk = true;
      }
    } else if (askIdx < RISHTA_COUNTS.ask) {
      spoke = sayRishta('ask', 3600, false, askIdx);
      if (spoke) askIdx++;
    }
    if (spoke) silenceT = -2;
  }

  // approval maxed → RISHTA PAKKA (waits politely for the channel, like the rant)
  if (rs >= 1 && sayRishta('pakka', 3600)) {
    pakkaCount++;
    ui.toast(`💍 Rishta pakka! +Rs ${RISHTA_RUPEES} shagun`);
    ui.setFare(fare + stats.kata * KATA_RUPEES + pakkaCount * RISHTA_RUPEES);
    riderLineCD = 5;
    rs = 0.3;
  }

  ui.setBP(rs, '💍');
}

function finishRide() {
  stats.timeSec = rideTime;
  stats.stars = mood;
  const tip = mood >= 4.5 ? 0.25 : mood >= 3.5 ? 0.12 : 0;
  const examBonus = pax.type === 'student' && rideTime < 55 ? 60 : 0;
  stats.payout =
    Math.round(
      (fare * (1 + tip) +
        stats.kata * KATA_RUPEES +
        examBonus +
        rantCount * RANT_RUPEES +
        pakkaCount * RISHTA_RUPEES) /
        5,
    ) * 5;
  audio.cash();
  audio.playMusic();
  ui.hideHUD();
  // review = a per-tier line (0 best → 3 worst), now with random variants so
  // replays of the same star tier don't repeat the same line/clip.
  const tier = mood >= 4.5 ? 0 : mood >= 3.5 ? 1 : mood >= 2.5 ? 2 : 3;
  const who = castPick === 'ganji' ? 'ganji' : 'rishta';
  // tolerate either shape: string[][] (tier → variants) or a legacy flat
  // string[] (one line per tier). Guards against a half-applied refactor ever
  // char-indexing a string into the review box again.
  const raw = (castPick === 'ganji' ? GANJI_REVIEWS : RISHTA_REVIEWS)[tier] as string | string[];
  const opts = Array.isArray(raw) ? raw : [raw];
  const j = opts.length > 1 ? pickLine(`${who}_rev${tier}`, opts.length) : 0;
  const reviewId = j === 0 ? `${who}_review${tier}` : `${who}_review${tier}_${j}`;
  ui.showCard(stats, `"${opts[j]}"`, makeRoast(stats), plateName);
  state = 'card';
  // spoken a beat after the cash ka-ching lands
  setTimeout(() => {
    if (state === 'card') audio.playVoice(reviewId, true);
  }, 800);
}

// ---------- camera ----------
function updateCamera(dt: number, t: number) {
  // portrait phones: pull the chase cam in so the rider fills the frame
  const portrait = camera.aspect < 0.8;
  if (state === 'haggle') {
    // negotiation two-shot: low over-the-shoulder past the captain's back,
    // the standee passenger facing us arguing the fare
    const sway = Math.sin(t * 0.5) * 0.3;
    // x-0.8, not further left: the centre median's palms/railings sit at x≈0
    // and smear across the lens if the camera backs into them
    const target = new THREE.Vector3(player.x - 0.8 + sway, 1.9, player.z - (portrait ? 5.6 : 4.2));
    camera.position.lerp(target, 1 - Math.exp(-3 * dt));
    camera.lookAt(player.x + 0.2, portrait ? 1.2 : 1.3, player.z + 0.9);
    camera.fov = lerp(camera.fov, portrait ? 60 : 47, 1 - Math.exp(-3 * dt));
  } else if (state === 'menu' || state === 'card') {
    // slow idle drift near the player / market
    const cx = Math.sin(t * 0.25) * 5;
    camera.position.lerp(
      new THREE.Vector3(player.x + cx, portrait ? 4.9 : 5.6, player.z - (portrait ? 10 : 13)),
      1 - Math.exp(-2 * dt),
    );
    camera.lookAt(player.x, 2.4, player.z + 24);
    camera.fov = lerp(camera.fov, 62, 1 - Math.exp(-3 * dt));
  } else {
    const boost = readInput().boost && state === 'ride';
    // portrait: track x dead-center (narrow hFOV pushes lane offsets off-screen)
    const desired = new THREE.Vector3(
      player.x * (portrait ? 0.95 : 0.82),
      portrait ? 4.6 : 5.3,
      player.z - (portrait ? 7.3 : 9.4),
    );
    camera.position.lerp(desired, 1 - Math.exp(-9 * dt));
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 1.4);
      const s = shake * shake * 0.5;
      camera.position.x += rand(-s, s);
      camera.position.y += rand(-s, s);
    }
    camera.lookAt(player.x * (portrait ? 1 : 0.92), portrait ? 1.7 : 2.5, player.z + 14);
    camera.fov = lerp(camera.fov, boost ? 71 : 62, 1 - Math.exp(-4 * dt));
  }
  camera.updateProjectionMatrix();
}

// ---------- main loop ----------
let lastT = performance.now();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (paused) {
    ui.setSpeedFx(false);
    renderer.render(scene, camera);
    return;
  }
  // feed the adaptive-quality controller (only while actually riding + visible)
  quality.sample(now, state === 'ride' && !document.hidden);
  elapsed += dt;
  hornCD = Math.max(0, hornCD - dt);
  truckHornCD = Math.max(0, truckHornCD - dt);

  if (state === 'ride') {
    rideTime += dt;
    const input = readInput();
    player.update(dt, input);
    // Clifton stretch is dual-carriageway: the median keeps you off the oncoming side
    if (player.z > 1145 && player.z < 1372 && player.x < -4.4) {
      player.x = -4.4;
      player.group.position.x = -4.4;
    }
    // Saddar's wide footpaths squeeze the drivable road
    if (player.z < 1000 && Math.abs(player.x) > 10.2) {
      player.x = Math.sign(player.x) * 10.2;
      player.group.position.x = player.x;
    }
    // bazaar jam vs Clifton calm — Saddar is bumper-to-bumper
    traffic.targets = player.z < 1000 ? saddarT : cliftonT;
    traffic.update(dt, player.z);
    handleCollisions();
    handleKata();
    handlePotholes();
    if (castPick === 'ganji') updateRage(dt, input.boost);
    else updateRishta(dt, input.boost);

    mood = clamp(mood + MOOD.regenPerSec * dt, 1, 5);
    ui.setStars(mood);
    ui.setProgress(player.z / ROUTE.finish);
    if (landmarkIdx < LANDMARKS.length && player.z >= LANDMARKS[landmarkIdx].z) {
      ui.landmark(LANDMARKS[landmarkIdx].name, LANDMARKS[landmarkIdx].sub);
      audio.ding();
      landmarkIdx++;
    }
    // fixed route beats — queued so they wait politely, but they ALWAYS play
    if (castPick === 'ganji' && wpIdx < GANJI_FIXED.length && player.z >= GANJI_FIXED[wpIdx].z) {
      const wp = GANJI_FIXED[wpIdx];
      const wpClip = `ganji_wp${wpIdx}`;
      wpIdx++;
      audio.queueVoice(wpClip, () => ui.bubble(GANJI_AVATAR, wp.text, 4200));
    }
    audio.setEngine(clamp(player.speed / SPEED.boost, 0, 1));
    ui.setSpeedFx(input.boost && player.speed > SPEED.base + 6); // warp lines while racing fast

    boostLineCD -= dt;
    if (input.boost && player.speed > SPEED.base + 10 && boostLineCD <= 0) {
      const spoke = castPick === 'ganji' ? sayGanji('boost') : sayRishta('boost');
      boostLineCD = spoke ? 9 : 2;
    }

    if (player.z >= ROUTE.finish) {
      state = 'arrive';
      arriveT = 0;
      if (castPick === 'ganji') sayGanji('arrive', 3200, true);
      else sayRishta('arrive', 3200, true);
      ui.setProgress(1);
    }
  } else if (state === 'arrive') {
    arriveT += dt;
    player.update(dt, { steer: 0, boost: false, brake: true });
    traffic.update(dt, player.z);
    audio.setEngine(clamp(player.speed / SPEED.boost, 0, 1));
    ui.setSpeedFx(false);
    if (arriveT > 1.9) finishRide();
  } else {
    audio.setEngine(0);
    ui.setSpeedFx(false);
  }

  // the negotiation shot is low & close — keep passing traffic out of the frame
  // bubble so a bus doesn't drive through the haggle. Only in haggle: every other
  // state leaves vehicles at their default (visible), so no per-frame sweep of
  // the ~100-strong jam is needed during the ride.
  if (state === 'haggle') {
    for (const v of traffic.vehicles) {
      v.group.visible = v.z < player.z - 9 || v.z > player.z + 9;
    }
  }

  world.update(player.z, dt);
  updateCamera(dt, elapsed);
  renderer.render(scene, camera);
}

animate();

// dev-only helpers for testing (window.__sawari.jump(2300) etc.)
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__sawari = {
    jump: (z: number) => {
      player.z = z;
      camera.position.set(player.x * 0.82, 6.1, z - 11.5);
      camera.lookAt(player.x * 0.92, 2.4, z + 17);
    },
    info: () => ({ ...renderer.info.render, programs: renderer.info.programs?.length }),
    scene,
    camera,
    THREE,
    traffic,
    audio,
    rage: () => {
      bp = 0.97; // next jam tick triggers the rant
    },
    sayGanji,
    sayRishta,
    pakka: () => {
      rs = 0.97; // next good second triggers the rishta
    },
    demoCard: () => {
      stats.horns = 23;
      stats.bumps = 2;
      stats.potholes = 3;
      stats.kata = 11;
      rideTime = 78;
      mood = 3.8;
      finishRide();
    },
    fps: () => {
      let frames = 0;
      const t0 = performance.now();
      const count = () => {
        frames++;
        if (performance.now() - t0 < 1000) requestAnimationFrame(count);
        else console.log(`FPS: ${frames}`);
      };
      requestAnimationFrame(count);
    },
  };
}
