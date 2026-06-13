import { pick } from './util';
import { GANJI_LINES } from './rider';
import type { CastChar } from './config';

export type PaxType = 'ganji' | 'aunty' | 'student' | 'uncle';

export interface Pax {
  type: PaxType;
  name: string;
  avatar: string;
  baseFare: number;
  weight: number; // 1 = normal, >1 = slower accel
  moodSens: number; // multiplier on mood loss
  greet: string;
  acceptLine: string;
  counterOkLine: string;
  counterNoLine: string;
  crash: string[];
  pothole: string[];
  periodic: string[];
  boost: string[];
  arrive: string[];
}

export interface RunStats {
  fare: number;
  payout: number;
  stars: number;
  timeSec: number;
  horns: number;
  bumps: number;
  potholes: number;
  kata: number;
  paxName: string;
  paxAvatar: string;
}

// Ganji Swag as your sawari — he sits behind, records Traffic Tales, and corrects
// all of Karachi from the pillion seat. Event lines live in rider.ts.
const GANJI: Pax = {
  type: 'ganji',
  name: 'Ganji Swag',
  avatar: '👨‍🦲',
  baseFare: 200,
  weight: 1.1,
  moodSens: 0.7, // thick-skinned — his rage is the BP meter, not the stars
  greet: '"Bhai, Teen Talwar chalo ge? Raste mein Traffic Tales bhi record karunga!"',
  acceptLine: GANJI_LINES.go[0].text,
  counterOkLine: 'Theek hai bhai, aaj vlog ka budget hai. Chalo!',
  counterNoLine: 'Itne mein to khalli walli ho jao bhai! Acha chalo, theek hai.',
  // ride-event lines route through sayGanji()/rider.ts — these mirror them
  crash: GANJI_LINES.crash.map((l) => l.text),
  pothole: GANJI_LINES.pothole.map((l) => l.text),
  periodic: [], // event-driven instead (jam/cutoff/nohelmet/wrongway)
  boost: GANJI_LINES.boost.map((l) => l.text),
  arrive: GANJI_LINES.arrive.map((l) => l.text),
};

const AUNTY: Pax = {
  type: 'aunty',
  name: 'Rishta Aunty',
  avatar: '🧕',
  baseFare: 180,
  weight: 1.25,
  moodSens: 1.3,
  greet:
    '"Beta, Teen Talwar chalo ge? Ek rishta dikhane jaana hai — aur raste mein TUMHARA bhi soch lengi."',
  acceptLine: 'Shabash beta. Aaram se chalana!',
  counterOkLine: 'Acha acha theek hai, chalo. Lekin AC wali speed se chalna.',
  counterNoLine: 'Itni mehngai mein?! Chalo theek hai, lekin dhyan se.',
  crash: [
    'HAW HAYE! Mera saaman!!',
    'BETA!! Ankhein ghar bhool aaye ho?!',
    'Ya Allah khair!! Aaram se!!',
  ],
  pothole: ['Uff meri kamar!', 'Beta gaddha nazar nahi aaya?!'],
  periodic: [
    'Beta shaadi ho gayi tumhari?',
    'Mera beta bhi bike chalata hai, tumse acha.',
    'Zainab Market mein aj kal kuch nahi milta...',
  ],
  boost: ['Beta yeh PIA ki flight nahi hai!!'],
  arrive: ['Shukar hai zinda pohanch gaye. Yeh lo paise.'],
};

// student (Danish) and uncle (Saleem) were retired from the cast on the
// 2-character decision — their clips stay in public/audio and their lines
// remain in scripts/gen_audio.py if they ever return as guest passengers.
export const ALL_PAX: Pax[] = [GANJI, AUNTY];

export function paxFor(c: CastChar): Pax {
  return c === 'ganji' ? GANJI : AUNTY;
}

export function randomPax(): Pax {
  return pick(ALL_PAX);
}

export function rollFare(pax: Pax): number {
  return pax.baseFare + 10 * Math.round((Math.random() * 60 - 20) / 10);
}

// counter-offer: 55% chance they accept +40%, else +10% but they start annoyed
export function haggle(fare: number): { fare: number; accepted: boolean } {
  if (Math.random() < 0.55) return { fare: Math.round((fare * 1.4) / 10) * 10, accepted: true };
  return { fare: Math.round((fare * 1.1) / 10) * 10, accepted: false };
}

export function makeReview(stats: RunStats, pax: Pax): string {
  const t = `${Math.floor(stats.timeSec / 60)}:${String(Math.floor(stats.timeSec % 60)).padStart(2, '0')}`;
  if (stats.stars >= 4.5) {
    return pick([
      `"Kamaal ki driving. Ek bhi jhatka nahi. ${t} mein pohncha diya. 5 stars, dil se."`,
      `"Aisi sawari roz mile to Karachi mein gaari kaun le. Recommended!"`,
      `"Bhai ne ${stats.kata} gaariyan kaati aur mujhe pata bhi nahi chala. Ustaad."`,
    ]);
  }
  if (stats.stars >= 3.5) {
    return pick([
      `"Theek thaak. ${stats.bumps} dafa dil rukk gaya tha lekin pohanch gaye."`,
      `"Driving acceptable. Horn ${stats.horns} dafa bajaya. Kaan ab bhi bajj rahe hain."`,
      `"${t} mein Teen Talwar. Bura nahi. Gaddhe ginwa diye bas."`,
    ]);
  }
  if (stats.stars >= 2.5) {
    return pick([
      `"${stats.bumps} takkrein. TEEN. ${pax.name === 'Danish' ? 'Paper se pehle' : 'Iss umar mein'} itna khauf theek nahi."`,
      `"Bhai ko race lagi thi kisi se. Mujhse pooch ke to lagao."`,
      `"Pohancha diya, shukar. Magar mere ${stats.potholes} joint hil gaye."`,
    ]);
  }
  return pick([
    `"Mayday mayday. ${stats.bumps} takkrein, ${stats.potholes} gaddhe. Agli dafa paidal jaunga."`,
    `"Inko license kis ne diya?? KHI police ko report karunga."`,
    `"1 star is liye ke zinda hoon. Warna woh bhi nahi deta."`,
  ]);
}

interface Roast {
  test: (s: RunStats) => boolean;
  text: string;
}

// punchline tagline on the score card (TEXT only, not voiced) — first matching
// test wins, so order = severity (most damning first). The generic pool below
// catches everything else, picked at random for variety.
const ROASTS: Roast[] = [
  { test: (s) => s.bumps >= 10, text: 'TAKKAR CHAMPIONSHIP JEET LI AAP NE 🏆💥' },
  { test: (s) => s.bumps >= 6, text: 'BHAI AAP RICKSHAW HI LE LO 🛺' },
  { test: (s) => s.bumps >= 3 && s.stars < 3, text: 'BIKE MEIN BRAKE BHI HOTI HAI. FREE MEIN.' },
  { test: (s) => s.potholes >= 8, text: 'HAR KHADDE KA NAAM YAAD HO GAYA HOGA 🕳️🕳️' },
  { test: (s) => s.potholes >= 6, text: 'HAR GADDHE SE DOSTI ZAROORI THI? 🕳️' },
  { test: (s) => s.horns >= 60, text: 'KAAN KE PARDE KA INSURANCE KARWA LO 🔊' },
  { test: (s) => s.horns >= 45, text: 'HORN KA BILL ALAG AAYEGA 🔊' },
  { test: (s) => s.kata >= 25, text: 'KATA KA BAADSHAH — SADDAR SALUTES 👑⚡' },
  { test: (s) => s.kata >= 18 && s.bumps <= 1, text: 'SADDAR KA UNDISPUTED KATA KING ⚡' },
  { test: (s) => s.stars >= 4.8 && s.timeSec < 50, text: 'ZAIBUNNISA STREET KA SHER 🦁' },
  { test: (s) => s.timeSec < 45 && s.bumps <= 1, text: 'ROCKET HO BHAI? TEEN TALWAR PAL MEIN 🚀' },
  { test: (s) => s.bumps === 0 && s.potholes <= 2, text: 'EK BHI TAKKAR NAHI — RARE FOOTAGE 🎥' },
  { test: (s) => s.stars >= 4.8, text: 'PURE BYKEA — FIVE STAR CAPTAIN ⭐' },
  { test: (s) => s.stars >= 4.5, text: 'SAFE DRIVER. AMMI PROUD HONGI 💚' },
  { test: (s) => s.stars >= 4 && s.kata >= 10, text: 'STYLE BHI, SAFETY BHI — MASHALLAH 👌' },
  { test: (s) => s.timeSec > 110, text: 'RASTE MEIN CHAI PEE KE AAYE THE KYA? ☕' },
  { test: (s) => s.timeSec > 95, text: 'ITNI DER MEIN TO W-11 BHI POHANCH JAATI 🚌' },
];

const GENERIC_ROASTS = [
  'CHALO. POHANCH TO GAYE.',
  'SAHI SALAMAT — YEHI BARI BAAT HAI 🙏',
  'AGLI BAAR THORA DHYAN, BHAI 🙂',
  'GUZARA RIDE THI. CONTENT BHI GUZARA 🎬',
  'BYKEA NE DEKHA TO SHAYAD BONUS DE 😎',
];

export function makeRoast(stats: RunStats): string {
  const hit = ROASTS.find((r) => r.test(stats));
  return hit ? hit.text : GENERIC_ROASTS[(Math.random() * GENERIC_ROASTS.length) | 0];
}
