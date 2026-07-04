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
