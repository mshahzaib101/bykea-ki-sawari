# Audio — voices, SFX, music

Two layers, both routed through one master gain in `src/audio.ts` (mute-safe):

1. **Procedural WebAudio** (zero assets): engine (sawtooth+lowpass, pitch follows
   speed), player horn (two-tone square), crash, pothole thud, kata whoosh,
   ding, cash arpeggio, fallback city rumble.
2. **Generated mp3 clips** in `public/audio/` (≈1.1MB total): 41 Urdu voice
   lines, street ambience loop (replaces the procedural rumble once loaded),
   W-11 musical truck horn, dhol menu-music loop (menu/haggle/card only).

## Voice cast (ElevenLabs, `eleven_multilingual_v2`)

| Character | Voice | id |
|---|---|---|
| Rishta Aunty (passenger) | Lily | `pFZP5JQG7iQjIQuC4Bku` |
| Ganji Swag (passenger) | custom ElevenLabs voice | `xmUckHPNQzEbGJmIWhDR` |
| Danish (student) — RETIRED, clips kept | Liam | `TX3LPaxmHKxFdv7VOQHJ` |
| Saleem Uncle — RETIRED, clips kept | Bill | `pqHfZKP75CvOlQylNhV4` |

**Cast model (2026-06-11):** the player is the anonymous Bykea captain; the two
selectable characters are PASSENGERS (Ganji Swag / Rishta Aunty). Only the
chosen passenger ever speaks during a ride — one character, one voice.

Ganji Swag uses a **custom ElevenLabs voice** (id above — don't reuse outside
this project). His comedic register is written to a Karachi traffic-vlogger
archetype — tics: "abay"/"yaar", sarcastic "maashallah" at wrong-way riders,
"khalli walli", potholes-as-moon.

## The clip ↔ text contract (don't break this)

Three places must stay in sync:

1. `scripts/gen_audio.py` — Urdu-script lines, keyed `{pax}_{category}{index}`
   (e.g. `aunty_crash1`). Files land in `public/audio/`.
2. `src/voices.ts` — `VOICE_COUNTS` says how many clips exist per category
   (aunty/student: crash 3, pothole 2, periodic 3, boost 1, arrive 1; uncle:
   crash 2; singles: greet/accept/counter_ok/counter_no).
3. `src/passengers.ts` — the roman-Urdu display lines. **Array index i must say
   the same thing as clip `{pax}_{cat}{i}`** — `say()` in `main.ts` shows
   `lines[i]` and plays clip `i` together.

Rishta Aunty has the same contract in `src/aunty.ts` (`RISHTA_LINES` +
`RISHTA_COUNTS` ↔ `rishta_*` clips, Lily voice: go 2, ask 8, story 5, crash 3,
pothole 2, jam 2, launde 3, boost 2, pakka 2, arrive 1 + singles greet/haggle0-2
— 34 clips). Her 'ask' questions fire IN ORDER (askIdx) — it's a biodata
interview of the captain; 💍 Rishta Meter (reuses the BP pill, label param)
fills with smooth driving + kata, drops on crash/pothole/boost; maxed = pakka
(+Rs 50 shagun). The old `aunty_*` clips are retired (files kept).

Ganji has the same contract in `src/rider.ts` (`GANJI_LINES` +
`GANJI_VOICE_COUNTS` ↔ `ganji_*` clips: go 2, jam 4, cutoff 5, nohelmet 4,
wrongway 5, pothole 5, crash 4, noise 4, bus 2, boost 4, rant 2, arrive 1,
story 5 — plus haggle singles `ganji_greet` / `ganji_counter_ok` /
`ganji_counter_no`; 50 files). Lines are mined from three real Traffic Tales
episodes he provided (transcripts via ElevenLabs STT). `story` clips are long
(8–15s) mid-ride qisse — fired on calm stretches by main.ts (max 2/ride,
storyCD); `bus` fires from `traffic.onBusStop` (50/50 with `noise`). **Bleep rule:** lines flagged
`bleep: true` show a grawlix (★#$!) where the slang word goes and the mp3 must
NOT contain that word — `sayGanji()` plays `audio.bleep()` (1kHz censor tone),
then the clip ~300ms later.

To add/change a line: edit the Urdu in `gen_audio.py` + the roman text at the
same index in `passengers.ts`, bump `VOICE_COUNTS` if count changed, delete the
old mp3 (script skips existing files), regenerate:

```bash
ELEVEN_KEY=sk_... python3 scripts/gen_audio.py
```

## Key handling (hard rule)

`ELEVEN_KEY` lives ONLY in the shell env when running the script. Never in
source, never in client code — anything shipped to the browser is public.
The key was once pasted in chat; rotate it before/after launch.

Note: ElevenLabs' API is audio-only (verified via their OpenAPI spec). Their
image/video generation is playground-UI only — no API. Don't burn time trying.

## Playback rules

- AudioContext unlocks on the first user gesture (start button) — never autoplay.
- One voice CHANNEL, STRICTLY SEQUENTIAL (user decision 2026-06-12 — no
  mid-sentence cuts, ever): a line only starts once the current one finished.
  - `playVoice(id)` returns false while busy; `force` interrupts and is
    reserved for game-STATE transitions only (greet/accept/counter, arrive) —
    never for in-ride lines.
  - In-ride scheduling: reactions skip if busy (they retry on the next event);
    the BP rant WAITS — bp stays maxed until sayGanji('rant') lands; the fit
    check + waypoint beats use `queueVoice(id, onPlay)` (plays right after the
    current line ends, single pending slot). `bleep()` claims the channel,
    clip follows ~300ms later.
  - Stories only START on open road (speed > 16) so they never block reaction
    lines in the Saddar jam. Chatter watchdog: >2s quiet → story (max 3/ride).
  - `say()`/`sayGanji()` return whether they spoke — call sites must only
    consume cooldowns on `true`.
- All clips `fetch`+decode lazily; missing files fail silently (game must work
  with no audio assets at all).
- Truck horn plays when a W-11 stops within 45 units (`traffic.onBusStop`).
- Landmark cards play `ding()`.
