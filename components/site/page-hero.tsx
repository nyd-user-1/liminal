import type { ReactNode } from "react";
import { Reveal } from "@/components/marketing/reveal";
import { CtaLink } from "./cta-link";

// Interior-page hero — eyebrow + display H1 + lede + CTAs, with an optional
// illustration or aside on the right. Marketing display type on a pale wash,
// matching the home page's grammar. Owns the page's single H1 (marketing
// surfaces render their own H1). NEW (public marketing site).

export function PageHero({
  eyebrow,
  title,
  lede,
  primary,
  secondary,
  ground = "page",
  illo,
  aside,
  innerClassName = "",
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
  ground?: "wash" | "surface" | "canvas" | "page";
  illo?: { src: string; alt: string; width: number; height: number };
  aside?: ReactNode;
  innerClassName?: string;
  children?: ReactNode;
}) {
  const groundCls = { wash: "bg-primary-wash", canvas: "bg-canvas", surface: "bg-surface", page: "bg-page" }[ground];
  const twoCol = Boolean(illo || aside);
  return (
    <section className={groundCls}>
      <div
        className={`mx-auto w-full max-w-6xl px-6 py-20 sm:py-28 ${twoCol ? "lg:grid lg:grid-cols-2 lg:items-center lg:gap-16" : ""} ${innerClassName}`}
      >
        <div className={twoCol ? "" : "max-w-3xl"}>
          {eyebrow && (
            <p className="mkt-rise text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          )}
          <h1
            className="mkt-rise mkt-d1 mt-4 text-balance font-display font-extrabold tracking-[-0.02em] text-text"
            style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.03 }}
          >
            {title}
          </h1>
          {lede && (
            <p className="mkt-rise mkt-d2 mt-5 max-w-xl text-pretty text-lg leading-relaxed text-text-body sm:text-xl">
              {lede}
            </p>
          )}
          {(primary || secondary) && (
            <div className="mkt-rise mkt-d3 mt-8 flex flex-col gap-3 sm:flex-row">
              {primary && (
                <CtaLink href={primary.href} arrow>
                  {primary.label}
                </CtaLink>
              )}
              {secondary && (
                <CtaLink href={secondary.href} tone="secondary">
                  {secondary.label}
                </CtaLink>
              )}
            </div>
          )}
          {children}
        </div>

        {illo && (
          <Reveal className="mt-10 lg:mt-0 lg:order-last">
            <img src={illo.src} alt={illo.alt} width={illo.width} height={illo.height} className="block w-full" loading="eager" />
          </Reveal>
        )}
        {aside && <div className="mt-10 lg:mt-0 lg:order-last">{aside}</div>}
      </div>
    </section>
  );
}
