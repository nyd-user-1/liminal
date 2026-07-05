import { listLocations } from "@/lib/repos/services";
import { LocationsSettings } from "./locations-client";

// Settings › Locations — office/telehealth locations CRUD.

export default async function LocationsSettingsPage() {
  const locations = await listLocations();
  return <LocationsSettings initialLocations={locations} />;
}
