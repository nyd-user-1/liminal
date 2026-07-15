"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Banner } from "@/components/ui/banner";
import { SidePanel } from "@/components/ui/side-panel";
import { Spinner } from "@/components/ui/spinner";

// The REAL prescribe flow: Photon's own Elements web components (the
// vendor-supported path) wrapped in our SidePanel so the surrounding chrome
// stays native Leuk.
//
// Two identities are in play. The Leuk session (cookie) is who you are here;
// the Photon session (their Auth0, obtained in-browser via photon-client) is
// who signs the prescription. They are separate on purpose — only a provider
// authorized in Photon carries the write:prescription permission, and the
// server's M2M token deliberately cannot write prescriptions at all.
//
// No hosts appear here: <photon-client env / dev-mode> selects Neutron vs
// production inside the SDK, driven by NEXT_PUBLIC_PHOTON_ENV.

const PRESCRIBE_PERMISSION = "write:prescription";

// Photon-authored copy for this exact state, per the demo brief.
const NOT_AUTHORIZED =
  "This practitioner is not yet authorized to prescribe in Photon (sandbox). Authorizing a provider is the only step needed to enable live prescribing.";

type PhotonElementProps = {
  children?: ReactNode;
  ref?: React.Ref<HTMLElement>;
} & Record<string, unknown>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "photon-client": PhotonElementProps;
      "photon-auth-wrapper": PhotonElementProps;
      "photon-prescribe-workflow": PhotonElementProps;
    }
  }
}

/** Permissions off the provider's User Access Token (public JWT claims). */
function tokenPermissions(token: string): string[] {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Array.isArray(payload?.permissions) ? (payload.permissions as string[]) : [];
  } catch {
    return [];
  }
}

export function PrescribePanel({
  open,
  onClose,
  onCreated,
  patientId,
  clientName,
  photonClientId,
  orgId,
  photonEnv,
}: {
  open: boolean;
  onClose: () => void;
  /** Fired once Photon confirms the prescription(s) were written. */
  onCreated: () => void;
  /** Photon patient id (clients.photon_patient_id) — required. */
  patientId: string;
  clientName: string;
  photonClientId: string;
  orgId: string;
  /** NEXT_PUBLIC_PHOTON_ENV — "neutron" (sandbox) or "photon" (production). */
  photonEnv: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [canPrescribe, setCanPrescribe] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Elements registers custom elements against `window` — import it in the
  // browser only, after mount (per Photon's React guidance).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    import("@photonhealth/elements")
      .then(() => alive && setReady(true))
      .catch((e) => alive && setError(`Could not load the Photon prescribe UI: ${e.message}`));
    return () => {
      alive = false;
    };
  }, [open]);

  // dev-mode is what actually points the SDK at Neutron: `env` alone sets the
  // API host but leaves the Auth0 domain on production. Both are driven off
  // NEXT_PUBLIC_PHOTON_ENV, so flipping it to "photon" goes live.
  const isSandbox = photonEnv !== "photon";

  const handleUserToken = useCallback((e: Event) => {
    const token = (e as CustomEvent<{ token?: string }>).detail?.token;
    if (!token) return;
    setCanPrescribe(tokenPermissions(token).includes(PRESCRIBE_PERMISSION));
  }, []);

  const handleCreated = useCallback(() => {
    onCreated();
    onClose();
  }, [onCreated, onClose]);

  const handleError = useCallback((e: Event) => {
    const errs = (e as CustomEvent<{ errors?: Array<{ message: string }> }>).detail?.errors ?? [];
    const msg = errs.map((x) => x.message).join("; ");
    // Photon rejects an unauthorized prescriber at the API. Surface the real
    // failure as the specific, actionable message rather than raw GraphQL.
    setError(/permission|unauthorized|not authorized|forbidden/i.test(msg) ? NOT_AUTHORIZED : msg || "Photon rejected the prescription.");
  }, []);

  // Elements dispatch composed CustomEvents that bubble to our host div.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !ready) return;
    el.addEventListener("photon-user-token", handleUserToken);
    el.addEventListener("photon-prescriptions-created", handleCreated);
    el.addEventListener("photon-prescriptions-error", handleError);
    el.addEventListener("photon-order-error", handleError);
    return () => {
      el.removeEventListener("photon-user-token", handleUserToken);
      el.removeEventListener("photon-prescriptions-created", handleCreated);
      el.removeEventListener("photon-prescriptions-error", handleError);
      el.removeEventListener("photon-order-error", handleError);
    };
  }, [ready, handleUserToken, handleCreated, handleError]);

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  // Auth0 sends the provider back here after login; both must be whitelisted
  // on the Photon SPA app (localhost:3010 already is).
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const redirectPath = typeof window === "undefined" ? "" : `${window.location.pathname}?tab=rx`;

  return (
    <SidePanel open={open} onClose={onClose} title={`Prescribe for ${clientName}`} icon="pill-bottle" width="max-w-3xl">
      <div ref={hostRef} className="min-h-0 overflow-x-hidden">
        {error && (
          <Banner variant="warning" className="mb-4">
            {error}
          </Banner>
        )}
        {canPrescribe === false && !error && (
          <Banner variant="warning" className="mb-4">
            {NOT_AUTHORIZED}
          </Banner>
        )}
        {!ready ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <photon-client
            id={photonClientId}
            org={orgId}
            env={photonEnv}
            {...(isSandbox ? { "dev-mode": "true" } : {})}
            redirect-uri={origin}
            redirect-path={redirectPath}
            emit-user-token="true"
          >
            <photon-auth-wrapper>
              {canPrescribe === false ? null : (
                <photon-prescribe-workflow
                  patient-id={patientId}
                  hide-patient-card="true"
                  enable-order="true"
                  enable-send-to-patient="true"
                  enable-local-pickup="true"
                />
              )}
            </photon-auth-wrapper>
          </photon-client>
        )}
      </div>
    </SidePanel>
  );
}
