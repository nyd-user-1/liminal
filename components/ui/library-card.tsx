import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

// Catalog `LibraryCard` — the uniform template/resource card used across the
// Library (notes, forms, assessments, prompts, …). Fixed height so every card
// in a grid lines up: title + kebab (top), 2-line-clamped description, and a
// footer with 1–2 tags bottom-left opposite a date bottom-right. The whole card
// is clickable when `onOpen` is set (teal border on hover); the kebab `menu`
// swallows its own clicks so it never triggers the card.
export function LibraryCard({
  title,
  description,
  tags,
  date,
  onOpen,
  menu,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** 1–2 tag chips (keep it to two — the footer has room for no more). */
  tags?: ReactNode;
  date?: ReactNode;
  onOpen?: () => void;
  /** A KebabMenu (or similar). Its clicks are stopped so they don't open the card. */
  menu?: ReactNode;
}) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className={`rounded-card ${onOpen ? "cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" : ""}`}
    >
      <Card className="flex h-[166px] flex-col gap-2 !p-5 transition-colors hover:border-primary">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-1 min-w-0 flex-1 text-[16px] font-semibold text-text">{title}</p>
          {menu && (
            <span onClick={(e) => e.stopPropagation()} className="-mr-1.5 -mt-1 shrink-0">
              {menu}
            </span>
          )}
        </div>
        {description && <p className="line-clamp-2 text-sm text-text-muted">{description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">{tags}</span>
          {date && <span className="shrink-0 text-[13px] text-text-muted">{date}</span>}
        </div>
      </Card>
    </div>
  );
}
