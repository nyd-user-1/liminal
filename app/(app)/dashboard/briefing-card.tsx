import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { platformBriefing } from "@/lib/briefing";

// Layer 3 — the Platform briefing card. An async server component: the page
// wraps it in <Suspense> so a cold 12h-cache miss streams in late instead of
// holding the whole dashboard on a model call. No client state, no fetch.

function Shell({ children, corner }: { children: React.ReactNode; corner?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2.5 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
          <Icon name="wand-sparkles" size={16} className="text-primary" />
          Platform briefing
        </span>
        {corner}
      </div>
      {children}
    </Card>
  );
}

export function BriefingSkeleton() {
  return (
    <Shell>
      <div className="flex flex-col gap-2" aria-hidden>
        <span className="h-3.5 w-full animate-pulse rounded bg-canvas" />
        <span className="h-3.5 w-11/12 animate-pulse rounded bg-canvas" />
        <span className="h-3.5 w-4/5 animate-pulse rounded bg-canvas" />
      </div>
      <span className="text-sm text-text-muted">Reading the inventory…</span>
    </Shell>
  );
}

export async function BriefingCard() {
  const b = await platformBriefing();

  if (b.state === "off" || b.state === "error") {
    return (
      <Shell corner={<Badge variant="neutral">Off</Badge>}>
        <p className="text-sm text-text-muted">{b.reason}</p>
      </Shell>
    );
  }

  return (
    <Shell corner={<Badge variant="info">Claude</Badge>}>
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-text">{b.text}</p>
      <p className="text-[13px] text-text-muted">
        Written from the counts below — no patient data is ever sent. Refreshes every 12 hours · {formatDateTime(b.generatedAt)}
      </p>
    </Shell>
  );
}
