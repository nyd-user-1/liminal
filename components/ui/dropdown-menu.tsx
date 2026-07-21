"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, IconSquare, type IconName } from "@/components/ui/icons";

// Catalog `DropdownMenu` + `MenuItem` — portaled + fixed off the trigger so
// scroll containers can't clip it; outside click / Escape / scroll dismisses.
// (Dismiss/positioning pattern adapted from hq's menu.tsx.)

const MenuCloseCtx = createContext<() => void>(() => {});

export function MenuItem({
  icon,
  iconSquare,
  label,
  subtitle,
  onClick,
  danger,
  selected,
  trailing,
}: {
  icon?: IconName;
  /** Render the icon in a grey rounded square (catalog "+ New" style). */
  iconSquare?: boolean;
  label: ReactNode;
  subtitle?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  selected?: boolean;
  /** Right-aligned slot — shortcut hint, status Badge, or chevron. */
  trailing?: ReactNode;
}) {
  const close = useContext(MenuCloseCtx);
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        close();
      }}
      className={`group flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left text-[15px] font-medium transition-colors hover:bg-[#F3F4F6] ${
        danger ? "text-danger" : "text-text"
      }`}
    >
      {icon &&
        (iconSquare ? (
          <IconSquare name={icon} />
        ) : (
          <Icon
            name={icon}
            className={
              danger
                ? "text-danger transition-colors group-hover:fill-danger-tint"
                : "text-text transition-colors group-hover:fill-primary-wash"
            }
          />
        ))}
      <span className="min-w-0 flex-1">
        {label}
        {subtitle && <span className="block truncate text-sm font-normal text-text-muted">{subtitle}</span>}
      </span>
      {trailing ? (
        <span className="ml-1 shrink-0">{trailing}</span>
      ) : (
        selected && <Icon name="check" size={16} className="text-primary" />
      )}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-border" />;
}

export function MenuSectionLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-[13px] font-semibold text-text-muted">{children}</div>;
}

export function DropdownMenu({
  trigger,
  children,
  label = "Open menu",
  align = "right",
  placement = "bottom",
  width = "w-56",
  triggerClassName = "",
}: {
  trigger: ReactNode;
  children: ReactNode;
  label?: string;
  align?: "left" | "right";
  /** Which side of the trigger the menu opens. `top` = drop-up (e.g. a
   *  bottom-of-sidebar account chip). */
  placement?: "bottom" | "top";
  width?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Scroll-to-dismiss is registered in the CAPTURE phase so it catches a
    // scrolling ancestor the menu is anchored to. That also caught scrolls
    // INSIDE the menu — a menu with its own overflow list (the notification
    // bell) dismissed itself the moment the pointer scrolled over its rows,
    // which reads as "it closes when you hover it". Ignore scrolls whose
    // target sits within the menu panel; anything else still dismisses.
    const onScroll = (e: Event) => {
      const t = e.target as Node | null;
      if (t && menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const horizontal =
        align === "right" ? { right: window.innerWidth - r.right } : { left: r.left };
      const vertical =
        placement === "top" ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 };
      setPos({ ...horizontal, ...vertical });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <MenuCloseCtx.Provider value={() => setOpen(false)}>
            <div
              ref={menuRef}
              role="menu"
              onClick={(e) => e.stopPropagation()}
              style={{ top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right }}
              className={`fixed z-50 flex ${width} flex-col rounded-card border border-border bg-surface p-2 shadow-menu`}
            >
              {children}
            </div>
          </MenuCloseCtx.Provider>,
          document.body,
        )}
    </>
  );
}
