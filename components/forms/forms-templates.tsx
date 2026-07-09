"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SendFormModal } from "@/components/forms/send-form-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { LibraryCard } from "@/components/ui/library-card";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { Form } from "@/lib/types";

// Contract export: `FormsTemplates` — the Forms tab of the Templates page
// (rendered there by the Clinical-docs agent; also mounted at
// /library/forms). Card grid of form templates: title, draft/published
// Badge, response count, KebabMenu edit/send/duplicate. Self-fetching so it
// can be dropped into any tab host.

type FormCard = Form & { responseCount: number };

export function FormsTemplates({ preview = false, onViewMore }: { preview?: boolean; onViewMore?: () => void } = {}) {
  const router = useRouter();
  const toast = useToast();
  const [forms, setForms] = useState<FormCard[] | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [sendTarget, setSendTarget] = useState<FormCard | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/forms");
    if (!res.ok) {
      setForms([]);
      return;
    }
    const data = await res.json();
    setForms(data.forms);
    setClients(data.clients);
  };

  useEffect(() => {
    load();
  }, []);

  const createForm = async () => {
    setBusy(true);
    const res = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled form", schema: [] }),
    });
    setBusy(false);
    if (!res.ok) {
      toast("Could not create the form.", "danger");
      return;
    }
    const form = await res.json();
    router.push(`/library/forms/${form.id}`);
  };

  const duplicate = async (form: FormCard) => {
    const res = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Copy of ${form.title}`,
        description: form.description,
        schema: form.schema,
      }),
    });
    if (!res.ok) {
      toast("Could not duplicate the form.", "danger");
      return;
    }
    toast(`Duplicated "${form.title}".`, "success");
    load();
  };

  const remove = async (form: FormCard) => {
    if (!window.confirm(`Delete "${form.title}"? This also removes its responses and can't be undone.`)) return;
    const res = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Could not delete the form.", "danger");
      return;
    }
    toast(`Deleted "${form.title}".`, "success");
    setForms((fs) => (fs ?? []).filter((f) => f.id !== form.id));
  };

  const formCard = (f: FormCard) => (
    <LibraryCard
      key={f.id}
      title={f.title}
      description={
        f.description ??
        `${f.schema.length} question${f.schema.length === 1 ? "" : "s"} · ${f.responseCount} response${f.responseCount === 1 ? "" : "s"}`
      }
      date={formatDate(f.updatedAt)}
      onOpen={() => router.push(`/library/forms/${f.id}`)}
      tags={
        <Badge variant={f.status === "published" ? "success" : "warning"}>
          {f.status === "published" ? "Published" : "Draft"}
        </Badge>
      }
      menu={
        <KebabMenu label={`Actions for ${f.title}`}>
          <MenuItem icon="edit" label="Edit" onClick={() => router.push(`/library/forms/${f.id}`)} />
          <MenuItem
            icon="send"
            label="Send to client"
            onClick={() => {
              if (f.status !== "published") toast("Publish the form before sending it.", "warning");
              else setSendTarget(f);
            }}
          />
          <MenuItem icon="copy" label="Duplicate" onClick={() => duplicate(f)} />
          <MenuItem icon="trash" label="Delete" danger onClick={() => remove(f)} />
        </KebabMenu>
      }
    />
  );

  if (forms === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        {preview && <h2 className="text-[19px] font-bold text-text">Forms</h2>}
        <Button leftIcon="plus" size="sm" className="ml-auto" onClick={createForm} loading={busy}>
          New form
        </Button>
      </div>

      {forms.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="No forms yet"
          subtext="Build intake forms and assessments, then send them to clients from here."
          actions={<Button onClick={createForm} loading={busy}>Create your first form</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(preview ? forms.slice(0, 6) : forms).map(formCard)}
          </div>
          {preview && forms.length > 6 && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={onViewMore}>
                View more
              </Button>
            </div>
          )}
        </>
      )}

      {sendTarget && (
        <SendFormModal
          open
          onClose={() => {
            setSendTarget(null);
            load();
          }}
          formId={sendTarget.id}
          formTitle={sendTarget.title}
          clients={clients}
        />
      )}
    </>
  );
}
