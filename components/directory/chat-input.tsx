"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PlusMenu } from "@/components/directory/plus-menu";

// ChatInput — the prompt container for /directory/ask. Layout follows the
// Nuxt UI chat template (nuxt-ui-templates/chat-vue): a soft rounded rectangle
// with the textarea on top and a controls row beneath — [+ menu] [model
// selector] bottom-left, send/stop bottom-right. No border, no shadow (per
// design ruling 2026-07-22); definition comes from the tinted fill alone.
// Auto-grow textarea, Enter-to-send, and the ArrowUp↔Square send/stop button
// carry over from the insurance ChatInput port.

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
const CHEVRON_DOWN = (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

interface ModelOption {
  id: string;
  label: string;
  description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", description: "Fastest" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Fast and smart" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", description: "Most capable, slowest" },
];

// Source var names → Liminal tokens (shared with PlusMenu, which renders inside).
const TOKEN_MAP = {
  "--border": "var(--color-border)",
  "--surface": "var(--color-surface, #ffffff)",
  "--inp-bg": "var(--color-canvas)",
  "--txt": "var(--color-text)",
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
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelMenuOpen(false);
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

  const insertPrompt = (text: string) => {
    setValue(text);
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 0);
  };

  return (
    <div className="bg-transparent p-1.5 sm:p-4" style={TOKEN_MAP}>
      <div className="max-w-[770px] mx-auto w-full">
        <div className="rounded-2xl sm:rounded-3xl bg-[var(--inp-bg)] px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-2.5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder ?? "Ask about providers, insurers, or rates..."}
            rows={1}
            className="w-full min-h-[28px] resize-none border-0 bg-transparent focus-visible:ring-0 p-0 placeholder:text-[var(--muted2)] text-[16px] text-[var(--txt)] outline-none"
          />

          {/* Controls row: + menu and model selector left, send right */}
          <div className="mt-2 flex items-center gap-1.5">
            <PlusMenu onSelect={insertPrompt} />

            <div className="relative" ref={modelRef}>
              <button
                ref={modelBtnRef}
                type="button"
                onClick={() => {
                  if (!modelMenuOpen && modelBtnRef.current) {
                    setModelMenuAbove(modelBtnRef.current.getBoundingClientRect().top > 350);
                  }
                  setModelMenuOpen(!modelMenuOpen);
                }}
                className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--txt)] transition-colors rounded-lg px-1.5 py-1"
                aria-label={`Model: ${selectedModel.label}`}
              >
                <span className="text-[13px] font-medium">{selectedModel.label}</span>
                <span className={`transition-transform ${modelMenuOpen ? "rotate-180" : ""}`}>{CHEVRON_DOWN}</span>
              </button>

              {modelMenuOpen && (
                <div
                  className={`absolute left-0 w-[230px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden py-1 z-50 ${
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

            <button
              type="button"
              onClick={isStreaming ? onStop : handleSubmit}
              disabled={!isStreaming && !value.trim()}
              className={`ml-auto h-9 w-9 rounded-xl shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
                isStreaming ? "bg-red-600 hover:bg-red-700 text-white" : "bg-[var(--txt)] hover:opacity-85 text-white"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isStreaming ? SQUARE : ARROW_UP}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
