"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { routeTitle } from "@/components/shell/route-title";
import { TOPBAR_ACTIONS_ID } from "@/components/shell/topbar-slot";

// The page H1, at the top of the content surface (white inset panel). Route-
// derived and rendered by the shell, so every page gets exactly one H1 without
// a per-page edit — this is where the canonical title now lives (it used to sit
// in the TopBar strip; the TopBar is a utility bar now). Page actions portal in
// on the right via TopBarActions → TOPBAR_ACTIONS_ID, so they sit beside the H1.
export function ContentHeader({ title, className = "" }: { title?: string; className?: string }) {
  const pathname = usePathname();
  const derived = routeTitle(pathname);
  return (
    <PageHeader
      icon={derived.icon}
      title={title ?? derived.title}
      actions={<div id={TOPBAR_ACTIONS_ID} className="flex items-center gap-2" />}
      className={className}
    />
  );
}
