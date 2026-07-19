"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";

// ⌘K command palette (TASK-SEARCH task 4a) — the workspace launcher. Opens on
// ⌘K / Ctrl+K anywhere; type to search clients, providers, organizations and
// plans (indexed, via /api/search) plus jump to any destination. Composed from
// the SearchInput primitive + a portal that mirrors Modal's scrim/escape/backdrop
// behavior — NOT a new ui/* primitive (there is no Command primitive to reuse,
// and Modal's fixed titled header doesn't fit a palette head; flagged for
// ui-agent as a possible future primitive).
//
// Snappy by construction: results stream in from the trigram indexes (~single
// round-trip per corpus, in parallel) and the previous results stay on screen
// while the next query resolves, so the list never blanks between keystrokes.

// Window event the TopBar search button dispatches to open the palette.
export const OPEN_COMMAND_PALETTE = "leuk:open-command-palette";

type SearchItem = { id: string; title: string; subtitle?: string; href: string };
type SearchGroup = { type: string; label: string; icon: IconName; items: SearchItem[] };

// Static jump-to destinations — the workspace's top-level routes, always
// filterable by label so ⌘K doubles as a keyboard nav.
const DESTINATIONS: { label: string; href: string; icon: IconName }[] = [
  { label: "Workspace", href: "/workspace", icon: "wand-sparkles" },
  { label: "Calendar", href: "/calendar", icon: "calendar" },
  { label: "Inbox", href: "/inbox", icon: "inbox" },
  { label: "Clients", href: "/clients", icon: "users" },
  { label: "Directory", href: "/directory", icon: "globe" },
  { label: "Rates", href: "/rates", icon: "activity" },
  { label: "Organizations", href: "/orgs", icon: "id-card" },
  { label: "Plans", href: "/plans", icon: "credit-card" },
  { label: "Recruiting", href: "/recruiting", icon: "users-round" },
  { label: "Billing", href: "/billing", icon: "dollar" },
  { label: "Library", href: "/library", icon: "clipboard" },
  { label: "Settings", href: "/settings", icon: "gear" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [active, setActive] = useState(0);

  // Global ⌘K / Ctrl+K to open, and a plain "/" when nothing is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The TopBar's search affordance is a plain button (no keyboard) — it opens
  // the palette by dispatching this event, so the trigger can live anywhere.
  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener(OPEN_COMMAND_PALETTE, open);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE, open);
  }, []);

  // Reset on open (the input autoFocuses on mount — see below).
  useEffect(() => {
    if (open) {
      setQ("");
      setGroups([]);
      setActive(0);
    }
  }, [open]);

  // Debounced indexed search; keep-previous (never clear groups mid-flight).
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setGroups([]);
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        if (!stale && res.ok) setGroups(json.groups ?? []);
      } catch {
        /* keep previous results on a transient error */
      }
    }, 150);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, open]);

  // Destination matches (client-side, instant).
  const dests = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? DESTINATIONS.filter((d) => d.label.toLowerCase().includes(term)) : DESTINATIONS;
    return list;
  }, [q]);

  // One flat, ordered list of everything selectable — for ↑/↓/Enter.
  const flat = useMemo(() => {
    const rows: { href: string; title: string; subtitle?: string; icon: IconName }[] = [];
    for (const d of dests) rows.push({ href: d.href, title: d.label, subtitle: "Go to", icon: d.icon });
    for (const g of groups) for (const it of g.items) rows.push({ ...it, icon: g.icon });
    return rows;
  }, [dests, groups]);

  // Clamp the cursor whenever the list changes.
  useEffect(() => {
    setActive((a) => (flat.length === 0 ? 0 : Math.min(a, flat.length - 1)));
  }, [flat.length]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = flat[active];
      if (row) go(row.href);
    }
  };

  if (!open || typeof document === "undefined") return null;

  // Rendered sections keep a running index so highlight tracks the flat list.
  let idx = 0;
  const renderRow = (row: { href: string; title: string; subtitle?: string; icon: IconName }) => {
    const i = idx++;
    const isActive = i === active;
    return (
      <button
        key={`${row.href}-${i}`}
        type="button"
        onMouseEnter={() => setActive(i)}
        onClick={() => go(row.href)}
        className={`flex w-full items-center gap-3 rounded-field px-3 py-2 text-left ${
          isActive ? "bg-primary-wash text-text" : "text-text-body hover:bg-canvas"
        }`}
      >
        <Icon name={row.icon} size={18} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">{row.title}</span>
        {row.subtitle && <span className="shrink-0 truncate text-[13px] text-text-muted">{row.subtitle}</span>}
      </button>
    );
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-start justify-center bg-scrim p-4 pt-[12vh]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-card bg-surface shadow-menu"
      >
        <div className="border-b border-border p-3">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- palette remounts on
              every open; autoFocus is the expected launcher behavior. */}
          <SearchInput
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search clients, providers, organizations, plans — or jump to…"
            aria-label="Search the workspace"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {/* Destinations */}
          {dests.length > 0 && (
            <div className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Go to</p>
              {dests.map((d) => renderRow({ href: d.href, title: d.label, subtitle: "Go to", icon: d.icon }))}
            </div>
          )}

          {/* Entity groups */}
          {groups.map((g) => (
            <div key={g.type} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {g.label}
              </p>
              {g.items.map((it) => renderRow({ ...it, icon: g.icon }))}
            </div>
          ))}

          {flat.length === 0 && (
            <p className="px-3 py-6 text-center text-[14px] text-text-muted">
              {q.trim().length < 2 ? "Type to search the workspace." : "No matches."}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[12px] text-text-muted">
          <span><kbd className="font-sans">↑↓</kbd> navigate</span>
          <span><kbd className="font-sans">↵</kbd> open</span>
          <span><kbd className="font-sans">esc</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
