import { Icon, type IconName } from "@/components/ui/icons";

// Feature-card grid — icon + title + body cards, composed from the Card look and
// tokens. Used across the partner pages (health plans / physicians / employers).
// NEW (public marketing site).

export interface Feature {
  icon: IconName;
  title: string;
  body: string;
}

export function FeatureGrid({ items, columns = 3, className = "" }: { items: Feature[]; columns?: 2 | 3 | 4; className?: string }) {
  const cols =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-6 ${cols} ${className}`}>
      {items.map((f) => (
        <div key={f.title} className="rounded-card border border-border bg-surface p-6 shadow-card">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-field bg-primary-wash text-primary-deep">
            <Icon name={f.icon} size={22} />
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold text-text">{f.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-text-body">{f.body}</p>
        </div>
      ))}
    </div>
  );
}
