"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";

// Catalog `CallControls` (§3b·67) — bottom toolbar on the dark stage: ~44px
// circular icon buttons (mic · camera · share · more), off-state = solid red
// fill, plus the solid-red "End call" pill.
//
// mic-off / camera-off / screen-share icons are missing from the foundation
// icon set (components/ui/icons.tsx), so they're inlined here — integration
// can promote them to the shared set later.

function GlyphSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const localGlyphs = {
  "mic-off": (
    <GlyphSvg>
      <path d="M9 5a3 3 0 0 1 6 0v4.3" />
      <path d="M9 9.6V12a3 3 0 0 0 5.12 2.12" />
      <path d="M19 10v2a7 7 0 0 1-.64 2.93M5 10v2a7 7 0 0 0 11.6 5.26" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </GlyphSvg>
  ),
  "camera-off": (
    <GlyphSvg>
      <path d="m22 8-6 4 6 4V8z" />
      <path d="M9 6h5a2 2 0 0 1 2 2v5" />
      <path d="M16 16.5V16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </GlyphSvg>
  ),
  "screen-share": (
    <GlyphSvg>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <polyline points="9.5 9.5 12 7 14.5 9.5" />
      <line x1="12" y1="7" x2="12" y2="13" />
    </GlyphSvg>
  ),
} as const;

function ControlButton({
  label,
  active,
  activeStyle = "neutral",
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  active: boolean; // false = "off" red fill (or highlighted for share)
  activeStyle?: "neutral" | "danger-off" | "share-on";
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const style =
    activeStyle === "danger-off" && !active
      ? "bg-danger text-white hover:bg-[#B91C1C]"
      : activeStyle === "share-on" && active
        ? "bg-primary text-white hover:bg-primary-hover"
        : "bg-white/10 text-white hover:bg-white/20";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={activeStyle === "share-on" ? active : undefined}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${style}`}
    >
      {children}
    </button>
  );
}

export function CallControls({
  micOn,
  camOn,
  sharing = false,
  onToggleMic,
  onToggleCam,
  onToggleShare,
  onEnd,
  className = "",
}: {
  micOn: boolean;
  camOn: boolean;
  sharing?: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleShare?: () => void; // omit to hide the share button (lobby)
  onEnd?: () => void; // omit to hide End call (lobby)
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <ControlButton
        label={micOn ? "Turn microphone off" : "Turn microphone on"}
        active={micOn}
        activeStyle="danger-off"
        onClick={onToggleMic}
      >
        {micOn ? <Icon name="mic" /> : localGlyphs["mic-off"]}
      </ControlButton>
      <ControlButton
        label={camOn ? "Turn camera off" : "Turn camera on"}
        active={camOn}
        activeStyle="danger-off"
        onClick={onToggleCam}
      >
        {camOn ? <Icon name="video" /> : localGlyphs["camera-off"]}
      </ControlButton>
      {onToggleShare && (
        <ControlButton
          label={sharing ? "Stop sharing screen" : "Share screen"}
          active={sharing}
          activeStyle="share-on"
          onClick={onToggleShare}
        >
          {localGlyphs["screen-share"]}
        </ControlButton>
      )}
      {onEnd && (
        <>
          <ControlButton label="More options" active disabled>
            <Icon name="dots-vertical" />
          </ControlButton>
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-danger px-5 text-[15px] font-medium text-white transition-colors hover:bg-[#B91C1C]"
          >
            <span className="rotate-[135deg]">
              <Icon name="phone" size={18} />
            </span>
            End call
          </button>
        </>
      )}
    </div>
  );
}
