"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Brand toggle — lets us flip the product name between "Leuk" and "Liminal"
// live, dark-mode-style, to compare the two during the naming decision. The
// <BrandName/> / <BrandFull/> / <BrandLogo/> components are client-side and read
// this context, so they can be dropped into server-rendered pages and still
// flip instantly (no reload) when the toggle fires. Default is Leuk.
//
// Once the name is settled: set DEFAULT_BRAND, and the toggle can be removed
// (or left hidden). Persisted in localStorage under "brand" like the theme.

export type BrandId = "leuk" | "liminal";

const LOGO = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com";
export const BRANDS: Record<BrandId, { name: string; full: string; logoDark: string; logoLight: string }> = {
  leuk: {
    name: "Leuk",
    full: "Leuk Psychiatry",
    logoDark: `${LOGO}/leuk.png`,
    logoLight: `${LOGO}/leuk.png`,
  },
  liminal: {
    name: "Liminal",
    full: "Liminal Psychiatry",
    logoDark: `${LOGO}/logos/brand/liminal-dark.png`,
    logoLight: `${LOGO}/logos/brand/liminal-light.png`,
  },
};

export const DEFAULT_BRAND: BrandId = "leuk";

const BrandCtx = createContext<{ id: BrandId; toggle: () => void }>({ id: DEFAULT_BRAND, toggle: () => {} });

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<BrandId>(DEFAULT_BRAND);

  useEffect(() => {
    const saved = localStorage.getItem("brand");
    if (saved === "leuk" || saved === "liminal") setId(saved);
  }, []);

  const toggle = useCallback(() => {
    setId((prev) => {
      const next: BrandId = prev === "leuk" ? "liminal" : "leuk";
      localStorage.setItem("brand", next);
      return next;
    });
  }, []);

  return <BrandCtx.Provider value={{ id, toggle }}>{children}</BrandCtx.Provider>;
}

export function useBrand() {
  return useContext(BrandCtx);
}

/** The short brand name, e.g. "Leuk". */
export function BrandName() {
  return <>{BRANDS[useBrand().id].name}</>;
}

/** The full brand name, e.g. "Leuk Psychiatry". */
export function BrandFull() {
  return <>{BRANDS[useBrand().id].full}</>;
}

/** Footer link that quietly flips the brand — labelled with the OTHER name, so
 *  it reads as a plain link but swaps the wordmark live. Styled to match the
 *  surrounding footer links (caller passes the shared className). */
export function BrandToggleLink({ className }: { className?: string }) {
  const { id, toggle } = useBrand();
  return (
    <button type="button" onClick={toggle} className={className}>
      {id === "leuk" ? "Demo 1" : "Demo 2"}
      <span aria-hidden className="text-white opacity-0 transition-opacity group-hover:opacity-100">
        ↗
      </span>
    </button>
  );
}
