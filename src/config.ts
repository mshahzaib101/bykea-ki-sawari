// Route: Empress Market (z=0) → Saddar bazaar → Zainab Market → Regal Chowk →
// Metropole/Frere Hall → (short) Clifton Bridge → Clifton → Teen Talwar
// Compressed to ~1380m so a run is a tight 45-70s — one tweet-video long.
export const ROUTE = {
  length: 1500,
  finish: 1380,
  sections: {
    saddar: [0, 520] as const,
    zainab: [520, 760] as const,
    regal: [760, 1000] as const,
    bridge: [1000, 1140] as const,
    clifton: [1140, 1380] as const,
  },
};

export const ROAD = {
  half: 12, // asphalt half-width
  lanes: [-9, -3, 3, 9], // -9 is the oncoming lane
  clampX: 10.6,
};

export const SPEED = {
  base: 26,
  boost: 44,
  crash: 9,
  accel: 16,
  steer: 17,
};

export const MOOD = {
  start: 5,
  regenPerSec: 0.045,
  crash: -0.65,
  pothole: -0.28,
};

export const KATA_RUPEES = 5;

// The playable cast — two PASSENGERS you can carry (the player is the Bykea
// captain driving them). Parody caricature names only.
export type CastChar = 'ganji' | 'aunty';

export const CAST: Record<CastChar, { name: string; tag: string }> = {
  ganji: { name: 'Ganji Swag', tag: 'yeh traffic, yaar!' },
  aunty: { name: 'Rishta Aunty', tag: 'beta, shaadi kab?' },
};
