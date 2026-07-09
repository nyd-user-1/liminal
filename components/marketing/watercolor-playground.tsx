"use client";

import { useEffect, useRef, useState } from "react";

// Floating panel that lets a visitor play with the .watercolor-hover pigment
// bloom live. Every control writes a --wc-* custom property on :root, which the
// parametrized rule in globals.css reads (originals as fallbacks). Presets are
// one-click starting points; "Surprise me" rolls a random tasteful look.

type Blend = "multiply" | "normal" | "screen" | "overlay" | "soft-light" | "darken";

type State = {
  coreColor: string; coreAlpha: number;
  midColor: string; midAlpha: number;
  edgeColor: string; edgeAlpha: number;
  midStop: number; edgeStop: number; endStop: number;
  inset: number; blur: number;
  restScale: number; hoverScale: number; opacity: number;
  fade: number; grow: number;
  blend: Blend; mask: boolean;
};

// Defaults mirror the fallbacks in globals.css exactly.
const DEFAULTS: State = {
  coreColor: "#1e3a4a", coreAlpha: 0.35,
  midColor: "#5e8c82", midAlpha: 0.25,
  edgeColor: "#c88c50", edgeAlpha: 0.15,
  midStop: 35, edgeStop: 55, endStop: 70,
  inset: 8, blur: 24,
  restScale: 0.6, hoverScale: 1.2, opacity: 1,
  fade: 0.7, grow: 1.3,
  blend: "multiply", mask: true,
};

const BLENDS: Blend[] = ["multiply", "normal", "screen", "overlay"];

// One-click starting points so a visitor sees the range without learning the
// sliders. On-brand (no off-palette hues) — each is a full State.
const PRESETS: Record<string, State> = {
  Default: DEFAULTS,
  Dusk: {
    ...DEFAULTS,
    coreColor: "#33415e", coreAlpha: 0.4,
    midColor: "#7b6d92", midAlpha: 0.26,
    edgeColor: "#e0a06a", edgeAlpha: 0.16,
    blur: 28, endStop: 74, hoverScale: 1.25,
  },
  Dawn: {
    ...DEFAULTS,
    coreColor: "#f0ae55", coreAlpha: 0.32,
    midColor: "#f2c98a", midAlpha: 0.22,
    edgeColor: "#e8b57a", edgeAlpha: 0.1,
    blur: 30, endStop: 76, hoverScale: 1.25,
  },
};

// "Surprise me" — a random but tasteful look. Colours come from an on-brand set;
// numeric params stay within ranges that read as watercolour, not noise.
const HUES = ["#1e3a4a", "#3f8290", "#c88c50", "#33415e", "#6b8f7a", "#b5657a", "#7b6d92", "#d99a6c", "#2c4a52", "#8fb0b0"];
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const rnd = (min: number, max: number, step = 0.01) => Math.round((min + Math.random() * (max - min)) / step) * step;
function randomize(): State {
  return {
    coreColor: pick(HUES), coreAlpha: rnd(0.3, 0.55),
    midColor: pick(HUES), midAlpha: rnd(0.15, 0.32),
    edgeColor: pick(HUES), edgeAlpha: rnd(0.08, 0.2),
    midStop: rnd(25, 45, 1), edgeStop: rnd(45, 65, 1), endStop: rnd(60, 92, 1),
    inset: rnd(4, 16, 1), blur: rnd(8, 44, 1),
    restScale: rnd(0.4, 0.8, 0.05), hoverScale: rnd(1.05, 1.6, 0.05), opacity: 1,
    fade: rnd(0.4, 1.2, 0.05), grow: rnd(0.8, 2, 0.05),
    blend: pick<Blend>(["multiply", "multiply", "normal", "screen", "overlay"]),
    mask: Math.random() > 0.3,
  };
}

function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// The var name / value pairs for a given state — single source of truth for both
// applying to :root and emitting the Copy-CSS block.
function vars(s: State): Array<[string, string]> {
  return [
    ["--wc-core", rgba(s.coreColor, s.coreAlpha)],
    ["--wc-mid", rgba(s.midColor, s.midAlpha)],
    ["--wc-edge", rgba(s.edgeColor, s.edgeAlpha)],
    ["--wc-mid-stop", `${s.midStop}%`],
    ["--wc-edge-stop", `${s.edgeStop}%`],
    ["--wc-end-stop", `${s.endStop}%`],
    ["--wc-inset", `${s.inset}%`],
    ["--wc-blur", `${s.blur}px`],
    ["--wc-rest-scale", String(s.restScale)],
    ["--wc-hover-scale", String(s.hoverScale)],
    ["--wc-opacity", String(s.opacity)],
    ["--wc-fade", `${s.fade}s`],
    ["--wc-grow", `${s.grow}s`],
    ["--wc-blend", s.blend],
  ];
}

export function WatercolorPlayground() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<State>(DEFAULTS);

  // draggable via the header. `pos` is the top-left corner in px; null = the
  // default bottom-right dock. Persists across open/close (component stays mounted).
  const panelRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return; // let header buttons click
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    setPos({ x: r.left, y: r.top });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!grab.current) return;
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 340;
    const h = el?.offsetHeight ?? 400;
    const x = Math.min(Math.max(0, e.clientX - grab.current.dx), window.innerWidth - w);
    const y = Math.min(Math.max(0, e.clientY - grab.current.dy), window.innerHeight - h);
    setPos({ x, y });
  };
  const onDragEnd = (e: React.PointerEvent) => {
    grab.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    const root = document.documentElement.style;
    for (const [k, v] of vars(s)) root.setProperty(k, v);
    // mask on = fall back to the default ellipse mask; off = pure circle
    if (s.mask) root.removeProperty("--wc-mask");
    else root.setProperty("--wc-mask", "none");
  }, [s]);

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open watercolor playground"
        className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface text-2xl shadow-menu transition-transform hover:scale-105"
      >
        🎨
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`fixed z-[60] flex max-h-[86vh] w-[340px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-menu ${pos ? "" : "bottom-6 right-6"}`}
    >
      {/* header — drag handle */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className="flex shrink-0 cursor-grab touch-none select-none items-center justify-between border-b border-border px-4 py-3 active:cursor-grabbing"
      >
        <span className="flex items-center gap-2 text-[15px] font-semibold text-text">🎨 Watercolor</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setS(DEFAULTS)} className="text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text">
            Reset
          </button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-text-muted hover:text-text">
            ✕
          </button>
        </div>
      </div>

      {/* scrollable controls */}
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <Section label="Presets">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PRESETS).map(([name, preset]) => {
              const active = JSON.stringify(s) === JSON.stringify(preset);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setS(preset)}
                  className={`rounded-field border px-3 py-1 text-xs font-medium transition-colors ${
                    active ? "border-primary bg-primary-wash text-primary" : "border-border text-text-body hover:bg-canvas"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Blend mode">
          <div className="flex flex-wrap gap-1.5">
            {BLENDS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => set("blend", b)}
                className={`rounded-field border px-2.5 py-1 text-xs font-medium transition-colors ${
                  s.blend === b ? "border-primary bg-primary-wash text-primary" : "border-border text-text-body hover:bg-canvas"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </Section>

        <Section label="Pigments">
          <ColorRow name="Core" color={s.coreColor} alpha={s.coreAlpha}
            onColor={(v) => set("coreColor", v)} onAlpha={(v) => set("coreAlpha", v)} />
          <ColorRow name="Mid" color={s.midColor} alpha={s.midAlpha}
            onColor={(v) => set("midColor", v)} onAlpha={(v) => set("midAlpha", v)} />
          <ColorRow name="Edge" color={s.edgeColor} alpha={s.edgeAlpha}
            onColor={(v) => set("edgeColor", v)} onAlpha={(v) => set("edgeAlpha", v)} />
        </Section>

        <Section label="Gradient stops">
          <Slider label="Mid stop" value={s.midStop} min={0} max={80} step={1} unit="%" onChange={(v) => set("midStop", v)} />
          <Slider label="Edge stop" value={s.edgeStop} min={20} max={95} step={1} unit="%" onChange={(v) => set("edgeStop", v)} />
          <Slider label="Bloom size" value={s.endStop} min={40} max={100} step={1} unit="%" onChange={(v) => set("endStop", v)} />
        </Section>

        <Section label="Shape">
          <Slider label="Overflow" value={s.inset} min={0} max={25} step={1} unit="%" onChange={(v) => set("inset", v)} />
          <Slider label="Blur" value={s.blur} min={0} max={60} step={1} unit="px" onChange={(v) => set("blur", v)} />
          <label className="flex items-center justify-between py-1 text-[13px] text-text-body">
            <span>Painterly edges</span>
            <input type="checkbox" checked={s.mask} onChange={(e) => set("mask", e.target.checked)} className="h-4 w-4 accent-primary" />
          </label>
        </Section>

        <Section label="Motion">
          <Slider label="Intensity" value={s.opacity} min={0} max={1} step={0.05} onChange={(v) => set("opacity", v)} />
          <Slider label="Rest scale" value={s.restScale} min={0.1} max={1.2} step={0.05} unit="×" onChange={(v) => set("restScale", v)} />
          <Slider label="Hover scale" value={s.hoverScale} min={0.5} max={2.5} step={0.05} unit="×" onChange={(v) => set("hoverScale", v)} />
          <Slider label="Fade in" value={s.fade} min={0} max={2} step={0.05} unit="s" onChange={(v) => set("fade", v)} />
          <Slider label="Grow" value={s.grow} min={0} max={3} step={0.05} unit="s" onChange={(v) => set("grow", v)} />
        </Section>
      </div>

      {/* footer */}
      <div className="shrink-0 border-t border-border p-3">
        <button
          type="button"
          onClick={() => setS(randomize())}
          className="w-full rounded-field bg-primary py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          ✨ Surprise me
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, unit = "", onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[13px] text-text-body">
        <span>{label}</span>
        <span className="tabular-nums text-text-muted">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 w-full accent-primary"
      />
    </div>
  );
}

function ColorRow({
  name, color, alpha, onColor, onAlpha,
}: {
  name: string; color: string; alpha: number; onColor: (v: string) => void; onAlpha: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={(e) => onColor(e.target.value)}
        className="h-7 w-7 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
        aria-label={`${name} color`}
      />
      <span className="w-10 shrink-0 text-[13px] text-text-body">{name}</span>
      <input
        type="range"
        min={0}
        max={0.8}
        step={0.01}
        value={alpha}
        onChange={(e) => onAlpha(parseFloat(e.target.value))}
        className="w-full accent-primary"
        aria-label={`${name} opacity`}
      />
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-text-muted">{alpha.toFixed(2)}</span>
    </div>
  );
}
