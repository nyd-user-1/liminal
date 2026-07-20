"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ownsPageTitle, routeTitle } from "@/components/shell/route-title";
import { TOPBAR_ACTIONS_ID } from "@/components/shell/topbar-slot";

// The page H1, at the top of the content surface (white inset panel). Route-
// derived and rendered by the shell, so every page gets exactly one H1 without
// a per-page edit — this is where the canonical title now lives (it used to sit
// in the TopBar strip; the TopBar is a utility bar now). Page actions portal in
// on the right via TopBarActions → TOPBAR_ACTIONS_ID, so they sit beside the H1.
//
// The title stands alone — no leading icon. `routeTitle` still returns one and
// the map still carries it; nothing renders it today. Left in place so the
// route → (icon, title) mapping keeps a single home if a surface wants it back.
export function ContentHeader({ title, className = "" }: { title?: string; className?: string }) {
  const pathname = usePathname();
  // A record that names itself owns its H1 — rendering one here too would put a
  // route label above the person's name and give the page two.
  if (ownsPageTitle(pathname)) return null;
  const derived = routeTitle(pathname);
  return (
    <PageHeader
      title={title ?? derived.title}
      actions={<div id={TOPBAR_ACTIONS_ID} className="flex items-center gap-2" />}
      className={className}
    />
  );
}
