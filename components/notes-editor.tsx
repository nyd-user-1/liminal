"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { EditorState, Plugin, TextSelection, type Transaction } from "prosemirror-state";
import { EditorView, Decoration, DecorationSet } from "prosemirror-view";
import { Slice } from "prosemirror-model";
import { type MarkType, type NodeType, type Attrs } from "prosemirror-model";
import { schema, defaultMarkdownParser, defaultMarkdownSerializer } from "prosemirror-markdown";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, setBlockType, toggleMark, chainCommands, exitCode, wrapIn } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from "prosemirror-inputrules";
import { wrapInList, splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";

// Clinical-notes writing engine — ProseMirror configured as a WYSIWYG
// *markdown* editor (adapted from hq/app/ui/prosemirror-editor.tsx, restyled
// for the Leuk light theme). Value in and out is a markdown string, so
// notes.body_md stays plain markdown. Linear-style affordances: markdown
// input rules ("## " → heading, "- " → list, "**b**" → bold as you type) and
// a "/" slash menu for block insertion.
//
// The imperative handle (ref) powers Ask AI: read the current selection as
// text, insert markdown after the current block, or replace the selection.

export interface NotesEditorHandle {
  /** Plain text of the current selection ("" when collapsed). */
  getSelectionText(): string;
  /** Parse markdown and insert it after the block containing the selection. */
  insertMarkdown(md: string): void;
  /** Parse markdown and replace the current selection with it. */
  replaceSelection(md: string): void;
  focus(): void;
}

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  /** ⌘S inside the editor — wired so save works while the view has focus */
  onSave?: () => void;
  autoFocus?: boolean;
}

// ---- input-rule helpers ----------------------------------------------------

function markInputRule(regexp: RegExp, markType: MarkType) {
  return new InputRule(regexp, (state, match, start, end) => {
    const [full, content] = match;
    if (!content) return null;
    const tr = state.tr;
    const textStart = start + full.indexOf(content);
    const textEnd = textStart + content.length;
    if (textEnd < end) tr.delete(textEnd, end);
    if (textStart > start) tr.delete(start, textStart);
    tr.addMark(start, start + content.length, markType.create());
    tr.removeStoredMark(markType);
    return tr;
  });
}

function buildInputRules() {
  const rules: InputRule[] = [
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (m) => ({ level: m[1].length })),
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    wrappingInputRule(
      /^(\d+)\.\s$/,
      schema.nodes.ordered_list,
      (m) => ({ order: +m[1] }),
      (m, node) => node.childCount + (node.attrs.order as number) === +m[1],
    ),
    textblockTypeInputRule(/^```$/, schema.nodes.code_block),
    new InputRule(/^(?:---|\*\*\*|___)$/, (state, _m, start, end) =>
      state.tr.replaceRangeWith(start, end, schema.nodes.horizontal_rule.create()),
    ),
    markInputRule(/\*\*([^*]+)\*\*$/, schema.marks.strong),
    markInputRule(/(?:^|[^*\w])\*([^*\s][^*]*)\*$/, schema.marks.em),
    markInputRule(/`([^`]+)`$/, schema.marks.code),
  ];
  return inputRules({ rules });
}

// ---- placeholder -----------------------------------------------------------

function placeholderPlugin(text: string) {
  return new Plugin({
    props: {
      decorations(state) {
        const { doc } = state;
        const empty =
          doc.childCount === 1 && doc.firstChild?.isTextblock && doc.firstChild.content.size === 0;
        if (!empty) return null;
        const deco = Decoration.node(0, doc.firstChild!.nodeSize, {
          "data-placeholder": text,
          class: "lim-prose-empty",
        });
        return DecorationSet.create(doc, [deco]);
      },
    },
  });
}

// ---- slash menu ------------------------------------------------------------

type SlashItem = {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  run: (view: EditorView) => void;
};

const SVG = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function applySlash(
  view: EditorView,
  cmd: (state: EditorState, dispatch: (tr: Transaction) => void) => boolean,
) {
  const { state, dispatch } = view;
  const { $from } = state.selection;
  const start = $from.start();
  dispatch(state.tr.delete(start, $from.pos));
  cmd(view.state, view.dispatch);
  view.focus();
}

const block = (type: NodeType, attrs?: Attrs) => (view: EditorView) =>
  applySlash(view, setBlockType(type, attrs));
const list = (type: NodeType) => (view: EditorView) => applySlash(view, wrapInList(type));

const SLASH_ITEMS: SlashItem[] = [
  {
    key: "h1",
    label: "Heading 1",
    hint: "#",
    icon: <span className="font-mono text-[11px] font-semibold">H1</span>,
    run: block(schema.nodes.heading, { level: 1 }),
  },
  {
    key: "h2",
    label: "Heading 2",
    hint: "##",
    icon: <span className="font-mono text-[11px] font-semibold">H2</span>,
    run: block(schema.nodes.heading, { level: 2 }),
  },
  {
    key: "h3",
    label: "Heading 3",
    hint: "###",
    icon: <span className="font-mono text-[11px] font-semibold">H3</span>,
    run: block(schema.nodes.heading, { level: 3 }),
  },
  {
    key: "bullet",
    label: "Bulleted list",
    hint: "-",
    icon: (
      <svg {...SVG}>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <circle cx="3.5" cy="6" r="0.5" fill="currentColor" />
        <circle cx="3.5" cy="12" r="0.5" fill="currentColor" />
        <circle cx="3.5" cy="18" r="0.5" fill="currentColor" />
      </svg>
    ),
    run: list(schema.nodes.bullet_list),
  },
  {
    key: "ordered",
    label: "Numbered list",
    hint: "1.",
    icon: (
      <svg {...SVG}>
        <path d="M10 6h11M10 12h11M10 18h11" />
        <path d="M4 6h1v4M4 10h2" />
        <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
      </svg>
    ),
    run: list(schema.nodes.ordered_list),
  },
  {
    key: "quote",
    label: "Blockquote",
    hint: ">",
    icon: (
      <svg {...SVG}>
        <path d="M17 6H3M21 12H8M21 18H8" />
      </svg>
    ),
    run: (view) => applySlash(view, wrapIn(schema.nodes.blockquote)),
  },
  {
    key: "divider",
    label: "Divider",
    hint: "---",
    icon: (
      <svg {...SVG}>
        <path d="M3 12h18" />
      </svg>
    ),
    run: (view) => {
      const { state, dispatch } = view;
      const { $from } = state.selection;
      dispatch(
        state.tr
          .delete($from.start(), $from.pos)
          .replaceSelectionWith(schema.nodes.horizontal_rule.create()),
      );
      view.focus();
    },
  },
];

type SlashState = { query: string; left: number; top: number } | null;

// ---- light-theme prose styles (scoped by .lim-prose) ------------------------

const PROSE_CSS = `
.lim-prose { font-size: 15px; line-height: 1.7; color: #4B5563; caret-color: #3F8290; }
.lim-prose ::selection { background: #B7D8DD; }
.lim-prose h1, .lim-prose h2, .lim-prose h3, .lim-prose h4 { color: #212A47; font-weight: 600; line-height: 1.3; margin: 1.25em 0 0.4em; }
.lim-prose h1 { font-size: 24px; font-weight: 700; }
.lim-prose h2 { font-size: 19px; }
.lim-prose h3 { font-size: 16px; }
.lim-prose > h1:first-child, .lim-prose > h2:first-child, .lim-prose > h3:first-child { margin-top: 0; }
.lim-prose p { margin: 0.45em 0; }
.lim-prose ul, .lim-prose ol { padding-left: 1.4em; margin: 0.45em 0; }
.lim-prose ul { list-style: disc; }
.lim-prose ol { list-style: decimal; }
.lim-prose li > p { margin: 0.15em 0; }
.lim-prose blockquote { border-left: 3px solid #B7D8DD; margin: 0.6em 0; padding-left: 1em; color: #6B7280; }
.lim-prose code { background: #F3F4F6; border: 1px solid #E6E7EB; border-radius: 4px; padding: 0.1em 0.35em; font-size: 13px; color: #212A47; }
.lim-prose pre { background: #F3F4F6; border: 1px solid #E6E7EB; border-radius: 8px; padding: 12px 14px; margin: 0.6em 0; overflow-x: auto; }
.lim-prose pre code { background: none; border: none; padding: 0; }
.lim-prose hr { border: none; border-top: 1px solid #E6E7EB; margin: 1.2em 0; }
.lim-prose strong { color: #212A47; }
.lim-prose a { color: #3F8290; text-decoration: underline; }
.lim-prose .lim-prose-empty::before { content: attr(data-placeholder); color: #9CA3AF; float: left; height: 0; pointer-events: none; }
`;

// ---- the component ---------------------------------------------------------

export const NotesEditor = forwardRef<NotesEditorHandle, Props>(function NotesEditor(
  {
    value,
    onChange,
    readOnly = false,
    placeholder = "Write, or type / for sections…",
    onSave,
    autoFocus = false,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastEmitted = useRef(value);
  const [slash, setSlash] = useState<SlashState>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashRef = useRef<{ open: boolean; index: number; items: SlashItem[] }>({
    open: false,
    index: 0,
    items: SLASH_ITEMS,
  });
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [onChange, onSave]);

  const filtered = useMemo(() => {
    if (!slash) return SLASH_ITEMS;
    const q = slash.query.toLowerCase();
    return SLASH_ITEMS.filter((i) => i.label.toLowerCase().includes(q) || i.key.startsWith(q));
  }, [slash]);
  useEffect(() => {
    slashRef.current = { open: !!slash && filtered.length > 0, index: slashIndex, items: filtered };
  }, [slash, filtered, slashIndex]);

  const readSlash = useCallback((view: EditorView) => {
    const { $from, empty } = view.state.selection;
    if (!empty || !$from.parent.isTextblock || $from.parent.type === schema.nodes.code_block) {
      setSlash(null);
      return;
    }
    const before = $from.parent.textBetween(0, $from.parentOffset, "￼");
    const m = before.match(/^\/(\w*)$/);
    if (!m) {
      setSlash(null);
      return;
    }
    const coords = view.coordsAtPos($from.pos);
    setSlash((prev) => {
      if (prev?.query !== m[1]) setSlashIndex(0);
      return { query: m[1], left: coords.left, top: coords.bottom + 4 };
    });
  }, []);

  // Ask-AI bridge — selection read + markdown insert/replace.
  useImperativeHandle(
    ref,
    () => ({
      getSelectionText() {
        const view = viewRef.current;
        if (!view) return "";
        const { from, to } = view.state.selection;
        return from === to ? "" : view.state.doc.textBetween(from, to, "\n");
      },
      insertMarkdown(md: string) {
        const view = viewRef.current;
        if (!view) return;
        const doc = defaultMarkdownParser.parse(md);
        if (!doc) return;
        const { state } = view;
        const $to = state.selection.$to;
        // after the top-level block containing the selection end (one-line spacer feel)
        const pos = $to.depth > 0 ? $to.after(1) : state.doc.content.size;
        view.dispatch(state.tr.insert(pos, doc.content).scrollIntoView());
        view.focus();
      },
      replaceSelection(md: string) {
        const view = viewRef.current;
        if (!view) return;
        const doc = defaultMarkdownParser.parse(md);
        if (!doc) return;
        view.dispatch(
          view.state.tr.replaceSelection(new Slice(doc.content, 0, 0)).scrollIntoView(),
        );
        view.focus();
      },
      focus() {
        viewRef.current?.focus();
      },
    }),
    [],
  );

  // Build the view once per mount (rebuilds when readOnly flips, e.g. on lock).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let doc;
    try {
      doc = defaultMarkdownParser.parse(lastEmitted.current);
    } catch {
      doc = schema.node("doc", null, [schema.node("paragraph")]);
    }
    const state = EditorState.create({
      schema,
      doc: doc ?? undefined,
      plugins: [
        buildInputRules(),
        // slash-menu keys run FIRST so ↑/↓/↵/esc drive the menu, not the doc
        keymap({
          ArrowDown: () => {
            const s = slashRef.current;
            if (!s.open) return false;
            setSlashIndex((i) => Math.min(i + 1, s.items.length - 1));
            return true;
          },
          ArrowUp: () => {
            const s = slashRef.current;
            if (!s.open) return false;
            setSlashIndex((i) => Math.max(i - 1, 0));
            return true;
          },
          Enter: () => {
            const s = slashRef.current;
            if (!s.open) return false;
            const item = s.items[s.index];
            if (item && viewRef.current) {
              item.run(viewRef.current);
              setSlash(null);
            }
            return true;
          },
          Escape: () => {
            if (!slashRef.current.open) return false;
            setSlash(null);
            return true;
          },
        }),
        keymap({
          "Mod-z": undo,
          "Mod-y": redo,
          "Mod-Shift-z": redo,
          "Mod-b": toggleMark(schema.marks.strong),
          "Mod-i": toggleMark(schema.marks.em),
          "Mod-e": toggleMark(schema.marks.code),
          "Mod-Alt-1": setBlockType(schema.nodes.heading, { level: 1 }),
          "Mod-Alt-2": setBlockType(schema.nodes.heading, { level: 2 }),
          "Mod-Alt-3": setBlockType(schema.nodes.heading, { level: 3 }),
          "Mod-Alt-0": setBlockType(schema.nodes.paragraph),
          "Mod-Shift-8": wrapInList(schema.nodes.bullet_list),
          "Mod-Shift-9": wrapInList(schema.nodes.ordered_list),
          Enter: splitListItem(schema.nodes.list_item),
          Tab: sinkListItem(schema.nodes.list_item),
          "Shift-Tab": liftListItem(schema.nodes.list_item),
          "Shift-Enter": chainCommands(exitCode, (state, dispatch) => {
            if (dispatch)
              dispatch(
                state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView(),
              );
            return true;
          }),
          "Mod-s": () => {
            onSaveRef.current?.();
            return true; // always swallow — never the browser save dialog
          },
        }),
        keymap(baseKeymap),
        history(),
        dropCursor({ color: "#3F8290", width: 2 }),
        gapCursor(),
        placeholderPlugin(placeholder),
      ],
    });
    const view = new EditorView(host, {
      state,
      editable: () => !readOnly,
      attributes: { class: "lim-prose focus:outline-none", spellcheck: "false" },
      dispatchTransaction(tr) {
        const next = view.state.apply(tr);
        view.updateState(next);
        if (tr.docChanged) {
          const md = defaultMarkdownSerializer.serialize(next.doc);
          lastEmitted.current = md;
          onChangeRef.current(md);
        }
        readSlash(view);
      },
    });
    viewRef.current = view;
    if (autoFocus && !readOnly) {
      const end = view.state.doc.content.size;
      view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(end))));
      view.focus();
    }
    return () => {
      viewRef.current = null;
      view.destroy();
    };
    // mount-once: the doc lives in the view; parents remount per note (key=id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // External value change (server refresh) → replace the doc in place.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === lastEmitted.current) return;
    let doc;
    try {
      doc = defaultMarkdownParser.parse(value);
    } catch {
      return;
    }
    if (!doc) return;
    lastEmitted.current = value;
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content));
  }, [value]);

  const pick = (item: SlashItem) => {
    const view = viewRef.current;
    if (!view) return;
    item.run(view);
    setSlash(null);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <style>{PROSE_CSS}</style>
      <div ref={hostRef} className="min-h-0 flex-1 overflow-y-auto" />
      {slash && filtered.length > 0 && (
        <div
          style={{ left: slash.left, top: slash.top }}
          className="fixed z-100 flex w-60 flex-col rounded-card border border-border bg-surface p-1 shadow-menu"
        >
          {filtered.map((item, i) => (
            <button
              key={item.key}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // keep the editor's selection
                pick(item);
              }}
              onMouseEnter={() => setSlashIndex(i)}
              className={`flex items-center justify-between gap-3 rounded-field px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
                i === slashIndex ? "bg-teal-100 text-primary" : "text-text-body"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="flex w-4 shrink-0 items-center justify-center text-text-muted">
                  {item.icon}
                </span>
                {item.label}
              </span>
              <span className="font-mono text-[11px] text-text-muted">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
