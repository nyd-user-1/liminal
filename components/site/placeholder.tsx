// Visible placeholder token — renders a brief's {{PLACEHOLDER}} as a dashed
// amber chip so the team can spot every unfilled asset on the rendered page
// (not just in the final report). NEW (public marketing site).

export function Placeholder({ token, className = "" }: { token: string; className?: string }) {
  return (
    <span
      title="Placeholder — needs a real value before launch"
      className={`inline-flex items-center rounded-field border border-dashed border-accent-ink/50 bg-amber-100 px-1.5 py-0.5 align-middle font-mono text-[12px] text-accent-ink ${className}`}
    >
      {token}
    </span>
  );
}
