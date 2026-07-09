import Link from "next/link";

// Custom 404 — modeled on the home's closing dusk CTA (dark dusk-teal ground,
// display headline + warm CTA, a framed watercolour scene). Root-level, so it
// renders full-screen (outside the app shell) for any unmatched route.

const ILLO = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations";

export default function NotFound() {
  return (
    <main
      className="relative flex min-h-screen items-center overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 90% at 80% 12%, color-mix(in oklab, var(--color-accent) 20%, transparent) 0%, transparent 45%), linear-gradient(to bottom, var(--color-dusk) 0%, var(--color-dusk-deep) 100%)",
      }}
    >
      <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-6 py-24 sm:py-28 lg:grid-cols-[24rem_1fr]">
        <div className="max-w-md">
          <p className="mkt-rise text-sm font-semibold uppercase tracking-[0.2em] text-accent">404</p>
          <h1
            className="mkt-rise mkt-d1 mt-3 text-balance font-display font-extrabold tracking-[-0.03em] text-[#f4efe6]"
            style={{ fontSize: "clamp(2.25rem, 4.8vw, 3.75rem)", lineHeight: 1.06 }}
          >
            Not all who wander are lost.
          </h1>
          <p className="mkt-rise mkt-d2 mt-5 max-w-md text-pretty text-lg leading-relaxed text-[#c9d6d4]">
            The page you&apos;re looking for isn&apos;t here.
          </p>
          <div className="mkt-rise mkt-d3 mt-8">
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-field bg-accent px-7 text-[15px] font-semibold text-[#12292f] transition-colors hover:bg-[#e7a244]"
            >
              Back to home
            </Link>
          </div>
        </div>

        <div className="relative">
          <img
            src={`${ILLO}/dusk20.avif`}
            alt="A watercolour illustration — a person sits at dusk before a warm band of light on the horizon."
            width={1600}
            height={900}
            className="mkt-paint mkt-develop mkt-d1 block w-full"
          />
        </div>
      </div>
    </main>
  );
}
