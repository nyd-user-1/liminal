"use client";

import { useEffect, useState } from "react";
import { FormsTemplates } from "@/components/forms/forms-templates";
import { NoteSheet } from "@/components/notes/note-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { IconSquare } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { Modal } from "@/components/ui/modal";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Select } from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { Skeleton } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { Tag, type TagHue } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { NoteTemplate, NoteTemplateKind } from "@/lib/types";

// Templates gallery (Carepatron Admin UI) — Notes tab: note-template Cards
// with "Use template" (client picker → drafts a note → NoteSheet) and a
// create/edit SidePanel. Forms tab: sibling contract <FormsTemplates/>.

const KIND_TAG: Record<NoteTemplateKind, { label: string; hue: TagHue }> = {
  soap: { label: "SOAP", hue: "teal" },
  dap: { label: "DAP", hue: "blue" },
  progress: { label: "Progress", hue: "violet" },
  intake: { label: "Intake", hue: "orange" },
  free: { label: "Free note", hue: "grey" },
};

const KIND_OPTIONS = (Object.keys(KIND_TAG) as NoteTemplateKind[]).map((k) => ({
  value: k,
  label: KIND_TAG[k].label,
}));

/** "## Subjective\n…## Plan" → "Subjective · Objective · … " section preview. */
function sectionPreview(bodyMd: string): string {
  const heads = [...bodyMd.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1].trim());
  if (heads.length > 0) return heads.join(" · ");
  const text = bodyMd.replace(/[#>*`_-]/g, "").trim();
  return text ? text.slice(0, 120) : "Blank canvas — free-form note.";
}

type ClientOption = { id: string; name: string };

interface EditorState {
  id: string | null; // null = create
  name: string;
  template: NoteTemplateKind;
  bodyMd: string;
  isBuiltin: boolean;
}

export function TemplatesIndex() {
  const toast = useToast();
  const [tab, setTab] = useState("notes");
  const [templates, setTemplates] = useState<NoteTemplate[] | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [useTarget, setUseTarget] = useState<NoteTemplate | null>(null);
  const [useClient, setUseClient] = useState("");
  const [using, setUsing] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load templates");
        setTemplates(json.templates);
        setClients(json.clients ?? []);
      })
      .catch((e) => {
        toast(e instanceof Error ? e.message : "Failed to load templates", "danger");
        setTemplates([]);
      });
  }, [toast]);

  async function saveEditor() {
    if (!editor || !editor.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(editor.id ? `/api/templates/${editor.id}` : "/api/templates", {
        method: editor.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editor.id
            ? { name: editor.name, bodyMd: editor.bodyMd }
            : { name: editor.name, template: editor.template, bodyMd: editor.bodyMd },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setTemplates((ts) =>
        editor.id
          ? (ts ?? []).map((t) => (t.id === editor.id ? json.template : t))
          : [...(ts ?? []), json.template],
      );
      toast(editor.id ? "Template updated" : "Template created", "success");
      setEditor(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function useTemplate() {
    if (!useTarget || !useClient) return;
    setUsing(true);
    try {
      const d = new Date();
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: useClient,
          template: useTarget.template,
          title: `${useTarget.name} ${d.getMonth() + 1}/${d.getDate()}`,
          bodyMd: useTarget.bodyMd,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create note");
      setUseTarget(null);
      setOpenNoteId(json.note.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create note", "danger");
    } finally {
      setUsing(false);
    }
  }

  return (
    <>
      {tab === "notes" && (
        <TopBarActions>
          <Button
            leftIcon="plus"
            onClick={() =>
              setEditor({ id: null, name: "", template: "progress", bodyMd: "", isBuiltin: false })
            }
          >
            New template
          </Button>
        </TopBarActions>
      )}
      <Tabs
        className="mb-6"
        active={tab}
        onChange={setTab}
        items={[
          { key: "notes", label: "Notes", count: templates?.length },
          { key: "forms", label: "Forms" },
        ]}
      />

      {tab === "forms" && <FormsTemplates />}

      {tab === "notes" && templates === null && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      )}

      {tab === "notes" && templates !== null && templates.length === 0 && (
        <EmptyState
          icon="note"
          title="No note templates"
          subtext="Create a template to standardise your clinical documentation."
        />
      )}

      {tab === "notes" && templates !== null && templates.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const kind = KIND_TAG[t.template];
            return (
              <Card key={t.id} className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <IconSquare name="note" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold text-text">{t.name}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Tag hue={kind.hue}>{kind.label}</Tag>
                      {t.isBuiltin && <Badge variant="neutral">Built-in</Badge>}
                    </div>
                  </div>
                  <KebabMenu>
                    <MenuItem
                      icon="edit"
                      label="Edit template"
                      onClick={() =>
                        setEditor({
                          id: t.id,
                          name: t.name,
                          template: t.template,
                          bodyMd: t.bodyMd,
                          isBuiltin: t.isBuiltin,
                        })
                      }
                    />
                    <MenuItem
                      icon="copy"
                      label="Duplicate"
                      onClick={() =>
                        setEditor({
                          id: null,
                          name: `${t.name} (copy)`,
                          template: t.template,
                          bodyMd: t.bodyMd,
                          isBuiltin: false,
                        })
                      }
                    />
                  </KebabMenu>
                </div>
                <p className="line-clamp-2 min-h-10 text-sm text-text-muted">{sectionPreview(t.bodyMd)}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    setUseClient(clients[0]?.id ?? "");
                    setUseTarget(t);
                  }}
                >
                  Use template
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* create / edit template */}
      <SidePanel
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editor?.id ? "Edit template" : "New template"}
        icon="note"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditor} loading={saving} disabled={!editor?.name.trim()}>
              {editor?.id ? "Save changes" : "Create template"}
            </Button>
          </>
        }
      >
        {editor && (
          <div className="flex flex-col gap-5">
            <Field
              label="Template name"
              required
              value={editor.name}
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              placeholder="e.g. Initial psychiatric evaluation"
            />
            {editor.id ? (
              <div>
                <p className="mb-1.5 text-sm font-medium text-text-body">Note type</p>
                <Tag hue={KIND_TAG[editor.template].hue}>{KIND_TAG[editor.template].label}</Tag>
              </div>
            ) : (
              <Select
                label="Note type"
                options={KIND_OPTIONS}
                value={editor.template}
                onValueChange={(v) => setEditor({ ...editor, template: v as NoteTemplateKind })}
              />
            )}
            <Textarea
              label="Structure (markdown)"
              rows={14}
              value={editor.bodyMd}
              onChange={(e) => setEditor({ ...editor, bodyMd: e.target.value })}
              placeholder={"## Subjective\n\n## Objective\n\n## Assessment\n\n## Plan"}
              hint="Sections become the pre-filled skeleton of every note started from this template."
              className="[&_textarea]:font-mono [&_textarea]:text-sm"
            />
          </div>
        )}
      </SidePanel>

      {/* use template → pick client → draft note */}
      {useTarget && (
        <Modal
          open
          onClose={() => setUseTarget(null)}
          title={`Use "${useTarget.name}"`}
          icon="note"
          footer={
            <>
              <Button variant="secondary" onClick={() => setUseTarget(null)}>
                Cancel
              </Button>
              <Button onClick={useTemplate} loading={using} disabled={!useClient}>
                Create note
              </Button>
            </>
          }
        >
          <p className="mb-4 text-[15px] text-text-body">
            Start a {KIND_TAG[useTarget.template].label} note pre-filled with this template&apos;s
            sections.
          </p>
          <Select
            label="Client"
            required
            searchable
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            value={useClient}
            onValueChange={setUseClient}
            placeholder="Choose a client…"
          />
        </Modal>
      )}

      {openNoteId && <NoteSheet noteId={openNoteId} onClose={() => setOpenNoteId(null)} />}
    </>
  );
}
