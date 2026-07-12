"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";

// Hero scroll cue — a circular down-chevron that fades/rises IN a beat after the
// page settles, then fades/drops OUT the instant the user starts scrolling. The
// gentle bob (.mkt-bob) and the smooth scroll to the target are CSS; both defer
// to prefers-reduced-motion. Desktop-only (the mobile hero isn't full-height).
export function ScrollCue({
  targetId = "reach",
  label = "Scroll to see how millions have found support",
}: {
  targetId?: string;
  label?: string;
}) {
  const [entered, setEntered] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 650);
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const visible = entered && !scrolled;

  return (
    <a
      href={`#${targetId}`}
      aria-label={label}
      tabIndex={visible ? 0 : -1}
      className={`group absolute inset-x-0 bottom-[66px] z-20 mx-auto hidden w-fit transition-all duration-500 ease-out lg:block ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <span className="mkt-bob flex h-11 w-11 items-center justify-center rounded-full border border-page-edge bg-surface/70 text-primary shadow-card backdrop-blur-sm transition-colors duration-200 group-hover:bg-surface group-hover:text-primary-deep group-hover:shadow-menu">
        <Icon name="chevron-down" size={20} />
      </span>
    </a>
  );
}
