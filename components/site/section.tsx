import type { ReactNode } from "react";

// Public-site section scaffolding. The design system has no Section/Container
// primitive, so this composes the home page's own convention
// (`mx-auto max-w-6xl px-6 py-24 sm:py-32`, alternating surface/canvas/wash
// grounds) into one reusable wrapper. NEW (public marketing site) — flagged for
// review; if the team prefers, this could graduate into components/ui.

type Ground = "surface" | "canvas" | "wash" | "page";

const GROUND: Record<Ground, string> = {
  surface: "bg-surface",
  canvas: "bg-canvas",
  wash: "bg-primary-wash",
  page: "bg-page",
};

export function Section({
  ground = "surface",
  id,
  className = "",
  innerClassName = "",
  children,
}: {
  ground?: Ground;
  id?: string;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${GROUND[ground]} ${className}`}>
      <div className={`mx-auto w-full max-w-6xl px-6 py-24 sm:py-32 ${innerClassName}`}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-[0.18em] text-primary ${className}`}>{children}</p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={`${align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"} ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        className={`${eyebrow ? "mt-4" : ""} text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl`}
      >
        {title}
      </h2>
      {lede && <p className="mt-4 text-pretty text-lg leading-relaxed text-text-body">{lede}</p>}
    </div>
  );
}
