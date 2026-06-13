// Adaptive quality — modelled on how professional engines and web-3D apps handle
// this (console "dynamic resolution scaling" + drei's <PerformanceMonitor>):
//
//   1. START AT FULL QUALITY. High is the target. We never pre-judge a device
//      into a degraded look — only MEASURED slowness pulls quality down.
//   2. RESOLUTION IS THE FIRST LEVER. A slightly softer image is far less jarring
//      than a half-empty city, so a single continuous `factor` scales the render
//      resolution across most of its range before anything else is touched.
//   3. OBJECT DENSITY IS THE LAST LEVER. Traffic/crowd counts only thin in the
//      bottom of the range — on genuinely weak hardware — and never below a
//      "still looks busy" floor, so it never goes trashy/empty.
//   4. HYSTERESIS. A deadband between the up/down FPS bounds, scale-DOWN-fast /
//      scale-UP-slow, and a flip-flop cap so it settles instead of pumping.
//
// `factor` ∈ [0,1]: 1 = full quality, 0 = the safe floor. main.ts feeds frame
// timing each ride frame; we re-evaluate once per ~second and fire onChange.

export interface QualitySettings {
  /** multiplies the (capped) device pixel ratio — the primary, least-visible lever */
  resScale: number;
  /** multiplies NPC traffic + animated-crowd counts — last resort, has a busy floor */
  densityScale: number;
}

// --- the quality curve: map factor → concrete settings ---
const RES_FLOOR = 0.62; // never render softer than 0.62× the capped DPR
const DENSITY_FLOOR = 0.6; // never thinner than 60% traffic/crowd (still feels busy)
const DENSITY_KNEE = 0.35; // density only starts thinning once factor drops below this

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function settingsForFactor(f: number): QualitySettings {
  // resolution rides the TOP of the range (factor 1 → DENSITY_KNEE): full → floor
  const resT = clamp01((f - DENSITY_KNEE) / (1 - DENSITY_KNEE));
  // density only moves in the BOTTOM of the range (factor DENSITY_KNEE → 0)
  const densT = clamp01(f / DENSITY_KNEE);
  return {
    resScale: RES_FLOOR + (1 - RES_FLOOR) * resT,
    densityScale: DENSITY_FLOOR + (1 - DENSITY_FLOOR) * densT,
  };
}

// --- adaptive controller tuning (targets a 60fps budget with headroom) ---
const WINDOW_MS = 1000; // re-evaluate at most once per second
const FPS_LOWER = 50; // sustained below this → degrade
const FPS_UPPER = 57; // sustained above this (and not full) → recover
const STEP_DOWN = 0.16; // scale down fast (DRS: don't risk dropped frames)
const STEP_UP = 0.07; // scale up slowly (only reclaim quality cautiously)
const UP_WINDOWS = 3; // need this many good windows in a row before a single step up
const MAX_FLIPS = 6; // after this many direction changes, stop recovering (settle)

function startFactor(): { factor: number; antialias: boolean; locked: boolean } {
  // explicit override for testing / support: ?q=low|mid|high (pins it, no adapting)
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'mid' || q === 'high') {
    return {
      factor: q === 'low' ? 0.25 : q === 'mid' ? 0.6 : 1,
      antialias: q !== 'low',
      locked: true,
    };
  }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  // Only a CLEAR weak signal lowers the starting point (so a known-weak Android
  // doesn't have to stutter for a second before adapting). deviceMemory is
  // Chrome/Android-only — undefined on iOS Safari, where we always start full
  // because every iPhone/iPad runs this comfortably.
  if (mem !== undefined && mem <= 2) return { factor: 0.5, antialias: false, locked: false };
  if (mem !== undefined && mem <= 4) return { factor: 0.85, antialias: true, locked: false };
  return { factor: 1, antialias: true, locked: false };
}

export class Quality {
  current: QualitySettings;
  /** MSAA — fixed at renderer construction, so it's decided once up front */
  readonly antialias: boolean;
  /** fired when the live settings change (renderer + traffic + crowd re-read them) */
  onChange: ((s: QualitySettings) => void) | null = null;

  private factor: number;
  private locked: boolean;
  // rolling-window + hysteresis state
  private winStart = 0;
  private frames = 0;
  private upStreak = 0;
  private flips = 0;
  private lastDir = 0;

  constructor() {
    const s = startFactor();
    this.factor = s.factor;
    this.antialias = s.antialias;
    this.locked = s.locked;
    this.current = settingsForFactor(this.factor);
  }

  /** rough label for diagnostics / logging */
  get tier(): 'low' | 'mid' | 'high' {
    return this.factor >= 0.85 ? 'high' : this.factor >= 0.4 ? 'mid' : 'low';
  }

  /**
   * Feed one frame. `active` must be true only during real gameplay (ride, tab
   * visible) so menus and throttled background tabs never skew the measurement.
   * Adapts at most once per window.
   */
  sample(now: number, active: boolean) {
    if (this.locked || !active) {
      this.winStart = now;
      this.frames = 0;
      return;
    }
    if (this.winStart === 0) this.winStart = now;
    this.frames++;
    const elapsed = now - this.winStart;
    if (elapsed < WINDOW_MS) return;
    const fps = (this.frames * 1000) / elapsed;
    this.winStart = now;
    this.frames = 0;
    this.evaluate(fps);
  }

  private evaluate(fps: number) {
    if (fps < FPS_LOWER && this.factor > 0) {
      this.upStreak = 0;
      this.adjust(-STEP_DOWN, -1);
    } else if (fps > FPS_UPPER && this.factor < 1) {
      // recover only after SUSTAINED headroom, and stop once we've flip-flopped
      // too much (the device has found its ceiling — don't pump the resolution)
      if (this.flips >= MAX_FLIPS) return;
      if (++this.upStreak >= UP_WINDOWS) {
        this.upStreak = 0;
        this.adjust(STEP_UP, 1);
      }
    } else {
      this.upStreak = 0; // inside the deadband — hold steady
    }
  }

  private adjust(delta: number, dir: number) {
    const next = clamp01(this.factor + delta);
    if (next === this.factor) return;
    this.factor = next;
    if (this.lastDir !== 0 && dir !== this.lastDir) this.flips++;
    this.lastDir = dir;
    this.current = settingsForFactor(this.factor);
    this.onChange?.(this.current);
  }
}

export const quality = new Quality();
