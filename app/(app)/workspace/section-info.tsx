"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";

// The ⓘ next to a section title. The context it carries is a sentence or two —
// too much for a tooltip bubble — so a click opens a small dialog instead.

export function SectionInfo({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`About ${title}`}
        className="inline-flex text-text-muted transition-colors hover:text-text"
      >
        <Icon name="info" size={15} />
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={title} width="max-w-md">
          <p className="text-[15px] leading-relaxed text-text-body">{text}</p>
        </Modal>
      )}
    </>
  );
}
