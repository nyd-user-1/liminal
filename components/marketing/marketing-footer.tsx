import Link from "next/link";
import { Logo } from "@/components/ui/logo";

// Public marketing footer — navy brand block with practice contact details.

export function MarketingFooter() {
  return (
    <footer className="bg-sidebar-bg text-sidebar-text">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo variant="onNavy" size="md" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-sidebar-text/80">
            All-in-one practice management and EHR — scheduling, telehealth, AI notes, and billing for
            behavioral-health practices.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Visit us</h3>
          <address className="mt-3 text-sm not-italic leading-relaxed text-sidebar-text/80">
            108 West 39th St, Ste 1006
            <br />
            New York, NY 10018
          </address>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Contact</h3>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-sidebar-text/80">
            <li>
              Call or text{" "}
              <a href="tel:+13322964649" className="text-white hover:underline">
                (332) 296-4649
              </a>
            </li>
            <li>Fax (332) 296-7418</li>
            <li>
              <Link href="/book/liminal" className="font-medium text-white hover:underline">
                Book an appointment →
              </Link>
            </li>
          </ul>
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
