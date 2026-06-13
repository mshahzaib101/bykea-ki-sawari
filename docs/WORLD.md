# World — route map & scene construction

The route is a straight strip along +z. Total `ROUTE.length = 1500`,
finish line `ROUTE.finish = 1380` (≈45–70s ride). Built from real reference
photos of each location (owner supplies them in `~/Desktop/saddar`, `~/Desktop/clifton`;
Wikimedia Commons also used — photos are reference only, never shipped).

## Route table (z positions)

| z | What | Notes |
|---|---|---|
| 0 | Start / pickup | Player spawns x=3 (middle lane) |
| 35 | **Empress Market** (left/screen-right, x<0) | Buff Indo-Gothic: gallery wing, gateway-arch clock tower, corner pavilions w/ pyramid roofs. Pigeons scatter, market crowd, stalls |
| 8–78 | Dry-fruit aunties (x≈-10.7) | 8 seated sellers in bright sarees: mats, open sacks w/ heaps, woven baskets, two-pan hand scales, bangles |
| 8–96 | Camera market + dentists (x>0 side) | NIKON / Canon / Fujifilm / Sony / Kodak text boards + upper row (passport photo, camera repair, denture specialist), AI-painted dealer board (z 25) + denture board (z 95) from `public/img/`, giant tooth, tripod photographer |
| 92 | Akhbar stall (x<0) | Paper stacks on table, papers clipped on string, seller holds one overhead; second newsboy works the bus stop queue (z 334) |
| 105–470 | Patri-walas (both sides) | 8 spread cloths: sunglasses / toys / chappals + seated sellers |
| 140/480/720 | Parked yellow-black taxis | |
| 160 | Stoodent Biryani billboard (x>0) | AI-generated print (`public/img/billboard_biryani.jpg`), 9.6×5.4 plane |
| 185 / 415 | Overflowing KMC dumpsters | Blue rusty boxes, garbage heaped over rim, litter halo, crow |
| 182 | **Rainbow Centre** (x<0) | Plaza facade w/ rainbow strip + CD/DVD mini-signs |
| 235 | Chai dhaba (x>0) | Bench + charpai + sitters |
| 300 | **Khyber Hotel** (x>0) | Curved colonial, continuous green balconies, sign band |
| 340 | Bus stop + parked painted minibus (x<0) | |
| 462 | **Bohri Bazaar** arch (x<0) | Side-street gate + stub road |
| 520–760 | **Zainab Market** | Hanging clothes on rails both sides (~350 colored pieces), cloth-bolt tables, gate arch at z 602 (x>0, sign rotY = -π/2!) |
| 775 / 870 | Zebra crossings + side streets | |
| 792 | Dome corner bldg "Limtown Watch Co" (x>0) | Regal Chowk corner |
| 762–790 | Sunday book stalls (x<0) | |
| 868 | **Hotel Metropole** curved corner (x<0) | |
| 945 | **Frere Hall** (x>0, set back) | Two-tone banded Venetian-Gothic, octagonal spire, lawn+fence+trees |
| 1000–1140 | **Clifton Bridge** (short) | Striped rails, water, port cranes + containers BOTH sides, far-shore skyline fills horizon |
| 1150–1370 | Clifton median (x=-6) | Palms alternating leafy trees, green KMC railings. Player clamped ≥ -4.4 here |
| 1230 | **Park Towers** (x>0) | Arch entry + sign |
| 1250–1370 | Buff stone underpass walls both sides | Carved panel texture |
| 1352 | ZAIB FABRIC fashion billboard (x<0) | |
| 1380 | **FINISH** | Arrive state starts |
| 1422 | **Teen Talwar** monument | 3 straight flattened marble blades, beveled tips, dark inscription stripes, flared 4-leg arched bases, UNITY/FAITH/DISCIPLINE labels, maroon brick ring, striped curb, palms, flags |
| 1390/1452 | Under-construction tower + crane (x<0) / **Ocean Tower + Ocean Mall** (x>0) | White tower h≈105, curved blue-glass face, colorful mall panels |

Landmark callout cards (`LANDMARKS` in `main.ts`) fire at their own z values —
keep them in sync if you move scenery.

## Zone behavior (set in `main.ts`)

- Saddar z<1000: traffic `targetCount=18`, player clamp ±10.2, potholes 16,
  110 litter pieces + 12 garbage piles + 2 dumpsters, 26 walkers +
  13 road-crossers (9 concentrated in z<520) + vendor carts + patri-walas.
- Clifton z>1140: `targetCount=9`, 3 potholes, no trash/carts, median clamp.
- Bus race (`traffic.ts`): when a bus spawns at playerZ<880 (55%, one pair max),
  TWO buses spawn side by side in lanes ∓3; speeds oscillate out of phase
  (base 16 ± 3.4) so they trade the lead, never stop, rattle (rotation.z), and
  fire the horn callback every 2.5–6s. Regular buses keep random stops.
- Bus art (modelled on the real decorated Mazdas, ref photos in chat 2026-06-11):
  three route styles — W-11 'swoosh' (blue + white/purple wave), G-7 'jingle'
  (red truck-art lattice + roof sitters), M-1 'classic' (cream + flower chain).
  Every bus gets: shaped CROWN taj (alpha-silhouette plane, wider than the cab:
  stepped shoulders + centre peak, arch panels, gold route plate, spikes +
  feather plumes + side wings), framed windshield glass w/ hanging garland +
  ماشاءاللہ + centre divider (raked back -0.15), visor brow w/ dangling discs,
  painted front (stacked arch pillars, peacock fan over chrome grille, gold
  lash-painted headlights), chrome bumper + guard bars + dangling chains,
  jhalar fringe front AND full-length both skirts (wheels peek below), painted
  doorway in side tex (z≈-2.3 curb side) w/ TWO door-hangers, wing mirrors on
  stalks, roof railing, rear ladder, mudflaps, arched gold window frames w/
  curtain pelmets + passenger heads, scallop roofline, rear "DEKH MAGAR PYAR
  SE ♥" plate. Textures cached per route code in module-level Maps; fringe/taj
  use alphaTest 0.4.

## How the scene is built (`world.ts`)

1. **Atmosphere**: shader-gradient sky dome (frustumCulled=false, depthTest=false,
   follows playerZ — DON'T change these flags, they fix a sky-hole bug), sun
   sprite, hazy morning fog `#d8d2c2`.
2. **Road**: one plane, 512px canvas tile repeating every 16m. Worn paint only —
   NO large dark patches (they tile visibly and read as glitch shadows; this was
   reverted once already).
3. **Front-row buildings**: facade textures from `facades.ts` + photoreal AI
   facades (`public/img/facade_*.jpg`, `tower_*.jpg`). Saddar = 3 procedural + 8
   AI (`facade_1-4` 3-storey colonial @floors 3, `facade_5-8` 4-storey commercial
   @floors 4); Clifton = 2 procedural + 4 AI 9:16 towers (`tower_1-4`, height set
   by the loop, `floors` unused). Merged per style; instanced volume boxes behind;
   `inGap` reserves space for landmarks. AI facades are `photoTex` (direct URL
   load, no chroma key / no SPRITE_VERSION bust — just add new filenames).
   **Rooftops**: every front-row building gets `addRooftop` — parapet rim (front +
   side edges), 1-3 water tanks on steel stands (plastic green/blue/black + steel),
   a stair-head mumty, the odd dish; Clifton adds an AC/plant block. All solid
   colour → folds into the one merged `StaticMerge` mesh. Plus wider height jitter
   (+28% chance of an extra storey) so the cornice line isn't ruler-flat.
4. **Landmarks**: hand-built groups per the reference photos.
5. **Street life**: everything static goes through `StaticMerge` (one mesh).
   Animated: walkers (pace z), crossers (pace x), pigeons (scatter when player
   near Empress Market), all updated in `world.update(playerZ, dt)` and skipped
   when >160 from player.
6. **Trash heaps** (Saddar only): 4 photoreal AI garbage-pile sprites
   `public/img/trash1-4.jpg` (lime-green keyed via `chromaKeyTex`), placed by
   `addTrashPile`/`trashCluster` as billboards facing the rider, merged into one
   mesh per texture. Source 4:3 with the heap on the bottom edge → plane base at
   y=0 plants it. ~78 heaps, densest at the Empress frontage (z 5–270), thinning
   to z 960, then **NONE** — Clifton stays clean (that contrast is sacred). Curb
   zone only (|x| 11–13.7) so heaps never block the lanes.

## Adding new scenery — checklist

- Static + solid color → `S.add(geometry, color, x, y, z, ry?, rx?, rz?)`.
- Textured → own Mesh; share materials where possible.
- Photo/AI-image boards → `photoTex('/img/…')` (files in `public/img/`, JPEG ~80q,
  generated with ElevenLabs Image & Video — keep brands parody except trade signs
  like camera dealers listing real makes). Hanging planes facing riders need
  `rotation.y = Math.PI` or the text mirrors.
- On the x=+15 side, road-facing planes need `rotation.y = -Math.PI/2`.
- Reserve facade gaps in `inGap` zones or buildings will overlap your landmark.
- Add a `LANDMARKS` entry (name + area sub-line) if it's notable.
- Saddar props can spill to x ±12.3 (the squeeze is intentional); keep
  drivable x ∈ [-10.2, 10.2] clear of solid geometry — props are visual only,
  nothing static collides.
