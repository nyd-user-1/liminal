"use client";

import { useState } from "react";
import { SendFormModal } from "@/components/forms/send-form-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import type { Form, FormBlock, FormBlockType } from "@/lib/types";

// Form builder (Carepatron Form UI): left BlockPalette · center QuestionCards
// (edit-in-place, teal accent bar on the active card, up/down reorder,
// info blocks render as SectionBlocks) · right settings panel with
// Save / Publish / Send to client.
//
// Block-type glyphs not in the foundation icon set (radio, checkbox, scale,
// signature, info) are local inline SVGs below — flagged for the icon owner.

const GLYPHS: Record<string, React.ReactNode> = {
  text: <path d="M4 7V5h16v2M12 5v14M9 19h6" />,
  textarea: <path d="M4 6h16M4 10h16M4 14h10" />,
  select: <path d="M4 5h16v6H4zM8 15l4 4 4-4" />,
  radio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
    </>
  ),
  checkbox: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <polyline points="8.5 12.5 11 15 15.5 9.5" />
    </>
  ),
  date: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  signature: <path d="M3 17c2-4 4-6 5-5s-1 5 1 5 3-7 5-7 0 7 2 7 2-2 5-2" />,
  scale: (
    <>
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="9" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <line x1="4" y1="8" x2="4" y2="16" />
      <line x1="20" y1="8" x2="20" y2="16" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" />
    </>
  ),
};

function Glyph({ type, className = "" }: { type: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {GLYPHS[type]}
    </svg>
  );
}

const PALETTE: Array<{ type: FormBlockType; title: string; subtitle: string }> = [
  { type: "text", title: "Short text", subtitle: "Single-line answer" },
  { type: "textarea", title: "Long text", subtitle: "Paragraph answer" },
  { type: "select", title: "Dropdown", subtitle: "Choose from a list" },
  { type: "radio", title: "Single choice", subtitle: "Pick one option" },
  { type: "checkbox", title: "Checkbox", subtitle: "Consent or multi-select" },
  { type: "date", title: "Date", subtitle: "Calendar picker" },
  { type: "scale", title: "Linear scale", subtitle: "0–3 rating (PHQ-9 style)" },
  { type: "signature", title: "Signature", subtitle: "Type-to-sign + consent" },
  { type: "info", title: "Section / info", subtitle: "Title text; starts a wizard step" },
];

const OPTION_TYPES: FormBlockType[] = ["select", "radio", "checkbox", "scale"];

function newBlock(type: FormBlockType): FormBlock {
  const id = `b_${Math.random().toString(36).slice(2, 9)}`;
  const base: FormBlock = { id, type, label: type === "info" ? "Section title" : "Untitled question", required: false };
  if (type === "scale") return { ...base, options: ["0", "1", "2", "3"] };
  if (OPTION_TYPES.includes(type)) return { ...base, options: ["Option 1", "Option 2"] };
  return base;
}

/** Read-only preview of a block's answer control (committed QuestionCard). */
function BlockPreview({ block }: { block: FormBlock }) {
  const ghost = "rounded-field border border-dashed border-field-border px-3 py-2 text-sm text-text-muted";
  switch (block.type) {
    case "text":
      return <div className={ghost}>Short answer</div>;
    case "textarea":
      return <div className={`${ghost} h-16`}>Long answer</div>;
    case "date":
      return <div className={`${ghost} w-44`}>mm/dd/yyyy</div>;
    case "signature":
      return <div className={`${ghost} italic`}>Type full name to sign</div>;
    case "select":
      return <div className={`${ghost} flex w-56 items-center justify-between`}>Choose… <span>▾</span></div>;
    case "scale":
      return (
        <div className="flex gap-2">
          {(block.options ?? []).map((o) => (
            <span key={o} className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-field-border px-2 text-sm text-text-body">
              {o}
            </span>
          ))}
        </div>
      );
    case "radio":
    case "checkbox":
      return (
        <div className="space-y-1.5">
          {(block.options ?? ["Yes"]).map((o) => (
            <div key={o} className="flex items-center gap-2 text-sm text-text-body">
              <span className={`h-4 w-4 border-[1.5px] border-field-border ${block.type === "radio" ? "rounded-full" : "rounded-[4px]"}`} />
              {o}
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export function FormBuilder({
  form,
  clients,
}: {
  form: Form;
  clients: Array<{ id: string; name: string }>;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description ?? "");
  const [blocks, setBlocks] = useState<FormBlock[]>(form.schema);
  const [status, setStatus] = useState(form.status);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const mutate = (next: FormBlock[]) => {
    setBlocks(next);
    setDirty(true);
  };

  const patchBlock = (id: string, patch: Partial<FormBlock>) =>
    mutate(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    mutate(next);
  };

  const save = async (nextStatus?: "draft" | "published") => {
    setBusy(true);
    const res = await fetch(`/api/forms/${form.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        schema: blocks,
        status: nextStatus ?? status,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast("Could not save the form.", "danger");
      return;
    }
    if (nextStatus) setStatus(nextStatus);
    setDirty(false);
    toast(nextStatus === "published" ? "Form published." : "Form saved.", "success");
  };

  return (
    <div className="flex items-start gap-5">
      {/* BlockPalette */}
      <aside className="w-60 shrink-0 rounded-card border border-border bg-surface p-3 shadow-card">
        <h2 className="px-1.5 pb-2 text-sm font-semibold text-text">Add a block</h2>
        <div className="space-y-0.5">
          {PALETTE.map((p) => (
            <button
              key={p.type}
              onClick={() => {
                const b = newBlock(p.type);
                mutate([...blocks, b]);
                setSelected(b.id);
              }}
              className="flex w-full items-center gap-2.5 rounded-field px-1.5 py-2 text-left transition-colors hover:bg-canvas"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-teal-100 text-primary">
                <Glyph type={p.type} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text">{p.title}</span>
                <span className="block truncate text-[13px] text-text-muted">{p.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Canvas */}
      <div className="min-w-0 flex-1 space-y-3">
        {blocks.length === 0 && (
          <div className="rounded-card border border-dashed border-field-border bg-surface px-6 py-16 text-center text-[15px] text-text-muted">
            Start by adding blocks from the palette on the left.
          </div>
        )}
        {blocks.map((block, i) => {
          const isSelected = selected === block.id;
          const isSection = block.type === "info";
          return (
            <div
              key={block.id}
              onClick={() => setSelected(block.id)}
              className={`relative cursor-pointer overflow-hidden rounded-card border bg-surface shadow-card transition-colors ${
                isSelected ? "border-primary" : "border-border hover:border-primary-weak"
              }`}
            >
              {/* teal accent bar (Form UI: violet in Carepatron, teal here) */}
              <span className={`absolute inset-y-0 left-0 w-1 ${isSelected ? "bg-primary" : isSection ? "bg-teal-200" : "bg-transparent"}`} />
              <div className={`px-5 ${isSection ? "py-4" : "py-4"}`}>
                {isSelected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-field bg-teal-100 text-primary">
                        <Glyph type={block.type} />
                      </span>
                      <span className="text-[13px] font-medium uppercase tracking-wide text-text-muted">
                        {PALETTE.find((p) => p.type === block.type)?.title ?? block.type}
                      </span>
                      <span className="ml-auto flex items-center gap-1">
                        <IconButton icon="chevron-up" label="Move up" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(i, -1); }} />
                        <IconButton icon="chevron-down" label="Move down" disabled={i === blocks.length - 1} onClick={(e) => { e.stopPropagation(); move(i, 1); }} />
                        <IconButton icon="copy" label="Duplicate" onClick={(e) => { e.stopPropagation(); mutate([...blocks.slice(0, i + 1), { ...block, id: newBlock(block.type).id }, ...blocks.slice(i + 1)]); }} />
                        <IconButton icon="trash" label="Delete" variant="danger" onClick={(e) => { e.stopPropagation(); mutate(blocks.filter((b) => b.id !== block.id)); }} />
                      </span>
                    </div>
                    <div>
                      <FieldLabel>{isSection ? "Section title / info text" : "Question label"}</FieldLabel>
                      <Input value={block.label} onChange={(e) => patchBlock(block.id, { label: e.target.value })} />
                    </div>
                    {OPTION_TYPES.includes(block.type) && (
                      <div>
                        <FieldLabel>Options</FieldLabel>
                        <div className="space-y-2">
                          {(block.options ?? []).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const options = [...(block.options ?? [])];
                                  options[oi] = e.target.value;
                                  patchBlock(block.id, { options });
                                }}
                              />
                              <IconButton
                                icon="x"
                                label="Remove option"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  patchBlock(block.id, { options: (block.options ?? []).filter((_, x) => x !== oi) });
                                }}
                              />
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon="plus"
                            onClick={(e) => {
                              e.stopPropagation();
                              patchBlock(block.id, { options: [...(block.options ?? []), `Option ${(block.options?.length ?? 0) + 1}`] });
                            }}
                          >
                            Add option
                          </Button>
                        </div>
                      </div>
                    )}
                    {!isSection && (
                      <Toggle
                        checked={!!block.required}
                        onChange={(v) => patchBlock(block.id, { required: v })}
                        label={<span className="text-sm text-text-body">Required</span>}
                      />
                    )}
                  </div>
                ) : isSection ? (
                  <p className="text-[17px] font-bold text-text">{block.label}</p>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-[15px] font-semibold text-text">
                      {block.label}
                      {block.required && <span className="ml-0.5 text-danger">*</span>}
                    </p>
                    <BlockPreview block={block} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Settings panel */}
      <aside className="w-72 shrink-0 space-y-4 rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text">Form settings</h2>
          <Badge variant={status === "published" ? "success" : "warning"} className="ml-auto">
            {status === "published" ? "Published" : "Draft"}
          </Badge>
        </div>
        <Field label="Title" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
        <Textarea
          label="Description"
          rows={3}
          value={description}
          onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
          placeholder="Shown to the client above the form"
        />
        <p className="text-[13px] text-text-muted">
          {blocks.length} block{blocks.length === 1 ? "" : "s"}. "Section / info" blocks start a new step in the
          client wizard.
        </p>
        <div className="space-y-2">
          <Button fullWidth onClick={() => save()} loading={busy}>
            {dirty ? "Save changes" : "Saved"}
          </Button>
          {status === "draft" ? (
            <Button fullWidth variant="secondary" onClick={() => save("published")} disabled={busy}>
              Publish
            </Button>
          ) : (
            <Button fullWidth variant="secondary" leftIcon="send" onClick={() => setSendOpen(true)} disabled={busy || dirty}>
              Send to client
            </Button>
          )}
        </div>
      </aside>

      <SendFormModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        formId={form.id}
        formTitle={title}
        clients={clients}
      />
    </div>
  );
}
