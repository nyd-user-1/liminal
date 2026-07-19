"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/icon-button";
import { Sidebar, type SidebarNavItem } from "@/components/shell/sidebar";

// Mobile nav (<md): hamburger in the TopBar opens the Sidebar as a left
// sheet over the scrim. Escape, scrim click, or following a link closes it.
// Stays mounted so the slide can animate; inert + aria-hidden while closed.
// (The account menu is reached from the TopBar utility bar, not the sheet.)

export function MobileNav({
  items,
  homeHref,
}: {
  items: SidebarNavItem[];
  homeHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Close when the route changes (nav link, account menu, sign out).
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <IconButton icon="menu" label="Open menu" className="md:hidden" onClick={() => setOpen(true)} />
      {mounted &&
        createPortal(
          <div className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`}>
            <div
              onClick={() => setOpen(false)}
              aria-hidden
              className={`absolute inset-0 bg-scrim transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              inert={!open}
              className={`absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] transition-transform duration-200 ease-out motion-reduce:transition-none ${
                open ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <Sidebar sheet items={items} homeHref={homeHref} onNavigate={() => setOpen(false)} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
