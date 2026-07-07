import Link from "next/link";
import type { ReactNode } from "react";

// Public-site call-to-action links. Matches the home page's inline link-buttons
// (h-12 rounded-field, primary teal / bordered secondary) rather than the app
// Button primitive, so these read as marketing CTAs and stay visually in step
// with the home redesign. NEW (public marketing site).

type Tone = "primary" | "secondary";

const TONES: Record<Tone, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-field-border text-text hover:bg-canvas",
};

export function CtaLink({
  href,
  tone = "primary",
  arrow = false,
  className = "",
  children,
}: {
  href: string;
  tone?: Tone;
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const base =
    "group inline-flex h-12 items-center justify-center gap-1.5 rounded-field px-6 text-[15px] font-semibold transition-colors";
  const inner = (
    <>
      {children}
      {arrow && (
        <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">
          →
        </span>
      )}
    </>
  );
  const cls = `${base} ${TONES[tone]} ${className}`;
  if (href.startsWith("http")) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

// The quieter text link — the ".link-wipe" underline + arrow used across the
// home page for secondary navigation.
export function ArrowLink({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-1 text-[15px] font-semibold text-primary ${className}`}>
      <span className="link-wipe">{children}</span>
      <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
