/**
 * What subset of an object an embedded table shows.
 *
 * The object tables are mounted in more than one place — their own route, the
 * Clients rail, and (next) a client record — so the host says which rows it
 * means rather than each host filtering before it passes them down.
 *
 * "all" is the org-wide list the route already role-scoped; { clientId } is one
 * client's. The catalog takes no scope: a formulary is org-level config, not
 * something a client has.
 */
export type TableScope = "all" | { clientId: string };

export function inScope(scope: TableScope, row: { clientId: string }): boolean {
  return scope === "all" || row.clientId === scope.clientId;
}
