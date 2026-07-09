import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/tooltip";
import { ProviderIllustration } from "@/components/providers/provider-illustration";
import type { AvatarHue } from "@/lib/types";

// Homepage "meet a few providers" card — the old testimonial rail's
// replacement. Leads to the real /providers/[slug] page (or /find-care for
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
  href: string;
};

const pillBase =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-field px-4 text-[15px] font-medium transition-colors";

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
      className="relative flex w-[560px] shrink-0 gap-5 rounded-card border border-page-edge bg-surface p-5 transition-colors hover:border-primary sm:w-[600px]"
    >
      <div className="absolute right-3 top-3 z-10">
        <Tooltip label={careType.label} placement="top">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-[#F3F4F6]">
            <Icon name={careType.icon} size={18} className="fill-primary-wash text-text" />
          </span>
        </Tooltip>
      </div>

      <ProviderIllustration
        name={p.name}
        avatarHue={p.avatarHue}
        illustrationKey={p.illustrationKey}
        directoryId={p.directoryId}
        className="mt-4 aspect-square w-[168px] shrink-0 self-start object-cover"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-balance font-display text-[20px] font-bold leading-tight text-primary">{p.name}</h3>
        <p className="mt-0.5 text-[14px] text-text-body">{p.credentialLine}</p>

        <div className="mt-2 flex items-center gap-1.5 text-[14px] text-text">
          <Icon name="star" size={15} className="fill-current text-accent" />
          <span className="font-semibold">{p.rating.toFixed(1)}</span>
          <span className="text-text-muted">({p.reviewCount})</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[14px] text-text-body">
          <Icon name="calendar-check" size={15} className="shrink-0 text-primary" />
          Available {p.availableLabel}
        </div>

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
