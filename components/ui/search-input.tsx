import type { InputHTMLAttributes } from "react";
import { Icon } from "@/components/ui/icons";

// Catalog `SearchInput` — input with leading search icon.

export function SearchInput({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        type="search"
        className="h-10 w-full rounded-field border border-border bg-surface pl-10 pr-3 text-[15px] text-text placeholder:text-text-muted outline-none transition-colors focus:border-field-border-focus"
        {...rest}
      />
    </div>
  );
}
