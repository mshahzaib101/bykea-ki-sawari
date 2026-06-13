# Roadmap

## Shipped (v1.x, 2026-06-11)

- Core loop: haggle → ride → arrive → score card (review + roast + stats + Post on 𝕏)
- 3 passengers (Shamim Aunty / Danish / Saleem Uncle) with 41 ElevenLabs Urdu
  voice lines, weight/mood personalities, exam-time bonus
- Compressed 1380m photo-referenced route (see WORLD.md) with 11 landmark
  callout cards (ride-app notification style)
- Saddar chaos vs Clifton calm zoning (traffic density, trash, road squeeze)
- Traffic: cars, rickshaws (poetry plates), bikes, wrong-way riders, donkey
  carts, W-11 bus that stops suddenly (+ musical horn nearby)
- Kata (near-miss) bonus, potholes, horn that nudges traffic, star mood system
- Morning-haze lighting; pause (chai break); mobile touch controls;
  X handle on the number plate; localStorage best score
- Audio: street ambience, dhol menu music, procedural engine/horn/crash
- "Bykea ki Sawari" branding + start-screen SVG art

## In progress (owner is hand-editing — coordinate before touching)

- **Rider characters**: `RiderChar` in `config.ts` ("Ganji Swag", "Rishta
  Aunty"), `ui.onStart(name, character)` signature — character select UI not
  finished yet
- **Racing W-11 pair**: `racing`/`racePhase`/`hornTimer` fields added to
  `Vehicle` in `traffic.ts` — two buses that trade the lead, honking

## Planned (each one = its own X post)

1. Chai-pani police checkpoint (pay Rs 50 or argue — dice roll)
2. Mudflap shayari unlocks ("Dekh magar pyaar se", "Maa ki dua…")
3. Daily seeded run (same traffic for everyone each day, Wordle-style) +
   shareable challenge links ("beat Ali's ghost")
4. Monsoon mode (flooded patches hide potholes) — release on a real Karachi
   rainy day for the trend
5. Bakra Eid event: the passenger is a goat
6. VIP movement: road closes, protocol convoy, passenger rage
7. Pink/foodpanda rider skin to bait Bykea-vs-foodpanda banter in replies

## Launch checklist

- [ ] Rotate the ElevenLabs key (it was pasted in chat once)
- [ ] `npx vercel` → live URL (share button auto-uses `location.href`)
- [ ] OG image (`og:image` meta is missing — make a 1200×630 poster)
- [ ] Record 30–40s portrait clip, post 8–11pm PKT, playable link in first
      reply, tag @bykea + founder; share the prompt/making-of as follow-up
