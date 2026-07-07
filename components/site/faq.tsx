"use client";

import { AccordionSection } from "@/components/ui/accordion-section";
import type { Faq } from "@/lib/site-content";

// FAQ list — reuses the AccordionSection primitive, collapsed by default so the
// section pre-answers objections without a wall of text. NEW (public marketing
// site).

export function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="mt-10 border-t border-border">
      {items.map((f) => (
        <div key={f.q} className="border-b border-border py-4">
          <AccordionSection title={f.q} defaultOpen={false}>
            <p className="max-w-2xl text-pretty text-[15px] leading-relaxed text-text-body">{f.a}</p>
          </AccordionSection>
        </div>
      ))}
    </div>
  );
}
