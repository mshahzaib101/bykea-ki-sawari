// Rishta Aunty's lines — she is the PASSENGER, and YOU (the captain) are her
// next potential client. The ride is an interview: she collects your biodata
// (sequential 'ask' questions), drops matchmaking war stories, and judges the
// traffic. Drive well and her Rishta Meter (💍) fills — maxed = rishta pakka.
// Display text here ↔ Urdu TTS text in scripts/gen_audio.py ("rishta" block),
// clips rishta_{cat}{i}.mp3 — same index-pairing contract as rider.ts.
import { VOICE_BASE } from './voices';

export type RishtaCat =
  | 'go'
  | 'ask'
  | 'story'
  | 'crash'
  | 'pothole'
  | 'jam'
  | 'launde'
  | 'boost'
  | 'pakka'
  | 'arrive';

export const RISHTA_AVATAR = '🧕';

export const RISHTA_LINES: Record<RishtaCat, string[]> = {
  // ride start — the interview begins
  go: [
    'Bismillah! Chalo beta. Raste mein tumhara data lena hai mujhe — client ban sakte ho tum.',
    'Seedha chalana beta. Aaj kal larke bike pe interview dete hain — shuru karein?',
  ],
  // the biodata interrogation — fired IN ORDER (askIdx), that's the interview arc
  ask: [
    'Beta, umar kitni hai tumhari? Sach bolna — main shanakhti card check karwa leti hoon.',
    'Kaam kya karte ho? Yeh Bykea full-time hai ya shauq ka?',
    'Ghar apna hai ya kiraye ka? Portion hai ya poora?',
    'Qad kitna hai? Helmet utaar ke mat batana, andaza ho gaya mujhe.',
    'Salary mat batao... bas yeh batao — motorcycle APNI hai?',
    'Ammi kya karti hain? Unka number dena, baat karni hai.',
    'Pichla rishta kyun toota tha? Haan mujhe pata hai — maine pata karwaya tha.',
    'Facebook pe ho beta? Profile photo helmet wali MAT rakhna.',
  ],
  // matchmaking war stories
  story: [
    'Maine do sau shaadiyan karwai hain. Chhe wapis aa gayin... unhein hum count nahi karte.',
    'Ek larka tha bilkul tumhare jaisa. Rishta karwaya — aaj DHA mein rehta hai. Biwi KI taraf se, magar rehta to hai!',
    'Ek dulhan ne mehndi pe inkaar kar diya. Maine wahin khari khari doosra larka nikaal diya. Khana waste nahi hone diya.',
    'Log kehte hain rishton ki app aa gayi hai. Beta, app tumhein biryani ki degh tak nahi pohncha sakti.',
    'Teen Talwar ke paas meri ek client hai — doctorni. Tumhara naam maine likh liya hai, fikar na karo.',
    'Ek ammi ne kaha: koi bhi chalega, bas zinda ho. Maine kaha behan, standards itne bhi mat girao. Phir unka beta dekha... samajh gayi.',
    'Mere paas ek register hai — assi ki dahai se. Jo larka ek dafa is mein aa gaya, uska naam kabhi nahi nikalta. KABHI nahi.',
  ],
  crash: [
    'HAWW beta! Aise chalaoge to rishta nahi, fatiha milegi!',
    'Ya Allah! Mera chashma!... Rishta cancel hote hote bacha hai abhi.',
    'Beta, jis larke ki driving aisi ho, uski file main neechay rakh deti hoon.',
    'Beta, marna hi hai to shaadi ke baad marna. Pehle ek rishta to pakka karo.',
  ],
  pothole: [
    'Hai meri kamar! Jahez mein naya road maangungi main tumse.',
    'Gaddha! Khair... sabar wala larka acha hota hai. Likh leti hoon.',
    'Beta yeh gaddha nazar nahi aaya? Chashma lagwana parega... woh bhi likh leti hoon.',
    'Hai Allah! Biryani ki degh bhi aise nahi hilti jaise main hil rahi hoon.',
  ],
  jam: [
    'Yeh traffic! Isi liye kehti hoon — shaadi karo, ghar baitho.',
    'Jam mein hi to rishtay pakkay hote hain beta. Time milta hai baat ka.',
    'Acha hua jam laga. Beta, ab bhaago mat — agla sawal aata hai.',
    'Is jam mein maine teen rishtay phone pe pakkay kiye hain. Multi-tasking kehte hain isko.',
  ],
  // overtaking stunt-boys and wrong-way heroes — all the same to her
  launde: [
    'Dekho inn laundon ko! Ghar pe biwi nahi na, isi liye yeh haal hai.',
    'Wrong way pe aa raha hai... iski ammi ko main jaanti hoon. Bataungi.',
    'Kartab dekho! Inki shaadi karwa do, saare stunt khatam.',
    'Yeh wheeling wale? Inki ammi ke aansu maine dekhe hain. File reject.',
    'Haww, dekho usse! Aise larkon ki wajah se meri job kabhi khatam nahi hoti.',
  ],
  boost: [
    'Haaye itni SPEED! Itni jaldi shaadi pe dikhana beta!',
    'ASTAGHFIRULLAH! Dupatta urh gaya mera! Aaram se!',
    'Itni tezi?! Itni jaldi sirf nikah pe hoti hai beta!',
  ],
  // Rishta Meter maxed — you have been APPROVED
  pakka: [
    'Bas, faisla ho gaya! Tum meri bhanji ke liye PAKKA. Yeh lo shagun!',
    "Mash'Allah kya driving hai! File sab se upar — rishta pakka samjho!",
  ],
  arrive: ['Pohanch gaye. Mera number likh lo — sanjeeda ho to ammi se call karwana.'],
};

/** clips generated per category — must match scripts/gen_audio.py "rishta" block */
export const RISHTA_COUNTS: Record<RishtaCat, number> = {
  go: 2,
  ask: 8,
  story: 7,
  crash: 4,
  pothole: 4,
  jam: 4,
  launde: 5,
  boost: 3,
  pakka: 2,
  arrive: 1,
};

/** score-card review, SPOKEN when the card shows — index = star tier (best→worst) */
export const RISHTA_REVIEWS: string[] = [
  "Mash'Allah! Aisi driving wale larke ki to file FRAMED hoti hai. Number milega tumhe.",
  'Theek chalaya beta. Rishtay layak ho... bas thora sa.',
  "Hmm. File mein likh diya hai: 'driving — guzara'. Baqi dekh lengi.",
  'Astaghfirullah! Tumhara rishta to main apni dushman se bhi nahi karwaungi. Magar paise pohanchane ke pooray.',
];

/** start-screen reactions when her card is tapped (clips rishta_select0..2) */
export const RISHTA_SELECT: string[] = [
  "Mujhe select kiya? Mash'Allah, samajhdar larka lagta hai. File kholti hoon.",
  'Acha kiya beta — uss ganje ke saath BP hi high hota tumhara.',
  'Chalo beta. Waise... shaadi shuda to nahi ho tum? Bas pooch rahi hoon.',
];

/** 3-round haggle — each "Itne mein nahi bhai" press (clips rishta_haggle0..2) */
export const RISHTA_HAGGLE: string[] = [
  'Haww, itne? Acha beta, theek hai... rishtay mein discount karwa dungi.',
  'Tum bilkul mere bhanje jaise ho — woh bhi paise pehle maangta hai. Acha lo.',
  'BAS. Iss se zyada diya to log jahez samjhenge. Chalo ab!',
];

export const RISHTA_SINGLES = [
  'rishta_greet',
  'rishta_haggle0',
  'rishta_haggle1',
  'rishta_haggle2',
] as const;

export function rishtaVoiceIds(): [string, string][] {
  const out: [string, string][] = [];
  for (const id of RISHTA_SINGLES) {
    out.push([id, `${VOICE_BASE}${id}.mp3`]);
  }
  for (const [cat, n] of Object.entries(RISHTA_COUNTS)) {
    for (let i = 0; i < n; i++) {
      out.push([`rishta_${cat}${i}`, `${VOICE_BASE}rishta_${cat}${i}.mp3`]);
    }
  }
  for (let i = 0; i < RISHTA_REVIEWS.length; i++) {
    out.push([`rishta_review${i}`, `${VOICE_BASE}rishta_review${i}.mp3`]);
  }
  return out;
}
