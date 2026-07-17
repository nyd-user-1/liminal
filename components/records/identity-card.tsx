"use client";

import { useRef, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

// The record rail's identity card: WHO this record is, pinned beside the board
// while the section cards scroll past it. One per record page — the client
// board is the first, /orgs and the provider rail are meant to follow.
//
// Visual language is the client Contact card's — a muted label over its value,
// never a bold label — at the provider rail's dimensions (a narrow, full-height
// column). The caller owns the column; this fills it.
//
// Generic by construction, the same rule components/board/ follows: this file
// imports React, Card and two form primitives, and knows nothing about clients.
// Everything that varies is config — including WHICH fields are editable and
// what saving one means. This card owns the interaction (double-click, Enter,
// Esc); the caller owns the write and the error it reports.

/** How a field edits. `kind` mirrors the control the record's own form uses for
 *  it — this card invents no validation of its own. */
export interface IdentityFieldEdit {
  kind: "text" | "email" | "tel" | "date" | "select";
  /** The raw value the editor opens with (not the rendered one). */
  value: string;
  /** Required for `select` — enum or relation options. */
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  /** Persist the new raw value. THROW to keep the editor open (and report the
   *  failure yourself — a toast is the house pattern); resolve to close it. */
  onSave: (next: string) => Promise<void>;
}

export interface IdentityField {
  label: string;
  /** Anything renderable; "–" stands in when empty. */
  value?: ReactNode;
  /** Present ⇒ double-clicking the value swaps it for an editor. */
  edit?: IdentityFieldEdit;
}

/** The open editor for one field. Enter saves, Esc cancels, blur saves — the
 *  inline-edit convention; a select saves the moment you pick. */
function FieldEditor({ edit, label, onDone }: { edit: IdentityFieldEdit; label: string; onDone: () => void }) {
  const [draft, setDraft] = useState(edit.value);
  const [saving, setSaving] = useState(false);
  // Enter fires save and blur fires save, and disabling the input to show the
  // in-flight state fires blur again — so the first commit wins and the rest
  // are dropped. Released on failure, when the editor stays open.
  const done = useRef(false);

  const save = async (next: string) => {
    if (done.current) return;
    done.current = true;
    if (next === edit.value) return onDone();
    setSaving(true);
    try {
      await edit.onSave(next);
      onDone();
    } catch {
      done.current = false;
      setSaving(false);
    }
  };
  const cancel = () => {
    done.current = true;
    onDone();
  };

  if (edit.kind === "select") {
    return (
      <span className="mt-0.5 block" onKeyDown={(e) => e.key === "Escape" && cancel()}>
        <Select
          aria-label={label}
          options={edit.options ?? []}
          value={draft}
          placeholder={edit.placeholder ?? "Select…"}
          disabled={saving}
          onValueChange={(v) => {
            setDraft(v);
            save(v);
          }}
        />
      </span>
    );
  }

  return (
    <span className="mt-0.5 block">
      <Input
        autoFocus
        aria-label={label}
        type={edit.kind === "text" ? "text" : edit.kind}
        value={draft}
        disabled={saving}
        placeholder={edit.placeholder}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => save(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save(draft);
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
    </span>
  );
}

function IdentityValue({ field }: { field: IdentityField }) {
  const [editing, setEditing] = useState(false);
  const empty = field.value === null || field.value === undefined || field.value === "";
  const shown = empty ? "–" : field.value;

  if (!field.edit) return <div data-field-value className="mt-0.5 text-[15px] text-text">{shown}</div>;
  if (editing) return <FieldEditor edit={field.edit} label={field.label} onDone={() => setEditing(false)} />;
  return (
    <div
      data-field-value
      onDoubleClick={() => setEditing(true)}
      title={`Double-click to edit ${field.label.toLowerCase()}`}
      className="-mx-1 mt-0.5 cursor-text rounded-field px-1 text-[15px] text-text transition-colors hover:bg-canvas"
    >
      {shown}
    </div>
  );
}

export function IdentityCard({
  name,
  subtitle,
  fields,
  actions,
  footer,
  className = "",
}: {
  name: string;
  /** The record's own identifier, under the name — muted and mono. */
  subtitle?: ReactNode;
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
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold leading-tight text-text" title={name}>
            {name}
          </h2>
          {/* break-all, not truncate: an identifier you can only read half of
              is not an identifier. A long one wraps rather than hides. */}
          {subtitle && <p className="mt-1 break-all font-mono text-[13px] leading-snug text-text-muted">{subtitle}</p>}
        </div>
        {actions && <span className="-mr-1 -mt-1 shrink-0">{actions}</span>}
      </div>

      {/* The fields scroll on their own: the rail is viewport-height, and a
          record with many fields must not push the card past it. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t border-border p-4">
        {fields.map((f) => (
          // data-field is a test hook, the same bargain data-board-card makes:
          // an interaction nobody can drive from a browser isn't verifiable.
          <div key={f.label} data-field={f.label}>
            <div className="text-sm text-text-muted">{f.label}</div>
            <IdentityValue field={f} />
          </div>
        ))}
      </div>

      {footer && <div className="shrink-0 border-t border-border p-4">{footer}</div>}
    </Card>
  );
}
