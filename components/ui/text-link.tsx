import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `TextLink` — inline link, optional leading icon. Renders a Next
// <Link> when `href` is given, else a <button>.
//   • wipe      (default) — STANDARD: teal at NORMAL weight, with an underline
//     that wipes in on hover (the .link-wipe animation in globals.css). Teal +
//     the wipe already carry the affordance, so weight is not asked to help;
//     bolding every link is what made dense tables read as all-emphasis.
//   • name      — the wipe at 500, for an entity's own name in its identity
//     column (client, plan, provider). The one place weight earns its keep: it
//     makes the row's SUBJECT findable while everything else stays quiet. Use
//     it for the thing the row IS, never merely for a link that matters.
//   • related   — the RELATED-RECORD treatment: body text under a muted-teal
//     dotted underline at rest; on hover the text goes teal and a solid teal
//     underline WIPES in over the dotted line (the .link-wipe motion), so the
//     dotted rest-line appears to fill in left→right. It means one thing and
//     only one thing: "this value lives in another table; click to go there."
//     Reach for it through the RelatedLink wrapper below, never by hand.

const base = "inline-flex items-center gap-1.5 text-[15px] transition-colors";

const VARIANTS = {
  wipe: "group font-normal text-primary",
  name: "group font-medium text-primary",
  // The dotted rest-underline lives on the wipe span (WIPE_SPAN_EXTRA), not the
  // anchor — an inline-block span won't render the anchor's text-decoration, so
  // the two underlines (dotted rest, solid wipe) must share the one element.
  related: "group font-normal text-text-body hover:text-primary",
} as const;

/** Variants whose underline wipes in on hover — they wrap children in the
 *  .link-wipe span. `related` carries a dotted underline on that same span so
 *  the dotted rest-line is present and the solid teal appears to fill it in. */
const WIPE_VARIANTS = new Set<keyof typeof VARIANTS>(["wipe", "name", "related"]);
const WIPE_SPAN_EXTRA: Partial<Record<keyof typeof VARIANTS, string>> = {
  related: "underline decoration-dotted decoration-primary/50 underline-offset-[3px] group-hover:decoration-primary",
};

export function TextLink({
  href,
  icon,
  variant = "wipe",
  className = "",
  children,
  ...rest
}: {
  href?: string;
  icon?: IconName;
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonHTMLAttributes<HTMLButtonElement>) {
  const content = (
    <>
      {icon && <Icon name={icon} size={16} />}
      {WIPE_VARIANTS.has(variant) ? (
        <span className={`link-wipe ${WIPE_SPAN_EXTRA[variant] ?? ""}`}>{children}</span>
      ) : (
        children
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${base} ${VARIANTS[variant]} ${className}`} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={`${base} ${VARIANTS[variant]} ${className}`} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}

/**
 * A value in this row that IS a record in another table — click to go there.
 *
 * The dotted underline is the whole signal: it says "this crosses over" without
 * competing with the row's own identity link (solid teal, wipe-on-hover) or the
 * row's own drill-down. That is why it stops propagation: inside a table the
 * row click means "open this row", and this means "open the OTHER record".
 *
 * Use it sparingly. If every value on a row is dotted, none of them read as
 * a crossing.
 */
export function RelatedLink({
  href,
  title,
  children,
  ...rest
}: {
  href: string;
  /** Say where it goes, e.g. "Open this billing group". */
  title?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement> & ButtonHTMLAttributes<HTMLButtonElement>, "href" | "title">) {
  return (
    <TextLink
      href={href}
      variant="related"
      title={title}
      onClick={(e) => e.stopPropagation()}
      {...rest}
    >
      {children}
    </TextLink>
  );
}
