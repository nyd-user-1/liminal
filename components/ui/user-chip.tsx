import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icons";
import type { AvatarHue } from "@/lib/types";

// Catalog `UserChip` — pill: Avatar(sm) + name(600) + chevron-down.
// Presentational; wrap in DropdownMenu's trigger to open a ProfileMenu.
// `onNavy` restyles it for the sidebar footer.

export function UserChip({
  name,
  hue,
  onNavy,
  collapsed,
  className = "",
}: {
  name: string;
  hue?: AvatarHue;
  onNavy?: boolean;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-full py-1 pl-1 transition-colors ${
        collapsed ? "pr-1" : "pr-2.5"
      } ${onNavy ? "text-white hover:bg-sidebar-active" : "bg-canvas text-text hover:bg-border"} ${className}`}
    >
      <Avatar name={name} hue={hue} size="sm" />
      {!collapsed && (
        <>
          <span className="truncate text-[15px] font-semibold">{name}</span>
          <Icon name="chevron-down" size={14} className={onNavy ? "text-sidebar-text" : "text-text-muted"} />
        </>
      )}
    </span>
  );
}
