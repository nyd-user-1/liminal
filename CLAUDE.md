# Liminal — agent conventions

All-in-one practice management + EHR (Next 16 App Router · React 19 · Tailwind v4 · Neon serverless SQL). Full conventions + entity model: `BUILD_SPEC.md`. Design-system spec: the Component Catalog in Brendan's Obsidian vault (`~/Vaults/hq/Carepatron/Design System/`).

## The one rule that outranks the others

**Reuse the design system — never create a new primitive or duplicate a feature component.** The kit has ~44 primitives (`components/ui/*`) and ~30 feature components. Browse them live at `/design-system` (sign in first); every card there has click-to-copy import lines, and the page's "Copy manifest" button emits the full inventory. If no primitive fits, compose existing ones; adding a genuinely new primitive requires saying so explicitly in your report.

## Canonical layout rules (never re-litigate)

- **One H1 per page, and it lives in the TopBar strip** — route-derived in `components/shell/topbar.tsx` (icon + title left, page actions + bell + UserChip right). Pages NEVER render their own page-level H1/PageHeader in content; page actions go through `TopBarActions` (`components/shell/topbar-slot.tsx`). Exceptions: entity headers on detail pages (client record, invoice) and full-screen surfaces (calls, print, note sheet). New page? Add its route to `ROUTE_TITLES` in topbar.tsx.

## Conventions (short form)

- Imports via `@/*`; UI kit exports are named. Theme tokens are CSS vars in `app/globals.css` (`bg-primary`, `bg-canvas`, `border-border`, status tints `bg-success-tint text-success`, `rounded-field/card`, `shadow-card/menu`). Navy sidebar `#1C2440`, teal primary `#3F8290`, amber accent `#F0AE55`.
- Data: `lib/repos/<domain>.ts` only — each function branches `hasDb ? sql : mockStore()`. **Normalize dates**: Neon returns `Date` objects; repos must return ISO strings (helpers `isoDateTime`/`isoDateOnly` in `lib/format.ts`). Mocks in `lib/mock/*` mirror `sql/002_seed.sql`.
- API routes: `requireUser()`/`requireRole()` from `@/lib/auth`, catch `AuthError` → status; `logEvent` (append-only audit) on PHI reads/writes. Never log PHI.
- Server components by default; lean code, no speculative abstraction.
- Dev: `npm run dev` → port **3010**. Logins `brendan@liminal.demo` (practitioner) / `casey@liminal.demo` (client), password `demo`. `.env.local` may hold a LIVE Neon `DATABASE_URL` — clean up any test rows you create.
- Git: stage files explicitly (never `git add -A` — multiple sessions share this tree). Commit trailers per the harness defaults.
