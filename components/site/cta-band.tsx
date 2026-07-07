import { Reveal } from "@/components/marketing/reveal";
import { Section } from "./section";
import { CtaLink } from "./cta-link";

// Closing call-to-action band — centered heading, optional illustration, one or
// two CTAs. NEW (public marketing site).

export function CtaBand({
  eyebrow,
  title,
  lede,
  primary,
  secondary,
  ground = "surface",
  illo,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  ground?: "surface" | "canvas" | "wash";
  illo?: { src: string; alt: string; width: number; height: number };
}) {
  return (
    <Section ground={ground} innerClassName="text-center">
      <div className="mx-auto max-w-2xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}
        <h2
          className={`${eyebrow ? "mt-4" : ""} text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-[42px]`}
        >
          {title}
        </h2>
        {lede && <p className="mx-auto mt-4 max-w-lg text-pretty text-lg text-text-body">{lede}</p>}
      </div>

      {illo && (
        <Reveal className="mx-auto mt-10 max-w-4xl">
          <img src={illo.src} alt={illo.alt} width={illo.width} height={illo.height} className="block w-full" loading="lazy" />
        </Reveal>
      )}

      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <CtaLink href={primary.href} arrow>
          {primary.label}
        </CtaLink>
        {secondary && (
          <CtaLink href={secondary.href} tone="secondary">
            {secondary.label}
          </CtaLink>
        )}
      </div>
    </Section>
  );
}
