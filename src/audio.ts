// All sound is procedural WebAudio — zero assets, zero copyright, ~0 bytes.
export class SawariAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private ambTimer: number | null = null;
  private ambGain: GainNode | null = null; // procedural city rumble
  private fileAmbGain: GainNode | null = null; // street-recording loop
  private fileAmbience = false;
  private duckFactor = 1; // engine multiplier while a voice line plays
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Set<string>();
  private voiceSrc: AudioBufferSourceNode | null = null;
  private musicSrc: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicWanted = false;
  muted = false;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ??
      (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Safari/iOS hand back a SUSPENDED context even when it's created inside a
    // user gesture — without this resume the first voice/music is silent.
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this.startEngine();
    this.startAmbience();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  private startEngine() {
    const ctx = this.ctx!;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master!);
    this.engineOsc.start();
  }

  /** norm 0..1 — bike speed */
  setEngine(norm: number) {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const wobble = Math.sin(t * 31) * 3;
    this.engineOsc.frequency.setTargetAtTime(52 + norm * 95 + wobble, t, 0.06);
    this.engineGain.gain.setTargetAtTime(
      norm <= 0 ? 0 : (0.045 + norm * 0.05) * this.duckFactor,
      t,
      0.1,
    );
  }

  /** lower the bed (ambience + engine) while a voice line plays — vlog-style mix */
  private duck(on: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duckFactor = on ? 0.45 : 1;
    this.fileAmbGain?.gain.setTargetAtTime(on ? 0.12 : 0.28, t, 0.15);
    // procedural rumble is retired once the street recording is live
    this.ambGain?.gain.setTargetAtTime(this.fileAmbience ? 0 : on ? 0.02 : 0.05, t, 0.15);
    // menu/card music dips under the voice too (the spoken review)
    this.musicGain?.gain.setTargetAtTime(on ? 0.12 : 0.3, t, 0.15);
  }

  private startAmbience() {
    const ctx = this.ctx!;
    // city rumble: looped brown noise through a lowpass
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(lp).connect(g).connect(this.master!);
    src.start();
    this.ambGain = g;

    // distant horns, randomly (only until the real ambience file takes over)
    this.ambTimer = window.setInterval(() => {
      if (!this.ctx || this.muted || this.fileAmbience || Math.random() > 0.4) return;
      this.distantHorn();
    }, 2400);
  }

  // ---------- generated clips (voices / sfx / music) ----------

  async load(id: string, url: string): Promise<boolean> {
    if (!this.ctx || this.buffers.has(id) || this.loading.has(id)) return this.buffers.has(id);
    this.loading.add(id);
    try {
      const r = await fetch(url);
      if (!r.ok) return false;
      const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
      this.buffers.set(id, buf);
      return true;
    } catch {
      return false;
    } finally {
      this.loading.delete(id);
    }
  }

  loadMany(pairs: [string, string][]) {
    for (const [id, url] of pairs) void this.load(id, url);
  }

  private voiceEndT = 0;
  private voiceLow = false; // current line is low-priority chatter (story/waypoint/filler)
  private pendingVoice: { id: string; onPlay?: () => void; low: boolean } | null = null;

  /** a line is still being spoken */
  voiceBusy(): boolean {
    return !!this.ctx && this.ctx.currentTime < this.voiceEndT;
  }

  /** low-priority chatter is playing — event reactions are allowed to cut it */
  voiceLowBusy(): boolean {
    return this.voiceBusy() && this.voiceLow;
  }

  /**
   * One voice channel. By default a new line WAITS its turn (returns false if
   * someone is mid-sentence); force=true interrupts. `low` marks chatter that
   * event reactions may cut mid-sentence.
   */
  playVoice(id: string, force = false, low = false): boolean {
    if (!this.ctx) return false;
    const buf = this.buffers.get(id);
    if (!buf) return false;
    if (!force && this.voiceBusy()) return false;
    try {
      this.voiceSrc?.stop();
    } catch {
      /* already done */
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 1.3; // the character leads the mix — the bed ducks under him
    src.connect(g).connect(this.master!);
    src.start();
    this.voiceSrc = src;
    this.voiceEndT = this.ctx.currentTime + buf.duration;
    this.voiceLow = low;
    this.duck(true);
    src.onended = () => {
      if (this.voiceSrc !== src) return; // we were interrupted; a newer line owns the channel
      this.voiceSrc = null;
      this.voiceEndT = 0;
      this.duck(false);
      const p = this.pendingVoice;
      this.pendingVoice = null;
      if (p) {
        if (this.playVoice(p.id, true, p.low)) p.onPlay?.();
      }
    };
    return true;
  }

  /** play now if the channel is free, otherwise right after the current line ends */
  queueVoice(id: string, onPlay?: () => void, low = true) {
    if (this.playVoice(id, false, low)) onPlay?.();
    else this.pendingVoice = { id, onPlay, low };
  }

  /** decoded length of a clip in seconds (0 if not loaded yet) */
  clipDuration(id: string): number {
    return this.buffers.get(id)?.duration ?? 0;
  }

  /** stop the current line and drop anything queued (quit-to-menu etc.) */
  stopVoice() {
    this.pendingVoice = null;
    this.voiceEndT = 0;
    try {
      this.voiceSrc?.stop();
    } catch {
      /* already done */
    }
    this.voiceSrc = null;
    this.duck(false);
  }

  playClip(id: string, vol = 0.6) {
    if (!this.ctx) return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.master!);
    src.start();
  }

  /** swap procedural rumble for the real Karachi street recording */
  async loadAmbienceFile(url: string) {
    if (!this.ctx) return;
    if (!(await this.load('__amb', url))) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.get('__amb')!;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = this.voiceBusy() ? 0.12 : 0.28; // respect an in-flight line
    src.connect(g).connect(this.master!);
    src.start();
    this.fileAmbGain = g;
    this.fileAmbience = true;
    this.ambGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
  }

  async loadMusic(url: string) {
    if (!(await this.load('__music', url))) return;
    if (this.musicWanted) this.startMusic();
  }

  private startMusic() {
    if (!this.ctx || this.musicSrc) return;
    const buf = this.buffers.get('__music');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.8);
    src.connect(g).connect(this.master!);
    src.start();
    this.musicSrc = src;
    this.musicGain = g;
  }

  playMusic() {
    this.musicWanted = true;
    this.startMusic();
  }

  stopMusic() {
    this.musicWanted = false;
    if (this.musicSrc && this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
      const src = this.musicSrc;
      setTimeout(() => {
        try {
          src.stop();
        } catch {
          /* done */
        }
      }, 900);
      this.musicSrc = null;
      this.musicGain = null;
    }
  }

  private distantHorn() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 320 + Math.random() * 420;
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 2 - 1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.018, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + Math.random() * 0.3);
    o.connect(g).connect(pan).connect(this.master!);
    o.start(t);
    o.stop(t + 0.7);
  }

  horn() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // LOUD desi two-tone blare: square+saw layers for grit, an octave-down sub
    // for weight, through a lowpass so it's punchy not piercing. ~0.35s.
    const blast = ctx.createGain();
    blast.gain.setValueAtTime(0.0001, t);
    blast.gain.exponentialRampToValueAtTime(0.3, t + 0.014); // hard attack, loud
    blast.gain.setValueAtTime(0.3, t + 0.2);
    blast.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.Q.value = 0.7;
    lp.connect(blast).connect(this.master!);
    const layers: [number, OscillatorType, number][] = [
      [480, 'sawtooth', 0.46], // body
      [600, 'square', 0.4], // the bright upper tone of the two-tone horn
      [240, 'square', 0.5], // sub — the chest-thump weight
    ];
    for (const [f, type, lvl] of layers) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f * 1.05, t); // tiny downward "honk" slide
      o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      const g = ctx.createGain();
      g.gain.value = lvl;
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + 0.36);
    }
  }

  crash() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = this.noiseBurst(0.3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise.connect(lp).connect(g).connect(this.master!);
    noise.start(t);

    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.3, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og).connect(this.master!);
    o.start(t);
    o.stop(t + 0.35);
  }

  pothole() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.16);
  }

  kata() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = this.noiseBurst(0.16);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(900, t);
    hp.frequency.exponentialRampToValueAtTime(4200, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    noise.connect(hp).connect(g).connect(this.master!);
    noise.start(t);
  }

  /** TV censor tone — plays where a slang word would be; the word is never in the clip */
  bleep(dur = 0.28) {
    if (!this.ctx) return;
    try {
      this.voiceSrc?.stop();
    } catch {
      /* already done */
    }
    // claim the voice channel for the tone so nothing barges in before the clip;
    // bleeps belong to reactions, so the claim is high-priority
    this.voiceEndT = Math.max(this.voiceEndT, this.ctx.currentTime + dur + 0.08);
    this.voiceLow = false;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 1000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.015);
    g.gain.setValueAtTime(0.16, t + dur - 0.04);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  ding() {
    this.blip([880, 1318], 0.09, 0.06);
  }

  cash() {
    this.blip([659, 880, 1046, 1318], 0.09, 0.07);
  }

  private blip(freqs: number[], dur: number, gap: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    freqs.forEach((f, i) => {
      const t = ctx.currentTime + i * gap;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.master!);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  private noiseBurst(dur: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  dispose() {
    if (this.ambTimer !== null) clearInterval(this.ambTimer);
  }
}
