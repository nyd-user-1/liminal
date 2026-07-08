import Link from "next/link";

// Reusable marketing band — the "are you a provider?" invitation. Mint field,
// centered, one outline CTA. Used on the home page and shown in the design system.
export function ProviderCta({
  heading = "Are you a mental health care provider or group practice?",
  body = "Offer affordable, in-network care without the administrative burden. So you can focus on what matters most.",
  ctaLabel = "Learn more",
  href = "/join",
}: {
  heading?: string;
  body?: string;
  ctaLabel?: string;
  href?: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="rounded-card bg-primary-wash px-6 py-16 text-center">
        <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-bold tracking-tight text-primary-deep sm:text-4xl">
          {heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-text-body">{body}</p>
        <Link
          href={href}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-field border border-border bg-surface px-6 text-[15px] font-medium text-text transition-colors hover:border-primary hover:text-primary"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
