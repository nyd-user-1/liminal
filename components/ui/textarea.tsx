import type { TextareaHTMLAttributes } from "react";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/field";

// Catalog `Textarea` — multi-line Field.

export function Textarea({
  label,
  required,
  hint,
  error,
  id,
  className = "",
  rows = 4,
  ...rest
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const inputId = id ?? rest.name;
  return (
    <div className={className}>
      {label && (
        <FieldLabel htmlFor={inputId} required={required}>
          {label}
        </FieldLabel>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={`w-full rounded-field border bg-surface px-3 py-2.5 text-[15px] text-text placeholder:text-text-muted outline-none transition-colors focus:border-field-border-focus disabled:bg-[#E5E7EB] ${error ? "border-danger focus:border-danger" : "border-field-border"}`}
        {...rest}
      />
      {error ? <FieldError>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}
