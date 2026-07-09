import { Icon, type IconName } from "@/components/ui/icons";
import type { AvatarHue } from "@/lib/types";
import { ProviderIllustration } from "@/components/providers/provider-illustration";

// Header block — illustration, name, role, years of experience, and a
// stacked quick-facts list (location, top specialty, virtual). Any quick
// fact with no data is simply omitted — directory providers are sparse.
// Icons are two-tone at rest: navy line, teal fill (+ solid navy accent dot
// on icons that have one, e.g. map-pin) — not gated behind hover.

export function ProviderHeader({
  name,
  roleTitle,
  yearsExperience,
  avatarHue,
  illustrationKey,
  directoryId,
  locationLabel,
  topSpecialty,
  virtual,
}: {
  name: string;
  roleTitle?: string | null;
  yearsExperience?: number | null;
  avatarHue?: AvatarHue;
  illustrationKey?: string | null;
  directoryId?: string;
  locationLabel?: string | null;
  topSpecialty?: string | null;
  virtual?: boolean;
}) {
  const facts: Array<{ icon: IconName; label: string }> = [
    locationLabel ? { icon: "map-pin", label: locationLabel } : null,
    topSpecialty
      ? { icon: topSpecialty.toLowerCase() === "medication management" ? "pill-bottle" : "star", label: topSpecialty }
      : null,
    virtual ? { icon: "monitor-check", label: "Virtual" } : null,
  ].filter((f): f is { icon: IconName; label: string } => f !== null);

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <ProviderIllustration
        name={name}
        avatarHue={avatarHue}
        illustrationKey={illustrationKey}
        directoryId={directoryId}
        className="h-[250px] w-[250px] shrink-0"
      />
      <div className="min-w-0">
        <h1 className="text-balance font-display text-[28px] font-bold tracking-tight text-text">{name}</h1>
        {roleTitle && <p className="mt-1 text-[17px] text-text-body">{roleTitle}</p>}
        {yearsExperience != null && (
          <p className="mt-0.5 text-[15px] text-text-muted">{yearsExperience} years of experience</p>
        )}
        {facts.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {facts.map((f) => (
              <span key={f.label} className="flex items-center gap-2 text-[14px] text-text-body">
                <Icon name={f.icon} size={16} className="shrink-0 fill-primary-wash text-text" />
                {f.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
