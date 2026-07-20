#!/usr/bin/env node
// Stripe Connect T6 preflight — everything that must be true BEFORE the drive,
// checked in one pass so the founder isn't discovering a missing key halfway
// through onboarding.
//
//   node --env-file=.env.local scripts/qa/preflight.mjs
//
// Read the output, not the exit code. Each line is PASS / FAIL / WARN with the
// specific fix attached. FAIL = the drive cannot proceed. WARN = it can, but
// something downstream will be degraded and you should know which part.

import { execSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";

const results = [];
const pass = (name, detail) => results.push({ level: "PASS", name, detail });
const fail = (name, detail, fix) => results.push({ level: "FAIL", name, detail, fix });
const warn = (name, detail, fix) => results.push({ level: "WARN", name, detail, fix });

// ── 1. Stripe keys, and specifically that they are TEST keys ─────────────────
// The tranche is test-mode only and the DB is live. A live secret key here
// would mean real money moving through an unfinished marketplace, so a live
// key is a HARDER failure than a missing one.
const secret = process.env.STRIPE_SECRET_KEY;
const pub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!secret) {
  fail(
    "STRIPE_SECRET_KEY",
    "absent — lib/stripe.ts getStripe() returns null, so checkout silently takes the MOCK path and no Stripe object is ever created",
    "add the test secret key (sk_test_…) to .env.local",
  );
} else if (secret.startsWith("sk_live_") || secret.startsWith("rk_live_")) {
  fail("STRIPE_SECRET_KEY", "is a LIVE key", "STOP. Replace with sk_test_… before any drive — this tranche is test-mode only.");
} else if (secret.startsWith("sk_test_") || secret.startsWith("rk_test_")) {
  pass("STRIPE_SECRET_KEY", `test key present (${secret.slice(0, 12)}…)`);
} else {
  warn("STRIPE_SECRET_KEY", `present but unrecognized prefix (${secret.slice(0, 8)}…)`, "confirm this is a test key");
}

if (!pub) {
  fail(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "absent — the embedded Connect components (T3) cannot initialise without it",
    "add the test publishable key (pk_test_…) to .env.local",
  );
} else if (pub.startsWith("pk_live_")) {
  fail("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "is a LIVE key", "replace with pk_test_…");
} else {
  pass("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", `${pub.slice(0, 12)}…`);
}

// ── 2. Webhook secret ────────────────────────────────────────────────────────
// The webhook 503s without this (app/api/stripe/webhook/route.ts), and the
// webhook is the ONLY authoritative settlement path — the success redirect is
// UX. No secret means the invoice never actually flips to paid.
const whsec = process.env.STRIPE_WEBHOOK_SECRET;
if (!whsec) {
  fail(
    "STRIPE_WEBHOOK_SECRET",
    "absent — POST /api/stripe/webhook returns 503 and refuses every event, so nothing settles",
    "run `stripe listen --forward-to localhost:3010/api/stripe/webhook` and copy the printed whsec_… into .env.local",
  );
} else if (!whsec.startsWith("whsec_")) {
  warn("STRIPE_WEBHOOK_SECRET", "present but does not look like a whsec_… value", "re-copy it from `stripe listen`");
} else {
  pass("STRIPE_WEBHOOK_SECRET", `${whsec.slice(0, 11)}…`);
}

// ── 3. Stripe CLI ────────────────────────────────────────────────────────────
// Without the CLI there is no way to forward events to localhost, and the
// connected-account scope (account.updated) cannot be observed at all.
try {
  const v = execSync("stripe --version", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  pass("stripe CLI", v);
  try {
    execSync("stripe config --list", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    pass("stripe CLI auth", "a config exists (confirm it is the right account with `stripe config --list`)");
  } catch {
    warn("stripe CLI auth", "no config found", "run `stripe login`");
  }
} catch {
  fail(
    "stripe CLI",
    "not installed — `stripe listen` is the only way to reach localhost:3010, and account.updated (connected scope) is otherwise unobservable",
    "brew install stripe/stripe-cli/stripe && stripe login",
  );
}

// ── 4. Schema (sql/061) ──────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  fail("DATABASE_URL", "absent", "run with `node --env-file=.env.local`");
} else {
  const sql = neon(process.env.DATABASE_URL);
  const want = ["stripe_connect_accounts", "stripe_events", "stripe_payment_splits"];
  const rows = await sql`
    SELECT table_name FROM information_schema.tables WHERE table_name = ANY(${want})
  `;
  const have = rows.map((r) => r.table_name);
  const missing = want.filter((t) => !have.includes(t));
  if (missing.length) {
    fail("sql/061 tables", `missing: ${missing.join(", ")}`, "psql \"$DATABASE_URL\" -f sql/061_stripe_connect.sql");
  } else {
    pass("sql/061 tables", have.sort().join(", "));
  }

  // The seeded invoice — the thing T4 clicks Pay on.
  const [inv] = await sql`
    SELECT number, status, total_cents FROM invoices WHERE id = '00000000-0000-4000-8000-000000009003'::uuid
  `;
  if (!inv) {
    warn(
      "test invoice",
      "INV-2026-9003 not seeded — Casey's other three invoices are all paid, so the portal has nothing payable",
      "node --env-file=.env.local scripts/qa/seed-test-invoice.mjs",
    );
  } else if (inv.status === "paid") {
    warn("test invoice", `${inv.number} is already paid (a previous drive settled it)`, "re-seed: --cleanup then seed again");
  } else {
    pass("test invoice", `${inv.number} status=${inv.status} $${(inv.total_cents / 100).toFixed(2)}`);
  }

  // Has anyone actually onboarded? charges_enabled is the only real gate.
  const accts = await sql`
    SELECT stripe_account_id, charges_enabled, details_submitted FROM stripe_connect_accounts
  `;
  if (!accts.length) {
    warn("connected account", "none yet — step 3 of the drive creates it", "provider Settings → Get paid → create");
  } else {
    for (const a of accts) {
      const detail = `${a.stripe_account_id} charges_enabled=${a.charges_enabled} details_submitted=${a.details_submitted}`;
      if (a.charges_enabled) pass("connected account", detail);
      else
        warn(
          "connected account",
          detail,
          "charges_enabled must be TRUE before checkout — details_submitted alone is NOT sufficient",
        );
    }
  }
}

// ── 5. Dev server ────────────────────────────────────────────────────────────
try {
  const res = await fetch("http://localhost:3010/api/health", { signal: AbortSignal.timeout(3000) }).catch(() => null);
  if (res) pass("dev server", `localhost:3010 responding (${res.status})`);
  else {
    const root = await fetch("http://localhost:3010/", { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (root) pass("dev server", `localhost:3010 responding (${root.status})`);
    else fail("dev server", "localhost:3010 not responding", "npm run dev");
  }
} catch {
  fail("dev server", "localhost:3010 not responding", "npm run dev");
}

// ── report ───────────────────────────────────────────────────────────────────
const pad = Math.max(...results.map((r) => r.name.length));
console.log("\nStripe Connect T6 — preflight\n");
for (const r of results) {
  console.log(`${r.level.padEnd(4)}  ${r.name.padEnd(pad)}  ${r.detail}`);
  if (r.fix) console.log(`${" ".repeat(6 + pad + 2)}↳ ${r.fix}`);
}
const fails = results.filter((r) => r.level === "FAIL").length;
const warns = results.filter((r) => r.level === "WARN").length;
console.log(`\n${fails} blocking, ${warns} advisory.`);
console.log(fails ? "The drive cannot proceed until the FAIL lines are cleared.\n" : "Clear to drive.\n");
process.exit(fails ? 1 : 0);
