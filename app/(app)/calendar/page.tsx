import { listAppointments, listClientsLite } from "@/lib/repos/appointments";
import { listLocations, listPractitioners, listServices } from "@/lib/repos/services";
import { CalendarClient } from "./calendar-client";

// Calendar — the scheduling flagship. Server component loads the working set;
// CalendarClient owns all interactivity (views, drag-drop, panels).

export default async function CalendarPage() {
  const [appointments, clients, services, locations, practitioners] = await Promise.all([
    listAppointments(),
    listClientsLite(),
    listServices(),
    listLocations(),
    listPractitioners(),
  ]);

  return (
    <CalendarClient
      initialAppointments={appointments}
      clients={clients}
      services={services}
      locations={locations}
      practitioners={practitioners}
    />
  );
}
