// Ganji Swag's lines — he is the PASSENGER (you drive the Bykea, he records
// Traffic Tales from the pillion). Cranky traffic-correcting energy.
// Display text here ↔ Urdu TTS text in scripts/gen_audio.py ↔ counts below.
// Same index-pairing contract as passengers (see docs/AUDIO.md).
// Lines with bleep:true start with a censor tone — the slang word is NEVER in
// the audio file; the game plays audio.bleep() then the clip.
import { VOICE_BASE } from './voices';

export interface RiderLine {
  text: string;
  bleep?: boolean;
}

export type GanjiCat =
  | 'go'
  | 'jam'
  | 'cutoff'
  | 'nohelmet'
  | 'wrongway'
  | 'pothole'
  | 'crash'
  | 'noise'
  | 'bus'
  | 'boost'
  | 'rant'
  | 'arrive'
  | 'story';

export const GANJI_AVATAR = '👨‍🦲';

// Lines written to a Karachi traffic-vlogger archetype:
// "abay"/"yaar" tics, sarcastic "maashallah" at wrong-way riders, "khalli walli"
// catchphrase, potholes-as-moon bit, the "main hi to ghalat nahi aa raha?" self-doubt gag.
export const GANJI_LINES: Record<GanjiCat, RiderLine[]> = {
  // his actual episode opener — plays the moment the ride starts
  go: [
    {
      text: 'Haan bhai, kya haal hai bhaiya? Welcome to Traffic Tales! Aaj ka route: Empress Market se Teen Talwar. Chalo bhai!',
    },
    {
      text: 'Camera on, mic on — Traffic Tales LIVE hai bhai! Empress Market se nikal rahe hain, dekhte hain Karachi aaj kya dikhata hai!',
    },
    {
      text: 'Bismillah! Camera roll ho raha hai — aaj ki sawari, aaj ka tamasha. Chalo Saddar se!',
    },
    {
      text: 'Helmet pehna? Shabaash! Chalo bhai, Traffic Tales ka naya episode — captain seat pe tum, kahaani pe main!',
    },
  ],
  jam: [
    { text: 'Yeh traffic hai ya parking lot? Subah se yahin khare hain!' },
    { text: 'Abay kya sheher ka design hai — poori qaum aaj isi road pe hai!' },
    { text: 'Mad Max ka scene ho gaya hai bhai — Fury Road, Karachi edition!' },
    { text: 'Mera BP mat barhao yaar... chalo bhi!' },
    { text: 'Yeh dekho — Pakistan ka sab se bara waiting room. Welcome to Saddar.' },
    { text: 'Horn mat maaro bhai log! Koi nahi hil sakta — yeh physics hai, jazbaat nahi.' },
    { text: 'Itni lambi line... lagta hai aage biryani free mil rahi hai.' },
    { text: 'Ambulance bhi yahin phansi hai bechari — patient ab pedal pe pohchega.' },
    { text: 'Gaari band kar do bhai, petrol jala ke kya — hum to khare hi hain.' },
    { text: 'Signal teen baar green hua, hum phir bhi wahin. Sirf mera dil green hai.' },
    { text: 'Yeh jam nahi, free ki meditation hai — khade raho, saans lo, BP barhao.' },
    { text: 'Poora Karachi ek hi road pe — baaki sheher kisi aur mulk mein hai kya?' },
  ],
  cutoff: [
    { text: '★#$! Yeh kahan hamari lane mein ghus raha hai?!', bleep: true },
    { text: 'Indicator invent ho chuka hai bhai, kabhi use kar lo!' },
    { text: 'Yeh SHAPATER dekho! Kahin aur se ghusa, kahin aur se niklega!' },
    { text: 'Machhar ki tarah idhar udhar, idhar udhar — ek line mein reh bhai!' },
    { text: '★#$! Bila wajah dedh hoshiyari!', bleep: true },
    { text: 'Iska side mirror band hai... sharmaya hua hai bechara.' },
    { text: 'Abe seedha chala bhai! Bike hai yeh, saanp nahi.' },
    { text: 'Race lagi hai kisi se? Formula One ki khaali seat hai bhai — udhar chala ja!' },
    { text: 'Overtake kar ke pohcha kahan? Agle signal pe phir saath khare hain hum!' },
    { text: 'Zig-zag, zig-zag... Snake wali game khel raha hai poori road pe?' },
    { text: 'Teeno lane ek saath badal di — Fast and Furious ka deleted scene hai yeh!' },
    { text: 'Aage nikal ke milega kya, medal? Sab ko ghar hi jaana hai bhai!' },
    { text: 'Shapaterbaazi mein PhD hai iski — har gap mein ghus jata hai!' },
    { text: 'Indicator left diya, mur gaya right. Yeh banda GPS ko bhi confuse kar de!' },
    { text: 'Beech mein ghus ke ab horn bhi? Pehle se dawat pe bulaya tha tujhe?' },
  ],
  nohelmet: [
    { text: '★#$! Helmet pehen ke chalo bhai!', bleep: true },
    { text: 'Hello bhai! Helmet kahan hai, HELMET?' },
    { text: 'Sar ek hi hai bhai, spare nahi milta!' },
    { text: 'Abe ek haath mein phone — karoron ka sauda ho raha hai bike pe?!' },
    { text: 'Bina helmet, bina dar. GoPro le le bhai — kam az kam footage to bachegi.' },
    { text: 'Teen sawari ek bike pe, helmet zero — poori family ka package deal!' },
    { text: 'Helmet seat ke neeche rakha hai na? Sajawat ke liye, sar ke liye nahi.' },
    { text: 'Baal set hain, sar nahi. Wah bhai, priorities ekdum clear hain!' },
    { text: 'Hero banne ka shauq hai? Hospital mein bhi hero banoge — ICU wale.' },
    { text: 'Topi pehni hai, helmet nahi. Fashion zindabad, dimaag murdabad!' },
  ],
  // index 0 is the JULOOS line — main.ts fires it when a wrong-way pack shows up
  wrongway: [
    { text: 'Maashallah! Poora juloos wrong way pe aa raha hai — maashallah, maashallah!' },
    { text: 'Kabhi kabhi sochta hoon... kahin MAIN hi to ghalat nahi aa raha?' },
    { text: 'Ulta aa raha hai, aur bharam mujhe de raha hai!' },
    { text: 'Aaja wrong way, aaja! Ghus ja hum mein!' },
    { text: 'Mubarak ho bhai, mubarak ho! Do rupay ka petrol bacha liya!' },
    { text: 'Ek haath mein phone, ek haath se wrong way — multitasking ka baap aa gaya!' },
    { text: 'Ruk ruk ruk, teri video banata hoon — kal poora Karachi dekhega tujhe!' },
    { text: 'Light nahi, helmet nahi, number plate nahi — bas bharam hi bharam!' },
    { text: 'Wah! GPS ne kaha hoga shortcut hai — seedha hamari taraf!' },
    { text: 'Ulti taraf se aa ke horn bhi maar raha hai? Kamaal ki himmat hai!' },
    { text: 'Poora Karachi seedha aa raha hai — bas yeh akela hero ulti taraf!' },
    { text: 'U-turn do furlong aage tha bhai — itni kya jaldi thi?' },
    { text: 'Maashallah, ek aur ulta! Aaj to juloos pe juloos aa raha hai!' },
    { text: 'Ramzan mein bhi ulti taraf? Bhai sabr ka mahina hai — U-turn le le!' },
    { text: 'Iska to steering hi ulta laga hai shayad — factory fault, bhai!' },
  ],
  pothole: [
    { text: 'Yeh dekho, chaand pe aa gaye hum! Wah!' },
    { text: 'Dukh hota hai yaar, jab khadday pe lagti hai.' },
    { text: 'Tax hum dete hain, khadday humein milte hain!' },
    { text: 'Surprise khadda! Subway Surfer khela hai? Only Karachi baby!' },
    { text: 'Bike pe space mein jaana hai? Kisi khadde mein full speed ghus jao — seedha Mars!' },
    { text: 'Yeh khadda nahi bhai, yeh KMC ka surprise gift hai.' },
    { text: 'Wah! Jo marore saalon se phanse hue the, sab khul gaye.' },
    { text: 'Yeh khadda nahi, Karachi ka swimming pool hai — bas barish ka intezaar hai.' },
    { text: 'Gaari ka alignment gaya, meri kamar gayi, aur neta ka vote bhi gaya.' },
    { text: 'Itne khadday hain ke Google Maps yahan "off-road" likhta hai.' },
    { text: 'Yeh road nahi, KMC ka braille hai — andhere mein bhi parh lo.' },
    { text: 'Chaand pe paani mil gaya bhai — par tha is khadde ka!' },
  ],
  crash: [
    { text: 'Yaar dekh ke! Risk nahi lene ka bhai!' },
    { text: 'Yeh Karachi mein driving nahi, survival hai!' },
    { text: 'Haan haan, "sorry bhai ghalti se" — ammi ki dawai lene ja raha tha na tu?' },
    { text: '★#$! Bhains ki aunty kahin ki!', bleep: true },
    { text: 'Bhai bhai bhai! Bike ko bachao, mujhe baad mein dekh lena!' },
    { text: 'Yeh dekha? Mout ko chhoo ke wapas aaye hain hum.' },
    { text: 'Takkar! Ab insurance wala bhi hasega — bike ka insurance hi nahi hai!' },
    { text: 'Dekh ke bhai! Meri hadiyaan abhi EMI pe hain!' },
    { text: 'Yeh takkar nahi, free ka chiropractor session tha — kamar set ho gayi.' },
    { text: 'Bike chala raha hai ya bumper cars khel raha hai mele mein?' },
    { text: 'Side mirror gaya... ab haath se ishaara karunga, purane zamane ki tarah.' },
    { text: 'Aram se yaar! Yeh body shop wale tere rishtedaar hain kya?' },
  ],
  noise: [
    { text: 'Yahan kitna shor hai bhai, kaan pak gaye!' },
    { text: 'Abay itni badi bus — saamne se horn kyun maar raha hai?!' },
    { text: 'Thele wale ko horn nahi maarte yaar... woh kya kare?' },
    { text: '★#$! Kaun dhakkan ka bacha horn maar raha hai traffic mein?!', bleep: true },
    { text: 'Shor itna hai ke apni baat khud nahi sun pa raha main!' },
    {
      text: 'Horn bajao zor se! Jaise aage wala ud ke jagah bana dega — physics aisa hi chalta hai na?',
    },
    { text: 'Yeh pressure horn hai ya masjid ka loudspeaker? Kaan ka parda gaya!' },
    { text: 'Sab ek saath horn maar rahe hain — Karachi Symphony Orchestra, live!' },
    { text: 'Abay red light pe bhi horn? Signal hara karna mere bas mein nahi bhai!' },
    { text: 'Itna shor hai ke apni soch bhi sunai nahi de rahi — shukar hai!' },
  ],
  bus: [
    { text: 'Bus se DOOR bhai, door! Andar se gutke ki peek aati hai!' },
    { text: '1965 ki bus hai bhai — chamak patti laga ke chala rahe hain!' },
    { text: 'Yeh bus ka dhuaan seedha mere phephron mein ja raha hai. Direct transfer.' },
    { text: 'Bus ke peechay mat raho bhai — yeh kabhi bhi, kahin bhi rukti hai. Surprise stop!' },
    { text: 'Bus ne bina indicator mor li — yeh W-gyaarah hai bhai, rules se aazad!' },
    { text: 'Bus ki chhat pe sawari? Yeh aam bus nahi, double-decker ka jugaad hai!' },
    { text: 'Bus beech road pe ruk gayi — stop yahin hai, kyunki driver ne aaj decide kiya.' },
    { text: 'Bus ka horn baja to laga qayamat aa gayi — bus nahi, Titanic hai yeh!' },
  ],
  boost: [
    { text: 'Ab aayi na line clear! Chalo chalo chalo!' },
    { text: 'Khalli walli ho jao bhai, khalli walli!' },
    { text: 'SCHUMACHER MODE ON! Dhoom macha de bhai!' },
    { text: 'Oho! CD-Seventy ka maza aa raha hai bhai!' },
    { text: 'Ab maza aaya! Iftar se pehle ghar pohchna hai — full throttle bhai!' },
    { text: 'Khali road! Yeh Karachi mein UFO dekhne jaisa hai — record kar lo jaldi!' },
    { text: 'Dhoom macha de bhai! University Road clear hai — yeh lamha phir nahi aayega!' },
    { text: 'Hawa se baatein! CD-Seventy ko aaj pankh lag gaye!' },
  ],
  rant: [
    {
      text: 'BAS! Ho gaya! Yeh traffic, yeh shor, yeh khadday — video bana raha hoon, poori duniya dekhegi!',
    },
    { text: 'Karachi walon! Thori si tameez, thora sa sabar — bas yehi maang raha hoon yaar!' },
  ],
  arrive: [{ text: 'Pohanch gaye bhai! Aaj ka Traffic Tale — zabardast. Yeh lo paise.' }],
  // mid-ride qisse — fire on calm stretches; that's the Traffic Tales format
  story: [
    {
      text: 'Ek parking wale ne pachaas rupay maange. Maine kaha, line to kheencho pehle! Kehta hai: line kheench di to mujhe kaun poochega? Yeh hai system, bhai.',
    },
    {
      text: 'Ek dafa ek rickshaw wale ne INDICATOR diya. Yeh aath sau saal mein ek baar hota hai — jaise Saturn aur Jupiter saath aa jayen. Maine to award dene ka socha tha.',
    },
    {
      text: 'Main kehta hoon shaadi ki dukaanein dus saal band kar do. Sherwaniyan band, dulhe band. Abadi kam, traffic kam — simple hisaab hai bhai!',
    },
    {
      text: 'Woh gadha gaari dekhi? Gadhe ke cousin China mein factory mein kaam karte hain, aur yeh Karachi ke traffic mein hai. Phir bhi chal raha hai. Gadha is a sign of resilience, bhai!',
    },
    {
      text: 'Bachpan mein yahan Bohri Bazaar aata tha main. Tab bhi traffic tha... magar tameez thi. Ab sirf traffic hai.',
    },
    {
      text: 'Yahan ek nehar hai — naam Nahr-e-Khayyam. Sunne mein lagta hai Baghdad ki koi cheez. Asal mein woh GUTTER-e-Khayyam hai bhai. Naam se dhoka mat khana.',
    },
    {
      text: 'Port wali road pe street light kabhi nahi jalti. KABHI! Jis din jali, main video bana ke duniya ko dikhaunga — itna bara hadsa hoga woh.',
    },
    {
      text: 'Ek mashwara — L wali gaariyon se door raho. Learner ko khud nahi pata agla move kya hai. Tumhari L lagwa dega.',
    },
    {
      text: 'Log hazard light ko decoration samajhte hain. Abe HAZARD ka matlab khatra hota hai — baraat ki jhalar nahi.',
    },
    {
      text: 'Ek baar University Road pe iftar se das minute pehle nikla. Har bike pe teen log, har haath mein samosa, koi brake pe nahi. Us din Allah khud traffic chala raha tha bhai.',
    },
    {
      text: 'Mere mohalle mein ek gaari ki alarm har raat bajti hai, chor kabhi nahi aata. Maine kaha theek karwa lo. Kehta hai: yeh to mohalle ki lori hai. Karachi hai bhai — yahan masla bhi tehzeeb se hota hai.',
    },
  ],
};

/** clips generated per category — must match scripts/gen_audio.py */
export const GANJI_VOICE_COUNTS: Record<GanjiCat, number> = {
  go: 4,
  jam: 12,
  cutoff: 15,
  nohelmet: 10,
  wrongway: 15,
  pothole: 12,
  crash: 12,
  noise: 10,
  bus: 8,
  boost: 8,
  rant: 2,
  arrive: 1,
  story: 11,
};

/**
 * score-card review, SPOKEN when the card shows. Outer index = star tier
 * (0 best → 3 worst); inner array = variants picked at random for replay variety.
 * Clip ids: variant 0 = `ganji_review{tier}` (legacy), variants 1+ = `ganji_review{tier}_{j}`.
 */
export const GANJI_REVIEWS: string[][] = [
  [
    'Bhai kya chalaya hai! Subscribe kar liya maine tumhe. Five star, seedha.',
    'Mashallah! Aisi driving pe to main khud helmet utaar ke salaam karoon. Top class!',
    'Yeh hui na baat! Smooth, safe, aur content bhi ban gaya. Five star pakka!',
  ],
  [
    'Acha chalaya yaar. Thore khadday tumne dhoonde, thore khud aaye. Chalega.',
    'Theek thaak. Thora aur dhyan, to next time five star. Subscribe rakhna!',
    'Chalo, bach gaye. Driving theek hai, magar mera BP thora high ho gaya.',
  ],
  [
    'Bhai ko race lagi thi kisi se. Mujhse pooch ke to lagao.',
    'Driving mein "guzara" likh raha hoon. Khadday ginna chhor diye maine.',
    'Content to mil gaya... magar meri kamar ki keemat pe. Do star.',
  ],
  [
    'Yeh ride nahi thi bhai, yeh Mad Max audition tha. Magar content mil gaya — isliye ek star extra.',
    'Bhai aap ne to traffic ke saath saath mera dil bhi tor diya. Ek star.',
    'Agla episode banaunga: "Karachi ka sab se khatarnak captain". Star? Khalli walli.',
  ],
];

/** start-screen reactions when his card is tapped (clips ganji_select0..2) */
export const GANJI_SELECT: string[] = [
  'Haan bhai! Sahi choice — aaj content guaranteed hai.',
  'Aunty ke saath jaate to ab tak rishta ho chuka hota tumhara. Bach gaye.',
  'Oye hoye! Traffic Tales team mein welcome bhai. Helmet?',
];

/** always plays right after the episode intro — the fit check */
export const GANJI_FITCHECK =
  'Chalo bhai — helmet check, camera check, sawari check — scene ON hai!';

/**
 * 3-round haggle: each "Itne mein nahi bhai" press escalates the drama
 * (clips ganji_haggle0..2; display text index-paired as usual).
 */
export const GANJI_HAGGLE: string[] = [
  'Arre yaar, main content creator hoon, crorepati nahi!... Acha chal, thora barha deta hoon.',
  'ABE! Bike hai ya helicopter?!... Khalli walli, le le bhai, le le.',
  'BAS bhai bas! Aakhri offer — isse zyada maanga na, to Traffic Tales ka agla episode TERE upar banega!',
];

/**
 * FIXED route beats — fire at these z positions every ride (queued, so they
 * wait for the current line). The scripted spine that keeps the ride alive.
 */
export const GANJI_FIXED: { z: number; text: string }[] = [
  {
    z: 540,
    text: 'Yeh Zainab Market aa gaya — ammi yahan se teen ghante mein do suit leti thin. TEEN. GHANTE.',
  },
  {
    z: 740,
    text: 'Regal Chowk bhai! Purane Karachi ki khushboo aati hai yahan se... aur thori gutter ki bhi.',
  },
  {
    z: 915,
    text: 'Yeh Frere Hall — sau saal purani building aaj bhi khari hai, aur hamara naya flyover saal mein beth jaata hai.',
  },
  {
    z: 1050,
    text: 'Bridge cross karte hi dekhna — traffic bhi civilized ho jata hai. Magic hai bhai.',
  },
  { z: 1230, text: 'Yeh Clifton — yahan ke kutte bhi imported hain bhai.' },
];

/** haggle-sheet clips played directly by id (not category-indexed) */
export const GANJI_SINGLES = [
  'ganji_greet',
  'ganji_fitcheck',
  'ganji_haggle0',
  'ganji_haggle1',
  'ganji_haggle2',
] as const;

export function ganjiVoiceIds(): [string, string][] {
  const out: [string, string][] = [];
  for (const id of GANJI_SINGLES) {
    out.push([id, `${VOICE_BASE}${id}.mp3`]);
  }
  for (let i = 0; i < GANJI_FIXED.length; i++) {
    out.push([`ganji_wp${i}`, `${VOICE_BASE}ganji_wp${i}.mp3`]);
  }
  for (let t = 0; t < GANJI_REVIEWS.length; t++) {
    for (let j = 0; j < GANJI_REVIEWS[t].length; j++) {
      const id = j === 0 ? `ganji_review${t}` : `ganji_review${t}_${j}`;
      out.push([id, `${VOICE_BASE}${id}.mp3`]);
    }
  }
  for (const [cat, n] of Object.entries(GANJI_VOICE_COUNTS)) {
    for (let i = 0; i < n; i++) {
      out.push([`ganji_${cat}${i}`, `${VOICE_BASE}ganji_${cat}${i}.mp3`]);
    }
  }
  return out;
}
