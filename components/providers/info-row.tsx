import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Shared row for Qualifications / Care details / About me: a grey circle
// badge + a small bold header with the value beneath, no divider lines. The
// icon is two-tone at rest — navy line, teal fill (+ a solid navy accent dot
// on icons that have one, e.g. map-pin) — not gated behind hover.

export function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-[#F3F4F6]">
        <Icon name={icon} size={18} className="fill-primary-wash text-text" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-text">{label}</p>
        <div className="mt-0.5 text-[15px] leading-relaxed text-text-body">{value}</div>
      </div>
    </div>
  );
}
