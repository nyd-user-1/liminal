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
import { PageHeader } from "@/components/ui/page-header";

// Design System — the Liminal foundations (tokens) followed by live demos of
// the first 10 shared UI primitives. Internal reference page, reached from the
// account menu. Client component so the interactive primitives can hold state.

// ── Foundations data ────────────────────────────────────────────────────────

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

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-9 w-9 shrink-0 rounded-field border border-border"
        style={{ background: hex }}
      />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-text">{name}</span>
        <span className="block font-mono text-[12px] uppercase text-text-muted">{hex}</span>
      </span>
    </div>
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

// A numbered spec card wrapping one primitive's live demo.
function Spec({
  index,
  name,
  desc,
  children,
}: {
  index: number;
  name: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-0">
      <div className="flex items-start gap-3 border-b border-border px-5 py-3.5">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[13px] font-semibold text-primary">
          {index}
        </span>
        <span className="min-w-0">
          <span className="block font-mono text-[15px] font-semibold text-text">{name}</span>
          <span className="block text-sm text-text-body">{desc}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-5 py-5">{children}</div>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [cadence, setCadence] = useState("Biweekly");
  const [color, setColor] = useState<string>(EVENT_COLORS[0]);

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div>
        <PageHeader icon="paint-roller" title="Design System" />
        <p className="mt-2 max-w-2xl text-[15px] text-text-body">
          The Liminal theme foundations and the shared UI kit. Below: the design tokens, then live
          demos of the first ten shared primitives.
        </p>
      </div>

      {/* Foundations */}
      <section className="space-y-6">
        <h2 className="text-[19px] font-semibold text-text">Foundations</h2>

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
              <div className="text-center">
                <span className="block h-14 w-14 rounded-field border border-border bg-canvas" />
                <span className="mt-2 block text-[12px] text-text-muted">field · 8px</span>
              </div>
              <div className="text-center">
                <span className="block h-14 w-14 rounded-card border border-border bg-canvas" />
                <span className="mt-2 block text-[12px] text-text-muted">card · 12px</span>
              </div>
              <div className="text-center">
                <span className="block h-14 w-14 rounded-card bg-surface shadow-card" />
                <span className="mt-2 block text-[12px] text-text-muted">shadow-card</span>
              </div>
              <div className="text-center">
                <span className="block h-14 w-14 rounded-card bg-surface shadow-menu" />
                <span className="mt-2 block text-[12px] text-text-muted">shadow-menu</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Primitives */}
      <section className="space-y-6">
        <div>
          <h2 className="text-[19px] font-semibold text-text">Shared primitives</h2>
          <p className="mt-1 text-sm text-text-muted">The first 10 of the shared UI kit.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Spec index={1} name="AccordionSection" desc="Title + chevron collapse; card or bare variant.">
            <div className="w-full">
              <AccordionSection title="Insurance &amp; billing" icon="credit-card" variant="card">
                <p className="text-sm text-text-body">
                  Collapsible content lives here — form rows, summaries, or nested rails.
                </p>
              </AccordionSection>
            </div>
          </Spec>

          <Spec index={2} name="Avatar" desc="Initials on a per-user hue; sm · md · lg, plus a group.">
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

          <Spec index={3} name="Badge" desc="Status chip, count circle, and bare status dot.">
            <Badge variant="success">Active</Badge>
            <Badge variant="info">Submitted</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="danger">Overdue</Badge>
            <Badge variant="neutral">Draft</Badge>
            <CountBadge count={5} />
            <CountBadge count={128} variant="danger" />
            <span className="inline-flex items-center gap-1.5 text-sm text-text-body">
              <DotBadge variant="success" /> Online
            </span>
          </Spec>

          <Spec index={4} name="Banner" desc="Full-width tinted strip: icon + copy + optional action.">
            <div className="w-full space-y-2.5">
              <Banner variant="info" action={<Button size="sm" variant="ghost">View</Button>}>
                A new intake form is awaiting your review.
              </Banner>
              <Banner variant="warning">This client&apos;s card on file expires next month.</Banner>
            </div>
          </Spec>

          <Spec index={5} name="Breadcrumb" desc="Muted link trail above a PageHeader.">
            <Breadcrumb
              items={[
                { label: "Clients", href: "/clients" },
                { label: "Brendan Stanton", href: "#" },
                { label: "Billing" },
              ]}
            />
          </Spec>

          <Spec index={6} name="Button" desc="Variants: primary · secondary · ghost · danger; sizes sm–xl.">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" leftIcon="plus">
              New
            </Button>
            <Button variant="secondary" size="sm">
              Small
            </Button>
            <Button variant="primary" loading>
              Saving
            </Button>
          </Spec>

          <Spec index={7} name="Card" desc="Base Card and SettingsCard (icon/title header + action).">
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <Card>
                <p className="text-[15px] font-semibold text-text">Base Card</p>
                <p className="mt-1 text-sm text-text-body">Surface, border, radius, soft shadow.</p>
              </Card>
              <SettingsCard icon="gear" title="Preferences">
                <p className="text-sm text-text-body">Header row with an optional far-right action.</p>
              </SettingsCard>
            </div>
          </Spec>

          <Spec index={8} name="Checkbox" desc="20px square; checked = primary fill + white check.">
            <div className="space-y-2.5">
              <Checkbox label="Send appointment reminders" defaultChecked />
              <Checkbox label="Share notes with client" />
              <Checkbox label="Disabled option" disabled />
            </div>
          </Spec>

          <Spec index={9} name="ChoiceChip" desc="Single-select option in a wrap grid; selected = teal + ✓.">
            {["Weekly", "Biweekly", "Monthly"].map((c) => (
              <ChoiceChip key={c} label={c} selected={cadence === c} onSelect={() => setCadence(c)} />
            ))}
          </Spec>

          <Spec index={10} name="ColorSwatch" desc="Rounded color chip keying a service to its calendar color.">
            {EVENT_COLORS.map((c) => (
              <ColorSwatch key={c} color={c} selected={color === c} onSelect={() => setColor(c)} />
            ))}
          </Spec>
        </div>
      </section>
    </div>
  );
}
