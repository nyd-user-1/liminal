import Link from "next/link";
import { Card } from "@/components/ui/card";

// Nearby areas — the same browse-link treatment as the /therapists directory
// index (components/marketing/therapist-directory.tsx): column-major a→z fill,
// a hover pill, and an up-right arrow that fades in. These were dead text
// before; every one of them is a real place with real providers in it, so each
// is a link into a pre-filtered /find-care search.

export function NearbyAreas({ areas }: { areas?: string[] }) {
  if (!areas || areas.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-4 text-[19px] font-semibold text-text">Nearby areas</h2>
      {/* column-major fill: each column reads a→z top-to-bottom before the next */}
      <ul className="columns-2 gap-8">
        {areas.map((a) => (
          <li key={a} className="mb-1 break-inside-avoid">
            <Link
              href={`/find-care?city=${encodeURIComponent(a)}`}
              className="group -mx-2 flex items-center justify-between gap-2 rounded-field px-2 py-1.5 text-[15px] text-text-body transition-colors hover:bg-page-edge hover:text-text"
            >
              {a}
              <span aria-hidden className="text-primary opacity-0 transition-opacity group-hover:opacity-100">
                ↗
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
