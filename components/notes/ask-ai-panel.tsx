"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Icon, type IconName } from "@/components/ui/icons";
import { SidePanel } from "@/components/ui/side-panel";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";

// Catalog `ChatPanel` + `SuggestedPrompt` — Ask AI in a SidePanel over the
// note editor: quoted-context block (teal left rule), suggested prompts,
// user/AI bubbles, "Thinking •••", response actions (copy · Insert · Replace),
// send box, disclaimer caption.

interface Msg {
  role: "user" | "ai";
  text: string;
  insertMd?: string;
}

const SUGGESTED: Array<{ icon: IconName; label: string }> = [
  { icon: "note", label: "Summarise this into bullet points" },
  { icon: "check", label: "Pull out the plan and next steps" },
  { icon: "edit", label: "Rewrite in a more clinical tone" },
  { icon: "sparkle", label: "Make this text more concise" },
];

export function AskAiPanel({
  open,
  onClose,
  noteId,
  context,
  onInsert,
  onReplace,
}: {
  open: boolean;
  onClose: () => void;
  noteId: string | null;
  /** Editor selection captured when the panel was opened ("" = none). */
  context: string;
  onInsert: (md: string) => void;
  onReplace: (md: string) => void;
}) {
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setMessages([]);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thinking]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setThinking(true);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, question: q, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ask AI failed");
      setMessages((m) => [...m, { role: "ai", text: data.answer, insertMd: data.insertMd }]);
    } catch {
      toast("Ask AI is unavailable right now.", "danger");
    } finally {
      setThinking(false);
    }
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Ask AI"
      icon="sparkle"
      width="max-w-md"
      headerActions={<Badge variant="info">Beta</Badge>}
    >
      <div className="-m-6 flex h-[calc(100%+3rem)] flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
          {context && (
            <blockquote className="border-l-2 border-primary bg-teal-100/60 px-3 py-2 text-sm text-text-body">
              <span className="mb-0.5 block text-[12px] font-semibold text-primary">Selected text</span>
              <span className="line-clamp-4">{context}</span>
            </blockquote>
          )}
          {messages.length === 0 && (
            <div>
              <p className="mb-3 text-[15px] font-semibold text-text">How can I help with this note?</p>
              <div className="flex flex-col gap-1">
                {SUGGESTED.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => send(s.label)}
                    className="flex items-center gap-2.5 rounded-field px-2.5 py-2 text-left text-sm font-medium text-text-body transition-colors hover:bg-teal-100 hover:text-primary"
                  >
                    <Icon name={s.icon} size={16} className="shrink-0 text-primary" />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-8 rounded-card bg-canvas px-3.5 py-2.5 text-sm text-text">
                {m.text}
              </div>
            ) : (
              <div key={i} className="text-sm leading-relaxed text-text-body">
                <p className="whitespace-pre-wrap">{m.text}</p>
                <div className="mt-2 flex items-center gap-3">
                  <IconButton
                    icon="copy"
                    label="Copy response"
                    className="!h-7 !w-7"
                    onClick={() => {
                      navigator.clipboard?.writeText(m.insertMd ?? m.text);
                      toast("Copied to clipboard", "success");
                    }}
                  />
                  <TextLink
                    className="!text-sm"
                    onClick={() => {
                      onInsert(m.insertMd ?? m.text);
                      toast("Inserted into note", "success");
                    }}
                  >
                    Insert
                  </TextLink>
                  {context && (
                    <TextLink
                      className="!text-sm"
                      onClick={() => {
                        onReplace(m.insertMd ?? m.text);
                        toast("Replaced selection", "success");
                      }}
                    >
                      Replace
                    </TextLink>
                  )}
                </div>
              </div>
            ),
          )}
          {thinking && (
            <p className="text-sm font-medium text-primary">
              Thinking
              <span className="animate-pulse">•••</span>
            </p>
          )}
        </div>
        <div className="border-t border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={2}
              placeholder="Ask anything about this note…"
              className="flex-1 resize-none rounded-field border border-field-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted outline-none transition-colors focus:border-field-border-focus"
            />
            <IconButton icon="send" label="Send" variant="filled" type="submit" disabled={thinking || !input.trim()} />
          </form>
          <p className="mt-2 text-[12px] text-text-muted">
            AI can make mistakes. Check important clinical information.
          </p>
        </div>
      </div>
    </SidePanel>
  );
}
