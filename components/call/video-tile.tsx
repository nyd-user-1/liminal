"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { AvatarHue } from "@/lib/types";

// Catalog `VideoTile` (§3b·67) — participant surface on the dark call stage:
// live video, or an Avatar-initials fallback when there's no track / camera
// is off, plus a name-plate chip. Sizes: stage (fills its container) ·
// thumbnail (self-preview, ~240px).

export function VideoTile({
  stream,
  name,
  hue = "teal",
  size = "stage",
  label,
  muted = false,
  mirrored = false,
  videoOff = false,
  className = "",
  children,
}: {
  stream: MediaStream | null;
  name: string;
  hue?: AvatarHue;
  size?: "stage" | "thumbnail";
  label?: string; // name-plate text override ("You")
  muted?: boolean; // mute local playback (always for self-preview)
  mirrored?: boolean;
  videoOff?: boolean;
  className?: string;
  children?: ReactNode; // overlay (waiting spinner, lobby controls…)
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = Boolean(stream) && !videoOff;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
  }, [stream, showVideo]);

  const sizing =
    size === "stage"
      ? "h-full w-full"
      : "h-[8.5rem] w-60 shrink-0 ring-1 ring-white/15 shadow-menu";

  return (
    <div className={`relative overflow-hidden rounded-card bg-white/5 ${sizing} ${className}`}>
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""} ${showVideo ? "" : "hidden"}`}
        />
      )}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar name={name} hue={hue} size={size === "stage" ? "lg" : "md"} />
        </div>
      )}
      <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-full bg-black/60 px-2.5 py-1 text-[13px] font-medium text-white">
        {label ?? name}
      </span>
      {children}
    </div>
  );
}
