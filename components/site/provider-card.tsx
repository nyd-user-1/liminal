import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { BOOK_HREF, type PlaceholderPractitioner } from "@/lib/site-content";

// Provider card for the "book this week" strip. Renders Leuk's own bookable
// practitioners — here, obvious PLACEHOLDER profiles (John/Jane Doe) with
// example availability. Avatar is initials only (design-system rule). Composed
// entirely from primitives (Avatar, Badge, Icon). NEW (public marketing site).

export function ProviderCard({ p }: { p: PlaceholderPractitioner }) {
  return (
    <div className="flex h-full flex-col rounded-card border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-menu">
      <div className="flex items-start gap-3">
        <Avatar name={p.name} hue={p.hue} size="md" />
        <div className="min-w-0">
          <p className="font-display text-[17px] font-semibold leading-tight text-text">
            {p.name}
            <span className="text-text-muted">, {p.credential}</span>
          </p>
          <p className="mt-0.5 text-sm text-text-body">{p.title}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="info">{p.care}</Badge>
        {p.telehealth && (
          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
            <Icon name="video" size={14} /> Virtual
          </span>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-text-muted">{p.focus.join(" · ")}</p>

      <dl className="mt-4 space-y-1.5 text-sm text-text-body">
        <div className="flex items-center gap-2">
          <Icon name="map-pin" size={15} className="shrink-0 text-text-muted" />
          <dd>{p.borough}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="calendar-check" size={15} className="shrink-0 text-primary" />
          <dd className="font-medium text-text">Next available: {p.nextAvailable}</dd>
        </div>
      </dl>

      <Link
        href={BOOK_HREF}
        className="mt-5 inline-flex h-10 items-center justify-center rounded-field bg-primary px-4 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
      >
        Book a session
      </Link>
    </div>
  );
}

export function ProviderStrip({
  items,
  note = "Example providers — placeholder profiles shown for preview. Real Leuk practitioners and live availability appear here at launch.",
}: {
  items: PlaceholderPractitioner[];
  note?: string;
}) {
  return (
    <>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <ProviderCard key={p.id} p={p} />
        ))}
      </div>
      {note && <p className="mt-6 text-sm text-text-muted">{note}</p>}
    </>
  );
}
