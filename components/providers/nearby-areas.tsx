import Link from "next/link";

// Nearby areas — the browse-link treatment from the /therapists directory
// index (components/marketing/therapist-directory.tsx): column-major a→z fill,
// a hover pill, and an up-right arrow that fades in. These were dead text
// before; every one is a real place with real providers in it, so each is a
// link into a pre-filtered /find-care search.
//
// The field is the mint wash rather than a white Card, per Brendan. On the
// directory index the pill is a *darker cream* against the cream ground, and
// that same idea on white surface gives you a cream pill you can barely see.
// Mint ground + teal-200 pill is the same one-step-darker move with enough
// contrast to actually register as a hover.

export function NearbyAreas({ areas }: { areas?: string[] }) {
  if (!areas || areas.length === 0) return null;
  return (
    <div className="rounded-card bg-primary-wash p-6">
      <h2 className="mb-4 text-[19px] font-semibold text-primary-deep">Nearby areas</h2>
      {/* column-major fill: each column reads a→z top-to-bottom before the next */}
      <ul className="columns-2 gap-8">
        {areas.map((a) => (
          <li key={a} className="mb-1 break-inside-avoid">
            <Link
              href={`/find-care?city=${encodeURIComponent(a)}`}
              className="group -mx-2 flex items-center justify-between gap-2 rounded-field px-2 py-1.5 text-[15px] text-text-body transition-colors hover:bg-primary-weak hover:text-primary-deep"
            >
              {a}
              <span aria-hidden className="text-primary-deep opacity-0 transition-opacity group-hover:opacity-100">
                ↗
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
