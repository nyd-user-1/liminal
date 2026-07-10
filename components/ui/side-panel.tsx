"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, IconSquare, type IconName } from "@/components/ui/icons";

// Catalog `SidePanel` — right slide-over on the scrim; header (icon square +
// title + actions) · scrollable body · pinned footer. THE workhorse for
// create/edit/detail flows. `mobileSheet` swaps the below-lg presentation
// for a bottom sheet (rounded top, slide-up, grab bar) — same API, same
// desktop behavior.

export function SidePanel({
  open,
  onClose,
  title,
  icon,
  headerActions,
  footer,
  width = "max-w-xl",
  mobileSheet = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: IconName;
  headerActions?: ReactNode;
  footer?: ReactNode;
  width?: string; // tailwind max-w-* (~400–800px)
  /** Below lg, present as a bottom sheet instead of a full-height right panel. */
  mobileSheet?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className={`fixed inset-0 z-50 flex bg-scrim ${
        mobileSheet ? "flex-col justify-end lg:flex-row lg:justify-end" : "justify-end"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={
          mobileSheet
            ? `mkt-rise mx-auto flex max-h-[88dvh] w-full ${width} flex-col rounded-t-card bg-surface shadow-menu lg:mx-0 lg:h-full lg:max-h-none lg:rounded-none`
            : `flex h-full w-full ${width} flex-col bg-surface shadow-menu`
        }
      >
        {mobileSheet && <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border lg:hidden" />}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          {icon && <IconSquare name={icon} />}
          <h2 className="text-[19px] font-semibold text-text">{title}</h2>
          <div className="ml-auto flex items-center gap-1">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="inline-flex h-9 w-9 items-center justify-center rounded-field text-text-muted transition-colors hover:bg-[#F3F4F6] hover:text-text"
            >
              <Icon name="x" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div
            className={`flex items-center justify-end gap-3 border-t border-border px-6 py-4 ${
              mobileSheet ? "max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))]" : ""
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
