import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Neon Postgres client. `sql` is a tagged-template function:
// sql`SELECT * FROM t WHERE id = ${id}` — parameters are bound, not
// interpolated, so it's safe against injection.
//
// Lazy: neon() is only constructed on first use, so importing this module
// during `next build` (when DATABASE_URL may be absent) does not throw.
// Callers must branch on `hasDb` before querying; a query made without
// DATABASE_URL throws at call time.

/** True when a real database is attached. Repos branch: sql`…` vs lib/mock. */
export const hasDb = !!process.env.DATABASE_URL;

let _client: NeonQueryFunction<false, false> | null = null;

function client(): NeonQueryFunction<false, false> {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _client = neon(url);
  }
  return _client;
}

// Proxy that forwards both the tagged-template call and any helper methods
// (.query, etc.) to the lazily-created client.
export const sql = new Proxy(function () {} as unknown as NeonQueryFunction<false, false>, {
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
