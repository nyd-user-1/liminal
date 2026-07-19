"use client";

import { Modal } from "@/components/ui/modal";
import { schemaTree } from "@/lib/schema-atlas";

// The shared schema-tree Dialog — one component behind every count card (the
// Coverage & growth group) and every Observatory / Platform-data card. Given a
// root relation it draws the two-level tree the atlas declares: the root, then
// the tables it joins to and the key columns each join rides on. Presentation
// only; the shape comes from lib/schema-atlas.ts (→ lib/table-atlas.mjs), so it
// can never disagree with the data dictionary or the db-atlas.

function KeyCols({ keys }: { keys: string[] }) {
  if (keys.length === 0) return null;
  return <span className="font-mono text-[12px] text-text-muted">{keys.join(" · ")}</span>;
}

export function SchemaTree({
  root,
  title,
  onClose,
}: {
  /** The relation the tree is rooted on (must exist in the atlas). */
  root: string;
  /** The dialog heading — the object's display label, e.g. "Providers". */
  title: string;
  onClose: () => void;
}) {
  const tree = schemaTree(root);

  return (
    <Modal open onClose={onClose} title={title} icon="grid" width="max-w-xl">
      {!tree ? (
        <p className="text-sm text-text-muted">No schema is registered for this object yet.</p>
      ) : (
        <div className="flex flex-col">
          <div className="flex flex-wrap items-baseline gap-x-2 pb-1">
            <span className="font-mono text-[13px] text-text">{tree.root.name}</span>
            <span className="text-[13px] text-text-muted">— root · {tree.root.note}</span>
          </div>
          {tree.related.length > 0 && (
            <div className="ml-[7px] border-l border-border pl-4">
              {tree.related.map((t) => (
                <div key={t.name} className="relative py-2">
                  <span className="absolute -left-4 top-[18px] h-px w-3 bg-border" aria-hidden />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-[13px] text-text">{t.name}</span>
                    <span className="text-[13px] text-text-muted">{t.note}</span>
                  </div>
                  <div className="mt-0.5">
                    <KeyCols keys={t.keys} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
