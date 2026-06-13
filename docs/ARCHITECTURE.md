# Architecture

Vanilla three.js + Vite + TypeScript. No framework, no physics engine, no assets
except generated audio (`public/audio/`) and `public/start-art.svg`. Everything
visual is procedural (canvas textures + box geometry).

## Module map (`src/`)

| File | Owns |
|---|---|
| `main.ts` | Game loop, states, input, camera, collisions/kata/potholes, landmark callouts, UI wiring, `window.__sawari` dev helpers |
| `config.ts` | Route lengths/sections, road lanes, speeds, mood constants, rider characters |
| `world.ts` | The entire static city: atmosphere, road, facades, landmarks, street life, walkers/pigeons/crossers (returns `{ potholes, update(playerZ, dt) }`) |
| `facades.ts` | Canvas-texture generators for building faces, bunting, billboards; color pools |
| `traffic.ts` | NPC vehicles (car/rickshaw/bike/W-11 bus/donkey cart/wrong-way), spawn/despawn around player, honk-nudge, `targetCount` set per-zone by main |
| `player.ts` | Bike + Bykea rider + passenger models, arcade physics (speed/steer/bounce), number-plate canvas |
| `passengers.ts` | The 3 passengers (aunty/student/uncle): dialog lines, haggling, reviews, roasts |
| `rider.ts` | Ganji Swag's rider lines (jam/cutoff/nohelmet/wrongway/rant…), bleep flags, clip manifest |
| `voices.ts` | Manifest mapping passenger dialog → generated mp3 clip ids |
| `audio.ts` | Procedural WebAudio (engine, horn, crash…) + generated-clip playback (voices, ambience, music) |
| `ui.ts` | All DOM: screens, HUD, bubble, landmark card, toasts, score card |

## Game states (`main.ts`)

`menu → haggle → ride → arrive → card → (haggle again | menu)`

- **menu**: start screen visible; idle camera drift; dhol music after first unlock.
- **haggle**: bottom sheet; passenger greet voice; counter-offer allowed once.
- **ride**: physics + traffic + events; HUD; landmark cards; bubble+voice lines.
- **arrive**: auto-brake past `ROUTE.finish`, then payout math.
- **card**: score card (review, roast, stats); Post-on-𝕏 intent; "Agli sawari".
- Pause overlay freezes the loop (Esc or ⏸ button) during ride/arrive only.

## Coordinate system — the gotcha

Camera looks down **+z**. Therefore **+x renders on the SCREEN-LEFT**.
- Input is inverted at the edge: pressing ← adds +1 steer (see `readInput()`).
- Lanes: x = -9 (oncoming, screen-right), -3, 3, 9. Player clamp ±10.6 globally,
  ±10.2 in Saddar (footpaths), ≥ -4.4 in Clifton (median).
- A plane facing the road on the x=+15 side needs `rotation.y = -Math.PI/2`
  (text mirrors if you get it wrong; DoubleSide shows reversed text from behind).

## UI contract

`ui.ts` queries DOM ids from `index.html` — keep them in sync:
`screen-start, screen-haggle, screen-pause, screen-card, hud, player-name,
btn-start/accept/counter/share/again/horn/boost/pause/resume/quit/mute,
hud-fare, hud-stars, route-fill, route-bike, bubble(-avatar/-text),
landmark(-name/-sub), toasts, card-* , stat-*, best-line`.

Layout invariants: landmark card top-center (app-notification style); passenger
bubble bottom-center (~128px up, clears mobile RACE/HORN buttons); they must
never overlap. Score card auto-writes `localStorage['sawari-best']`.

## Performance budget

Target: 60fps on mid-range Android, bundle ≈160KB gzip + ~1.1MB audio.

- ALL static colored props go through `StaticMerge` in `world.ts` → ONE mesh,
  one draw call (vertex colors). Never add loose `Mesh`es for static props.
- Facade planes are merged per texture-style (~16 materials). Building volumes
  and back rows are `InstancedMesh`.
- Only textured/animated things get individual meshes (signs, banners, walkers,
  pigeons, crossers, landmark buildings).
- Blob shadows (no real shadow maps). No post-processing. PixelRatio capped at 2.
- ~400 draw calls / ~15k tris total. Check with `__sawari.info()`.

## Testing

- rAF is throttled to ~0–1fps in hidden/background tabs (incl. preview tools):
  logic barely advances between screenshots. Use `__sawari.jump(z)` (snaps the
  camera too) for spot checks; do real playtests in a visible browser tab.
- `npm run build` runs `tsc` first — strict, `noUnusedLocals`, no TS enums
  (`erasableSyntaxOnly`).
