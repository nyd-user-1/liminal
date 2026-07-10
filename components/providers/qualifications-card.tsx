import { Card } from "@/components/ui/card";
import { InfoRow } from "@/components/providers/info-row";

// "Qualification and insurance" — icon + small header + value, no divider
// lines (per the Headway reference). Any row with no data is simply omitted;
// the whole card is omitted if nothing at all is available.

export function QualificationsCard({
  yearsExperience,
  training,
  licenseType,
  licensedIn,
  insuranceAccepted,
}: {
  yearsExperience?: number | null;
  training?: string | null;
  licenseType?: string | null;
  licensedIn?: string[];
  insuranceAccepted?: string[];
}) {
  const hasAny =
    yearsExperience != null || training || licenseType || (licensedIn?.length ?? 0) > 0 || (insuranceAccepted?.length ?? 0) > 0;
  if (!hasAny) return null;

  return (
    <Card>
      <h2 className="mb-4 text-[19px] font-semibold text-text">Qualification and insurance</h2>
      <div className="space-y-5">
        {yearsExperience != null && (
          <InfoRow
            icon="graduation-cap"
            label="Years of experience"
            value={`${yearsExperience} year${yearsExperience === 1 ? "" : "s"}`}
          />
        )}
        {training && <InfoRow icon="graduation-cap" label="Training" value={training} />}
        {licenseType && <InfoRow icon="circle-check" label="License type" value={licenseType} />}
        {licensedIn && licensedIn.length > 0 && (
          <InfoRow icon="circle-check" label="Licensed in" value={licensedIn.join(", ")} />
        )}
        {insuranceAccepted && insuranceAccepted.length > 0 && (
          <InfoRow icon="id-card" label="Insurance accepted" value={insuranceAccepted.join(", ")} />
        )}
      </div>
    </Card>
  );
}
