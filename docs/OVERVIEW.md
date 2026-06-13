# Overview — what this is and why

**Bykea ki Sawari** is a small 3D arcade game: you're a Bykea-style motorcycle-taxi
rider in Karachi. Pick up a passenger at Empress Market (Saddar), haggle the fare,
survive the bazaar traffic, drop them at Teen Talwar (Clifton). Playable in any
browser, mobile-first (touch controls), no install.

## The actual goal (read this first)

The game exists to grow the owner's X/Twitter following from zero. Every design
decision optimizes for **shareable 45–70 second clips** and **"that's MY city"
recognition** from Pakistani viewers. It is not trying to be a deep game; it is
trying to be a perfect tweet.

Consequences:
- One run = one tweet-video length. Don't make the route longer.
- Recognizability beats polish. A janky-but-real Empress Market beats a beautiful
  generic building. When in doubt, pull reference photos (owner drops them in
  `~/Desktop/saddar` and `~/Desktop/clifton`) and copy reality.
- Built-in virality hooks are sacred: the player's X handle on the number plate,
  the roast/review score card, the "Post on 𝕏" button, landmark callout cards
  (viewers must know where the rider is), Urdu voice lines.
- The owner posts dev updates as content. Small, demoable features > big systems.

## Tone & brand rules

- Humor is desi and affectionate, never mean. Roman Urdu in UI ("Itne mein nahi
  bhai 🤨"), Urdu script in voice generation.
- **Bykea**: the title uses the **Bykea** name; the rider wears a Bykea-green
  helmet + jacket. Treat as parody / satire.
- **Everything else is parody**: Stoodent Biryani, Sarvis Shoes, Disco Bakery
  (real but iconic-cultural), Limtown Watch Co, JAZZBA 4G, THANDA COLA.
- Real PLACES keep real names: Empress Market, Zainab Market, Rainbow Centre,
  Khyber Hotel, Bohri Bazaar, Regal Chowk, Hotel Metropole, Frere Hall,
  Park Towers, Ocean Tower/Mall, Teen Talwar.
- No politics, no real people, no religion jokes. Mosque/minaret appear as
  scenery only, treated respectfully.

## The Karachi contrast (core aesthetic)

- **Saddar (z 0–1000)**: morning rush — jammed traffic (18 vehicles), narrow road
  (wide footpaths), vendor carts eating into lanes, trash piles, people crossing
  anywhere, dense signboards, wire chaos, bunting, crowds.
- **Clifton (z 1140–1380)**: clean, calm — light traffic (9), no trash, smooth
  road, palm median with green KMC railings, boundary walls with bougainvillea,
  Ocean Tower skyline.

Keep this contrast intact; it's the emotional arc of every run.
