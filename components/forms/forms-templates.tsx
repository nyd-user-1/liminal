"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SendFormModal } from "@/components/forms/send-form-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import type { Form } from "@/lib/types";

// Contract export: `FormsTemplates` — the Forms tab of the Templates page
// (rendered there by the Clinical-docs agent; also mounted at
// /templates/forms). Card grid of form templates: title, draft/published
// Badge, response count, KebabMenu edit/send/duplicate. Self-fetching so it
// can be dropped into any tab host.

type FormCard = Form & { responseCount: number };

export function FormsTemplates() {
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
    router.push(`/templates/forms/${form.id}`);
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

  if (forms === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {forms.length} form{forms.length === 1 ? "" : "s"}
        </p>
        <Button leftIcon="plus" size="sm" onClick={createForm} loading={busy}>
          New form
        </Button>
      </div>

      {forms.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="No forms yet"
          subtext="Build intake forms and assessments, then send them to clients from here."
          actions={<Button onClick={createForm}>Create your first form</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {forms.map((f) => (
            <Card key={f.id} className="flex flex-col gap-3 !p-5">
              <div className="flex items-start gap-2">
                <button
                  onClick={() => router.push(`/templates/forms/${f.id}`)}
                  className="min-w-0 flex-1 text-left text-[17px] font-semibold text-text transition-colors hover:text-primary"
                >
                  {f.title}
                </button>
                <KebabMenu label={`Actions for ${f.title}`}>
                  <MenuItem icon="edit" label="Edit" onClick={() => router.push(`/templates/forms/${f.id}`)} />
                  <MenuItem
                    icon="send"
                    label="Send to client"
                    onClick={() => {
                      if (f.status !== "published") toast("Publish the form before sending it.", "warning");
                      else setSendTarget(f);
                    }}
                  />
                  <MenuItem icon="copy" label="Duplicate" onClick={() => duplicate(f)} />
                </KebabMenu>
              </div>
              {f.description && <p className="line-clamp-2 text-sm text-text-body">{f.description}</p>}
              <div className="mt-auto flex items-center gap-2">
                <Badge variant={f.status === "published" ? "success" : "warning"}>
                  {f.status === "published" ? "Published" : "Draft"}
                </Badge>
                <span className="text-[13px] text-text-muted">
                  {f.schema.length} question{f.schema.length === 1 ? "" : "s"} · {f.responseCount} response
                  {f.responseCount === 1 ? "" : "s"}
                </span>
              </div>
            </Card>
          ))}
        </div>
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
