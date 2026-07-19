import { TABLE_GROUPS } from "@/lib/table-atlas.mjs";

// A thin, typed read over lib/table-atlas.mjs for the shared schema-tree Dialog
// (schema-tree.tsx). The atlas already declares, per table, what it means, the
// key columns its joins ride on, and which tables it relates to — so the tree a
// founder opens off a count card or an Observatory card is drawn from the same
// source db-atlas and the data dictionary read, never a hand-copy that can drift.

interface AtlasTable {
  name: string;
  meaning: string;
  keys: string[];
  joins: string[];
  blurb?: string;
}
interface AtlasGroup {
  tables: AtlasTable[];
}

const BY_NAME: Map<string, AtlasTable> = new Map(
  (TABLE_GROUPS as AtlasGroup[]).flatMap((g) => g.tables).map((t) => [t.name, t]),
);

export interface SchemaNode {
  /** The relation name, as it exists in the database. */
  name: string;
  /** One-line plain-language note (the atlas blurb, or the meaning's first clause). */
  note: string;
  /** The columns this table's declared joins ride on. */
  keys: string[];
}

export interface SchemaTreeData {
  root: SchemaNode;
  related: SchemaNode[];
}

/** The blurb if the atlas carries one, else the meaning trimmed to its first
 *  sentence — enough to say what the table is without printing a paragraph. */
function noteOf(t: AtlasTable): string {
  if (t.blurb) return t.blurb;
  const end = t.meaning.search(/[.;]/);
  return end === -1 ? t.meaning : t.meaning.slice(0, end + 1);
}

function nodeOf(t: AtlasTable): SchemaNode {
  return { name: t.name, note: noteOf(t), keys: t.keys };
}

/** Root table → the tables it joins to (with their key columns). Returns null
 *  when the root isn't a registered relation. */
export function schemaTree(root: string): SchemaTreeData | null {
  const t = BY_NAME.get(root);
  if (!t) return null;
  const related = t.joins.map((j) => BY_NAME.get(j)).filter((x): x is AtlasTable => !!x).map(nodeOf);
  return { root: nodeOf(t), related };
}
