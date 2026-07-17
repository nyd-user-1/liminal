"use client";

import { useCallback, useEffect, useState } from "react";

export type LazyRows<T> = {
  /** null while unfetched or in flight; a fetched empty set is []. */
  rows: T[] | null;
  truncated: boolean;
  error: string | null;
  /** The raw payload, for the odd table that needs a field beside its rows. */
  data: Record<string, unknown> | null;
  reload: () => void;
};

/**
 * Client-side loader for an object table's API twin.
 *
 * The object tables take server-fetched `rows` when their own route renders
 * them; when a host mounts one WITHOUT rows (the Clients rail), the table
 * loads its own data through this — so /clients only pays for a Photon
 * round-trip once its tab is actually opened, never on first paint.
 *
 * `enabled` gates the fetch on the tab being open. Rows arrive pre-scoped by
 * role from the route, same rule as the server pages.
 */
export function useLazyRows<T>(endpoint: string, key: string, enabled: boolean): LazyRows<T> {
  const [state, setState] = useState<Omit<LazyRows<T>, "reload">>({
    rows: null,
    truncated: false,
    error: null,
    data: null,
  });

  const reload = useCallback(() => {
    setState({ rows: null, truncated: false, error: null, data: null });
    fetch(endpoint)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not load this list.");
        return data;
      })
      .then((data) => setState({ rows: data[key] ?? [], truncated: !!data.truncated, error: null, data }))
      .catch((e: unknown) =>
        setState({ rows: null, truncated: false, error: String((e as Error).message ?? e), data: null }),
      );
  }, [endpoint, key]);

  useEffect(() => {
    if (enabled && state.rows === null && state.error === null) reload();
  }, [enabled, state.rows, state.error, reload]);

  return { ...state, reload };
}
