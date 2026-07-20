import { hasDb, sql } from "@/lib/db";
import { mockStore } from "@/lib/mock";

// Append-only audit trail for PHI reads/writes (HIPAA gesture). Fire-and-
// forget: logging must NEVER break the request that triggered it, so every
// failure is swallowed. Keep `meta` free of PHI — ids and enums only.

export interface AuditInput {
  actorId: string | null;
  action: string; // e.g. "note.sign", "client.view"
  entity: string; // e.g. "note"
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Audit a PHI READ from inside a repo, resolving the actor from the session
 * cookie. Reads are the half people forget, so the logging lives next to the
 * query rather than in each of the dozen callers that could omit it.
 *
 * Outside a request (seed scripts, cron) there is no cookie and `cookies()`
 * throws — that is not an error, so it is swallowed like every other audit
 * failure. Never pass PHI in `meta`: ids and enums only.
 */
export async function auditRead(
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: Record<string, unknown> | null,
): Promise<void> {
  try {
    const { getUser } = await import("@/lib/auth");
    const user = await getUser();
    if (!user) return; // no session → no PHI was served to a person
    await logEvent({ actorId: user.id, action, entity, entityId, meta });
  } catch {
    // never throw from audit logging
  }
}

export async function logEvent(evt: AuditInput): Promise<void> {
  try {
    if (hasDb) {
      await sql`
        INSERT INTO audit_events (actor_id, action, entity, entity_id, meta)
        VALUES (${evt.actorId}, ${evt.action}, ${evt.entity}, ${evt.entityId ?? null}, ${JSON.stringify(evt.meta ?? null)})
      `;
    } else {
      const events = mockStore().auditEvents;
      events.push({
        id: events.length + 1,
        actorId: evt.actorId,
        action: evt.action,
        entity: evt.entity,
        entityId: evt.entityId ?? null,
        meta: evt.meta ?? null,
        at: new Date().toISOString(),
      });
    }
  } catch {
    // never throw from audit logging
  }
}
