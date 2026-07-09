import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";
import { CARE_TYPE_TOPICS, CONDITION_LINKS, PARTNER_LINKS, PROVIDER_LINKS } from "@/lib/site-content";

// Public marketing footer — navy brand block: link columns, a crisis-support
// note (a mental-health site should always surface these), practice contact,
// and the data-source line.
//
// Doubles as a running site map while the public pages are still being built:
// every live public route is linked from one of these columns, plus an
// "Other" column for pages that exist in the repo but aren't decided yet
// (ship or delete) — audit surface, remove once the site settles.

const COLUMNS: Array<{ heading: string; note?: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Find care",
    links: [
      { label: "Find a provider", href: "/find-care" },
      { label: "Therapists", href: "/therapists" },
      { label: "Psychiatrists", href: "/psychiatrists" },
      { label: "Psychiatric NP", href: "/psychiatric-np" },
      { label: "Virtual therapy", href: "/find-care?type=virtual" },
      { label: "Book with Liminal", href: "/book/liminal" },
    ],
  },
  {
    heading: "Care types",
    links: CARE_TYPE_TOPICS.map((t) => ({ label: t.label, href: `/care/${t.slug}` })),
  },
  {
    heading: "Conditions",
    links: CONDITION_LINKS,
  },
  {
    heading: "For providers",
    links: [
      ...PROVIDER_LINKS.map(({ label, href }) => ({ label, href })),
      { label: "Refer a provider", href: "/join?ref=1" },
      { label: "Provider portal", href: "/sign-in" },
    ],
  },
  {
    heading: "Partners",
    links: PARTNER_LINKS,
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "/company/about" },
      { label: "Press", href: "/company/press" },
      { label: "Careers", href: "/company/careers" },
    ],
  },
  {
    heading: "Other",
    note: "Exists — not decided yet",
    links: [{ label: "Home v2 (WIP)", href: "/home-2" }],
  },
];

function CrisisLine({ icon, label, detail }: { icon: IconName; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon name={icon} size={16} className="mt-0.5 shrink-0 text-accent" />
      <span>
        <span className="block font-medium text-white">{label}</span>
        <span className="block text-sidebar-text/70">{detail}</span>
      </span>
    </li>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-dusk-deep text-sidebar-text">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_3fr]">
          <div>
            <Link href="/" aria-label="Liminal home" className="inline-block">
              <img
                src="https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/logos/brand/liminal-light.png"
                alt="Liminal"
                className="h-8 w-auto"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-sidebar-text/80">
              Find licensed mental-health care across New York — and the all-in-one platform practices use to deliver it.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <h3 className={`text-sm font-semibold ${col.note ? "text-accent" : "text-white"}`}>{col.heading}</h3>
                {col.note && <p className="mt-0.5 text-xs text-sidebar-text/50">{col.note}</p>}
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        className="group -mx-2 flex items-center justify-between rounded-field px-2 py-1.5 text-sidebar-text/80 transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        {l.label}
                        <span aria-hidden className="text-white opacity-0 transition-opacity group-hover:opacity-100">
                          ↗
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Crisis + contact */}
        <div className="mt-12 grid gap-8 border-t border-white/10 pt-8 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-white">In crisis? Help is available 24/7.</h3>
            <ul className="mt-3 flex flex-col gap-3 text-sm">
              <CrisisLine icon="phone" label="988 Suicide & Crisis Lifeline" detail="Call or text 988" />
              <CrisisLine icon="message" label="Crisis Text Line" detail="Text HOME to 741741" />
            </ul>
            <p className="mt-3 text-sm text-sidebar-text/70">If this is an emergency, call 911.</p>
          </div>
          <div className="md:text-right">
            <h3 className="text-sm font-semibold text-white">Visit us</h3>
            <address className="mt-3 text-sm not-italic leading-relaxed text-sidebar-text/80">
              108 West 39th St, Ste 1006 · New York, NY 10018
            </address>
            <p className="mt-2 text-sm text-sidebar-text/80">
              Call or text{" "}
              <a href="tel:+13322964649" className="text-white hover:underline">
                (332) 296-4649
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-6 py-5 text-xs text-sidebar-text/60">
          © 2026 Liminal. Provider directory data sourced from NY State (OMH) and NY Medicaid open data.
        </p>
      </div>
    </footer>
  );
}
