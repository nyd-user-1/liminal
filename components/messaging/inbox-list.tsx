"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { CountBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { ListRow } from "@/components/ui/list-row";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatTime } from "@/lib/format";
import type { ThreadSummary } from "@/lib/repos/threads";

// Practitioner Inbox (catalog §4): PageHeader + Compose, Tabs Open/Closed
// with counts, SearchInput, thread ListRows → /inbox/[id].

function threadTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? formatTime(d) : formatDate(d);
}

export function InboxList({
  threads,
  clients,
}: {
  threads: ThreadSummary[];
  clients: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [query, setQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ clientId: "", subject: "", body: "" });
  const [busy, setBusy] = useState(false);

  const counts = useMemo(
    () => ({
      open: threads.filter((t) => t.status === "open").length,
      closed: threads.filter((t) => t.status === "closed").length,
    }),
    [threads],
  );

  const visible = threads.filter((t) => {
    if (t.status !== tab) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.clientName.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      (t.snippet ?? "").toLowerCase().includes(q)
    );
  });

  const submitCompose = async () => {
    if (!compose.clientId || !compose.subject.trim() || !compose.body.trim()) {
      toast("Choose a client and fill in subject and message.", "warning");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(compose),
    });
    setBusy(false);
    if (!res.ok) {
      toast("Could not start the conversation.", "danger");
      return;
    }
    const thread = await res.json();
    setComposeOpen(false);
    setCompose({ clientId: "", subject: "", body: "" });
    router.push(`/inbox/${thread.id}`);
    router.refresh();
  };

  return (
    <>
      <PageHeader
        icon="inbox"
        title="Inbox"
        className="mb-5"
        actions={
          <Button leftIcon="plus" onClick={() => setComposeOpen(true)}>
            Compose
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        items={[
          { key: "open", label: "Open", count: counts.open },
          { key: "closed", label: "Closed", count: counts.closed },
        ]}
        active={tab}
        onChange={(k) => setTab(k as "open" | "closed")}
      />

      <SearchInput
        placeholder="Search conversations"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 max-w-md"
      />

      {visible.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={query ? "No conversations match your search" : `No ${tab} conversations`}
          subtext={tab === "open" ? "Client messages will appear here." : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map((t) => (
            <ListRow
              key={t.id}
              onClick={() => router.push(`/inbox/${t.id}`)}
              leading={<Avatar name={t.clientName} size="md" />}
              title={
                <>
                  {t.clientName}
                  <span className="font-normal text-text-muted">·</span>
                  <span className="truncate font-medium text-text-body">{t.subject}</span>
                </>
              }
              meta={t.snippet ?? "No messages yet"}
              trailing={
                <>
                  <span className="text-[13px] text-text-muted">{threadTime(t.lastMessageAt)}</span>
                  <CountBadge count={t.unreadFromClient} />
                </>
              }
            />
          ))}
        </div>
      )}

      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="New message"
        icon="message"
        footer={
          <>
            <Button variant="secondary" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCompose} loading={busy}>
              Send message
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Client"
            required
            placeholder="Choose a client"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            value={compose.clientId}
            onValueChange={(v) => setCompose((c) => ({ ...c, clientId: v }))}
          />
          <Field
            label="Subject"
            required
            value={compose.subject}
            onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
            placeholder="e.g. Follow-up on today's session"
          />
          <Textarea
            label="Message"
            required
            rows={4}
            value={compose.body}
            onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
            placeholder="Write a message…"
          />
        </div>
      </Modal>
    </>
  );
}
