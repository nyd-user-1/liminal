import Link from "next/link";
import { Icon, IconSquare, type IconName } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";

// Settings hub — NavPanel-style rows routing to breadcrumbed sub-pages
// (catalog: Settings opens a secondary nav, not one tabbed page).

const SECTIONS: Array<{ href: string; icon: IconName; title: string; subtitle: string }> = [
  {
    href: "/settings/services",
    icon: "clipboard",
    title: "Services",
    subtitle: "Appointment types — duration, pricing and calendar color",
  },
  {
    href: "/settings/locations",
    icon: "globe",
    title: "Locations",
    subtitle: "Where appointments happen — office and telehealth",
  },
  {
    href: "/settings/availability",
    icon: "clock",
    title: "Availability",
    subtitle: "Weekly bookable hours per practitioner",
  },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon="gear" title="Settings" className="mb-6" />
      <p className="mb-4 text-[13px] font-semibold text-text-muted">Scheduling</p>
      <div className="space-y-2.5">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-canvas"
          >
            <IconSquare name={s.icon} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-text">{s.title}</span>
              <span className="block truncate text-sm text-text-muted">{s.subtitle}</span>
            </span>
            <Icon name="chevron-right" size={18} className="shrink-0 text-text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
