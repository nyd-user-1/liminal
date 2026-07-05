"use client";

import { Button } from "@/components/ui/button";

// Screen-only toolbar on the print view — hidden by @media print.

export function PrintActions() {
  return (
    <div className="print-hide mx-auto mb-6 flex max-w-[820px] items-center justify-end gap-2.5">
      <Button variant="secondary" onClick={() => window.close()}>
        Close
      </Button>
      <Button leftIcon="download" onClick={() => window.print()}>
        Print or save PDF
      </Button>
    </div>
  );
}
