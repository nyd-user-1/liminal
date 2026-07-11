import { Card } from "@/components/ui/card";
import { ClampText } from "@/components/providers/clamp-text";
import { InfoRow } from "@/components/providers/info-row";

// "Care details" — icon + small header + value, no divider lines (per the
// Headway reference). Longer lists (more specialties, therapy methods) clamp
// with "Show more"; everything else is a plain comma-joined line. Any row
// with no data is omitted; the whole card is omitted if nothing is available.

export function CareDetailsCard({
  topSpecialties,
  moreSpecialties,
  therapyMethods,
  agesServed,
  languages,
  locationLabel,
}: {
  topSpecialties?: string[];
  moreSpecialties?: string[];
  therapyMethods?: string[];
  agesServed?: string[];
  languages?: string[];
  locationLabel?: string | null;
}) {
  const hasAny =
    (topSpecialties?.length ?? 0) > 0 ||
    (moreSpecialties?.length ?? 0) > 0 ||
    (therapyMethods?.length ?? 0) > 0 ||
    (agesServed?.length ?? 0) > 0 ||
    (languages?.length ?? 0) > 0 ||
    Boolean(locationLabel);

  if (!hasAny) return null;

  return (
    <Card>
      <h2 className="mb-4 text-[19px] font-semibold text-text">Care details</h2>
      <div className="space-y-5">
        {((topSpecialties?.length ?? 0) > 0 || (moreSpecialties?.length ?? 0) > 0) && (
          <InfoRow
            icon="leaf"
            label="Specialties"
            value={<ClampText text={[...(topSpecialties ?? []), ...(moreSpecialties ?? [])].join(", ")} lines={3} />}
          />
        )}
        {therapyMethods && therapyMethods.length > 0 && (
          <InfoRow icon="users" label="Methods" value={<ClampText text={therapyMethods.join(", ")} lines={3} />} />
        )}
        {agesServed && agesServed.length > 0 && (
          <InfoRow icon="users-round" label="Ages served" value={agesServed.join(", ")} />
        )}
        {languages && languages.length > 0 && (
          <InfoRow icon="message-circle" label="Languages" value={languages.join(", ")} />
        )}
        {locationLabel && <InfoRow icon="map-pin" label="Location" value={locationLabel} />}
      </div>
    </Card>
  );
}
