import type { InputHTMLAttributes, ReactNode } from "react";

// Catalog `Radio` — primary-ring circle, selected = primary dot;
// label 15/500 + optional muted sub-label.

export function Radio({
  label,
  subLabel,
  className = "",
  ...rest
}: { label?: ReactNode; subLabel?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const dot = (
    <span className="relative inline-flex h-5 w-5 shrink-0">
      <input
        type="radio"
        className="peer h-5 w-5 cursor-pointer appearance-none rounded-full border-[1.5px] border-field-border bg-surface transition-colors checked:border-primary disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      />
      <span className="pointer-events-none absolute inset-0 m-auto h-2.5 w-2.5 scale-0 rounded-full bg-primary transition-transform peer-checked:scale-100" />
    </span>
  );
  if (!label) return <span className={className}>{dot}</span>;
  return (
    <label className={`inline-flex cursor-pointer items-start gap-2.5 ${className}`}>
      {dot}
      <span className="text-[15px] font-medium text-text">
        {label}
        {subLabel && <span className="block text-sm font-normal text-text-muted">{subLabel}</span>}
      </span>
    </label>
  );
}
