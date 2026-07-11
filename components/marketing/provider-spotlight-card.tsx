import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/tooltip";
import { ProviderIllustration } from "@/components/providers/provider-illustration";
import { RatingAvailability } from "@/components/providers/rating-availability";
import type { PublicResult } from "@/app/api/directory/public-search/route";
import { directoryRatingFor, directoryYearsFor } from "@/lib/directory-rating";
import type { AvatarHue } from "@/lib/types";

// Homepage "meet a few providers" card — the old testimonial rail's
// replacement. Leads to the real /providers/[slug] page (or /providers for
// the not-yet-wired spotlight entries), so it's composed to *feel* like that
// page: same ProviderIllustration system (illustrations, not photos — no
// photo data exists for any provider, real or directory). Kept deliberately
// terse — no quote, no specialty tags — per a dev-tools mockup that trimmed
// the card down to photo, name, credential, rating, availability, and the two
// CTAs. `quote`/`specialties`/`moreCount` stay on the type (still authored,
// still real data) in case a denser variant wants them later; this card just
// doesn't render them. Rating/review-count is a display-only field with no
// backing data yet (design lead's call — wire it up later).
//
// The whole card is one Link (not just the two CTA pills), so "View profile"
// / "Book session" are inert spans styled as buttons — nesting real <a> tags
// inside the card-level Link isn't valid HTML, and both already point at the
// same href today anyway.

export type CareType = "medication" | "therapy" | "other";

export type ProviderSpotlight = {
  id: string;
  name: string;
  credentialLine: string;
  rating: number;
  reviewCount: number;
  availableLabel: string;
  quote: string;
  specialties: string[];
  moreCount: number;
  careType: CareType;
  illustrationKey?: string | null;
  avatarHue?: AvatarHue;
  directoryId?: string;
  /** Takes priority over illustrationKey/directoryId — see ProviderIllustration. */
  photoUrl?: string | null;
  href: string;
};

const pillBase =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-field px-4 text-[15px] font-medium transition-colors";

// Role/credential strings sometimes carry the full license expansion in parens —
// "APRN-CNP (Advanced Practice Registered Nurse - Certified Nurse Practitioner)".
// The card wants just the credential, so drop parentheticals and collapse the
// whitespace they leave behind.
function shortenCredential(s: string): string {
  return s.replace(/\s*\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim();
}

// Care-type badge in the card's top-right corner — same grey chip + two-tone
// icon (navy line, pale-teal fill via `fill-primary-wash`, not a hardcoded
// color) as components/providers/info-row.tsx uses on the provider profile
// page. The Tooltip primitive already portals to <body>, which is what keeps
// its label from being clipped by the rail's overflow-x-auto scroller.
const CARE_TYPE_META: Record<CareType, { icon: IconName; label: string }> = {
  medication: { icon: "pill-bottle", label: "Medication" },
  therapy: { icon: "message-circle-heart", label: "Therapy" },
  other: { icon: "activity", label: "Other" },
};

export function ProviderSpotlightCard({ p }: { p: ProviderSpotlight }) {
  const careType = CARE_TYPE_META[p.careType];

  return (
    <Link
      href={p.href}
      className="relative flex w-[630px] shrink-0 gap-5 rounded-card border border-page-edge bg-surface p-5 transition-colors hover:border-primary sm:w-[670px]"
    >
      <div className="absolute right-3 top-3 z-10">
        <Tooltip label={careType.label} placement="top">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface shadow-card">
            <Icon name={careType.icon} size={18} className="fill-primary-wash text-text" />
          </span>
        </Tooltip>
      </div>

      <ProviderIllustration
        name={p.name}
        avatarHue={p.avatarHue}
        illustrationKey={p.illustrationKey}
        directoryId={p.directoryId}
        photoUrl={p.photoUrl}
        className="h-[250px] w-[250px] shrink-0 self-start object-cover"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-balance font-display text-[28px] font-bold tracking-tight leading-tight text-primary">
          {p.name}
        </h3>
        <p className="mt-0.5 text-[14px] text-text-body">{shortenCredential(p.credentialLine)}</p>

        <RatingAvailability
          rating={p.rating}
          reviewCount={p.reviewCount}
          availableLabel={p.availableLabel}
          className="mt-2"
        />

        <div className="mt-auto flex gap-2 pt-3">
          <span className={`${pillBase} border border-border bg-surface text-primary`}>View profile</span>
          <span className={`${pillBase} bg-primary text-white`}>Book session</span>
        </div>
      </div>
    </Link>
  );
}

export function ProviderSpotlightRail({ providers }: { providers: ProviderSpotlight[] }) {
  return (
    <div className="no-scrollbar flex gap-6 overflow-x-auto scroll-smooth pb-2 pl-[max(24px,calc(50vw_-_552px))] pr-[max(24px,calc(50vw_-_552px))]">
      {providers.map((p) => (
        <ProviderSpotlightCard key={p.id} p={p} />
      ))}
    </div>
  );
}

// ── find-care variant ─────────────────────────────────────────────────────────
// Same card, same layout, driven by the live PublicResult search shape instead
// of authored content, keyed on `bookable`:
//   - bookable Liminal practitioners: identical to the homepage card — rating,
//     next availability, View profile + Book session, whole card → /providers/[slug].
//   - the ~116k directory rows: same shape, swapped content. People keep their
//     profession line + whole-card profile link; programs/facilities show
//     address where the credential line was, a seeded "serving for N years"
//     where availability was (see directoryRatingFor — the placeholder-rating
//     convention), and real CTAs: tel: "Call the program" + /programs/[id].
// Programs use real <a> pills, so their card root is a div (no nested anchors).

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMhotrs\b/i, "MHOTRS");
}

// `@container` + `@xl:` below key these breakpoints off the card's own
// rendered width, not the viewport — required now that the card can render
// either full-width (1-col) or half-width (2-col) at the same viewport size.
// See components/marketing/providers-search.tsx's results grid.
const findCareCardClass =
  "relative flex w-full @container gap-4 rounded-card border border-page-edge bg-surface p-5 transition-colors @xl:gap-5";
const findCareArtClass =
  "h-[9.375rem] w-[9.375rem] shrink-0 self-start object-cover @xl:h-[15.625rem] @xl:w-[15.625rem]";
const findCareTitleClass =
  "text-balance font-display text-[1.375rem] font-bold tracking-tight leading-tight text-primary @xl:text-[1.75rem]";

function findCareChip(r: PublicResult): { icon: IconName; label: string } {
  if (r.kind === "program") return { icon: "hand-heart", label: "Program" };
  return /psychiatr|nurse|np\b/i.test(r.subtitle ?? "") ? CARE_TYPE_META.medication : CARE_TYPE_META.therapy;
}

export function FindCareSpotlightCard({ r }: { r: PublicResult }) {
  const chip = findCareChip(r);
  const isProgram = r.kind === "program";
  const seeded = directoryRatingFor(r.id);
  const locationLine = [r.city ?? r.address, r.county].filter(Boolean).join(", ");

  const chipEl = (
    <div className="absolute right-3 top-3 z-10">
      <Tooltip label={chip.label} placement="top">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface shadow-card">
          <Icon name={chip.icon} size={18} className="fill-primary-wash text-text" />
        </span>
      </Tooltip>
    </div>
  );

  if (!isProgram) {
    // A person — bookable Liminal practitioner or directory (NPI) provider.
    const href = r.slug ? `/providers/${r.slug}` : undefined;
    const rating = r.bookable
      ? { rating: r.rating ?? 5.0, reviewCount: r.reviewCount ?? 0 }
      : seeded;
    const subline = shortenCredential(
      [r.subtitle ? titleCase(r.subtitle) : null, r.credential].filter(Boolean).join(" · "),
    );

    const body = (
      <>
        {chipEl}
        <ProviderIllustration name={r.name} directoryId={r.id} gender={r.gender} className={findCareArtClass} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className={findCareTitleClass}>{r.name}</h3>
          {subline && <p className="mt-0.5 text-[14px] text-text-body">{subline}</p>}
          <RatingAvailability
            rating={rating.rating}
            reviewCount={rating.reviewCount}
            availableLabel={r.bookable ? r.availableLabel : undefined}
            secondLine={
              !r.bookable && locationLine ? { icon: "map-pin", text: locationLine } : undefined
            }
            className="mt-2"
          />
          {/* Only rendered when we hold network data AND they're accepting —
              absence is never surfaced as "not accepting". */}
          {r.acceptingNewPatients && (
            <div className="mt-2">
              <Badge variant="success">Accepting new patients</Badge>
            </div>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            <span className={`${pillBase} border border-border bg-surface text-primary`}>View profile</span>
            {r.bookable && <span className={`${pillBase} bg-primary text-white`}>Book session</span>}
          </div>
        </div>
      </>
    );

    if (!href) return <div className={findCareCardClass}>{body}</div>;
    return (
      <Link href={href} className={`${findCareCardClass} hover:border-primary`}>
        {body}
      </Link>
    );
  }

  // A program/facility — same card shape, swapped content, real anchor CTAs.
  const addressLine = [r.address ? titleCase(r.address) : null, r.city ? titleCase(r.city) : null]
    .filter(Boolean)
    .join(", ");
  const serving = `Serving ${r.city ? titleCase(r.city) : (r.county ?? "New York")} for ${directoryYearsFor(r.id)} years`;

  return (
    <div className={findCareCardClass}>
      {chipEl}
      <span className={`flex items-center justify-center rounded-card bg-canvas ${findCareArtClass}`}>
        <Icon name="hand-heart" size={44} className="fill-primary-wash text-text" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className={findCareTitleClass}>{titleCase(r.name)}</h3>
        {(addressLine || r.agency) && (
          <p className="mt-0.5 text-[14px] text-text-body">{addressLine || r.agency}</p>
        )}
        <RatingAvailability
          rating={seeded.rating}
          reviewCount={seeded.reviewCount}
          secondLine={{ icon: "hand-heart", text: serving }}
          className="mt-2"
        />
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <Link href={`/programs/${r.id}`} className={`${pillBase} border border-border bg-surface text-primary hover:border-primary`}>
            View program page
          </Link>
          {r.phone && (
            <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className={`${pillBase} bg-primary text-white hover:bg-primary-hover`}>
              Call the program
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
