// Maps passenger dialog to the generated Urdu voice clips in /public/audio.
import type { PaxType } from './passengers';

export const VOICE_BASE = '/audio/';

/** clips recorded per category, per passenger — must match scripts/gen_audio.py */
export const VOICE_COUNTS: Record<PaxType, Record<string, number>> = {
  ganji: {}, // Ganji's clips live in rider.ts (ganjiVoiceIds) — never routed through here
  aunty: { crash: 3, pothole: 2, periodic: 3, boost: 1, arrive: 1 },
  student: { crash: 3, pothole: 2, periodic: 3, boost: 1, arrive: 1 },
  uncle: { crash: 2, pothole: 2, periodic: 3, boost: 1, arrive: 1 },
};

const SINGLES = ['greet', 'accept', 'counter_ok', 'counter_no'];

export function voiceIdsFor(pax: PaxType): [string, string][] {
  const out: [string, string][] = [];
  for (const s of SINGLES) {
    out.push([`${pax}_${s}`, `${VOICE_BASE}${pax}_${s}.mp3`]);
  }
  for (const [cat, n] of Object.entries(VOICE_COUNTS[pax])) {
    for (let i = 0; i < n; i++) {
      out.push([`${pax}_${cat}${i}`, `${VOICE_BASE}${pax}_${cat}${i}.mp3`]);
    }
  }
  return out;
}
