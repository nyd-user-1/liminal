import type { InputHTMLAttributes, ReactNode } from "react";

// Catalog `Checkbox` — 20px square, checked = primary fill + white check.
// Pure styled input; state is the consumer's (checked/onChange or name form post).

export function Checkbox({
  label,
  className = "",
  ...rest
}: { label?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const box = (
    <span className="relative inline-flex h-5 w-5 shrink-0">
      <input
        type="checkbox"
        className="peer h-5 w-5 cursor-pointer appearance-none rounded-[4px] border-[1.5px] border-field-border bg-surface transition-colors checked:border-primary checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      />
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 opacity-0 transition-opacity peer-checked:opacity-100"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
  if (!label) return <span className={className}>{box}</span>;
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2.5 text-[15px] text-text ${className}`}>
      {box}
      {label}
    </label>
  );
}
