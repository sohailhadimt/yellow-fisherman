# The Yellow Fisherman · concept preview

Immersive 3D website concept for The Yellow Fisherman (Ram Lane, Ashford, Kent). Not the official site; noindex.

- `index.html`, `main.js`, `style.css`: Three.js + GSAP ScrollTrigger site. Procedural 3D (no external models).
- `config.js`: business facts, real menu prices (from the shop's live online menu, read 15 Nov 2026) and sourced review quotes.
- `dashboard.html`: owner orders/leads dashboard. Demo mode (browser storage) until `API_BASE` is set.
- `worker/`: Cloudflare Worker + D1 leads API (not deployed).


## v2: walk-in counter (Nov 2026)
- Hero: cinematic fryer clip (media/hero-fryer*.mp4, mobile gets the 1.5MB version).
- Walk-in: 97 scroll-scrubbed webp frames (media/walk), tap-to-walk button, drag to look around.
- Counter: floating glass menu panels (CSS 3D coverflow, swipe/arrows/dots), real prices from config.js PANELS.
- Tap a dish: photoreal cut-out pops and flies into the tray; live total; meal price applied when a fish is paired with medium chips.
- Steam, embers and lamp bloom: Three.js overlay (main.js `fx`).
- "Wrap it up" opens the same order form; leads go to leads.js / dashboard.html as before.
- Imagery is illustrative; swap media/ for the shop's own photos/footage before launch.
