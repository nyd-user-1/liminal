import { listServices } from "@/lib/repos/services";
import { ServicesSettings } from "./services-client";

// Settings › Services — service catalog CRUD (ListRows + SidePanel edit).

export default async function ServicesSettingsPage() {
  const services = await listServices();
  return <ServicesSettings initialServices={services} />;
}
