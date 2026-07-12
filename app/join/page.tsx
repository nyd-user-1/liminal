import { JoinForm } from "@/components/marketing/join-form";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Nav } from "@/components/marketing/nav";
import { Icon, type IconName } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Join as a provider · Leuk",
  description: "Grow your practice with Leuk — scheduling, telehealth, AI notes, and billing in one place.",
};

const PERKS: { icon: IconName; label: string }[] = [
  { icon: "calendar", label: "A calendar clients can self-book" },
  { icon: "sparkle", label: "AI-drafted progress notes" },
  { icon: "dollar", label: "Billing, claims, and payments handled" },
];

export default function JoinPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="flex-1">
        <section className="bg-sidebar-bg">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Grow your practice with Leuk
              </h1>
              <p className="mt-4 max-w-md text-lg text-sidebar-text/85">
                Join a network built for behavioral-health clinicians. Spend less time on admin and more with clients.
              </p>
              <ul className="mt-8 flex flex-col gap-3">
                {PERKS.map((p) => (
                  <li key={p.label} className="flex items-center gap-3 text-sidebar-text">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">
                      <Icon name={p.icon} size={16} />
                    </span>
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>
            <JoinForm />
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
