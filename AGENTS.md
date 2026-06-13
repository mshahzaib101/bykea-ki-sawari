# Bykea ki Sawari — agent context

A 3D Karachi bike-taxi browser game (three.js + Vite + TS). You play a Bykea-style
rider taking passengers from **Empress Market (Saddar) → Teen Talwar (Clifton)**.
Built to be shared on X/Twitter; one run ≈ 45–70s = one tweet video.

**Read `docs/` before changing anything substantial:**

- `docs/OVERVIEW.md` — product goals, brand/tone rules, what's sacred
- `docs/ARCHITECTURE.md` — modules, game states, coordinate gotchas, UI contract
- `docs/WORLD.md` — route map with z-positions, scene construction, perf budget
- `docs/AUDIO.md` — ElevenLabs voice pipeline, clip↔text contract, key handling
- `docs/ROADMAP.md` — shipped vs planned features

## Hard rules

- **Never put the ElevenLabs API key in any source file or client code.** It is
  passed via `ELEVEN_KEY` env var to `scripts/gen_audio.py` only.
- The game title uses the **Bykea** name; treat all commercial brands as
  **parody / satire** ("Stoodent Biryani", "Sarvis Shoes", "Limtown Watch Co").
  Landmark/place names stay real. No real people's names or photos.
- Saddar = rushy/trashy/jammed; Clifton = clean/calm. Keep that contrast.
- Voice clips and dialog text are index-paired — see `docs/AUDIO.md` before
  editing `src/passengers.ts` line arrays.

## Quick commands

```bash
npm run dev      # dev server (vite reads PORT env; see vite.config.ts)
npm run build    # tsc typecheck + production build (dist/, ~160KB gzip + 1.1MB audio)
```

Dev helpers (DEV builds only): `window.__sawari.jump(z)` teleports (snaps camera),
`.demoCard()` shows the score card, `.info()` renderer stats, `.scene/.camera/.THREE`.

**Testing gotcha:** headless/background tabs throttle rAF to ~0–1fps — game logic
barely advances between screenshots. Verify gameplay in a visible browser tab.
