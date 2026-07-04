import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `TextLink` — inline primary link, 600 weight, optional leading icon.
// Renders a Next <Link> when `href` is given, else a <button>.

const base =
  "inline-flex items-center gap-1.5 text-[15px] font-semibold text-primary transition-colors hover:text-primary-hover";

export function TextLink({
  href,
  icon,
  className = "",
  children,
  ...rest
}: {
  href?: string;
  icon?: IconName;
  children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonHTMLAttributes<HTMLButtonElement>) {
  const content = (
    <>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${base} ${className}`} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={`${base} ${className}`} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}
