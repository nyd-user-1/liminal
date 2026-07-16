import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import type { DictionaryGroup, DictionaryTable } from "@/lib/repos/admin";
import { CopyCard } from "./copy-card";

// The observatory — the platform inventory as cards. Every card answers four
// questions in the same order: how much (the number), what is it (plain
// language), where does it show up (the page link), and where does it live
// (the table name, mono). That last pair is the point: the dashboard should
// teach which page is powered by which table.
//
// The rows come from lib/repos/admin.ts — the same registry /admin/data
// renders as a table. This file is presentation only; nothing is computed here.

function formatCount(t: DictionaryTable): string {
  if (t.count === null) return "—";
  return `${t.countKind === "estimate" ? "≈" : ""}${t.count.toLocaleString("en-US")}`;
}

/** The card as one terminal-paste-ready line — what a click puts on the
 *  clipboard. Reads like the card, front to back. */
function copyText(t: DictionaryTable): string {
  const parts: string[] = [];
  if (t.planned) parts.push(`${t.name} — NOT BUILT YET (${t.planned})`);
  else if (t.missing) parts.push(`${t.name} — not yet loaded`);
  else parts.push(`${t.name} — ${formatCount(t)} rows`);
  parts.push(t.blurb ?? t.meaning);
  for (const f of t.facts ?? []) parts.push(`${f.label}: ${f.value}`);
  if (t.powers) parts.push(`powers ${t.powers.label} (${t.powers.href})`);
  return parts.join(" · ");
}

function TableCard({ t }: { t: DictionaryTable }) {
  const dim = t.planned || t.missing;
  return (
    <CopyCard text={copyText(t)}>
      <Card className={`flex h-full min-w-0 flex-col gap-3 p-5 ${dim ? "opacity-70" : ""}`}>
      {t.planned ? (
        <Badge variant="neutral" className="self-start">
          Not built yet
        </Badge>
      ) : t.missing ? (
        <Badge variant="warning" className="self-start">
          Not yet loaded
        </Badge>
      ) : (
        <span className="text-[28px] font-bold leading-none tabular-nums text-text">{formatCount(t)}</span>
      )}

      <p className="flex-1 text-sm leading-relaxed text-text-muted">{t.blurb ?? t.meaning}</p>

      {t.facts && t.facts.length > 0 && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          {t.facts.map((f) => (
            <div key={f.label} className="flex items-baseline gap-1.5">
              <dt className="text-[11px] uppercase tracking-wider text-text-muted">{f.label}</dt>
              <dd className="text-sm font-semibold tabular-nums text-text">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* The teaching pair, on one line: the table it lives in → the page it
          powers. (It also keeps the wide numbers above out of a flex row with
          a shrink-0 link, which overflowed the card at tablet widths.) */}
      <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2.5">
        <p className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-wide text-text-muted" title={t.name}>
          {t.planned ? `${t.name} · ${t.planned}` : t.name}
        </p>
        {t.powers && (
          <TextLink href={t.powers.href} className="shrink-0 text-[13px]">
            {t.powers.label}
          </TextLink>
        )}
      </div>
      </Card>
    </CopyCard>
  );
}

export function Observatory({ groups }: { groups: DictionaryGroup[] }) {
  return (
    <div className="flex flex-col gap-8">
      {groups
        .filter((g) => g.platform)
        .map((g) => (
          <section key={g.title} className="flex flex-col gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-text">{g.title}</h3>
              {g.blurb && <p className="mt-0.5 text-sm text-text-muted">{g.blurb}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.tables.map((t) => (
                <TableCard key={t.name} t={t} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
