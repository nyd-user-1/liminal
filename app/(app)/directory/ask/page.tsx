"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatInput } from "@/components/directory/chat-input";
import { Markdown } from "@/components/directory/markdown";

// /directory/ask — chat surface for the care-directory agent. Streams from
// POST /api/ai/directory (AI SDK UI message stream): text renders as it
// generates and tool calls surface live as status lines. Reference data only,
// no PHI. Layout follows the insurance repo's HomeChat: input centered while
// the thread is empty (suggested prompts beneath it), pinned to the bottom
// once the first message sends. The route title strip says "Directory"
// (longest-prefix match on /directory), so this page renders no H1.

const STARTERS = [
  "What does Cigna pay for a 60-minute therapy session?",
  "Find psychiatrists in Brooklyn accepting new patients",
  "Compare Oxford and Empire rates for medication management",
  "Which group practices get paid the most for intakes?",
];

// Friendly labels for streamed tool activity.
const TOOL_LABELS: Record<string, [active: string, done: string]> = {
  "tool-search_providers": ["Searching providers…", "Searched providers"],
  "tool-get_provider": ["Pulling provider record…", "Pulled provider record"],
  "tool-market_rates": ["Checking published rates…", "Checked published rates"],
  "tool-directory_facets": ["Loading filters…", "Loaded filters"],
};

export default function AskDirectoryPage() {
  const [model, setModel] = useState("claude-opus-4-8");
  const modelRef = useRef(model);
  modelRef.current = model;

  const { messages, sendMessage, stop, status, error } = useChat({
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

  // Empty thread: input centered vertically, suggested prompts beneath it.
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-[770px]">{input}</div>
        <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text transition-colors hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // With messages: scrollable thread + input pinned to the bottom.
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-card rounded-br-sm bg-primary px-3.5 py-2 text-[13.5px] text-white">
                  {message.parts.map((part, i) => (part.type === "text" ? <span key={i}>{part.text}</span> : null))}
                </div>
              </div>
            ) : (
              <div key={message.id} className="flex justify-start">
                <div className="max-w-[92%] rounded-card rounded-bl-sm border border-border bg-surface px-4 py-3 shadow-card">
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
