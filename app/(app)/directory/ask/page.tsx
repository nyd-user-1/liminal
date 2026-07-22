"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatInput } from "@/components/directory/chat-input";
import { Markdown } from "@/components/directory/markdown";
import { Icon, type IconName } from "@/components/ui/icons";

// /directory/ask — chat surface for the care-directory agent. Streams from
// POST /api/ai/directory (AI SDK UI message stream): text renders as it
// generates and tool calls surface live as status lines. Reference data only,
// no PHI. Layout follows the insurance repo's HomeChat: input centered while
// the thread is empty (suggested prompts beneath it), pinned to the bottom
// once the first message sends. The route title strip says "Directory"
// (longest-prefix match on /directory), so this page renders no H1.

const STARTERS: Array<{ icon: IconName; label: string; prompt: string }> = [
  { icon: "dollar", label: "Cigna 60-min rate", prompt: "What does Cigna pay for a 60-minute therapy session?" },
  { icon: "map-pin", label: "Psychiatrists in Brooklyn", prompt: "Find psychiatrists in Brooklyn accepting new patients" },
  { icon: "activity", label: "Oxford vs Empire", prompt: "Compare Oxford and Empire rates for medication management" },
  { icon: "id-card", label: "Top-paid groups", prompt: "Which group practices get paid the most for intakes?" },
  { icon: "pill-bottle", label: "Med-management rates", prompt: "Which insurer pays the most for medication management (99214)?" },
  { icon: "users-round", label: "Therapists in Manhattan", prompt: "Find therapists in Manhattan accepting new patients" },
];

// Friendly labels for streamed tool activity.
const TOOL_LABELS: Record<string, [active: string, done: string]> = {
  "tool-search_providers": ["Searching providers…", "Searched providers"],
  "tool-get_provider": ["Pulling provider record…", "Pulled provider record"],
  "tool-market_rates": ["Checking published rates…", "Checked published rates"],
  "tool-directory_facets": ["Loading filters…", "Loaded filters"],
};

// Claude-style minimalist footer under each finished answer: copy + retry.
function AnswerFooter({ text, isLast, busy, onRegenerate }: { text: string; isLast: boolean; busy: boolean; onRegenerate: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="mt-1.5 flex items-center gap-0.5 text-text-muted">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy answer"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-canvas hover:text-text"
      >
        <Icon name={copied ? "check" : "copy"} size={14} className={copied ? "text-success" : undefined} />
      </button>
      {isLast && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          aria-label="Regenerate answer"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-canvas hover:text-text disabled:opacity-40"
        >
          <Icon name="refresh-cw" size={13} />
        </button>
      )}
    </div>
  );
}

export default function AskDirectoryPage() {
  const [model, setModel] = useState("claude-haiku-4-5");
  const modelRef = useRef(model);
  modelRef.current = model;

  const { messages, sendMessage, stop, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/directory",
      body: () => ({ model: modelRef.current }),
    }),
  });

  const isStreaming = status === "submitted" || status === "streaming";
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = (text: string) => {
    if (!text.trim() || isStreaming) return;
    void sendMessage({ text });
  };

  const input = (
    <ChatInput
      onSend={send}
      onStop={stop}
      isStreaming={isStreaming}
      selectedModelId={model}
      onModelChange={setModel}
      autoFocus
    />
  );

  // Empty thread: input centered vertically; short iconed prompt chips wrap
  // beneath it, left-aligned to the input container's edge (chat-vue layout).
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="w-full">{input}</div>
        <div className="w-full px-1.5 sm:px-4">
          <div className="mx-auto flex w-full max-w-[770px] flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => send(s.prompt)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-text transition-colors hover:border-primary hover:text-primary"
              >
                <Icon name={s.icon} size={14} className="text-primary" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // With messages: scrollable thread + input pinned to the bottom.
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
          {messages.map((message, mi) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-card rounded-br-sm bg-primary px-3.5 py-2 text-[13.5px] text-white">
                  {message.parts.map((part, i) => (part.type === "text" ? <span key={i}>{part.text}</span> : null))}
                </div>
              </div>
            ) : (
              // Assistant answers sit flat on the page — no card, no border, no
              // shadow (chat-vue reference; design ruling 2026-07-22).
              <div key={message.id} className="px-1">
                <div>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") return <Markdown key={i} md={part.text} />;
                    const label = TOOL_LABELS[part.type];
                    if (label && "state" in part) {
                      const done = part.state === "output-available" || part.state === "output-error";
                      return (
                        <p
                          key={i}
                          className={`my-1 flex items-center gap-1.5 text-[12px] ${done ? "text-text-muted" : "animate-pulse text-primary"}`}
                        >
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${done ? "bg-border" : "bg-primary"}`} />
                          {done ? label[1] : label[0]}
                        </p>
                      );
                    }
                    return null;
                  })}
                  {!(isStreaming && mi === messages.length - 1) && (
                    <AnswerFooter
                      text={message.parts
                        .filter((p): p is Extract<(typeof message.parts)[number], { type: "text" }> => p.type === "text")
                        .map((p) => p.text)
                        .join("\n")}
                      isLast={mi === messages.length - 1}
                      busy={isStreaming}
                      onRegenerate={() => void regenerate()}
                    />
                  )}
                </div>
              </div>
            ),
          )}
          {status === "submitted" && (
            <div className="flex items-center gap-1 px-1 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
            </div>
          )}
          {error && (
            <p className="rounded-field bg-danger-tint px-3 py-2 text-[13px] text-danger">
              {error.message || "The directory assistant is temporarily unavailable."}
            </p>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <div className="shrink-0">{input}</div>
    </div>
  );
}
