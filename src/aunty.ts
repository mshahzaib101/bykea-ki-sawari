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
    'Chalo beta, Bismillah. Pehle tumhara mukammal data — phir Teen Talwar. Time waste nahi karte hum.',
    "Helmet pehna hai? Mash'Allah, dhyan rakhne wala larka. File mein pehla point plus.",
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
    'Bhai behan kitne hain? Bara ghar acha hota hai, mehmaan-nawazi aati hai.',
    'Khaana banana aata hai? Aaj kal larke bhi seekh lete hain, sharm ki baat nahi.',
    'Cricket khelte ho ya sirf dekhte ho? Khaandaan mein sehat zaroori hai beta.',
    'Visa-shisa ka koi chakkar? Bahar settle larke ki demand zyada hoti hai.',
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
    'Ek larka roz garage mein gaari chamkata tha. Maine kaha shaadi karwa doon? Kehta hai aunty, gaari hi meri biwi hai. Aaj bhi kunwara hai. Sachi baat.',
    'Ek dafa rishta itna pakka tha ke maine mithai bhi baant di. Larke ne aakhri waqt PUBG khelni shuru kar di. Rishta gaya, mithai gayi, meri izzat gayi.',
    'Meri ek client ne larke se sirf ek sawal poocha: bike apni hai? Larke ne haan kaha. Aaj dono khush hain. Beta, sawal sahi hona chahiye.',
  ],
  crash: [
    'HAWW beta! Aise chalaoge to rishta nahi, fatiha milegi!',
    'Ya Allah! Mera chashma!... Rishta cancel hote hote bacha hai abhi.',
    'Beta, jis larke ki driving aisi ho, uski file main neechay rakh deti hoon.',
    'Beta, marna hi hai to shaadi ke baad marna. Pehle ek rishta to pakka karo.',
    'Haww Allah! Bach gaye... beta meri bhanji widow nahi banegi, samjhe?',
    'Takkar?! Insurance to door ki baat, tumhari to file hi cancel.',
    'Beta sambhal ke! Damaad toot gaya to shaadi kis se karwaungi?',
    'Yeh dent dekha? Yeh tumhari rishta market-value bhi dent kar gaya.',
    'Astaghfirullah! Meri dua pe ho beta, warna abhi janaaza nikalta.',
    'Takkar maar ke "sorry aunty"? Sorry se rishtay nahi chalte beta.',
  ],
  pothole: [
    'Hai meri kamar! Jahez mein naya road maangungi main tumse.',
    'Gaddha! Khair... sabar wala larka acha hota hai. Likh leti hoon.',
    'Beta yeh gaddha nazar nahi aaya? Chashma lagwana parega... woh bhi likh leti hoon.',
    'Hai Allah! Biryani ki degh bhi aise nahi hilti jaise main hil rahi hoon.',
    'Haww meri kamar! Beta saas banungi to yeh sab yaad rakhungi.',
    'Yeh gaddha! Khair, ghar tak pohncha do salaamat — baqi maaf.',
    'Itne gadday? Beta tumhare mohalle ki sarak bhi aisi hai kya? Sach batao.',
    'Haye! Mera saara makeup hil gaya — bhanji se milne se pehle theek karna parega.',
    'Gaddha dekh ke bhi nahi bacha — beta, dhyan rakhne wala larka chahiye hota hai.',
  ],
  jam: [
    'Yeh traffic! Isi liye kehti hoon — shaadi karo, ghar baitho.',
    'Jam mein hi to rishtay pakkay hote hain beta. Time milta hai baat ka.',
    'Acha hua jam laga. Beta, ab bhaago mat — agla sawal aata hai.',
    'Is jam mein maine teen rishtay phone pe pakkay kiye hain. Multi-tasking kehte hain isko.',
    'Jam laga to acha hua — beta, ab sach sach batao, tankhwa kitni hai?',
    'Itni dair khare hain ke maine ek aur rishta phone pe pakka kar diya.',
    'Yeh traffic dekh ke shukar karo abhi shaadi nahi hui — warna saas bhi saath hoti.',
    'Sabar karo beta. Sabar wala larka mujhe sab se zyada pasand hai — likh rahi hoon.',
    'Itna jam hai ke meri bhanji ki poori biodata sun sakte ho. Suno...',
    'Yeh log ghar kyun nahi rehte? Shaadi karwa doon to sab seedhe ho jayein.',
  ],
  // overtaking stunt-boys and wrong-way heroes — all the same to her
  launde: [
    'Dekho inn laundon ko! Ghar pe biwi nahi na, isi liye yeh haal hai.',
    'Wrong way pe aa raha hai... iski ammi ko main jaanti hoon. Bataungi.',
    'Kartab dekho! Inki shaadi karwa do, saare stunt khatam.',
    'Yeh wheeling wale? Inki ammi ke aansu maine dekhe hain. File reject.',
    'Haww, dekho usse! Aise larkon ki wajah se meri job kabhi khatam nahi hoti.',
    'Yeh overtake kya kiya — seedha meri reject file mein gaya. Naam likh liya iska.',
    'Itni jaldi kahan beta? Ghar pe koi rishta dekhne thori aaya hai tere.',
    'Lane mein ghus gaya bina indicator — aisa damaad kis ko chahiye, batao?',
    'Haww! Yeh tezi shaadi pe dikhata to ab tak ghar bas chuka hota.',
    'Maa-baap ne itna parhaya likhaya, aur yeh sarak pe shapaterbaazi kar raha hai. Tauba!',
    'Inn laundon ki ammiyan mujhse aa ke roti hain — "rishta karwa do, sudhar jayega". Beta, gaari to sambhal nahi raha!',
    'Wrong way wala? Iski to file main laal pen se cross karti hoon.',
  ],
  boost: [
    'Haaye itni SPEED! Itni jaldi shaadi pe dikhana beta!',
    'ASTAGHFIRULLAH! Dupatta urh gaya mera! Aaram se!',
    'Itni tezi?! Itni jaldi sirf nikah pe hoti hai beta!',
    'Beta yeh nikah ki tezi nahi, talaq ki tezi lag rahi hai! Aaram se!',
    'Haaye! Itni speed pe dupatta to gaya, ab izzat bachao beta!',
    'Slow chalao beta! Itni jaldi to sirf laddu baantne mein karte hain.',
    'Astaghfirullah, yeh raftaar! Meri bhanji ko motion sickness hai, yaad rakhna.',
    'Itni tez? Sasural jaldi pohnchne ka shauq abhi se? Sabar beta!',
  ],
  // Rishta Meter maxed — you have been APPROVED
  pakka: [
    'Bas, faisla ho gaya! Tum meri bhanji ke liye PAKKA. Yeh lo shagun!',
    "Mash'Allah kya driving hai! File sab se upar — rishta pakka samjho!",
    'Faisla final! Tum jaisa damaad to log dhoondte reh jate hain. Yeh shagun rakho beta!',
    'Bas, ab inkaar ki gunjaish nahi! Meri bhanji ki kismat khul gayi. Mubarak ho!',
  ],
  arrive: ['Pohanch gaye. Mera number likh lo — sanjeeda ho to ammi se call karwana.'],
};

/** clips generated per category — must match scripts/gen_audio.py "rishta" block */
export const RISHTA_COUNTS: Record<RishtaCat, number> = {
  go: 4,
  ask: 12,
  story: 10,
  crash: 10,
  pothole: 9,
  jam: 10,
  launde: 12,
  boost: 8,
  pakka: 4,
  arrive: 1,
};

/**
 * score-card review, SPOKEN when the card shows. Outer index = star tier
 * (0 best → 3 worst); inner array = variants picked at random for replay variety.
 * Clip ids: variant 0 = `rishta_review{tier}` (legacy), variants 1+ = `rishta_review{tier}_{j}`.
 */
export const RISHTA_REVIEWS: string[][] = [
  [
    "Mash'Allah! Aisi driving wale larke ki to file FRAMED hoti hai. Number milega tumhe.",
    'Beta tum to perfect damaad nikle! Meri bhanji ke liye file sab se upar.',
    'Wah! Itni sambhal ke chalaya — saas log aise hi larke dhoondti hain. Pakka!',
  ],
  [
    'Theek chalaya beta. Rishtay layak ho... bas thora sa.',
    'Acha larka ho. File mein rakh leti hoon — thora polish chahiye bas.',
    'Chalega beta. Driving theek, akhlaq theek — ammi se baat karwana.',
  ],
  [
    "Hmm. File mein likh diya hai: 'driving — guzara'. Baqi dekh lengi.",
    'Beta, driving pe thora kaam karo. Filhaal "under review" rakha hai tumhe.',
    'Itni takkrein? Beta sambhal ke — warna bhanji ki ammi nahi maanegi.',
  ],
  [
    'Astaghfirullah! Tumhara rishta to main apni dushman se bhi nahi karwaungi. Magar paise pohanchane ke pooray.',
    'Haww beta! Aisi driving? File seedha raddi mein. Tauba tauba.',
    'Beta, pehle driving school, phir rishta. Abhi to naam bhi nahi likhungi.',
  ],
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
  for (let t = 0; t < RISHTA_REVIEWS.length; t++) {
    for (let j = 0; j < RISHTA_REVIEWS[t].length; j++) {
      const id = j === 0 ? `rishta_review${t}` : `rishta_review${t}_${j}`;
      out.push([id, `${VOICE_BASE}${id}.mp3`]);
    }
  }
  return out;
}
