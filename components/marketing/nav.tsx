"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccordionSection } from "@/components/ui/accordion-section";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/icon-button";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";
import { SearchOverlay } from "@/components/marketing/search-overlay";

// Public marketing nav (Headway pattern, Liminal brand). One shared dropdown
// panel whose caret + width morph under the active trigger. Search opens a
// Modal (⌘K). "My portal" is the secondary Button + a left-aligned menu.
// Below md, the centered links collapse into a full-screen MobileMenu.
//
// Icon hover treatment: our set has no filled variants, so rows deepen the
// icon from text-muted → text-text and bump stroke-width on hover (the
// "deepen + stroke-bump" approach, not fill-currentColor).

type MenuKey = "find" | "providers" | "company";
const WIDTHS: Record<MenuKey, number> = { find: 636, providers: 320, company: 300 };

// ── content data ─────────────────────────────────────────────────────────────

const BOROUGHS: Array<[label: string, county: string]> = [
  ["Manhattan", "New York"],
  ["Brooklyn", "Kings"],
  ["Queens", "Queens"],
  ["Bronx", "Bronx"],
  ["Staten Island", "Richmond"],
];
// The 10 largest non-borough cities by provider volume in the live directory
// (`directory_providers.city`). The dataset is NYC-only, so beyond the four
// single-city boroughs every city here is a Queens neighborhood.
const CITIES = [
  "Flushing",
  "Forest Hills",
  "Jamaica",
  "Glen Oaks",
  "Elmhurst",
  "Bayside",
  "Rego Park",
  "Far Rockaway",
  "Long Island City",
  "Queens Village",
];
const SPECIALTIES = [
  "ADHD",
  "Anxiety and Depression",
  "Bipolar Disorder",
  "OCD",
  "Trauma and PTSD",
  "Couples",
  "Grief and Loss",
  "Addiction",
  "LGBTQIA+",
];

type FindCategory = {
  key: string;
  label: string;
  icon: IconName;
  sections: Array<{ header?: string; links: Array<{ label: string; href: string; icon: IconName }> }>;
  viewAll: { label: string; href: string };
};

function locationSections(type: string, icon: IconName) {
  return [
    {
      header: "By borough",
      links: BOROUGHS.map(([label, county]) => ({
        label,
        href: `/find-care?type=${type}&county=${encodeURIComponent(county)}`,
        icon,
      })),
    },
    {
      header: "By city",
      // `q` searches the directory's `city` column, so these filter for real.
      links: CITIES.map((c) => ({
        label: c,
        href: `/find-care?type=${type}&q=${encodeURIComponent(c)}`,
        icon: "globe" as IconName,
      })),
    },
  ];
}

const FIND_CATEGORIES: FindCategory[] = [
  {
    key: "therapists",
    label: "Therapists",
    icon: "users",
    sections: locationSections("therapist", "person-circle"),
    viewAll: { label: "View all therapists", href: "/find-care?type=therapist" },
  },
  {
    key: "psychiatrists",
    label: "Psychiatrists",
    icon: "book-heart",
    sections: locationSections("psychiatrist", "book-heart"),
    viewAll: { label: "View all psychiatrists", href: "/find-care?type=psychiatrist" },
  },
  {
    key: "specialty",
    label: "By specialty",
    icon: "grid",
    sections: [
      {
        header: "By specialty",
        links: SPECIALTIES.map((s) => ({
          label: s,
          href: `/find-care?specialty=${encodeURIComponent(s)}`,
          icon: "sparkle" as IconName,
        })),
      },
    ],
    viewAll: { label: "+20 more", href: "/find-care" },
  },
  {
    key: "virtual",
    label: "Virtual therapy",
    icon: "video",
    sections: [
      {
        links: [
          { label: "Virtual therapy", href: "/find-care?type=virtual", icon: "video" },
          { label: "Virtual psychiatry", href: "/find-care?type=virtual&kind=psychiatry", icon: "video" },
          { label: "Same-week appointments", href: "/find-care?type=virtual", icon: "calendar-check" },
        ],
      },
    ],
    viewAll: { label: "Browse virtual care", href: "/find-care?type=virtual" },
  },
  {
    key: "resources",
    label: "Therapy resources",
    icon: "file-text",
    sections: [
      {
        links: [
          { label: "Mental health programs", href: "/portal/resources", icon: "globe" },
          { label: "Crisis support", href: "/find-care?type=crisis", icon: "phone" },
          { label: "What to expect", href: "/#for-providers", icon: "note" },
        ],
      },
    ],
    viewAll: { label: "Explore resources", href: "/portal/resources" },
  },
];

const PROVIDER_LINKS: Array<{ label: string; href: string; icon: IconName }> = [
  { label: "Learn more", href: "/#for-providers", icon: "sparkle" },
  { label: "Join Liminal", href: "/join", icon: "plus" },
  { label: "Refer a provider", href: "/join?ref=1", icon: "send" },
  { label: "Provider portal", href: "/sign-in", icon: "lock" },
  { label: "Resource center", href: "/join#faq", icon: "file-text" },
];

const COMPANY_LINKS: Array<{ label: string; href: string; icon: IconName }> = [
  { label: "About us", href: "/company/about", icon: "globe" },
  { label: "Press", href: "/company/press", icon: "note" },
  { label: "Careers", href: "/company/careers", icon: "users" },
];

// ── row + panel-content pieces ───────────────────────────────────────────────

function PanelRow({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-field px-3 py-2 transition-colors hover:bg-canvas">
      <Icon
        name={icon}
        size={20}
        className="shrink-0 text-text-muted transition-colors group-hover:fill-primary-wash group-hover:text-text"
      />
      <span className="text-[15px] font-medium text-text-body group-hover:text-text">{label}</span>
    </Link>
  );
}

// Find-care content link — plain text, no icon (icons are for the nav panels
// that are literal action rows, not this location/specialty index).
function FindLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-field px-3 py-2 text-[15px] font-medium text-text-body transition-colors hover:bg-canvas hover:text-text"
    >
      {label}
    </Link>
  );
}

function FindCarePanel({ cat, setCat }: { cat: string; setCat: (k: string) => void }) {
  const active = FIND_CATEGORIES.find((c) => c.key === cat) ?? FIND_CATEGORIES[0];
  return (
    <div className="flex">
      {/* left third — category rail (grey comes from the panel gradient) */}
      <div className="w-1/3 p-2">
        {FIND_CATEGORIES.map((c) => {
          const on = c.key === cat;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={`flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left transition-colors ${
                on ? "bg-surface shadow-sm" : ""
              }`}
            >
              <Icon
                name={c.icon}
                size={20}
                className={`shrink-0 transition-colors ${on ? "fill-primary-wash text-text" : "text-text-muted"}`}
              />
              <span className={`text-[15px] font-medium ${on ? "text-text" : "text-text-body"}`}>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* right two-thirds — content; View all is the last grid cell */}
      <div className="w-2/3 p-4">
        {active.sections.map((s, i) => {
          const isLast = i === active.sections.length - 1;
          return (
            <div key={i} className="mb-4 last:mb-0">
              {s.header && <p className="px-3 pb-1 text-[13px] font-semibold text-text">{s.header}</p>}
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {s.links.map((l) => (
                  <FindLink key={l.href + l.label} href={l.href} label={l.label} />
                ))}
                {isLast && (
                  <TextLink href={active.viewAll.href} variant="underline" className="px-3 py-2">
                    {active.viewAll.label}
                  </TextLink>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProvidersPanel() {
  return (
    <div className="p-2">
      {PROVIDER_LINKS.map((l) => (
        <PanelRow key={l.href} {...l} />
      ))}
    </div>
  );
}

function CompanyPanel() {
  return (
    <div>
      <div className="p-2">
        {COMPANY_LINKS.map((l) => (
          <PanelRow key={l.href} {...l} />
        ))}
      </div>
      <div className="border-t border-border bg-canvas px-5 py-4">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-text-muted">From Liminal</p>
        <Link href="/book/liminal" className="mt-1 inline-block text-[15px] font-medium text-primary hover:text-primary-hover">
          Book an appointment in minutes →
        </Link>
      </div>
    </div>
  );
}

// My portal — the real secondary Button primitive + a left-aligned dropdown.
function MyPortalMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        My portal
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 flex w-56 flex-col rounded-card border border-border bg-surface p-2 shadow-menu"
        >
          {(
            [
              { icon: "person-circle", label: "Patient portal" },
              { icon: "lock", label: "Provider portal" },
            ] as const
          ).map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => go("/sign-in")}
              className="group flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left text-[15px] font-medium text-text transition-colors hover:bg-canvas"
            >
              <Icon name={it.icon} className="text-text-body transition-colors group-hover:fill-primary-wash group-hover:text-text" />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Mobile menu — full-screen sheet with collapsible sections (Headway pattern).
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  if (!open || typeof document === "undefined") return null;
  const link = (href: string, label: string) => (
    <Link
      key={href + label}
      href={href}
      onClick={onClose}
      className="block rounded-field px-3 py-2 text-[15px] font-medium text-text-body hover:bg-canvas hover:text-text"
    >
      {label}
    </Link>
  );
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-surface md:hidden">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <Link href="/" aria-label="Liminal home" onClick={onClose}>
          <Logo size="sm" />
        </Link>
        <IconButton icon="x" label="Close menu" onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-2">
        <AccordionSection title="Find care" defaultOpen={false}>
          {FIND_CATEGORIES.map((c) => link(c.viewAll.href, c.label))}
        </AccordionSection>
        <AccordionSection title="For providers" defaultOpen={false}>
          {PROVIDER_LINKS.map((l) => link(l.href, l.label))}
        </AccordionSection>
        <AccordionSection title="Company" defaultOpen={false}>
          {COMPANY_LINKS.map((l) => link(l.href, l.label))}
        </AccordionSection>
        <div className="mt-6 flex flex-col gap-3">
          <Button variant="secondary" fullWidth onClick={() => { onClose(); router.push("/sign-in"); }}>
            My portal
          </Button>
          <Button fullWidth onClick={() => { onClose(); router.push("/join"); }}>
            Join as a provider
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── nav ──────────────────────────────────────────────────────────────────────

export function Nav() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<MenuKey | null>(null);
  const [cat, setCat] = useState("therapists");
  const [caretX, setCaretX] = useState(0);
  const [panelHeight, setPanelHeight] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<MenuKey, HTMLButtonElement | null>>({ find: null, providers: null, company: null });
  const contentRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMenu = useRef<MenuKey>("find");
  if (open) lastMenu.current = open;
  const menu = open ?? lastMenu.current;

  const measure = useCallback((m: MenuKey) => {
    const t = triggerRefs.current[m];
    const c = barRef.current;
    if (!t || !c) return;
    const tr = t.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    setCaretX(tr.left + tr.width / 2 - cr.left);
  }, []);

  const openMenu = useCallback(
    (m: MenuKey) => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      measure(m);
      if (m === "find") setCat("therapists");
      setOpen(m);
    },
    [measure],
  );

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 150);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Animate panel height to fit content on menu / category change.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!open || !el) {
      setPanelHeight(0);
      return;
    }
    // Track the panel's *live* content height with a ResizeObserver rather than
    // measuring once: the width animates between menus, which reflows/​un-wraps
    // the text, and a one-shot read taken mid-transition freezes a stale (too
    // tall) height. Observing keeps the box fitting exactly, at any data shape.
    const ro = new ResizeObserver(() => setPanelHeight(el.scrollHeight));
    ro.observe(el);
    setPanelHeight(el.scrollHeight);
    return () => ro.disconnect();
  }, [open, menu, cat]);

  const triggers: Array<{ key: MenuKey; label: string }> = [
    { key: "find", label: "Find care" },
    { key: "providers", label: "For providers" },
    { key: "company", label: "Company" },
  ];

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-200 ${
          scrolled ? "bg-surface shadow-card" : "bg-primary-wash"
        }`}
      >
        <div
          ref={barRef}
          className={`relative mx-auto flex max-w-6xl items-center gap-6 px-6 transition-all duration-200 ${
            scrolled ? "h-14" : "h-[72px]"
          }`}
          onMouseLeave={scheduleClose}
        >
          <Link href="/" aria-label="Liminal home" className="shrink-0">
            <Logo size="sm" />
          </Link>

          {/* centered links */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-field px-3 py-2 text-[15px] font-medium text-text-body transition-colors hover:text-primary"
            >
              Search providers
            </button>
            {triggers.map((t) => (
              <button
                key={t.key}
                ref={(el) => {
                  triggerRefs.current[t.key] = el;
                }}
                type="button"
                onMouseEnter={() => openMenu(t.key)}
                onFocus={() => openMenu(t.key)}
                aria-expanded={open === t.key}
                className={`rounded-field px-3 py-2 text-[15px] font-medium transition-colors hover:text-primary ${
                  open === t.key ? "text-primary" : "text-text-body"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* right cluster */}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <MyPortalMenu />
              <Button onClick={() => router.push("/join")}>Join as a provider</Button>
            </div>
            <IconButton icon="menu" label="Open menu" className="md:hidden" onClick={() => setMobileOpen(true)} />
          </div>

          {/* shared morphing panel */}
          <div className="pointer-events-none absolute left-0 top-full z-40 w-full" aria-hidden={!open}>
            <div
              className="absolute top-2 transition-[left,width] duration-[250ms] ease-out"
              style={{ left: caretX, width: WIDTHS[menu], transform: "translateX(-50%)" }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              {/* caret */}
              <div
                className={`mx-auto h-3 w-3 rotate-45 rounded-[2px] border-l border-t border-border bg-surface transition-opacity duration-150 ${
                  open ? "opacity-100" : "opacity-0"
                }`}
              />
              <div
                className={`pointer-events-auto -mt-[7px] overflow-hidden rounded-card border border-border shadow-menu transition-[height,opacity] duration-[250ms] ease-out ${
                  open ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                style={{
                  height: open ? panelHeight : 0,
                  // Find-care two-tone: left third canvas, rest surface — painted
                  // on the box so the rail always fills full height.
                  background:
                    menu === "find"
                      ? "linear-gradient(to right, var(--color-canvas) 0 33.3333%, var(--color-surface) 33.3333%)"
                      : "var(--color-surface)",
                }}
              >
                <div ref={contentRef}>
                  {menu === "find" && <FindCarePanel cat={cat} setCat={setCat} />}
                  {menu === "providers" && <ProvidersPanel />}
                  {menu === "company" && <CompanyPanel />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
