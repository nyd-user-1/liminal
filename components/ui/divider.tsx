// Catalog `Divider` — hairline; `label` variant centers a muted label ("or").

export function Divider({ label, className = "" }: { label?: string; className?: string }) {
  if (!label) return <hr className={`border-border ${className}`} />;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <hr className="flex-1 border-border" />
      <span className="text-[13px] text-text-muted">{label}</span>
      <hr className="flex-1 border-border" />
    </div>
  );
}
