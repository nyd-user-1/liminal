"use client";

import { useState, type ReactNode } from "react";
import { AccordionSection } from "@/components/ui/accordion-section";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge, CountBadge, DotBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, SettingsCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { ColorSwatch, EVENT_COLORS } from "@/components/ui/color-swatch";
import { DatePicker } from "@/components/ui/date-picker";
import { Divider } from "@/components/ui/divider";
import { DropdownMenu, MenuDivider, MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { FileUpload } from "@/components/ui/file-upload";
import { FilterChip } from "@/components/ui/filter-chip";
import { IconButton } from "@/components/ui/icon-button";
import { Icon, IconSquare, type IconName } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { ListRow } from "@/components/ui/list-row";
import { Logo } from "@/components/ui/logo";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Radio } from "@/components/ui/radio";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { Skeleton, Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { Stepper } from "@/components/ui/stepper";
import { Table, Td, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/tag";
import { TextLink } from "@/components/ui/text-link";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { Toolbar } from "@/components/ui/toolbar";
import { Tooltip } from "@/components/ui/tooltip";
import { UserChip } from "@/components/ui/user-chip";

// Design System — Liminal foundations + the full shared UI kit, plus a
// reference index of the feature components.
//
// Kept deliberately light:
//   • Tabs render only the ACTIVE panel (see `tab` switch) — the other panels
//     aren't in the DOM.
//   • Primitives are presentational, so they're demoed live.
//   • Feature components (ProseMirror editor, WebRTC stage, data-backed
//     dashboards…) are cataloged as METADATA only — never imported — so this
//     route never bundles their heavy dependencies.

// ── Foundations data ─────────────────────────────────────────────────────────

const BRAND = [
  { name: "primary", hex: "#3F8290" },
  { name: "primary-hover", hex: "#35707C" },
  { name: "primary-weak", hex: "#B7D8DD" },
  { name: "accent", hex: "#F0AE55" },
  { name: "accent-ink", hex: "#C58A2E" },
];
const CHROME = [
  { name: "sidebar-bg", hex: "#1C2440" },
  { name: "sidebar-active", hex: "#2B3557" },
  { name: "canvas", hex: "#F2F3F6" },
  { name: "surface", hex: "#FFFFFF" },
  { name: "border", hex: "#E6E7EB" },
];
const TEXT = [
  { name: "text", hex: "#212A47" },
  { name: "text-body", hex: "#4B5563" },
  { name: "text-muted", hex: "#9CA3AF" },
];
const STATUS = [
  { name: "success", hex: "#16A34A" },
  { name: "warning", hex: "#B7791F" },
  { name: "danger", hex: "#DC2626" },
  { name: "info", hex: "#35707C" },
];

// ── Feature-component catalog (metadata only — nothing imported) ──────────────

const FEATURES: Array<{
  area: string;
  items: Array<{ name: string; path: string; desc: string; composedOf?: Array<{ name: string; feature?: boolean }> }>;
}> = [
  {
    area: "Billing",
    items: [
      {
        name: "BillingDashboard",
        path: "billing/billing-dashboard.tsx",
        desc: "Invoices tab — StatCards + Toolbar + table + row actions.",
        // Primitives actually imported by the file (verified against its import block).
        composedOf: [
          { name: "PageHeader" }, { name: "StatCard" }, { name: "Tabs" }, { name: "Toolbar" },
          { name: "SearchInput" }, { name: "FilterChip" }, { name: "Table" }, { name: "ListRow" },
          { name: "Pagination" }, { name: "KebabMenu" }, { name: "EmptyState" }, { name: "Button" },
          { name: "TextLink" },
        ],
      },
      {
        name: "ClientBilling",
        path: "billing/client-billing.tsx",
        desc: "Client Billing tab — async server wrapper.",
        // No primitives directly: fetches data and delegates to a feature component.
        composedOf: [{ name: "ClientInvoices", feature: true }],
      },
      {
        name: "ClientInvoices",
        path: "billing/client-invoices.tsx",
        desc: "StatCards + the client's invoice list.",
        // Mixed: composes primitives AND three sibling features.
        composedOf: [
          { name: "StatCard" }, { name: "Table" }, { name: "KebabMenu" }, { name: "EmptyState" },
          { name: "Button" }, { name: "TextLink" },
          { name: "InvoiceStatusBadge", feature: true }, { name: "NewInvoicePanel", feature: true },
          { name: "RecordPaymentModal", feature: true },
        ],
      },
      {
        name: "InvoiceDetail",
        path: "billing/invoice-detail.tsx",
        desc: "Invoice header, actions, and line items.",
        composedOf: [
          { name: "Breadcrumb" }, { name: "Card" }, { name: "Table" }, { name: "Banner" },
          { name: "KebabMenu" }, { name: "Button" }, { name: "Divider" },
          { name: "InvoiceStatusBadge", feature: true }, { name: "RecordPaymentModal", feature: true },
        ],
      },
      {
        name: "InvoiceStatusBadge",
        path: "billing/invoice-status-badge.tsx",
        desc: "Maps invoice status → Badge variant.",
        composedOf: [{ name: "Badge" }],
      },
      {
        name: "NewInvoicePanel",
        path: "billing/new-invoice-panel.tsx",
        desc: "New-invoice SidePanel with client picker.",
        composedOf: [
          { name: "SidePanel" }, { name: "Field" }, { name: "Select" }, { name: "DatePicker" },
          { name: "Button" }, { name: "TextLink" },
        ],
      },
      {
        name: "PayerPanel",
        path: "billing/payer-panel.tsx",
        desc: "New / edit payer SidePanel.",
        composedOf: [{ name: "SidePanel" }, { name: "Field" }, { name: "Button" }],
      },
      {
        name: "PrintActions",
        path: "billing/print-actions.tsx",
        desc: "Screen-only toolbar on the print view.",
        composedOf: [{ name: "Button" }],
      },
      {
        name: "RecordPaymentModal",
        path: "billing/record-payment-modal.tsx",
        desc: "Record-payment Modal.",
        composedOf: [{ name: "Modal" }, { name: "Field" }, { name: "Select" }, { name: "Button" }],
      },
    ],
  },
  {
    area: "Telehealth call",
    items: [
      {
        name: "CallStage",
        path: "call/call-stage.tsx",
        desc: "Full-viewport WebRTC telehealth stage.",
        composedOf: [
          { name: "Card" }, { name: "Toggle" }, { name: "Spinner" }, { name: "Divider" }, { name: "Button" },
          { name: "CallHeader", feature: true }, { name: "CallControls", feature: true },
          { name: "VideoTile", feature: true }, { name: "ScribePanel", feature: true },
          { name: "useWebRTC", feature: true },
        ],
      },
      {
        name: "CallHeader",
        path: "call/call-header.tsx",
        desc: "Top strip on the dark stage — camera chip + timer.",
        composedOf: [{ name: "Badge" }],
      },
      { name: "CallControls", path: "call/call-controls.tsx", desc: "Bottom control toolbar on the stage." },
      {
        name: "VideoTile",
        path: "call/video-tile.tsx",
        desc: "Participant surface on the dark stage.",
        composedOf: [{ name: "Avatar" }],
      },
      { name: "useWebRTC", path: "call/use-webrtc.ts", desc: "Native-WebRTC 1-on-1 call hook (/api/signal)." },
    ],
  },
  {
    area: "Forms & intake",
    items: [
      {
        name: "FormBuilder",
        path: "forms/form-builder.tsx",
        desc: "Palette · question cards · settings builder.",
        composedOf: [
          { name: "Field" }, { name: "Textarea" }, { name: "Toggle" }, { name: "IconButton" },
          { name: "Button" }, { name: "Badge" }, { name: "SendFormModal", feature: true },
        ],
      },
      {
        name: "FormsTemplates",
        path: "forms/forms-templates.tsx",
        desc: "Forms tab of the Templates page.",
        composedOf: [
          { name: "Card" }, { name: "EmptyState" }, { name: "KebabMenu" }, { name: "Spinner" },
          { name: "Button" }, { name: "Badge" }, { name: "SendFormModal", feature: true },
        ],
      },
      {
        name: "IntakeWizard",
        path: "forms/intake-wizard.tsx",
        desc: "Portal intake wizard — Stepper-driven fill.",
        composedOf: [
          { name: "Stepper" }, { name: "Field" }, { name: "Select" }, { name: "Checkbox" },
          { name: "Radio" }, { name: "ChoiceChip" }, { name: "Textarea" }, { name: "TextLink" },
          { name: "Button" }, { name: "Badge" },
        ],
      },
      {
        name: "SendFormModal",
        path: "forms/send-form-modal.tsx",
        desc: "'Send to client' modal.",
        composedOf: [{ name: "Modal" }, { name: "Select" }, { name: "Button" }],
      },
    ],
  },
  {
    area: "Messaging",
    items: [
      {
        name: "InboxList",
        path: "messaging/inbox-list.tsx",
        desc: "Practitioner inbox — Compose + Open/Closed tabs.",
        composedOf: [
          { name: "PageHeader" }, { name: "Tabs" }, { name: "SearchInput" }, { name: "ListRow" },
          { name: "EmptyState" }, { name: "Modal" }, { name: "Field" }, { name: "Textarea" },
          { name: "Select" }, { name: "Avatar" }, { name: "Button" }, { name: "Badge" },
        ],
      },
      {
        name: "ThreadView",
        path: "messaging/thread-view.tsx",
        desc: "Shared secure-messaging thread pane.",
        composedOf: [{ name: "Avatar" }, { name: "Badge" }, { name: "Button" }],
      },
    ],
  },
  {
    area: "Notes & AI scribe",
    items: [
      { name: "NotesEditor", path: "notes-editor.tsx", desc: "Clinical-notes ProseMirror WYSIWYG engine." },
      {
        name: "ClientNotes",
        path: "notes/client-notes.tsx",
        desc: "Client Documentation tab.",
        composedOf: [
          { name: "EmptyState" }, { name: "KebabMenu" }, { name: "DropdownMenu" }, { name: "Tag" },
          { name: "Spinner" }, { name: "Button" }, { name: "Badge" },
          { name: "NoteSheet", feature: true },
        ],
      },
      {
        name: "NoteSheet",
        path: "notes/note-sheet.tsx",
        desc: "Full-screen slide-up document surface.",
        composedOf: [
          { name: "Tabs" }, { name: "Card" }, { name: "AccordionSection" }, { name: "Modal" },
          { name: "KebabMenu" }, { name: "IconButton" }, { name: "Avatar" }, { name: "Spinner" },
          { name: "TextLink" }, { name: "Button" }, { name: "Badge" },
          { name: "NotesEditor", feature: true }, { name: "AskAiPanel", feature: true },
          { name: "AiBits", feature: true },
        ],
      },
      {
        name: "ScribePanel",
        path: "notes/scribe-panel.tsx",
        desc: "Docked AI Scribe panel on the call screen.",
        composedOf: [
          { name: "Tabs" }, { name: "Banner" }, { name: "Select" }, { name: "Field" },
          { name: "Textarea" }, { name: "ChoiceChip" }, { name: "IconButton" }, { name: "Spinner" },
          { name: "Divider" }, { name: "Button" }, { name: "Badge" },
          { name: "AiBits", feature: true }, { name: "NoteSheet", feature: true },
        ],
      },
      {
        name: "AskAiPanel",
        path: "notes/ask-ai-panel.tsx",
        desc: "Ask-AI chat panel in a SidePanel.",
        composedOf: [
          { name: "SidePanel" }, { name: "IconButton" }, { name: "TextLink" }, { name: "Badge" },
        ],
      },
      { name: "AiBits", path: "notes/ai-bits.tsx", desc: "TrendList · TranscriptPanel · ChapterList." },
    ],
  },
  {
    area: "Shell",
    items: [
      {
        name: "AppShell",
        path: "shell/app-shell.tsx",
        desc: "Sidebar + main column (TopBar + canvas).",
        composedOf: [{ name: "Sidebar", feature: true }, { name: "TopBar", feature: true }],
      },
      {
        name: "Sidebar",
        path: "shell/sidebar.tsx",
        desc: "Navy nav column + bottom-left account menu.",
        composedOf: [
          { name: "UserChip" }, { name: "DropdownMenu" }, { name: "Avatar" }, { name: "Logo" },
          { name: "Badge" },
        ],
      },
      {
        name: "TopBar",
        path: "shell/topbar.tsx",
        desc: "White top strip — title + bell + avatar menu.",
        composedOf: [
          { name: "UserChip" }, { name: "DropdownMenu" }, { name: "IconButton" }, { name: "Avatar" },
        ],
      },
      { name: "NavPanel", path: "shell/nav-panel.tsx", desc: "Settings secondary nav panel." },
    ],
  },
];

// ── Click-to-copy payloads ────────────────────────────────────────────────────
// Copying a card yields the EXACT import line (file path + named exports), so a
// pasted line tells any future session precisely what to reuse — no drift.

const KIT_IMPORTS: Record<string, string> = {
  Button: 'import { Button } from "@/components/ui/button";',
  IconButton: 'import { IconButton } from "@/components/ui/icon-button";',
  TextLink: 'import { TextLink } from "@/components/ui/text-link";',
  Field: 'import { Field } from "@/components/ui/field";',
  Textarea: 'import { Textarea } from "@/components/ui/textarea";',
  Select: 'import { Select } from "@/components/ui/select";',
  SearchInput: 'import { SearchInput } from "@/components/ui/search-input";',
  Checkbox: 'import { Checkbox } from "@/components/ui/checkbox";',
  Radio: 'import { Radio } from "@/components/ui/radio";',
  Toggle: 'import { Toggle } from "@/components/ui/toggle";',
  SegmentedControl: 'import { SegmentedControl } from "@/components/ui/segmented-control";',
  ChoiceChip: 'import { ChoiceChip } from "@/components/ui/choice-chip";',
  ColorSwatch: 'import { ColorSwatch, EVENT_COLORS } from "@/components/ui/color-swatch";',
  FilterChip: 'import { FilterChip } from "@/components/ui/filter-chip";',
  DatePicker: 'import { DatePicker } from "@/components/ui/date-picker";',
  FileUpload: 'import { FileUpload } from "@/components/ui/file-upload";',
  Avatar: 'import { Avatar, AvatarGroup } from "@/components/ui/avatar";',
  Badge: 'import { Badge, CountBadge, DotBadge } from "@/components/ui/badge";',
  Tag: 'import { Tag } from "@/components/ui/tag";',
  StatCard: 'import { StatCard } from "@/components/ui/stat-card";',
  ListRow: 'import { ListRow } from "@/components/ui/list-row";',
  Table: 'import { Table, Tr, Td } from "@/components/ui/table";',
  ProgressBar: 'import { ProgressBar } from "@/components/ui/progress-bar";',
  Stepper: 'import { Stepper } from "@/components/ui/stepper";',
  "Spinner / Skeleton": 'import { Spinner, Skeleton } from "@/components/ui/spinner";',
  Tabs: 'import { Tabs } from "@/components/ui/tabs";',
  Breadcrumb: 'import { Breadcrumb } from "@/components/ui/breadcrumb";',
  Pagination: 'import { Pagination } from "@/components/ui/pagination";',
  Toolbar: 'import { Toolbar } from "@/components/ui/toolbar";',
  KebabMenu: 'import { KebabMenu } from "@/components/ui/kebab-menu"; // items: MenuItem/MenuDivider from dropdown-menu',
  DropdownMenu: 'import { DropdownMenu, MenuItem, MenuDivider } from "@/components/ui/dropdown-menu";',
  UserChip: 'import { UserChip } from "@/components/ui/user-chip";',
  Modal: 'import { Modal } from "@/components/ui/modal";',
  SidePanel: 'import { SidePanel } from "@/components/ui/side-panel";',
  Toast: 'import { useToast } from "@/components/ui/toast"; // ToastProvider already mounted in app/layout.tsx',
  Tooltip: 'import { Tooltip } from "@/components/ui/tooltip";',
  Banner: 'import { Banner } from "@/components/ui/banner";',
  EmptyState: 'import { EmptyState } from "@/components/ui/empty-state";',
  AccordionSection: 'import { AccordionSection } from "@/components/ui/accordion-section";',
  Card: 'import { Card, SettingsCard } from "@/components/ui/card";',
  Divider: 'import { Divider } from "@/components/ui/divider";',
  PageHeader: 'import { PageHeader } from "@/components/ui/page-header";',
  Logo: 'import { Logo } from "@/components/ui/logo";',
  "Icon set": 'import { Icon, IconSquare, type IconName } from "@/components/ui/icons";',
};

function featureImport(c: { name: string; path: string; desc: string }) {
  return `import { ${c.name} } from "@/components/${c.path.replace(/\.(t|j)sx?$/, "")}"; // ${c.desc}`;
}

// Where each feature component renders in the running app.
const LIVE_AT: Record<string, string> = {
  BillingDashboard: "/billing",
  ClientBilling: "/clients/[id]?tab=billing",
  ClientInvoices: "/clients/[id]?tab=billing",
  InvoiceDetail: "/billing/[id]",
  InvoiceStatusBadge: "/billing",
  NewInvoicePanel: "/billing",
  PayerPanel: "/billing (Payers tab)",
  PrintActions: "/billing/[id]/print",
  RecordPaymentModal: "/billing/[id]",
  CallStage: "/calls/[room]",
  CallHeader: "/calls/[room]",
  CallControls: "/calls/[room]",
  VideoTile: "/calls/[room]",
  useWebRTC: "/calls/[room]",
  FormBuilder: "/templates/forms/[id]",
  FormsTemplates: "/templates (Forms tab)",
  IntakeWizard: "/portal/forms/[responseId]",
  SendFormModal: "/templates (Forms tab)",
  InboxList: "/inbox",
  ThreadView: "/inbox/[id] + /portal/messages/[id]",
  NotesEditor: "inside NoteSheet",
  ClientNotes: "/clients/[id]?tab=documentation",
  NoteSheet: "opens from ClientNotes + the scribe flow",
  ScribePanel: "/calls/[room] (docked panel)",
  AskAiPanel: "inside NoteSheet",
  AiBits: "inside NoteSheet + ScribePanel",
  AppShell: "every workspace/portal page",
  Sidebar: "inside AppShell",
  TopBar: "inside AppShell",
  NavPanel: "/settings",
};

type FeatureItem = { name: string; path: string; desc: string; composedOf?: Array<{ name: string; feature?: boolean }> };

// Multi-line paste block: import · file + live route · composition graph.
function featureCopy(c: FeatureItem) {
  const lines = [featureImport(c), `// file: components/${c.path}${LIVE_AT[c.name] ? ` · live at: ${LIVE_AT[c.name]}` : ""}`];
  if (c.composedOf?.length) {
    lines.push(`// composed of: ${c.composedOf.map((p) => (p.feature ? `${p.name} (feature)` : p.name)).join(", ")}`);
  }
  return lines.join("\n");
}

// ── Shared layout helpers ─────────────────────────────────────────────────────

function Swatch({ name, hex }: { name: string; hex: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={`Copy --color-${name}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`--color-${name}: ${hex}; /* utilities: bg-${name} · text-${name} · border-${name} */`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      className="group/sw flex items-center gap-2.5 text-left"
    >
      <span
        className="relative h-9 w-9 shrink-0 rounded-field border border-border transition group-hover/sw:ring-2 group-hover/sw:ring-primary-weak"
        style={{ background: hex }}
      >
        {copied && (
          <span className="absolute inset-0 flex items-center justify-center rounded-field bg-surface/80">
            <Icon name="check" size={16} className="text-success" />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-text">{name}</span>
        <span className="block font-mono text-[12px] uppercase text-text-muted">{hex}</span>
      </span>
    </button>
  );
}

function SwatchGroup({ title, colors }: { title: string; colors: Array<{ name: string; hex: string }> }) {
  return (
    <div>
      <p className="mb-2.5 text-[13px] font-semibold text-text-muted">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {colors.map((c) => (
          <Swatch key={c.name} {...c} />
        ))}
      </div>
    </div>
  );
}

// One primitive's live demo. Hovering the card shows a teal border + a copy
// icon top-right; clicking anywhere in the header copies the exact import
// line (+ variant summary). The demo area below stays interactive.
function Spec({ name, desc, wide, children }: { name: string; desc: string; wide?: boolean; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const imp = KIT_IMPORTS[name];
  const payload = imp ? (imp.includes("//") ? imp : `${imp} // ${desc}`) : name;
  return (
    <div
      className={`group/spec overflow-hidden rounded-card border border-border bg-surface shadow-card transition-colors hover:border-primary ${wide ? "lg:col-span-2 lg:order-first" : ""}`}
    >
      <button
        type="button"
        title="Copy import line"
        aria-label={`Copy ${name} import line`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(payload);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {}
        }}
        className="flex w-full items-start justify-between gap-3 border-b border-border px-5 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block font-mono text-[15px] font-semibold text-text">{name}</span>
          <span className="block text-sm text-text-body">{desc}</span>
        </span>
        <Icon
          name={copied ? "check" : "copy"}
          size={16}
          className={`mt-0.5 shrink-0 transition-opacity ${
            copied ? "text-success opacity-100" : "text-text-muted opacity-0 group-hover/spec:opacity-100"
          }`}
        />
      </button>
      <div className="flex flex-wrap items-center gap-3 px-5 py-5">{children}</div>
    </div>
  );
}

// One feature component's registry card. Same affordance as Spec: teal border
// + top-right copy icon on hover; the WHOLE card is the click target (these
// cards have no interactive demos). Copies the featureCopy() paste block.
function FeatureCard({ c }: { c: FeatureItem }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy import + file + composition"
      aria-label={`Copy ${c.name} reference`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(featureCopy(c));
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      className="group/feat h-full rounded-card border border-border bg-surface p-4 text-left shadow-card transition-colors hover:border-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[15px] font-semibold text-text">{c.name}</p>
        <Icon
          name={copied ? "check" : "copy"}
          size={16}
          className={`mt-0.5 shrink-0 transition-opacity ${
            copied ? "text-success opacity-100" : "text-text-muted opacity-0 group-hover/feat:opacity-100"
          }`}
        />
      </div>
      <p className="mt-1 text-sm text-text-body">{c.desc}</p>
      <p className="mt-2 font-mono text-[12px] text-text-muted">
        components/{c.path}
        {LIVE_AT[c.name] && <span className="text-text-muted/70"> · live at {LIVE_AT[c.name]}</span>}
      </p>
      {c.composedOf && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1.5 text-[12px] font-semibold text-text-muted">Composed of →</p>
          <div className="flex flex-wrap gap-1.5">
            {c.composedOf.map((p) => (
              <Tag key={p.name} hue={p.feature ? "grey" : "teal"}>
                {p.name}
                {p.feature && <span className="ml-1 text-[11px] opacity-70">feature</span>}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </button>
  );
}

function Group({ title, cols = 2, children }: { title: string; cols?: 2 | 3; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-[19px] font-semibold text-text">{title}</h2>
      <div className={`grid gap-4 ${cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>{children}</div>
    </section>
  );
}

const DEMO_ICONS: IconName[] = [
  "calendar", "inbox", "users", "dollar", "clipboard", "gear", "bell", "message",
  "video", "phone", "file-text", "credit-card", "search", "plus", "check", "x",
  "edit", "trash", "download", "upload", "lock", "globe", "sparkle", "paint-roller",
];

// Demo-only link-treatment sample (NOT the shipped TextLink) — lets the
// TextLink Spec compare underline/color options side by side.
function LinkSample({
  color,
  deco,
  icon,
  children,
}: {
  color: string;
  deco: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`group inline-flex items-center gap-1.5 text-[15px] font-semibold transition-colors ${color}`}
    >
      {icon && <Icon name={icon} size={16} className="shrink-0" />}
      <span className={deco}>{children}</span>
    </button>
  );
}

const LINK_VARIANTS = [
  { label: "Teal · always-on underline", color: "text-primary hover:text-primary-hover", deco: "underline decoration-1 underline-offset-[3px]" },
  { label: "Teal · soft → solid on hover", color: "text-primary hover:text-primary-hover", deco: "underline decoration-1 underline-offset-[3px] decoration-primary/40 group-hover:decoration-primary" },
  { label: "Amber accent-ink · always-on", color: "text-accent-ink hover:text-[#a06f1f]", deco: "underline decoration-1 underline-offset-[3px]" },
  { label: "Amber accent-ink · soft → solid", color: "text-accent-ink hover:text-[#a06f1f]", deco: "underline decoration-1 underline-offset-[3px] decoration-accent-ink/40 group-hover:decoration-accent-ink" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [tab, setTab] = useState("foundations");

  // Interactive-primitive state
  const [cadence, setCadence] = useState("Biweekly");
  const [color, setColor] = useState<string>(EVENT_COLORS[0]);
  const [reminders, setReminders] = useState(true);
  const [view, setView] = useState("month");
  const [innerTab, setInnerTab] = useState("overview");
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");
  const [date, setDate] = useState("2026-07-15");
  const [file, setFile] = useState<{ name: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(2);
  const [modalOpen, setModalOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const toast = useToast();

  const featureTotal = FEATURES.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      <Tabs
        className="mb-6"
        active={tab}
        onChange={setTab}
        items={[
          { key: "foundations", label: "Foundations" },
          { key: "primitives", label: "Primitives", count: 44 },
          { key: "components", label: "Components", count: featureTotal },
        ]}
      />

      {/* ── FOUNDATIONS ─────────────────────────────────────────────── */}
      {tab === "foundations" && (
        <div className="space-y-4">
          <Card className="space-y-6">
            <SwatchGroup title="Brand" colors={BRAND} />
            <SwatchGroup title="Chrome" colors={CHROME} />
            <SwatchGroup title="Text tones" colors={TEXT} />
            <SwatchGroup title="Semantic status" colors={STATUS} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <p className="mb-4 text-[13px] font-semibold text-text-muted">Typography — Inter</p>
              <div className="space-y-2.5">
                <p className="text-[28px] font-bold text-text">Display · 28 / 700</p>
                <p className="text-[19px] font-semibold text-text">Heading · 19 / 600</p>
                <p className="text-[15px] text-text-body">Body · 15 / 400 — the workspace default</p>
                <p className="text-[13px] text-text-muted">Small · 13 — muted metadata</p>
              </div>
            </Card>

            <Card>
              <p className="mb-4 text-[13px] font-semibold text-text-muted">Radius &amp; elevation</p>
              <div className="flex flex-wrap items-end gap-5">
                {[
                  { cls: "rounded-field border border-border bg-canvas", label: "field · 8px" },
                  { cls: "rounded-card border border-border bg-canvas", label: "card · 12px" },
                  { cls: "rounded-card bg-surface shadow-card", label: "shadow-card" },
                  { cls: "rounded-card bg-surface shadow-menu", label: "shadow-menu" },
                ].map((t) => (
                  <div key={t.label} className="text-center">
                    <span className={`block h-14 w-14 ${t.cls}`} />
                    <span className="mt-2 block text-[12px] text-text-muted">{t.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── PRIMITIVES ──────────────────────────────────────────────── */}
      {tab === "primitives" && (
        <div className="space-y-10">
          <Group title="Actions" cols={3}>
            <Spec name="Button" desc="primary · secondary · ghost · danger; sizes sm–xl.">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="primary" leftIcon="plus">New</Button>
              <Button variant="primary" loading>Saving</Button>
            </Spec>
            <Spec name="IconButton" desc="default · filled · circular · danger — click one to copy its JSX.">
              {(
                [
                  ["edit", "Edit", undefined],
                  ["plus", "Add", "filled"],
                  ["x", "Close", "circular"],
                  ["trash", "Delete", "danger"],
                ] as const
              ).map(([icon, label, variant]) => {
                const jsx = `<IconButton icon="${icon}" label="${label}"${variant ? ` variant="${variant}"` : ""} />`;
                return (
                  <Tooltip key={icon} label={jsx}>
                    <IconButton
                      icon={icon}
                      label={label}
                      variant={variant}
                      onClick={async () => {
                        await navigator.clipboard.writeText(jsx);
                        toast(`Copied ${jsx}`, "success");
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Spec>
            <Spec
              name="TextLink"
              desc="Inline primary link; optional leading icon. Rows: teal vs amber accent-ink · Cols: always-on underline vs soft→solid on hover."
              wide
            >
              <div className="grid w-full gap-x-10 gap-y-6 sm:grid-cols-2">
                {LINK_VARIANTS.map((v) => (
                  <div key={v.label}>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-text-muted">{v.label}</p>
                    <div className="flex flex-col items-start gap-2">
                      <LinkSample color={v.color} deco={v.deco}>View all clients</LinkSample>
                      <LinkSample color={v.color} deco={v.deco} icon="download">Export</LinkSample>
                    </div>
                  </div>
                ))}
              </div>
            </Spec>
          </Group>

          <Group title="Form inputs">
            <Spec name="Field" desc="Label + input + hint/error; affix slots.">
              <div className="grid w-full gap-4 sm:grid-cols-2">
                <Field label="Full name" name="name" placeholder="Jane Doe" />
                <Field label="Fee" name="fee" prefix="$" suffix="/ session" placeholder="120" />
                <Field label="Email" name="email" error="Enter a valid email" defaultValue="not-an-email" />
                <Field label="NPI" name="npi" hint="10-digit provider ID" placeholder="1234567890" />
              </div>
            </Spec>
            <Spec name="Textarea" desc="Multi-line Field.">
              <Textarea className="w-full" label="Session summary" name="summary" placeholder="Type a note…" />
            </Spec>
            <Spec name="Select" desc="Native + searchable (color-dot) variants.">
              <div className="grid w-full gap-4 sm:grid-cols-2">
                <Select
                  label="Status"
                  placeholder="Any status"
                  value={status}
                  onValueChange={setStatus}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "lead", label: "Lead" },
                    { value: "discharged", label: "Discharged" },
                  ]}
                />
                <Select
                  label="Service"
                  searchable
                  placeholder="Pick a service…"
                  value={service}
                  onValueChange={setService}
                  options={[
                    { value: "intake", label: "Intake session", color: "#3F8290" },
                    { value: "therapy", label: "Therapy — 50 min", color: "#3BA55C" },
                    { value: "followup", label: "Follow-up", color: "#E0447C" },
                  ]}
                />
              </div>
            </Spec>
            <Spec name="DatePicker" desc="Mini month grid; today + selected states.">
              <DatePicker value={date} onChange={setDate} />
            </Spec>
            <Spec name="SearchInput" desc="Input with a leading search icon.">
              <SearchInput className="w-full" placeholder="Search clients…" />
            </Spec>
            <Spec name="Checkbox" desc="20px square; checked = primary fill.">
              <div className="space-y-2.5">
                <Checkbox label="Send appointment reminders" defaultChecked />
                <Checkbox label="Share notes with client" />
                <Checkbox label="Disabled" disabled />
              </div>
            </Spec>
            <Spec name="Radio" desc="Single-select ring; optional sub-label.">
              <div className="space-y-2.5">
                <Radio name="loc" label="In person" subLabel="Downtown office" defaultChecked />
                <Radio name="loc" label="Telehealth" subLabel="Secure video" />
              </div>
            </Spec>
            <Spec name="Toggle" desc="~40×22 switch; on = primary track.">
              <Toggle checked={reminders} onChange={setReminders} label="SMS reminders" subtitle="24h before" />
            </Spec>
            <Spec name="SegmentedControl" desc="Joined button group; active = primary.">
              <SegmentedControl
                value={view}
                onChange={setView}
                segments={[
                  { value: "day", label: "Day" },
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                ]}
              />
            </Spec>
            <Spec name="ChoiceChip" desc="Single-select chip; selected = teal + ✓.">
              {["Weekly", "Biweekly", "Monthly"].map((c) => (
                <ChoiceChip key={c} label={c} selected={cadence === c} onSelect={() => setCadence(c)} />
              ))}
            </Spec>
            <Spec name="ColorSwatch" desc="Calendar-color chip; the Liminal palette.">
              {EVENT_COLORS.map((c) => (
                <ColorSwatch key={c} color={c} selected={color === c} onSelect={() => setColor(c)} />
              ))}
            </Spec>
            <Spec name="FilterChip" desc="Table filter pill — add vs. applied.">
              <FilterChip label="Status" value={statusFilter || undefined} onClick={() => setStatusFilter("Active")} onClear={() => setStatusFilter("")} />
              <FilterChip label="Assignee" onClick={() => {}} />
            </Spec>
            <Spec name="FileUpload" desc="Dropzone → uploaded tile." wide>
              <FileUpload
                className="w-full"
                constraints="PDF, PNG or JPG · max 10 MB"
                file={file}
                onFile={(f) => setFile({ name: f.name })}
                onRemove={() => setFile(null)}
              />
              {!file && (
                <Button variant="ghost" size="sm" onClick={() => setFile({ name: "referral-letter.pdf" })}>
                  Simulate upload
                </Button>
              )}
            </Spec>
          </Group>

          <Group title="Data display">
            <Spec name="Icon set" desc="The line-icon registry (IconName) — click an icon to copy its JSX." wide>
              <div className="flex w-full flex-wrap gap-2">
                {DEMO_ICONS.map((n) => (
                  <Tooltip key={n} label={n}>
                    <button
                      type="button"
                      aria-label={`Copy icon ${n}`}
                      onClick={async () => {
                        await navigator.clipboard.writeText(`<Icon name="${n}" />`);
                        toast(`Copied <Icon name="${n}" />`, "success");
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-field border border-border text-text-body transition-colors hover:bg-canvas"
                    >
                      <Icon name={n} />
                    </button>
                  </Tooltip>
                ))}
              </div>
            </Spec>
            <Spec name="Logo" desc="Brand wordmark; onLight / onNavy.">
              <Logo />
              <span className="rounded-lg bg-sidebar-bg px-4 py-3"><Logo variant="onNavy" /></span>
            </Spec>
            <Spec name="Avatar" desc="Initials on a per-user hue; sizes + group.">
              <Avatar name="Brendan Stanton" hue="teal" size="sm" />
              <Avatar name="Amara Okafor" hue="amber" size="md" />
              <Avatar name="Priya Rao" hue="pink" size="md" />
              <AvatarGroup
                people={[
                  { name: "Brendan Stanton", hue: "teal" },
                  { name: "Amara Okafor", hue: "amber" },
                  { name: "Priya Rao", hue: "pink" },
                  { name: "Jon Lee", hue: "blue" },
                  { name: "Mia Chen" },
                ]}
              />
            </Spec>
            <Spec name="Badge" desc="Status chip · count circle · status dot.">
              <Badge variant="success">Active</Badge>
              <Badge variant="info">Submitted</Badge>
              <Badge variant="warning">Pending</Badge>
              <Badge variant="danger">Overdue</Badge>
              <CountBadge count={5} />
              <CountBadge count={128} variant="danger" />
              <span className="inline-flex items-center gap-1.5 text-sm text-text-body">
                <DotBadge variant="success" /> Online
              </span>
            </Spec>
            <Spec name="Tag" desc="Hue-coded taxonomy chip; dismissible.">
              <Tag hue="teal">Anxiety</Tag>
              <Tag hue="violet">CBT</Tag>
              <Tag hue="orange">Sliding scale</Tag>
              <Tag hue="grey" onDismiss={() => {}}>Removable</Tag>
            </Spec>
            <Spec name="StatCard" desc="KPI value + label + optional corner slot." wide>
              <div className="grid w-full gap-3 sm:grid-cols-3">
                <StatCard label="Outstanding" value="$4,280" corner={<Badge variant="warning">3</Badge>} />
                <StatCard label="Sessions this week" value="27" />
                <StatCard label="Collected" value="$12.6k" corner={<Tag hue="green">+8%</Tag>} />
              </div>
            </Spec>
            <Spec name="ListRow" desc="Bordered row: leading · title · meta · trailing." wide>
              <div className="w-full space-y-2.5">
                <ListRow
                  accent="#3F8290"
                  leading={<Avatar name="Amara Okafor" hue="amber" size="md" />}
                  title={<>Amara Okafor <Badge variant="info">Lead</Badge></>}
                  meta="Next: Jul 18 · Intake"
                  trailing={<IconButton icon="chevron-right" label="Open" />}
                />
                <ListRow
                  leading={<IconSquare name="file-text" />}
                  title="Intake packet"
                  meta="Sent 2 days ago"
                  trailing={<Badge variant="success">Signed</Badge>}
                />
              </div>
            </Spec>
            <Spec name="Table" desc="Header + rows; pair with Toolbar + Pagination." wide>
              <Table head={["Client", "Service", "Status", ""]} className="w-full">
                <Tr>
                  <Td>Amara Okafor</Td>
                  <Td>Therapy — 50 min</Td>
                  <Td><Badge variant="success">Paid</Badge></Td>
                  <Td className="text-right"><KebabMenu><MenuItem icon="eye" label="View" onClick={() => {}} /><MenuItem icon="trash" label="Delete" danger onClick={() => {}} /></KebabMenu></Td>
                </Tr>
                <Tr>
                  <Td>Jon Lee</Td>
                  <Td>Intake session</Td>
                  <Td><Badge variant="warning">Sent</Badge></Td>
                  <Td className="text-right"><KebabMenu><MenuItem icon="eye" label="View" onClick={() => {}} /></KebabMenu></Td>
                </Tr>
              </Table>
            </Spec>
            <Spec name="Stepper" desc="Numbered steps: done ✓ · active · upcoming." wide>
              <Stepper className="w-full" steps={["Details", "Insurance", "Consent", "Review"]} active={1} />
            </Spec>
            <Spec name="ProgressBar" desc="Thin track + primary fill; optional %.">
              <div className="w-full space-y-3">
                <ProgressBar value={38} showLabel />
                <ProgressBar value={72} showLabel />
              </div>
            </Spec>
            <Spec name="Spinner / Skeleton" desc="Inline loader + placeholder bars.">
              <Spinner className="text-primary" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </Spec>
          </Group>

          <Group title="Navigation">
            <Spec name="Tabs" desc="Underline tabs — controlled or href.">
              <Tabs
                className="w-full"
                active={innerTab}
                onChange={setInnerTab}
                items={[
                  { key: "overview", label: "Overview" },
                  { key: "billing", label: "Billing", count: 3 },
                  { key: "notes", label: "Notes" },
                ]}
              />
            </Spec>
            <Spec name="Breadcrumb" desc="Muted link trail above a PageHeader.">
              <Breadcrumb items={[{ label: "Clients", href: "#" }, { label: "Amara Okafor", href: "#" }, { label: "Billing" }]} />
            </Spec>
            <Spec name="Pagination" desc="Prev/next + range label under a Table.">
              <Pagination className="w-full" page={page} pageCount={5} onPageChange={setPage} />
            </Spec>
            <Spec name="KebabMenu" desc="Dots trigger → DropdownMenu of actions.">
              <KebabMenu>
                <MenuItem icon="eye" label="View" onClick={() => {}} />
                <MenuItem icon="edit" label="Edit" onClick={() => {}} />
                <MenuDivider />
                <MenuItem icon="trash" label="Delete" danger onClick={() => {}} />
              </KebabMenu>
            </Spec>
            <Spec name="DropdownMenu" desc="Portaled menu; bottom or drop-up.">
              <DropdownMenu
                label="Open menu"
                align="left"
                triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-surface px-3 text-[15px] font-medium text-text hover:bg-canvas"
                trigger={<>Actions <Icon name="chevron-down" size={14} className="text-text-muted" /></>}
              >
                <MenuItem icon="edit" label="Rename" onClick={() => {}} />
                <MenuItem icon="copy" label="Duplicate" onClick={() => {}} />
              </DropdownMenu>
            </Spec>
            <Spec name="UserChip" desc="Avatar + name pill; the account-menu trigger.">
              <UserChip name="Brendan Stanton" hue="teal" />
              <span className="rounded-lg bg-sidebar-bg p-2">
                <UserChip name="Brendan Stanton" hue="teal" onNavy />
              </span>
            </Spec>
            <Spec name="Toolbar" desc="Strip above an index table." wide>
              <Toolbar className="w-full" count={128} countLabel="clients" actions={<Button size="sm" leftIcon="plus">New</Button>}>
                <SearchInput placeholder="Search…" className="w-56" />
                <FilterChip label="Status" onClick={() => {}} />
              </Toolbar>
            </Spec>
          </Group>

          <Group title="Overlays & feedback">
            <Spec name="Modal" desc="Centered dialog on the scrim.">
              <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
              <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Record payment"
                icon="credit-card"
                footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={() => setModalOpen(false)}>Save</Button></>}
              >
                <p className="text-[15px] text-text-body">Body content — forms, confirmations, details.</p>
              </Modal>
            </Spec>
            <Spec name="SidePanel" desc="Right slide-over — the create/edit workhorse.">
              <Button variant="secondary" onClick={() => setPanelOpen(true)}>Open panel</Button>
              <SidePanel
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
                title="New client"
                icon="users"
                footer={<><Button variant="secondary" onClick={() => setPanelOpen(false)}>Cancel</Button><Button onClick={() => setPanelOpen(false)}>Create</Button></>}
              >
                <div className="space-y-4">
                  <Field label="Full name" name="n" placeholder="Jane Doe" />
                  <Field label="Email" name="e" placeholder="jane@example.com" />
                </div>
              </SidePanel>
            </Spec>
            <Spec name="Toast" desc="Auto-dismissing bottom-right pill.">
              <Button size="sm" variant="secondary" onClick={() => toast("Invoice sent", "success")}>Success</Button>
              <Button size="sm" variant="secondary" onClick={() => toast("Draft saved")}>Info</Button>
              <Button size="sm" variant="secondary" onClick={() => toast("Payment failed", "danger")}>Danger</Button>
            </Spec>
            <Spec name="Tooltip" desc="Dark bubble on hover; portaled.">
              <Tooltip label="Start a telehealth call"><IconButton icon="video" label="Call" /></Tooltip>
              <Tooltip label="Compose message" placement="right"><IconButton icon="message" label="Message" /></Tooltip>
            </Spec>
            <Spec name="Banner" desc="Full-width tinted strip." wide>
              <div className="w-full space-y-2.5">
                <Banner variant="info" action={<Button size="sm" variant="ghost">View</Button>}>A new intake form is awaiting your review.</Banner>
                <Banner variant="warning">This client&apos;s card on file expires next month.</Banner>
              </div>
            </Spec>
            <Spec name="EmptyState" desc="Spot mark + title + subtext + actions." wide>
              <EmptyState
                className="w-full"
                icon="inbox"
                title="No messages yet"
                subtext="When a client replies, the thread shows up here."
                actions={<Button leftIcon="send">Compose</Button>}
              />
            </Spec>
            <Spec name="AccordionSection" desc="Title + chevron collapse; card variant." wide>
              <AccordionSection className="w-full" title="Insurance &amp; billing" icon="credit-card" variant="card">
                <p className="text-sm text-text-body">Collapsible content — form rows, summaries, nested rails.</p>
              </AccordionSection>
            </Spec>
          </Group>

          <Group title="Layout & brand">
            <Spec name="Card" desc="Base Card + SettingsCard header." wide>
              <div className="grid w-full gap-3 sm:grid-cols-2">
                <Card>
                  <p className="text-[15px] font-semibold text-text">Base Card</p>
                  <p className="mt-1 text-sm text-text-body">Surface, border, radius, soft shadow.</p>
                </Card>
                <SettingsCard icon="gear" title="Preferences" action={<TextLink>Edit</TextLink>}>
                  <p className="text-sm text-text-body">Header row + optional far-right action.</p>
                </SettingsCard>
              </div>
            </Spec>
            <Spec name="Divider" desc="Hairline; labeled 'or' variant." wide>
              <div className="w-full space-y-4">
                <Divider />
                <Divider label="or" />
              </div>
            </Spec>
            <Spec name="PageHeader" desc="Icon + title + right-aligned actions." wide>
              <PageHeader className="w-full" icon="users" title="Clients" actions={<Button leftIcon="plus">New client</Button>} />
            </Spec>
          </Group>
        </div>
      )}

      {/* ── COMPONENTS (metadata only) ──────────────────────────────── */}
      {tab === "components" && (
        <div className="space-y-8">
          <Banner variant="info">
            Feature components are cataloged as a reference index — not rendered here. They&apos;re
            data-backed and heavy (ProseMirror, WebRTC, live queries), so importing them would bloat
            this route. Open each in the app to see it live.
          </Banner>

          {FEATURES.map((group) => (
            <section key={group.area}>
              <h2 className="mb-3 text-[19px] font-semibold text-text">{group.area}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((c) => (
                  <FeatureCard key={c.path} c={c} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
