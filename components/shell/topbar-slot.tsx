"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const TOPBAR_ACTIONS_ID = "topbar-actions";

// Teleports a page's primary action(s) into the surface header's right cluster
// (left of search — see content-surface.tsx). Portal-based so tab-dependent
// actions update naturally. Index pages don't use this anymore: their "+ New"
// renders inline at the right end of the tab rail (IndexHeader).
export function TopBarActions({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<Element | null>(null);
  useEffect(() => {
    setEl(document.getElementById(TOPBAR_ACTIONS_ID));
  }, []);
  return el ? createPortal(children, el) : null;
}
