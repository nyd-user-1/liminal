"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { Tag } from "@/components/ui/tag";

// /directory/ask — chat surface for the care-directory agent (prototype).
// Talks to POST /api/ai/directory; reference data only, no PHI. The route
// title strip says "Directory" (longest-prefix match on /directory), so this
// page renders no H1 of its own.

type Turn = { role: "user" | "assistant"; content: string; tools?: string[] };

const STARTERS = [
  "What does Cigna pay for a 60-minute therapy session?",
  "Find psychiatrists in Brooklyn accepting new patients",
  "Compare Oxford and Empire rates for medication management",
  "Which group practices get paid the most for intakes?",
];

// ── tiny read-only markdown renderer ─────────────────────────────────────────
// The agent answers in plain markdown: headings, bold, bullets, and tables.
// No markdown dependency exists in the app, and the notes editor is an editor,
// not a viewer — so this page carries the ~60 lines it needs and nothing more.

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) {
      out.push(
        <code key={k++} className="rounded bg-canvas px-1 py-0.5 text-[12px]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function cells(row: string): string[] {
  return row.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

function Markdown({ md }: { md: string }) {
  const lines = md.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // table: | a | b | followed by |---|---|
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().match(/^\|?[\s:-]+\|[\s|:-]*$/)) {
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(cells(lines[i]));
        i++;
      }
      blocks.push(
        <div key={k++} className="my-2 overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-[13px]">
            <thead>
              <tr>
                {header.map((h, j) => (
                  <th key={j} className="border-b border-border px-2 py-1.5 text-left font-semibold">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri % 2 ? "bg-canvas/60" : undefined}>
                  {r.map((c, j) => (
                    <td key={j} className="border-b border-border/60 px-2 py-1.5 align-top">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push(
        <p key={k++} className={`mt-3 mb-1 font-semibold ${h[1].length <= 2 ? "text-[15px]" : "text-[13.5px]"}`}>
          {inline(h[2])}
        </p>,
      );
      i++;
      continue;
    }

    // bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={k++} className="my-1.5 list-disc space-y-1 pl-5">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // paragraph (greedy until blank/structural line)
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(\s*[-*]\s+|#{1,4}\s|\|)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={k++} className="my-1.5 leading-relaxed">
        {inline(para.join(" "))}
      </p>,
    );
  }
  return <div className="text-[13.5px] text-text">{blocks}</div>;
}

// ── the chat page ────────────────────────────────────────────────────────────

export default function AskDirectoryPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setDraft("");
    setBusy(true);
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((prev) => [...prev, { role: "user", content: q }]);
    try {
      const res = await fetch("/api/ai/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "The assistant failed.");
      const tools = [...new Set((json.trace as Array<{ tool: string }>).map((t) => t.tool))];
      setTurns((prev) => [...prev, { role: "assistant", content: json.answer, tools }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The assistant failed.");
      // Roll the unanswered question back into the draft so it isn't lost.
      setTurns((prev) => prev.slice(0, -1));
      setDraft(q);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4">
      <div className="flex-1 overflow-y-auto py-4">
        {turns.length === 0 && !busy ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-wash text-primary">
              <Icon name="globe" size={20} />
            </span>
            <p className="text-[15px] font-semibold">Ask the directory</p>
            <p className="mt-1 max-w-md text-[13px] text-text-muted">
              126,000 NY behavioral-health providers, insurance participation, and real published
              in-network rates. Ask in plain language.
            </p>
            <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text transition-colors hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-card rounded-br-sm bg-primary px-3.5 py-2 text-[13.5px] text-white">
                    {t.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%] rounded-card rounded-bl-sm border border-border bg-surface px-4 py-3 shadow-card">
                    <Markdown md={t.content} />
                    {t.tools && t.tools.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
                        <span className="text-[11px] text-text-muted">checked:</span>
                        {t.tools.map((name) => (
                          <Tag key={name}>{name.replaceAll("_", " ")}</Tag>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-center gap-2 pl-1 text-[13px] text-text-muted">
                <Spinner size={16} />
                Searching the directory…
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
        {error && (
          <p className="mt-3 rounded-field bg-danger-tint px-3 py-2 text-[13px] text-danger">{error}</p>
        )}
      </div>

      <form
        className="sticky bottom-0 flex shrink-0 items-end gap-2 border-t border-border bg-canvas py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(draft);
            }
          }}
          rows={draft.includes("\n") ? 3 : 1}
          placeholder="Ask about providers, insurers, or rates…"
          className="min-h-10 flex-1 resize-none rounded-field border border-border bg-surface px-3 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !draft.trim()} loading={busy}>
          Ask
        </Button>
      </form>
    </div>
  );
}
