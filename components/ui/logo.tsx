// Liminal brand mark — lowercase "liminal" wordmark with the amber arch over
// the "n" and a teal underline rule. Variants: onNavy (sidebar, auth backdrop)
// · onLight (white surfaces).

const sizes = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
} as const;

export function Logo({
  variant = "onLight",
  size = "md",
  className = "",
}: {
  variant?: "onNavy" | "onLight";
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span
        className={`font-bold lowercase tracking-tight ${sizes[size]} ${variant === "onNavy" ? "text-white" : "text-text"}`}
      >
        limi
        <span className="relative inline-block">
          n
          {/* amber arch over the n */}
          <svg
            viewBox="0 0 10 5"
            className="absolute -top-[0.28em] left-1/2 w-[0.58em] -translate-x-1/2"
            aria-hidden
          >
            <path d="M1 5 A 4 4 0 0 1 9 5" fill="none" stroke="#F0AE55" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
        al
      </span>
      {/* teal underline rule */}
      <span className="mt-1 h-[2.5px] w-full rounded-full bg-teal-500" aria-hidden />
    </span>
  );
}
