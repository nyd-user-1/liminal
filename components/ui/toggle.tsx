"use client";

import type { ReactNode } from "react";

// Catalog `Toggle` — ~40×22 switch; on = primary track. Row pattern:
// toggle + title(15/600) + muted subtitle.

export function Toggle({
  checked,
  onChange,
  label,
  subtitle,
  disabled,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  subtitle?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-primary" : "bg-field-border"}`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-card transition-transform ${checked ? "translate-x-[20px]" : "translate-x-[2px]"}`}
      />
    </button>
  );
  if (!label) return <span className={className}>{control}</span>;
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {control}
      <span className="text-[15px] font-semibold text-text">
        {label}
        {subtitle && <span className="block text-sm font-normal text-text-muted">{subtitle}</span>}
      </span>
    </div>
  );
}
