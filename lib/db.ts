import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Neon Postgres clients. Both are tagged-template functions:
// sql`SELECT * FROM t WHERE id = ${id}` — parameters are bound, not
// interpolated, so it's safe against injection.
//
// Two databases, because PHI lives under a BAA and public reference data
// does not:
//   sql     — DATABASE_URL, the reference/public dataset project (NPPES, rate
//             signals, FHIR directories, Form 5500). No PHI, no HIPAA.
//   sqlPhi  — DATABASE_URL_PHI, the HIPAA-enabled project (clients, notes,
//             appointments, invoices, users, sessions, audit_events). pgAudit
//             logs every statement here, so keep public-data reads off it.
//
// They are separate Postgres servers: a single statement can never join across
// them. Fetch from each and merge in TypeScript.
//
// Lazy: neon() is only constructed on first use, so importing this module
// during `next build` (when the env vars may be absent) does not throw.
// Callers must branch on `hasDb`/`hasPhiDb` before querying; a query made
// without the URL throws at call time.

/** True when the reference database is attached. Repos branch: sql`…` vs lib/mock. */
export const hasDb = !!process.env.DATABASE_URL;

/**
 * True when a clinical database is attached. Falls back to DATABASE_URL so
 * environments that have not yet been given DATABASE_URL_PHI keep working
 * exactly as before the split.
 */
export const hasPhiDb = !!(process.env.DATABASE_URL_PHI || process.env.DATABASE_URL);

function lazyClient(read: () => string | undefined, label: string): NeonQueryFunction<false, false> {
  let _client: NeonQueryFunction<false, false> | null = null;
  const client = (): NeonQueryFunction<false, false> => {
    if (!_client) {
      const url = read();
      if (!url) throw new Error(`${label} is not set`);
      _client = neon(url);
    }
    return _client;
  };
  // Proxy that forwards both the tagged-template call and any helper methods
  // (.query, etc.) to the lazily-created client.
  return new Proxy(function () {} as unknown as NeonQueryFunction<false, false>, {
    apply(_target, _thisArg, args) {
      // @ts-expect-error — forwarding tagged-template args to the real client
      return client()(...args);
    },
    get(_target, prop) {
      const c = client() as unknown as Record<string | symbol, unknown>;
      const v = c[prop];
      return typeof v === "function" ? v.bind(c) : v;
    },
  }) as NeonQueryFunction<false, false>;
}

export const sql = lazyClient(() => process.env.DATABASE_URL, "DATABASE_URL");

export const sqlPhi = lazyClient(
  () => process.env.DATABASE_URL_PHI || process.env.DATABASE_URL,
  "DATABASE_URL_PHI",
);
