import { hasDb, sql } from "@/lib/db";

// The live schema, introspected — what actually exists in the database right
// now, per object type, for the /workspace Data section's tabs. Read-only:
// every query below is a catalog SELECT.
//
// ONE correction worth knowing before reading the numbers. `information_schema`
// reports 69 routines and 19 triggers in `public`, but 67 of those routines
// belong to EXTENSIONS (pgcrypto, pg_trgm, pg_session_jwt, plpgsql) and are not
// ours in any meaningful sense. The functions query filters them out via
// pg_depend, so the tab reports the 2 we wrote and names the extension count
// separately. The triggers, by contrast, are all ours.

export interface SchemaObject {
  name: string;
  /** Second line — what this object is, in the database's own terms. */
  detail: string;
  /** Right-hand figure where the object type has one (row counts, sizes). */
  metric: string | null;
}

export interface SchemaCatalog {
  tables: SchemaObject[];
  views: SchemaObject[];
  indexes: SchemaObject[];
  functions: SchemaObject[];
  triggers: SchemaObject[];
  sequences: SchemaObject[];
  /** Routines owned by extensions, excluded from `functions`. Named in the UI so
   *  the gap between "69 routines" and "2 functions" is explained, not hidden. */
  extensionRoutines: number;
}

/** The shape a non-admin (or a database-less build) gets — every tab empty and
 *  honest about it, rather than a nullable payload every consumer must guard. */
export const EMPTY_CATALOG: SchemaCatalog = {
  tables: [],
  views: [],
  indexes: [],
  functions: [],
  triggers: [],
  sequences: [],
  extensionRoutines: 0,
};

const int = (v: unknown): number => Number(v ?? 0);

export async function schemaCatalog(): Promise<SchemaCatalog> {
  if (!hasDb) return EMPTY_CATALOG;

  const [tables, views, indexes, functions, triggers, sequences, ext] = await Promise.all([
    // Live row estimate from the planner's statistics (reltuples) — an exact
    // count(*) per table across 76 tables would cost minutes. Estimates carry a
    // "+", per the no-almost-equal-glyph rule.
    sql`
      SELECT c.relname AS name,
             pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
             GREATEST(c.reltuples, 0)::bigint AS rows,
             (SELECT count(*)::int FROM information_schema.columns col
               WHERE col.table_schema = 'public' AND col.table_name = c.relname) AS cols
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC
    `,
    // Plain views and materialized views together — both are views, and the
    // distinction is the interesting part, so it becomes a column.
    sql`
      SELECT c.relname AS name,
             CASE c.relkind WHEN 'm' THEN 'materialized' ELSE 'view' END AS kind,
             CASE WHEN c.relkind = 'm' THEN pg_size_pretty(pg_total_relation_size(c.oid)) END AS size
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
      ORDER BY c.relkind, c.relname
    `,
    sql`
      SELECT i.indexname AS name, i.tablename AS table_name,
             pg_size_pretty(pg_relation_size(quote_ident(i.indexname)::regclass)) AS size
      FROM pg_indexes i
      WHERE i.schemaname = 'public'
      ORDER BY pg_relation_size(quote_ident(i.indexname)::regclass) DESC
    `,
    // Ours only: anything an extension owns is excluded by the pg_depend check.
    sql`
      SELECT p.proname AS name,
             CASE p.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END AS kind,
             pg_get_function_result(p.oid) AS returns
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      ORDER BY p.proname
    `,
    sql`
      SELECT t.tgname AS name, c.relname AS table_name, p.proname AS fn
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
      ORDER BY c.relname, t.tgname
    `,
    sql`
      SELECT sequence_name AS name, data_type
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name
    `,
    sql`
      SELECT count(*)::int AS c
      FROM pg_depend d
      JOIN pg_proc p ON p.oid = d.objid
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE d.deptype = 'e' AND n.nspname = 'public'
    `,
  ]);

  return {
    tables: (tables as Array<{ name: string; size: string; rows: string; cols: number }>).map((r) => ({
      name: r.name,
      detail: `${int(r.cols)} columns · ${r.size}`,
      metric: `${int(r.rows).toLocaleString("en-US")}+`,
    })),
    views: (views as Array<{ name: string; kind: string; size: string | null }>).map((r) => ({
      name: r.name,
      detail: r.kind === "materialized" ? "materialized view" : "view",
      metric: r.size,
    })),
    indexes: (indexes as Array<{ name: string; table_name: string; size: string }>).map((r) => ({
      name: r.name,
      detail: `on ${r.table_name}`,
      metric: r.size,
    })),
    functions: (functions as Array<{ name: string; kind: string; returns: string }>).map((r) => ({
      name: r.name,
      detail: r.kind,
      metric: `returns ${r.returns}`,
    })),
    triggers: (triggers as Array<{ name: string; table_name: string; fn: string }>).map((r) => ({
      name: r.name,
      detail: `on ${r.table_name}`,
      metric: `${r.fn}()`,
    })),
    sequences: (sequences as Array<{ name: string; data_type: string }>).map((r) => ({
      name: r.name,
      detail: r.data_type,
      metric: null,
    })),
    extensionRoutines: int((ext as Array<{ c: number }>)[0]?.c),
  };
}
