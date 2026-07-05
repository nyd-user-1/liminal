import { DEMO_CLIENT_USER_ID, DEMO_PRACTITIONER_ID, registerFixtures } from "@/lib/mock";
import type { Message, Thread } from "@/lib/types";

// Mirrors sql/002_seed.sql — threads (17) + messages (18): same uuids,
// subjects, bodies, timestamps.
//
// Sender-id bridge (mock mode only): the seed's users are 00…1001 (Brendan),
// 00…1002 (Priya) and 00…1003 (Casey — portal login casey@liminal.demo,
// linked to the Casey Morgan client row 00…2001 via clients.user_id). The
// foundation mock store seeds the demo logins under different ids, so here
// seed 1001 → DEMO_PRACTITIONER_ID and seed 1003 → DEMO_CLIENT_USER_ID (the
// clients fixture already points client 2001.userId at DEMO_CLIENT_USER_ID).
// Priya keeps her seed id. In DB mode none of this applies: sql/002_seed.sql
// ids are used as-is and casey@liminal.demo IS users 00…1003.

const T = (n: string) => `00000000-0000-4000-8000-00000000${n}`;

const BRENDAN = DEMO_PRACTITIONER_ID; // seed 00…1001
const PRIYA = T("1002");
const CASEY = DEMO_CLIENT_USER_ID; // seed 00…1003

const threads: Array<Omit<Thread, "createdAt" | "updatedAt">> = [
  { id: T("17001"), clientId: T("2001"), subject: "Sertraline refill", status: "open", lastMessageAt: "2026-07-02T14:38:00-04:00" },
  { id: T("17002"), clientId: T("2001"), subject: "Rescheduling next week", status: "closed", lastMessageAt: "2026-06-27T10:12:00-04:00" },
  { id: T("17003"), clientId: T("2004"), subject: "Superbill for June sessions", status: "open", lastMessageAt: "2026-07-03T16:20:00-04:00" },
  { id: T("17004"), clientId: T("2009"), subject: "Intake paperwork reminder", status: "open", lastMessageAt: "2026-07-01T09:05:00-04:00" },
];

const messages: Message[] = [
  {
    id: T("18001"),
    threadId: T("17001"),
    senderId: CASEY,
    body: "Hi Dr. Stanton — my pharmacy says I have no refills left on the sertraline and I take my last dose Sunday. Could you send a new script to the CVS on Hudson St?",
    readAt: "2026-07-02T09:15:00-04:00",
    createdAt: "2026-07-02T08:47:00-04:00",
  },
  {
    id: T("18002"),
    threadId: T("17001"),
    senderId: BRENDAN,
    body: "Good catch — I just sent 75 mg (the new dose we discussed) with 2 refills to CVS Hudson St. It should be ready this afternoon. See you Monday.",
    readAt: "2026-07-02T14:40:00-04:00",
    createdAt: "2026-07-02T14:32:00-04:00",
  },
  {
    id: T("18003"),
    threadId: T("17001"),
    senderId: CASEY,
    body: "Got it, thank you!",
    readAt: null,
    createdAt: "2026-07-02T14:38:00-04:00",
  },
  {
    id: T("18004"),
    threadId: T("17002"),
    senderId: CASEY,
    body: "Is there any chance we could move next week's session earlier in the day? Something came up at work Monday afternoon.",
    readAt: "2026-06-26T15:20:00-04:00",
    createdAt: "2026-06-26T14:55:00-04:00",
  },
  {
    id: T("18005"),
    threadId: T("17002"),
    senderId: BRENDAN,
    body: "Done — moved you to Monday 7/6 at 9:00 AM at the office. You will get a confirmation from the portal.",
    readAt: "2026-06-27T10:15:00-04:00",
    createdAt: "2026-06-27T10:12:00-04:00",
  },
  {
    id: T("18006"),
    threadId: T("17003"),
    senderId: BRENDAN,
    body: "Hi Ava — your June superbill is attached under Records > Documents. It includes the 6/29 session; submit it to Aetna with your member ID and let us know if they need anything else.",
    readAt: null,
    createdAt: "2026-07-03T16:20:00-04:00",
  },
  {
    id: T("18007"),
    threadId: T("17004"),
    senderId: PRIYA,
    body: "Hi Eli — looking forward to meeting you on Monday 7/6 at 11:00 AM. The intake form in your invite takes about 10 minutes; completing it beforehand lets us spend the whole hour on you.",
    readAt: null,
    createdAt: "2026-07-01T09:05:00-04:00",
  },
];

registerFixtures("threads", (store) => {
  for (const t of threads) store.threads.set(t.id, { ...t, createdAt: t.lastMessageAt ?? "2026-06-26T14:55:00-04:00", updatedAt: t.lastMessageAt ?? "2026-06-26T14:55:00-04:00" });
  for (const m of messages) store.messages.set(m.id, m);
});
