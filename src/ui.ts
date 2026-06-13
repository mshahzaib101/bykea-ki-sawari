import type { Pax, RunStats } from './passengers';
import type { CastChar } from './config';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export class UI {
  onStart: (name: string, character: CastChar) => void = () => {};
  onCharPick: (character: CastChar) => void = () => {};
  onAccept: () => void = () => {};
  onCounter: () => void = () => {};
  onShare: () => void = () => {};
  onAgain: () => void = () => {};
  onChangeChar: () => void = () => {};
  onHorn: () => void = () => {};
  onBoost: (down: boolean) => void = () => {};
  onMute: () => boolean = () => false; // returns new muted state
  onPause: () => void = () => {};
  onResume: () => void = () => {};
  onQuit: () => void = () => {};

  private bubbleTimer: number | null = null;
  private landmarkTimer: number | null = null;
  private character: CastChar | null = null; // nothing pre-selected — player must pick

  private screenStart = el<HTMLDivElement>('screen-start');
  private screenHaggle = el<HTMLDivElement>('screen-haggle');
  private screenCard = el<HTMLDivElement>('screen-card');
  private hud = el<HTMLDivElement>('hud');
  private nameInput = el<HTMLInputElement>('player-name');
  private counterBtn = el<HTMLButtonElement>('btn-counter');
  private muteBtn = el<HTMLButtonElement>('btn-mute');

  constructor() {
    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('.char-card'));
    const charRow = document.querySelector<HTMLElement>('.char-row');
    const startBtn = el<HTMLButtonElement>('btn-start');
    const pickHint = el<HTMLParagraphElement>('pick-hint');
    for (const card of cards) {
      card.addEventListener('click', () => {
        this.character = card.dataset.char as CastChar;
        for (const c of cards) c.classList.toggle('selected', c === card);
        startBtn.classList.remove('locked'); // a pick unlocks Start
        pickHint.classList.add('hidden');
        this.onCharPick(this.character);
      });
    }
    startBtn.addEventListener('click', () => {
      if (!this.character) {
        // no pick yet — nudge them to the cards instead of starting
        pickHint.classList.remove('hidden');
        this.nudge(pickHint);
        if (charRow) this.nudge(charRow);
        return;
      }
      this.onStart(this.nameInput.value.trim(), this.character);
    });
    el('btn-accept').addEventListener('click', () => this.onAccept());
    this.counterBtn.addEventListener('click', () => this.onCounter());
    el('btn-share').addEventListener('click', () => this.onShare());
    el('btn-again').addEventListener('click', () => this.onAgain());
    el('btn-change-char').addEventListener('click', () => this.onChangeChar());
    this.muteBtn.addEventListener('click', () => {
      const muted = this.onMute();
      this.muteBtn.textContent = muted ? '🔇' : '🔊';
    });

    el('btn-pause').addEventListener('click', () => this.onPause());
    el('btn-resume').addEventListener('click', () => this.onResume());
    el('btn-quit').addEventListener('click', () => this.onQuit());

    const hornBtn = el('btn-horn');
    hornBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onHorn();
    });
    const boostBtn = el('btn-boost');
    boostBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onBoost(true);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      boostBtn.addEventListener(ev, () => this.onBoost(false));
    }
  }

  /** replay the shake animation on an element (re-trigger by forcing reflow) */
  private nudge(elm: HTMLElement) {
    elm.classList.remove('shake');
    void elm.offsetWidth;
    elm.classList.add('shake');
  }

  private charSayTimer: number | null = null;

  /** speech bubble under the character cards on the start screen */
  charSay(text: string) {
    const b = el('char-say');
    b.textContent = `"${text}"`;
    b.classList.remove('hidden');
    if (this.charSayTimer !== null) clearTimeout(this.charSayTimer);
    this.charSayTimer = window.setTimeout(() => b.classList.add('hidden'), 4000);
  }

  hideStart() {
    this.screenStart.classList.add('hidden');
    this.muteBtn.classList.add('show');
    el('char-say').classList.add('hidden');
  }

  showStart() {
    this.screenStart.classList.remove('hidden');
  }

  /** clear the pick — return the home screen to its "choose a character" state */
  resetCharPick() {
    this.character = null;
    for (const c of document.querySelectorAll<HTMLElement>('.char-card'))
      c.classList.remove('selected');
    el('btn-start').classList.add('locked');
    el('pick-hint').classList.remove('hidden');
  }

  showPause() {
    el('screen-pause').classList.remove('hidden');
  }

  hidePause() {
    el('screen-pause').classList.add('hidden');
  }

  showHaggle(pax: Pax, fare: number) {
    el('haggle-avatar').textContent = pax.avatar;
    el('haggle-name').textContent = pax.name;
    el('haggle-line').textContent = pax.greet;
    el('haggle-fare').textContent = `Rs ${fare}`;
    this.counterBtn.disabled = false;
    this.counterBtn.style.opacity = '1';
    this.screenHaggle.classList.remove('hidden');
  }

  /** more=true keeps the counter button alive for another haggle round */
  updateHaggle(fare: number, line: string, more = false) {
    el('haggle-fare').textContent = `Rs ${fare}`;
    el('haggle-line').textContent = `"${line}"`;
    this.counterBtn.disabled = !more;
    this.counterBtn.style.opacity = more ? '1' : '0.45';
  }

  hideHaggle() {
    this.screenHaggle.classList.add('hidden');
  }

  showHUD() {
    this.hud.classList.remove('hidden');
  }

  hideHUD() {
    this.hud.classList.add('hidden');
    this.setSpeedFx(false);
  }

  private speedFxOn = false;
  /** boost speed-line warp overlay on/off (guarded so it's cheap per-frame) */
  setSpeedFx(on: boolean) {
    if (on === this.speedFxOn) return;
    this.speedFxOn = on;
    el('speed-fx').classList.toggle('on', on);
  }

  /** punch the press shockwave ring on a control button (re-triggerable) */
  private pressFx(id: string) {
    const b = el(id);
    b.classList.remove('fx');
    void b.offsetWidth; // reflow so the animation restarts on rapid taps
    b.classList.add('fx');
  }
  hornFx() {
    this.pressFx('btn-horn');
  }
  raceFx() {
    this.pressFx('btn-boost');
  }

  private steerCoachTimer: number | null = null;
  /** mobile steering tip — shown at the start of every ride on touch devices */
  showSteerCoach() {
    const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    if (!touch) return; // desktop steers with arrow keys — tip doesn't apply
    el('steer-coach').classList.remove('hidden', 'coach-out');
    if (this.steerCoachTimer !== null) clearTimeout(this.steerCoachTimer);
    this.steerCoachTimer = window.setTimeout(() => this.hideSteerCoach(), 1575); // auto-dismiss (halved)
  }
  /** dismiss the steering tip (first steer tap or timeout); fades out */
  hideSteerCoach() {
    const c = el('steer-coach');
    if (c.classList.contains('hidden') || c.classList.contains('coach-out')) return;
    if (this.steerCoachTimer !== null) {
      clearTimeout(this.steerCoachTimer);
      this.steerCoachTimer = null;
    }
    c.classList.add('coach-out');
    window.setTimeout(() => c.classList.add('hidden'), 350);
  }

  setFare(rs: number) {
    el('hud-fare').textContent = String(rs);
  }

  /** character meter — Ganji's BP or Aunty's 💍 rishta score; null hides it */
  setBP(v: number | null, label = 'BP') {
    const pill = el('bp-pill');
    if (v === null) {
      pill.classList.add('hidden');
      return;
    }
    const lbl = pill.querySelector('.bp-label');
    if (lbl) lbl.textContent = label;
    pill.classList.remove('hidden');
    el('bp-fill').style.width = `${Math.min(100, Math.max(0, v * 100))}%`;
    pill.classList.toggle('boiling', v > 0.8);
  }

  setStars(mood: number) {
    const n = Math.max(1, Math.round(mood));
    el('hud-stars').textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  setProgress(p: number) {
    const pct = Math.min(100, Math.max(0, p * 100));
    el('route-fill').style.width = `${pct}%`;
    el('route-bike').style.left = `${pct}%`;
  }

  bubble(avatar: string, text: string, ms = 2600) {
    const b = el('bubble');
    el('bubble-avatar').textContent = avatar;
    el('bubble-text').textContent = text;
    b.classList.remove('hidden');
    if (this.bubbleTimer !== null) clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => b.classList.add('hidden'), ms);
  }

  /** ride-app style location card — slides in, holds ~2s, slides away */
  landmark(name: string, sub: string) {
    const card = el('landmark');
    el('landmark-name').textContent = name;
    el('landmark-sub').textContent = sub;
    card.classList.remove('hidden', 'show');
    void card.offsetWidth; // restart the CSS animation
    card.classList.add('show');
    if (this.landmarkTimer !== null) clearTimeout(this.landmarkTimer);
    this.landmarkTimer = window.setTimeout(() => card.classList.add('hidden'), 2650);
  }

  toast(text: string, kind: 'normal' | 'bad' | 'bonus' = 'normal') {
    const t = document.createElement('div');
    t.className = kind === 'normal' ? 'toast' : `toast ${kind}`;
    t.textContent = text;
    const box = el('toasts');
    box.appendChild(t);
    // keep at most 2 on screen — fast combos would otherwise wall off the road
    // view (esp. on mobile); drop the oldest to make room for the newest
    while (box.children.length > 2) box.removeChild(box.firstChild!);
    setTimeout(() => t.remove(), kind === 'bonus' ? 960 : 1150);
  }

  showCard(stats: RunStats, review: string, roast: string, plateName: string) {
    el('card-fare').textContent = String(stats.payout);
    const n = Math.max(1, Math.round(stats.stars));
    el('card-stars').textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    el('card-pax').textContent = stats.paxName;
    el('card-review').textContent = review;
    el('card-roast').textContent = `"${roast}"`;
    const m = Math.floor(stats.timeSec / 60);
    const s = String(Math.floor(stats.timeSec % 60)).padStart(2, '0');
    el('stat-time').textContent = `${m}:${s}`;
    el('stat-horns').textContent = String(stats.horns);
    el('stat-bumps').textContent = String(stats.bumps);
    el('stat-kata').textContent = String(stats.kata);
    el('card-plate-name').textContent = (plateName || 'RIDER').toUpperCase().slice(0, 12);

    const prevBest = Number(localStorage.getItem('sawari-best') ?? 0);
    if (stats.payout > prevBest) {
      localStorage.setItem('sawari-best', String(stats.payout));
      el('best-line').textContent =
        prevBest > 0 ? `🏆 NAYA RECORD! (pichla: Rs ${prevBest})` : '🏆 Pehli sawari mukammal!';
    } else {
      el('best-line').textContent = `🏆 Aap ka record: Rs ${prevBest}`;
    }
    this.screenCard.classList.remove('hidden');
  }

  hideCard() {
    this.screenCard.classList.add('hidden');
  }
}
