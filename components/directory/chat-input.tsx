"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// ChatInput — ported from ~/Code/insurance src/components/ChatInput.tsx (the
// /new-chat pill: rounded-full container, auto-growing textarea, provider
// model menu, ArrowUp↔Square send/stop button). Differences from the source,
// on purpose: the PlusMenu slot is dropped (insurance-specific), the model
// list is Claude-only (this agent's allowlist), and the source's CSS vars
// (--txt/--muted/--inp-bg/…) are mapped onto Liminal's design tokens at the
// root so the markup could stay as close to verbatim as possible.

const CLAUDE_ICON = (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/anthropic-icon.webp" alt="Anthropic" className="h-4 w-4 object-contain" />
);

// lucide-react glyphs used by the source component, inlined (no lucide dep here)
const ARROW_UP = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </svg>
);
const SQUARE = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
  </svg>
);

interface ModelOption {
  id: string;
  label: string;
  description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: "claude-opus-4-8", label: "Claude Opus", description: "Most capable, slowest" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet", description: "Fast and smart" },
  { id: "claude-haiku-4-5", label: "Claude Haiku", description: "Fastest" },
];

// Source var names → Liminal tokens, applied at the root so the ported class
// strings below stay untouched.
const TOKEN_MAP = {
  "--border": "var(--color-border)",
  "--surface": "var(--color-surface, #ffffff)",
  "--inp-bg": "var(--color-canvas)",
  "--txt": "var(--color-text)",
  "--bg": "var(--color-surface, #ffffff)",
  "--muted": "var(--color-text-body)",
  "--muted2": "var(--color-text-muted)",
} as CSSProperties;

interface Props {
  onSend: (message: string, modelId: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming, selectedModelId, onModelChange, placeholder, autoFocus }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelMenuAbove, setModelMenuAbove] = useState(true);
  const modelRef = useRef<HTMLDivElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);

  const selectedModel = MODEL_OPTIONS.find((m) => m.id === selectedModelId) ?? MODEL_OPTIONS[0];

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const maxHeight = 144;
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, maxHeight) + "px";
      textareaRef.current.style.overflowY = textareaRef.current.scrollHeight > maxHeight ? "auto" : "hidden";
    }
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    }
    if (modelMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelMenuOpen]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed, selectedModelId);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-transparent p-1.5 sm:p-4" style={TOKEN_MAP}>
      <div className="max-w-[770px] mx-auto w-full">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 rounded-full sm:rounded-[28px] bg-[rgba(0,0,0,0.025)] border border-[rgba(0,0,0,0.15)] pl-3 pr-2 py-2 sm:p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-lg sm:bg-[var(--surface)] sm:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Ask about providers, insurers, or rates"}
            rows={1}
            className="order-2 sm:order-1 flex-1 sm:basis-full min-w-0 min-h-[40px] resize-none border-0 bg-transparent focus-visible:ring-0 p-0 px-1 sm:px-0 placeholder:text-[var(--muted2)] text-[17px] text-[var(--txt)] outline-none"
          />

          {/* Model selector */}
          <div className="relative order-3 shrink-0 sm:ml-auto" ref={modelRef}>
            <button
              ref={modelBtnRef}
              type="button"
              onClick={() => {
                if (!modelMenuOpen && modelBtnRef.current) {
                  const rect = modelBtnRef.current.getBoundingClientRect();
                  setModelMenuAbove(rect.top > 350);
                }
                setModelMenuOpen(!modelMenuOpen);
              }}
              className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--txt)] transition-colors rounded-lg p-1.5"
              aria-label={`Model: ${selectedModel.label}`}
            >
              {CLAUDE_ICON}
              <span className="text-xs font-medium">{selectedModel.label.replace("Claude ", "")}</span>
            </button>

            {modelMenuOpen && (
              <div
                className={`absolute right-0 w-[220px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden py-1 z-50 ${
                  modelMenuAbove ? "bottom-full mb-2" : "top-full mt-2"
                }`}
              >
                {MODEL_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onModelChange(m.id);
                      setModelMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-[var(--inp-bg)] transition-colors"
                  >
                    <span className="shrink-0">{CLAUDE_ICON}</span>
                    <span className="flex-1 text-left">
                      <span className="block font-medium text-[var(--txt)]">{m.label}</span>
                      <span className="block text-[11px] text-[var(--muted2)]">{m.description}</span>
                    </span>
                    {m.id === selectedModelId && (
                      <svg className="h-4 w-4 shrink-0 text-[var(--txt)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send / Stop button */}
          <button
            type="button"
            onClick={isStreaming ? onStop : handleSubmit}
            disabled={!isStreaming && !value.trim()}
            className={`order-4 h-9 w-9 sm:h-10 sm:w-10 rounded-full sm:rounded-xl shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
              isStreaming
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-[var(--txt)] hover:opacity-85 text-white"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isStreaming ? SQUARE : ARROW_UP}
          </button>
        </div>
      </div>
    </div>
  );
}
