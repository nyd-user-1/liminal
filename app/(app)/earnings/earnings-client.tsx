"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ConnectBalances,
  ConnectNotificationBanner,
  ConnectPaymentDetails,
  ConnectPayments,
  ConnectPayouts,
  ConnectPayoutsList,
} from "@stripe/react-connect-js";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SidePanel } from "@/components/ui/side-panel";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { ConnectEmbed } from "../settings/payments/connect-embed";
import {
  connectStage,
  fetchConnectStatus,
  fetchLoginLinkUrl,
  type ConnectAccountStatus,
} from "../settings/payments/connect-api";

// Earnings — the practitioner's money view over their Stripe connected account.
// Three embedded surfaces (Overview / Transactions / Payouts) under one pinned
// notification banner, gated so nothing mounts unless the account can actually
// take charges. The page title lives in the TopBar (canonical layout rule);
// nothing here renders an H1. Clients never reach this route — the (app) layout
// bounces them to /portal.
//
// Reuses the SETTINGS seam's runtime and route contract (ConnectEmbed themes the
// Stripe iframes to the kit; connect-api is the only thing that talks to
// /api/connect/**) — imported, never forked.
//
// disputes_list is deliberately absent: with destination charges the dispute
// lands on the PLATFORM, so a connected account's dispute list is empty by
// design and an empty component would read as broken.

type View = "overview" | "transactions" | "payouts";

const VIEWS = new Set<View>(["overview", "transactions", "payouts"]);

export function EarningsClient({ publishableKey }: { publishableKey: string }) {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const [account, setAccount] = useState<ConnectAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // ?view= seeds the initial tab so a payout email can deep-link straight to
  // Transactions; after mount the SegmentedControl owns it locally.
  const initialView = params.get("view");
  const [view, setView] = useState<View>(
    VIEWS.has(initialView as View) ? (initialView as View) : "overview",
  );

  // A charge id in ?payment= opens the payment_details flyover directly — the
  // target of a "view this payment" link in a payout email, and the one place
  // the per-charge application-fee split is shown.
  const paymentId = params.get("payment");

  // The notification banner reports its own count; keep it mounted (it is the
  // source of that count) but collapsed to zero height until it has something to
  // say, so an empty Stripe iframe doesn't leave a dead band above the views.
  // Height-clipped rather than display:none so the iframe still loads and fires
  // onNotificationsChange.
  const [notices, setNotices] = useState(0);

  const refresh = useCallback(async () => {
    if (!publishableKey) {
      setLoading(false);
      return;
    }
    setError("");
    try {
      setAccount(await fetchConnectStatus());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your earnings.");
    } finally {
      setLoading(false);
    }
  }, [publishableKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The Express Dashboard link hands back a single-use URL — open it rather than
  // storing or emailing it.
  const openDashboard = async () => {
    setBusy(true);
    try {
      window.location.href = await fetchLoginLinkUrl();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not open the Stripe dashboard.", "danger");
      setBusy(false);
    }
  };

  const closePayment = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("payment");
    const qs = next.toString();
    router.replace(qs ? `/earnings?${qs}` : "/earnings", { scroll: false });
  };

  const stage = connectStage(account);

  if (!publishableKey) {
    return (
      <Banner variant="warning">
        Payments aren&rsquo;t configured on this environment — no Stripe publishable key is set.
      </Banner>
    );
  }

  if (loading) {
    return (
      <Card className="flex items-center gap-2.5 text-[15px] text-text-muted">
        <Spinner size={18} /> Loading your earnings…
      </Card>
    );
  }

  // Never mount money components for an account that can't take charges. Any
  // stage short of "active" (no account, mid-onboarding, or verification
  // pending) sends the practitioner to Settings to finish setup first.
  if (stage !== "active") {
    return (
      <Card>
        <EmptyState
          className="py-8"
          icon="credit-card"
          title="Set up payments first"
          subtext="Your balance, transactions, and payouts appear here once your payout account is verified and able to accept client payments."
          actions={
            <Button leftIcon="credit-card" onClick={() => router.push("/settings/payments")}>
              Set up payments
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Banner
          variant="danger"
          action={
            <Button size="sm" variant="secondary" onClick={() => void refresh()}>
              Try again
            </Button>
          }
        >
          {error}
        </Banner>
      )}

      <ConnectEmbed publishableKey={publishableKey}>
        <div className="space-y-4">
          {/* Pinned across every view; height-clipped until Stripe has a notice. */}
          <div className={notices > 0 ? "" : "h-0 overflow-hidden"}>
            <ConnectNotificationBanner
              onLoadError={() => undefined}
              onNotificationsChange={({ total }) => setNotices(total)}
            />
          </div>

          <SegmentedControl
            segments={[
              { value: "overview", label: "Overview", icon: "dollar" },
              { value: "transactions", label: "Transactions", icon: "credit-card" },
              { value: "payouts", label: "Payouts", icon: "arrow-right" },
            ]}
            value={view}
            onChange={(v) => setView(v as View)}
          />

          <Card className="p-5">
            {view === "overview" && (
              <>
                <ConnectBalances onLoadError={() => setError("Your balance could not load.")} />
                <p className="mt-4 text-[15px] text-text-muted">
                  Available funds pay out to your bank on Stripe&rsquo;s schedule. Track individual
                  payouts under Payouts.
                </p>
              </>
            )}
            {view === "transactions" && (
              <ConnectPayments onLoadError={() => setError("Your transactions could not load.")} />
            )}
            {view === "payouts" && (
              <div className="space-y-6">
                <ConnectPayouts onLoadError={() => setError("Your payouts could not load.")} />
                <ConnectPayoutsList onLoadError={() => undefined} />
              </div>
            )}
          </Card>

          {/* Quiet fallback — the embedded components cover day-to-day; the full
              Express dashboard is one muted link away, not a primary action. */}
          <div className="pt-1">
            <TextLink variant="underline" disabled={busy} onClick={() => void openDashboard()}>
              Open your Stripe Express dashboard
            </TextLink>
          </div>
        </div>

        {/* payment_details flyover — rendered inside ConnectEmbed so the Stripe
            Connect context reaches it through the portal. */}
        <SidePanel
          open={Boolean(paymentId)}
          onClose={closePayment}
          title="Payment"
          kicker="Transaction"
          icon="credit-card"
          width="max-w-lg"
        >
          {paymentId && <ConnectPaymentDetails payment={paymentId} onClose={closePayment} />}
        </SidePanel>
      </ConnectEmbed>
    </div>
  );
}
