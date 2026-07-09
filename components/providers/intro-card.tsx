"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ClampText } from "@/components/providers/clamp-text";
import { InfoRow } from "@/components/providers/info-row";

// The "Great to meet you!" intro card. "I identify as" / "My style is" used
// to be their own always-visible "About me" card further down the page;
// they now live under the intro's own "Show more" toggle instead, so the
// fuller, more personal detail only shows once the reader has already opted
// into the longer bio.

export function IntroCard({
  introMd,
  identifyAs,
  styleIs,
}: {
  introMd: string;
  identifyAs?: string | null;
  styleIs?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAboutMe = Boolean(identifyAs || styleIs);

  return (
    <Card>
      <h2 className="mb-3 text-[19px] font-semibold text-text">Great to meet you!</h2>
      <ClampText text={introMd} lines={4} onToggle={setExpanded} />
      {expanded && hasAboutMe && (
        <div className="mt-5 space-y-5 border-t border-border pt-5">
          <h3 className="text-[15px] font-semibold text-text">About me</h3>
          {identifyAs && <InfoRow icon="heart-handshake" label="I identify as" value={identifyAs} />}
          {styleIs && <InfoRow icon="palette" label="My style is" value={styleIs} />}
        </div>
      )}
    </Card>
  );
}
