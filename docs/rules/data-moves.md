# Data displays move

Counts count up, the queue scrolls, the rail slides — motion that says the system is live. All of it gated behind reduced-motion, which holds every value at rest.

**Why it exists.** A number that was fetched a second ago and a number that was hardcoded last spring look identical when both sit still. Motion is the cheapest available proof that something behind the screen is actually running.

**How to apply.** Count-ups on scoreboard figures, growth on bars, auto-scroll on queues, tooltips on anything with a story behind it. Every one of them checks `prefers-reduced-motion` and renders the final value immediately when it is set — the motion is the garnish, never the mechanism.
