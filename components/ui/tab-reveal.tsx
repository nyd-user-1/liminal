"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Catalog `TabReveal` — the drill-down tab transition (founder spec
// 2026-07-23): wrap a tab rail's active panel and key it by the active tab;
// switching tabs plays a short framer-motion reveal (fade + lift + blur
// settle) instead of an instant swap. Reduced-motion renders plainly.
//
// A NEW PRIMITIVE, deliberately: the /orgs record and the /directory provider
// view share this exact behavior, and framer-motion stays behind this one
// module so no page imports the library directly.

export function TabReveal({
  id,
  className = "",
  children,
}: {
  /** The active tab's key — changing it triggers the reveal. */
  id: string;
  /** Applied to the motion wrapper — pass the panel's layout classes
   *  (e.g. "flex min-h-0 flex-1 flex-col") so fill-height tables keep their
   *  bounded ancestor. */
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={reduced ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduced ? undefined : { opacity: 0, y: -6, filter: "blur(3px)" }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
