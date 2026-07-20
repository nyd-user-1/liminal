"use client";

import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import {
  ANATOMY_FOOTNOTES,
  IN_NETWORK_SCHEMA,
  MANIFEST_FIELDS,
  TOC_SCHEMA,
  jobAnatomy,
  type CanonField,
} from "./harvest-anatomy";
import { jobDescription } from "./job-descriptions";

// The Harvest Runs dialog (TASK-WORKSPACE-V4 T3). Reuses the round-4 SchemaTree
// visual language — mono field names, muted notes, a border-left indent — but the
// tree here is the CMS canon-vs-harvested ledger (harvest-anatomy.ts), a green
// check on every field our scanner keeps and nothing on the rest. Composition of
// the Modal primitive, not a new one.

/** Harvested vs total, counted over a canon tree (the synthetic root excluded). */
function countFields(root: CanonField): { kept: number; total: number } {
  let kept = 0;
  let total = 0;
  const walk = (fields: CanonField[]) => {
    for (const f of fields) {
      total += 1;
      if (f.harvested) kept += 1;
      if (f.children) walk(f.children);
    }
  };
  walk(root.children ?? []);
  return { kept, total };
}

function FieldRow({ field }: { field: CanonField }) {
  return (
    <div className="relative py-1.5">
      <span className="absolute -left-4 top-[15px] h-px w-3 bg-border" aria-hidden />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="inline-flex w-3.5 shrink-0 translate-y-[2px] justify-center" aria-hidden>
          {field.harvested ? <Icon name="circle-check" size={14} className="text-success" /> : null}
        </span>
        <span className={`font-mono text-[13px] ${field.harvested ? "text-text" : "text-text-muted"}`}>
          {field.name}
        </span>
        <span className="text-[12px] text-text-muted">{field.type}</span>
        {field.required && <span className="text-[11px] uppercase tracking-wide text-text-muted/70">req</span>}
        {field.lands && (
          <span className="rounded-field bg-success-tint px-1.5 py-px text-[11px] font-medium text-success">
            → {field.lands}
          </span>
        )}
        {field.note && <span className="text-[12px] text-text-muted">— {field.note}</span>}
      </div>
      {field.children && field.children.length > 0 && (
        <div className="ml-[6px] mt-1 border-l border-border pl-4">
          {field.children.map((c) => (
            <FieldRow key={c.name} field={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaBlock({
  root,
  heading,
  subhead,
  extra,
}: {
  root: CanonField;
  heading: string;
  subhead: string;
  extra?: CanonField[];
}) {
  const { kept, total } = countFields(root);
  const keptTotal = kept + (extra?.filter((f) => f.harvested).length ?? 0);
  const allTotal = total + (extra?.length ?? 0);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h4 className="text-[13px] font-semibold text-text">{heading}</h4>
        <span className="text-[12px] tabular-nums text-text-muted">
          {keptTotal} of {allTotal} fields kept
        </span>
      </div>
      <p className="text-[12px] text-text-muted">{subhead}</p>
      <div className="mt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 pb-1">
          <span className="font-mono text-[13px] text-text">{root.name}</span>
          {root.note && <span className="text-[12px] text-text-muted">— {root.note}</span>}
        </div>
        <div className="ml-[6px] border-l border-border pl-4">
          {root.children?.map((c) => (
            <FieldRow key={c.name} field={c} />
          ))}
          {extra?.map((f) => (
            <FieldRow key={f.name} field={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
      <span className="text-[13px] text-text-body">{value}</span>
    </div>
  );
}

export function HarvestAnatomyDialog({ job, onClose }: { job: string; onClose: () => void }) {
  const anatomy = jobAnatomy(job);
  const isMrf = anatomy.kind === "mrf";

  return (
    <Modal open onClose={onClose} title={anatomy.title} icon="file-text" width="max-w-2xl">
      <div className="flex flex-col gap-6">
        {/* What it downloads */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-text">What it downloads</h3>
            <span className="font-mono text-[11px] text-text-muted">{job}</span>
          </div>
          <p className="text-sm leading-relaxed text-text-body">{anatomy.summary}</p>
          {isMrf ? (
            anatomy.pipeline && <KV label="Pipeline" value={anatomy.pipeline} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {anatomy.script && <KV label="Script" value={anatomy.script} />}
              {anatomy.reads && <KV label="Reads" value={anatomy.reads} />}
              {anatomy.writes && <KV label="Writes" value={anatomy.writes} />}
            </div>
          )}
          {!isMrf && (
            <p className="text-[12px] text-text-muted">{jobDescription(job)}</p>
          )}
        </section>

        {/* The canon-vs-harvested ledger — MRF jobs only. */}
        {isMrf && (
          <div className="flex flex-col gap-5 border-t border-border pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-[15px] font-semibold text-text">What we keep vs leave behind</h3>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
                <Icon name="circle-check" size={13} className="text-success" /> extracted · blank = left behind
              </span>
            </div>

            <SchemaBlock
              root={IN_NETWORK_SCHEMA}
              heading="In-network-rates file"
              subhead="Every field of the CMS Transparency-in-Coverage schema (v1.3.1 · v2.0) our scanner reads."
              extra={MANIFEST_FIELDS}
            />

            <SchemaBlock
              root={TOC_SCHEMA}
              heading="Table-of-contents file"
              subhead="Read by hand to mint manifests — a check means the field feeds a downstream layer, not that the scanner extracts it."
            />

            <ul className="flex flex-col gap-1.5 border-t border-border pt-4">
              {ANATOMY_FOOTNOTES.map((f) => (
                <li key={f} className="flex gap-2 text-[12px] text-text-muted">
                  <span aria-hidden>·</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
