"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import type { AvatarHue } from "@/lib/types";

// The record rail's identity card: WHO this record is, pinned beside the board
// while the section cards scroll past it. One per record page — the client
// board is the first, /orgs and the provider rail are meant to follow.
//
// Visual language is the client Contact card's — a muted label over its value,
// never a bold label — at the provider rail's dimensions (a narrow, full-height
// column). The caller owns the column; this fills it.
//
// Generic by construction, the same rule components/board/ follows: this file
// imports React, Card and Avatar, and knows nothing about clients. Everything
// that varies is config.

export interface IdentityField {
  label: string;
  /** Anything renderable; "–" stands in when empty. */
  value?: ReactNode;
}

export function IdentityCard({
  name,
  hue,
  avatarSrc,
  badge,
  meta,
  fields,
  actions,
  footer,
  className = "",
}: {
  /** Drives both the heading and the avatar's initials. */
  name: string;
  hue?: AvatarHue;
  avatarSrc?: string | null;
  /** Status pill beside the name — pass an interactive one to make it a picker. */
  badge?: ReactNode;
  /** The muted line under the name (pronouns · date of birth · …). */
  meta?: ReactNode;
  fields: IdentityField[];
  /** Top-right slot — a kebab of record actions, usually. */
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex h-full min-h-0 flex-col !p-0 ${className}`}>
      {/* Identity block: pinned, never scrolls away from its own fields. */}
      <div className="flex shrink-0 items-start gap-3 p-4">
        <Avatar name={name} hue={hue} size="lg" src={avatarSrc} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold leading-tight text-text" title={name}>
            {name}
          </h2>
          {badge && <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{badge}</span>}
        </div>
        {actions && <span className="-mr-1 -mt-1 shrink-0">{actions}</span>}
      </div>

      {meta && <p className="shrink-0 px-4 pb-3 text-sm text-text-muted">{meta}</p>}

      {/* The fields scroll on their own: the rail is viewport-height, and a
          record with many fields must not push the card past it. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t border-border p-4">
        {fields.map((f) => {
          const empty = f.value === null || f.value === undefined || f.value === "";
          return (
            <div key={f.label}>
              <div className="text-sm text-text-muted">{f.label}</div>
              <div className="mt-0.5 text-[15px] text-text">{empty ? "–" : f.value}</div>
            </div>
          );
        })}
      </div>

      {footer && <div className="shrink-0 border-t border-border p-4">{footer}</div>}
    </Card>
  );
}
