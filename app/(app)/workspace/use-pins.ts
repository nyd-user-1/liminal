"use client";

import { useCallback, useEffect, useState } from "react";

// Pinned work-queue issues — up to three, persisted to localStorage so they
// survive a reload. The pin action lives in the work-queue table; the Pinned
// tickets card up top reads the same list. They're separate components, so a
// same-tab CustomEvent keeps the card in step the instant you pin from the
// queue (the native `storage` event only fires cross-tab).

const KEY = "workspace-pinned-issues";
const EVENT = "workspace-pins-changed";
export const MAX_PINS = 3;

function read(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, MAX_PINS) : [];
  } catch {
    return [];
  }
}

function write(next: string[]) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function usePins() {
  // Empty on the server and the first client render (localStorage is read in an
  // effect), so the two markups match and hydration stays quiet.
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setPinned(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isPinned = useCallback((id: string) => pinned.includes(id), [pinned]);

  // Pin, or unpin if already pinned. Silently no-ops a fourth pin — the table
  // reflects the cap by disabling the control once three are set.
  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_PINS ? cur : [...cur, id];
    if (next !== cur) write(next);
  }, []);

  const full = pinned.length >= MAX_PINS;
  return { pinned, isPinned, toggle, full };
}
