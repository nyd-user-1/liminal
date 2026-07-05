"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, CountBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { IconSquare } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { Modal } from "@/components/ui/modal";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatTime } from "@/lib/format";
import type { ThreadSummary } from "@/lib/repos/threads";

// Client-side thread index: rows → /portal/messages/[id], unread CountBadge
// (staff messages), "New message" compose (POST /api/threads scopes clients
// to their own record).

function threadTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? formatTime(d) : formatDate(d);
}

export function MessagesList({ threads }: { threads: ThreadSummary[] }) {
  const router = useRouter();
  const toast = useToast();
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ subject: "", body: "" });
  const [busy, setBusy] = useState(false);

  const submitCompose = async () => {
    if (!compose.subject.trim() || !compose.body.trim()) {
      toast("Fill in a subject and message.", "warning");
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
      toast("Could not send the message.", "danger");
      return;
    }
    const thread = await res.json();
    setComposeOpen(false);
    setCompose({ subject: "", body: "" });
    router.push(`/portal/messages/${thread.id}`);
    router.refresh();
  };

  return (
    <>
      <TopBarActions>
        <Button leftIcon="plus" onClick={() => setComposeOpen(true)}>
          New message
        </Button>
      </TopBarActions>

      {threads.length === 0 ? (
        <EmptyState
          icon="message"
          title="No messages yet"
          subtext="Start a conversation with your care team."
          actions={<Button onClick={() => setComposeOpen(true)}>New message</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {threads.map((t) => (
            <ListRow
              key={t.id}
              onClick={() => router.push(`/portal/messages/${t.id}`)}
              leading={<IconSquare name="message" />}
              title={
                <>
                  {t.subject}
                  {t.status === "closed" && <Badge variant="neutral">Closed</Badge>}
                </>
              }
              meta={t.snippet ?? "No messages yet"}
              trailing={
                <>
                  <span className="text-[13px] text-text-muted">{threadTime(t.lastMessageAt)}</span>
                  <CountBadge count={t.unreadFromStaff} />
                </>
              }
            />
          ))}
        </div>
      )}

      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Message your care team"
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
          <Field
            label="Subject"
            required
            value={compose.subject}
            onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
            placeholder="e.g. Question about my medication"
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
