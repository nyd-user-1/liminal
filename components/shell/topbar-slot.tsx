"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const TOPBAR_ACTIONS_ID = "topbar-actions";

// Teleports a page's primary action(s) into the TopBar strip (right cluster,
// left of the bell). Portal-based so tab-dependent actions update naturally.
export function TopBarActions({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<Element | null>(null);
  useEffect(() => {
    setEl(document.getElementById(TOPBAR_ACTIONS_ID));
  }, []);
  return el ? createPortal(children, el) : null;
}
