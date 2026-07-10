"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { CountBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatTime } from "@/lib/format";
import type { ThreadSummary } from "@/lib/repos/threads";

// Practitioner Inbox — master/detail split: thread list pane (Tabs
// Open/Closed, search, unread emphasis, active highlight) beside the open
// thread (children from inbox/layout.tsx). Below lg the panes swap on
// navigation instead of sharing the row. Compose lives in the TopBar.

function threadTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? formatTime(d) : formatDate(d);
}

export function InboxShell({
  threads,
  clients,
  children,
}: {
  threads: ThreadSummary[];
  clients: Array<{ id: string; name: string }>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const activeId = pathname.startsWith("/inbox/") ? pathname.split("/")[2] : null;

  const active = threads.find((t) => t.id === activeId);
  const [tab, setTab] = useState<"open" | "closed">(active?.status === "closed" ? "closed" : "open");
  const [query, setQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ clientId: "", subject: "", body: "" });
  const [busy, setBusy] = useState(false);

  // Opening a thread marks it read server-side; refresh so the list's
  // unread badge clears. Skip the initial mount.
  const prevId = useRef(activeId);
  useEffect(() => {
    if (prevId.current !== activeId) {
      prevId.current = activeId;
      if (activeId) router.refresh();
    }
  }, [activeId, router]);

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
      <TopBarActions>
        <Button leftIcon="plus" onClick={() => setComposeOpen(true)}>
          Compose
        </Button>
      </TopBarActions>

      <div className="flex h-full min-h-0 overflow-hidden rounded-card border border-border bg-surface shadow-card">
        {/* Thread list pane */}
        <div
          className={`flex w-full flex-col border-border lg:w-[380px] lg:shrink-0 lg:border-r ${
            activeId ? "max-lg:hidden" : ""
          }`}
        >
          <div className="shrink-0 space-y-3 border-b border-border p-3">
            <Tabs
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
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <EmptyState
                icon="inbox"
                title={query ? "No conversations match" : `No ${tab} conversations`}
                subtext={tab === "open" && !query ? "Client messages will appear here." : undefined}
              />
            ) : (
              visible.map((t) => {
                const unread = t.unreadFromClient > 0;
                const current = t.id === activeId;
                return (
                  <Link
                    key={t.id}
                    href={`/inbox/${t.id}`}
                    aria-current={current ? "page" : undefined}
                    className={`block border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-canvas ${
                      current ? "bg-canvas" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Avatar name={t.clientName} size="sm" />
                      <span className={`min-w-0 flex-1 truncate text-[15px] text-text ${unread ? "font-bold" : "font-semibold"}`}>
                        {t.clientName}
                      </span>
                      <span className="shrink-0 text-[12px] text-text-muted">{threadTime(t.lastMessageAt)}</span>
                    </span>
                    <span className={`mt-1 block truncate text-sm ${unread ? "font-medium text-text" : "text-text-body"}`}>
                      {t.subject}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text-muted">
                        {t.snippet ?? "No messages yet"}
                      </span>
                      <CountBadge count={t.unreadFromClient} />
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Thread pane */}
        <div className={`min-w-0 flex-1 flex-col lg:flex ${activeId ? "flex" : "max-lg:hidden lg:flex"}`}>
          {children}
        </div>
      </div>

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
