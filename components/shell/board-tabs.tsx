import { Tabs } from "@/components/ui/tabs";

// The boards' shared rail: Insights (the fixed page), Analytics (the
// composable board), Dashboard (the pre-rename original, kept for reference).
// Rendered at the top of all three so switching surfaces is one click from
// the same spot on every page. Tabs marks the active item off the pathname.

const ITEMS = [
  { key: "insights", label: "Workspace", href: "/workspace" },
  { key: "analytics", label: "Analytics", href: "/analytics" },
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "data-dictionary", label: "Data Dictionary", href: "/workspace/data-dictionary" },
  { key: "docs", label: "Docs", href: "/workspace/docs" },
];

export function BoardTabs() {
  return <Tabs items={ITEMS} />;
}
