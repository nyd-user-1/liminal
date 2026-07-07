import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { FOOTER_COLUMNS, CRISIS_LINES } from "@/lib/site-content";

// My public-site footer — models the existing marketing footer's navy brand
// block and carries the SAME crisis resources (988 / 741741 / 911) on every
// page, per the brief's mandatory rule. Deliberately separate from
// components/marketing/marketing-footer.tsx (owned by the home redesign) so the
// two sessions don't collide. NEW (public marketing site).

const LIGHT_LOGO = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/logos/brand/liminal-light.png";

export function SiteFooter() {
  return (
    <footer className="bg-sidebar-bg text-sidebar-text">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/home-2" aria-label="Liminal home" className="inline-block">
              <img src={LIGHT_LOGO} alt="Liminal" className="h-8 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-sidebar-text/80">
              Therapy and psychiatric care across New York — and the connected system practices use to deliver it.
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.label}>
              <h3 className="text-sm font-semibold text-white">{col.label}</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {col.links?.map((l) => (
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

        {/* Crisis + contact — crisis resources are permanent on every page. */}
        <div className="mt-12 grid gap-8 border-t border-white/10 pt-8 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-white">In crisis? Help is available 24/7.</h3>
            <ul className="mt-3 flex flex-col gap-3 text-sm">
              {CRISIS_LINES.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5">
                  <Icon name={c.icon} size={16} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <span className="block font-medium text-white">{c.label}</span>
                    <span className="block text-sidebar-text/70">{c.detail}</span>
                  </span>
                </li>
              ))}
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
          © 2026 Liminal. Provider directory data sourced from NY State (OMH) and NY Medicaid open data. Provider cards
          shown on the homepage are placeholder examples.
        </p>
      </div>
    </footer>
  );
}
