import { listAvailability, listPractitioners } from "@/lib/repos/services";
import { AvailabilitySettings } from "./availability-client";

// Settings › Availability — weekly bookable-hours editor per practitioner.

export default async function AvailabilitySettingsPage() {
  const [practitioners, availability] = await Promise.all([listPractitioners(), listAvailability()]);
  return <AvailabilitySettings practitioners={practitioners} initialAvailability={availability} />;
}
