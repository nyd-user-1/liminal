"use client";

import { IconButton } from "@/components/ui/icon-button";

// Marketing-only dark toggle — circular reveal via the View Transitions API,
// ported from 44b's AppLayout. Presentational only; Nav owns the `dark`
// state (it also needs it to swap the logo mark) and passes the click
// handler down.
export function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: (e: React.MouseEvent) => void }) {
  return <IconButton icon={dark ? "sun" : "moon"} label="Toggle dark mode" variant="circular" onClick={onToggle} />;
}
