import type { ReactNode } from "react";

// Tiny read-only markdown renderer for agent answers: headings, bold, bullets,
// and tables. No markdown dependency exists in the app, and the notes editor
// is an editor, not a viewer — so this carries the ~60 lines it needs.

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

export function Markdown({ md }: { md: string }) {
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
