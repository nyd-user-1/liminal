import type { AvatarHue } from "@/lib/types";
import { ProviderIllustration } from "@/components/providers/provider-illustration";
import { RatingAvailability } from "@/components/providers/rating-availability";

// Header block — illustration, name, role, years of experience, and (when
// available) rating + next-availability, matching the homepage spotlight
// card. Rating/availability is only known for real bookable practitioners;
// directory providers simply omit that row — this component doesn't fall
// back to location/specialty text, since that's already shown lower on the
// page in CareDetailsCard.

export function ProviderHeader({
  name,
  roleTitle,
  yearsExperience,
  avatarHue,
  illustrationKey,
  directoryId,
  photoUrl,
  rating,
  reviewCount,
  availableLabel,
}: {
  name: string;
  roleTitle?: string | null;
  yearsExperience?: number | null;
  avatarHue?: AvatarHue;
  illustrationKey?: string | null;
  directoryId?: string;
  /** Takes priority over illustrationKey/directoryId — see ProviderIllustration. */
  photoUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  availableLabel?: string | null;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <ProviderIllustration
        name={name}
        avatarHue={avatarHue}
        illustrationKey={illustrationKey}
        directoryId={directoryId}
        photoUrl={photoUrl}
        className="h-[250px] w-[250px] shrink-0"
      />
      <div className="min-w-0">
        <h1 className="text-balance font-display text-[28px] font-bold tracking-tight text-primary">{name}</h1>
        {roleTitle && <p className="mt-1 text-[17px] text-text-body">{roleTitle}</p>}
        {yearsExperience != null && (
          <p className="mt-0.5 text-[15px] text-text-muted">
            {yearsExperience} year{yearsExperience === 1 ? "" : "s"} of experience
          </p>
        )}
        {rating != null && reviewCount != null && availableLabel && (
          <RatingAvailability rating={rating} reviewCount={reviewCount} availableLabel={availableLabel} className="mt-3" />
        )}
      </div>
    </div>
  );
}
