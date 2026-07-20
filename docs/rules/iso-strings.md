# Repos return ISO strings

Neon hands back `Date` objects; every repo normalizes to ISO strings at the boundary, so no surface ever renders a raw Date.

**Why it exists.** A `Date` that crosses the server/client boundary serializes differently depending on how it got there, and the failure shows up as a hydration mismatch or a timezone-shifted day on a clinical record. Normalizing once, at the repo edge, means no component has to think about it.

**How to apply.** Use the `isoDateTime` and `isoDateOnly` helpers in `lib/format.ts` on every date column a repo returns. The mock branch returns the same shape as the SQL branch — if the two disagree, the bug will only appear in one environment.
