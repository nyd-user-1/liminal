import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";

// Public marketing footer — navy brand block: link columns, a crisis-support
// note (a mental-health site should always surface these), practice contact,
// and the data-source line.

const COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Find care",
    links: [
      { label: "Therapists", href: "https://care.headway.co/therapists" },
      { label: "Psychiatrists", href: "/find-care?type=psychiatrist" },
      { label: "Virtual therapy", href: "/find-care?type=virtual" },
      { label: "Book with Liminal", href: "/book/liminal" },
    ],
  },
  {
    heading: "For providers",
    links: [
      { label: "Join Liminal", href: "/join" },
      { label: "Provider portal", href: "/sign-in" },
      { label: "Refer a provider", href: "/join?ref=1" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "/company/about" },
      { label: "Press", href: "/company/press" },
      { label: "Careers", href: "/company/careers" },
    ],
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
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
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

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold text-white">{col.heading}</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-sidebar-text/80 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
