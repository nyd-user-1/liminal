"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BoardGrid, reorderIds, type BoardCardSize } from "@/components/board/board-grid";
import { BoardCard } from "@/components/board/board-card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { IdentityCard } from "@/components/records/identity-card";
import { ClientStatusBadge, clientHue, formatDob, tagHue } from "@/app/(app)/clients/ui";
import { ContactMenu } from "@/app/(app)/clients/[id]/contact-menu";
import { InsuranceTab } from "@/app/(app)/clients/[id]/insurance-tab";
import type { PolicyWithPayer } from "@/lib/repos/policies";
import type { PractitionerOption } from "@/lib/repos/clients";
import type {
  Appointment,
  Client,
  ClientStatus,
  FileRecord,
  Invoice,
  Payer,
  Referral,
} from "@/lib/types";

// A client record IS a board: the same dashboard the practice gets, scoped to
// one person. The rail on the left says who they are and stays put; the cards
// on the right are the record's sections, and the practitioner owns which ones
// are on the board, in what order, at what size.
//
// Nothing here re-implements a section: each card MOUNTS the component the old
// tab used (and, for the object lists, the same components/tables/* the rail
// and the standalone routes mount, scoped to this client). This file is
// composition — placement, sizes, persistence — exactly as /analytics is.

/** Everything a client record renders, in one payload — see the API twin at
 *  app/api/clients/[id]/record. Server-fetched by the deep-link route, loaded
 *  through the twin when the rail opens a tab. */
export interface ClientRecordBundle {
  client: Client;
  practitioners: PractitionerOption[];
  practitionerName: string | null;
  policies: PolicyWithPayer[];
  payers: Payer[];
  files: FileRecord[];
  appointments: Appointment[];
  invoices: Invoice[];
  referrals: Referral[];
  /** Photon wiring for the Rx card; empty orgId = Photon unconfigured. */
  orgId: string;
  photonClientId: string;
  photonEnv: string;
}

// The client board's size ladder. These cards hold tables and forms, not stat
// tiles, so the ladder starts where /analytics' ends: three columns beside a
// 320px rail, and heights that fit a handful of rows without an inner scroll.
// BoardGrid takes the ladder as config — no new step in the primitive.
const CLIENT_GRID = "grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3";
const CLIENT_SPAN: Record<BoardCardSize, string> = {
  sm: "col-span-1",
  md: "col-span-1 lg:col-span-2 2xl:col-span-2",
  lg: "col-span-1 lg:col-span-2 2xl:col-span-3",
};
const CLIENT_HEIGHT: Record<BoardCardSize, string> = {
  sm: "h-[320px]",
  md: "h-[420px]",
  lg: "h-[520px]",
};
const SIZE_ORDER: BoardCardSize[] = ["sm", "md", "lg"];
const NEXT_SIZE: Record<BoardCardSize, BoardCardSize> = { sm: "md", md: "lg", lg: "sm" };

const STATUSES: Array<{ value: ClientStatus; label: string }> = [
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

/** One card the board can hold. `count` becomes the badge the old tab line wore;
 *  `action` is the section's own New/primary button, lifted into the card's
 *  header — the old tab drew it inside itself, the card draws it as chrome. */
interface CardDef {
  key: string;
  title: string;
  size: BoardCardSize;
  count?: (r: ClientRecordBundle) => number | undefined;
  action?: (r: ClientRecordBundle) => React.ReactNode;
  render: (r: ClientRecordBundle) => React.ReactNode;
}

// The board's layout is per USER per RECORD TYPE — one layout for every client,
// not one per client (a practitioner arranges their working view once). Card
// KEYS only: no client data ever reaches localStorage.
const BOARD_KEY = "liminal-record:client:board";

interface BoardState {
  ids: string[];
  sizes: Record<string, BoardCardSize>;
}

function readBoard(): BoardState | null {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    return raw ? (JSON.parse(raw) as BoardState) : null;
  } catch {
    return null;
  }
}
function writeBoard(state: BoardState) {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(state));
  } catch {
    /* storage disabled — the board still works, it just won't persist */
  }
}

export function ClientRecord({
  record,
  initialCard,
  onReload,
}: {
  record: ClientRecordBundle;
  /** A deep link's ?tab= value. Card keys ARE the old tab keys, so every
   *  ?tab=rx reference in the app still lands on the thing it named. */
  initialCard?: string;
  onReload?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { client } = record;
  const name = `${client.firstName} ${client.lastName}`;

  // Each section's create flow keeps its panel inside the section; the board
  // only owns the trigger, the same handshake the object tables use.
  const [newPolicyOpen, setNewPolicyOpen] = useState(false);

  const CARDS: CardDef[] = useMemo(
    () => [
      {
        key: "insurance",
        title: "Insurance",
        size: "md",
        count: (r) => r.policies.length,
        action: () => (
          <Button size="sm" variant="secondary" leftIcon="plus" onClick={() => setNewPolicyOpen(true)}>
            New policy
          </Button>
        ),
        render: (r) => (
          <InsuranceTab
            clientId={r.client.id}
            policies={r.policies}
            payers={r.payers}
            files={r.files}
            bare
            newOpen={newPolicyOpen}
            onNewOpenChange={setNewPolicyOpen}
          />
        ),
      },
    ],
    [newPolicyOpen],
  );
  const CARD_BY_KEY = useMemo(() => Object.fromEntries(CARDS.map((c) => [c.key, c])), [CARDS]);
  const DEFAULT_IDS = useMemo(() => CARDS.map((c) => c.key), [CARDS]);

  const [board, setBoard] = useState<BoardState>(() => ({ ids: DEFAULT_IDS, sizes: {} }));
  const [ready, setReady] = useState(false);

  // Server render has no localStorage, so first paint is the default board;
  // then adopt whatever this browser saved. Keys that no longer exist are
  // dropped rather than rendered as holes.
  useEffect(() => {
    const saved = readBoard();
    const ids = (saved?.ids ?? DEFAULT_IDS).filter((id) => CARD_BY_KEY[id]);
    // A deep link names a card: put it on the board if this browser had removed
    // it, so ?tab=rx can never land on a record that doesn't show prescriptions.
    if (initialCard && CARD_BY_KEY[initialCard] && !ids.includes(initialCard)) ids.push(initialCard);
    setBoard({ ids, sizes: saved?.sizes ?? {} });
    setReady(true);
  }, [DEFAULT_IDS, CARD_BY_KEY, initialCard]);

  // …and scroll to it, once it has actually rendered.
  useEffect(() => {
    if (!ready || !initialCard) return;
    const el = document.querySelector(`[data-board-card="${CSS.escape(initialCard)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [ready, initialCard]);

  const commit = useCallback(
    (next: BoardState) => {
      setBoard(next);
      if (ready) writeBoard(next);
    },
    [ready],
  );

  const sizeOf = useCallback(
    (key: string) => board.sizes[key] ?? CARD_BY_KEY[key]?.size ?? "md",
    [board.sizes, CARD_BY_KEY],
  );

  const removeCard = useCallback(
    (key: string) => commit({ ...board, ids: board.ids.filter((k) => k !== key) }),
    [board, commit],
  );

  const resizeCard = useCallback(
    (key: string) => commit({ ...board, sizes: { ...board.sizes, [key]: NEXT_SIZE[sizeOf(key)] } }),
    [board, commit, sizeOf],
  );

  /** Corner-handle resize: step the ladder, clamped at both ends (the kebab
   *  cycles instead) — same rule the analytics board follows. */
  const stepCard = useCallback(
    (key: string, dir: 1 | -1) => {
      const cur = sizeOf(key);
      const idx = Math.min(Math.max(SIZE_ORDER.indexOf(cur) + dir, 0), SIZE_ORDER.length - 1);
      if (SIZE_ORDER[idx] === cur) return;
      commit({ ...board, sizes: { ...board.sizes, [key]: SIZE_ORDER[idx] } });
    },
    [board, commit, sizeOf],
  );

  const reorder = useCallback(
    (from: string, to: string) => commit({ ...board, ids: reorderIds(board.ids, from, to) }),
    [board, commit],
  );

  async function setStatus(status: ClientStatus) {
    if (status === client.status) return;
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast("Could not update status.", "danger");
      return;
    }
    toast(
      <>
        <b>{name}</b> marked {STATUSES.find((s) => s.value === status)?.label.toLowerCase()}
      </>,
      "success",
    );
    // The record is the rail's, not the route's — reload the bundle when the
    // host gave us a way to; fall back to the route when it didn't.
    if (onReload) onReload();
    else router.refresh();
  }

  const placed = board.ids.filter((id) => CARD_BY_KEY[id]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      {/* The rail: narrow, full height of the column, and it does not move.
          The board beside it scrolls under the tab line and away. */}
      <aside className="shrink-0 lg:h-full lg:w-80">
        <IdentityCard
          name={name}
          hue={clientHue(client.id)}
          badge={
            <DropdownMenu
              label="Change status"
              align="left"
              width="w-44"
              trigger={
                <ClientStatusBadge status={client.status} withChevron className="cursor-pointer hover:opacity-80" />
              }
            >
              {STATUSES.map((s) => (
                <MenuItem
                  key={s.value}
                  label={s.label}
                  selected={s.value === client.status}
                  onClick={() => setStatus(s.value)}
                />
              ))}
            </DropdownMenu>
          }
          meta={[client.pronouns, client.dob ? formatDob(client.dob) : null].filter(Boolean).join(" · ") || undefined}
          actions={<ContactMenu clientId={client.id} email={client.email} phone={client.phone} />}
          fields={[
            { label: "Email", value: client.email },
            { label: "Phone", value: client.phone },
            { label: "Address", value: client.address },
            { label: "Gender", value: client.gender },
            { label: "Primary practitioner", value: record.practitionerName },
            {
              label: "Tags",
              value:
                client.tags.length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {client.tags.map((t) => (
                      <Tag key={t} hue={tagHue(t)}>
                        {t}
                      </Tag>
                    ))}
                  </span>
                ) : null,
            },
          ]}
        />
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {placed.length === 0 ? (
          <EmptyState
            icon="grid"
            title="An empty record"
            subtext="Add a card to build this client’s working view."
          />
        ) : (
          <BoardGrid
            items={placed}
            size={sizeOf}
            onReorder={reorder}
            className={CLIENT_GRID}
            span={CLIENT_SPAN}
            height={CLIENT_HEIGHT}
            renderCard={(key) => {
              const def = CARD_BY_KEY[key];
              const count = def.count?.(record);
              return (
                <BoardCard
                  label={def.title}
                  title={
                    <span className="inline-flex items-center gap-1.5">
                      {def.title}
                      {count !== undefined && (
                        <span className="rounded-full bg-canvas px-1.5 text-[13px] tabular-nums text-text-muted">
                          {count}
                        </span>
                      )}
                    </span>
                  }
                  titleText={def.title}
                  menu={def.action?.(record)}
                  onRemove={() => removeCard(key)}
                  onResizeStep={(dir) => stepCard(key, dir)}
                  onResizeCycle={() => resizeCard(key)}
                >
                  {/* Each card is a window onto its section: the section keeps
                      its own scroll, the card keeps the board's geometry. */}
                  <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{def.render(record)}</div>
                </BoardCard>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}

/** The rail's loading state while a freshly-opened tab fetches its record. */
export function ClientRecordLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner size={24} />
    </div>
  );
}
