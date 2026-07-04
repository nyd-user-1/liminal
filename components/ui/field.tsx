import type { InputHTMLAttributes, ReactNode } from "react";

// Catalog `Field` — label(14/500 muted) → input(44px, white, field-border,
// r-field) → hint/error. Focus = teal border. Affix slots: prefix ($, dial
// code) · suffix (mins, unit) · trailing (eye toggle, validation icon).

export function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-text-body">
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
    </label>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[13px] text-text-muted">{children}</p>;
}

export function FieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[13px] text-danger">{children}</p>;
}

export const fieldClass =
  "h-11 w-full rounded-field border border-field-border bg-surface px-3 text-[15px] text-text placeholder:text-text-muted outline-none transition-colors focus:border-field-border-focus disabled:bg-[#E5E7EB] disabled:text-text-muted";

export function Input({
  error,
  className = "",
  ...rest
}: { error?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`${fieldClass} ${error ? "border-danger focus:border-danger" : ""} ${className}`}
      {...rest}
    />
  );
}

/**
 * Full field: label + input + optional affixes + hint/error.
 * `prefix`/`suffix` render inside the border (text or icon); `trailing` is an
 * interactive slot flush right (e.g. password eye IconButton).
 */
export function Field({
  label,
  required,
  hint,
  error,
  prefix,
  suffix,
  trailing,
  id,
  className = "",
  ...rest
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  trailing?: ReactNode;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "prefix">) {
  const inputId = id ?? rest.name;
  const bare = !prefix && !suffix && !trailing;
  return (
    <div className={className}>
      {label && (
        <FieldLabel htmlFor={inputId} required={required}>
          {label}
        </FieldLabel>
      )}
      {bare ? (
        <Input id={inputId} error={!!error} {...rest} />
      ) : (
        <div
          className={`flex h-11 w-full items-center rounded-field border bg-surface transition-colors focus-within:border-field-border-focus ${error ? "border-danger" : "border-field-border"}`}
        >
          {prefix && <span className="pl-3 text-[15px] text-text-muted">{prefix}</span>}
          <input
            id={inputId}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-text placeholder:text-text-muted outline-none"
            {...rest}
          />
          {suffix && <span className="pr-3 text-[15px] text-text-muted">{suffix}</span>}
          {trailing && <span className="flex items-center pr-1">{trailing}</span>}
        </div>
      )}
      {error ? <FieldError>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}
