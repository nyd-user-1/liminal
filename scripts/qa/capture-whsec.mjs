#!/usr/bin/env node
// Put the Stripe webhook signing secret into .env.local, surgically.
//
//   node scripts/qa/capture-whsec.mjs            # ask the CLI, then write
//   node scripts/qa/capture-whsec.mjs whsec_abc… # write a secret you already have
//
// Why a script instead of "just paste it": .env.local holds a LIVE
// DATABASE_URL and several real API credentials. This only ever rewrites the
// single STRIPE_WEBHOOK_SECRET line (or appends one), keeps a timestamped
// backup, and prints a diff of names-only so you can see nothing else moved.
//
// `stripe listen --print-secret` returns the same whsec the long-running
// `stripe listen --forward-to …` would print, without holding a listener open.
// The secret is stable per CLI account, so capture it once and leave it.

import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

const ENV_PATH = ".env.local";
const KEY = "STRIPE_WEBHOOK_SECRET";

let secret = process.argv[2] ?? null;

if (secret && !secret.startsWith("whsec_")) {
  console.error(`"${secret}" does not look like a whsec_… value.`);
  process.exit(1);
}

if (!secret) {
  try {
    secret = execFileSync("stripe", ["listen", "--print-secret"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    console.error(
      "Could not get the secret from the Stripe CLI.\n" +
        "  · not installed?  brew install stripe/stripe-cli/stripe\n" +
        "  · not logged in?  stripe login\n" +
        "  · or pass it directly:  node scripts/qa/capture-whsec.mjs whsec_…\n\n" +
        String(err.stderr ?? err.message ?? err).trim(),
    );
    process.exit(1);
  }
}

if (!secret.startsWith("whsec_")) {
  console.error(`The CLI returned something unexpected: ${secret.slice(0, 40)}`);
  process.exit(1);
}

let env;
try {
  env = readFileSync(ENV_PATH, "utf8");
} catch {
  console.error(`${ENV_PATH} not found — run this from the repo root.`);
  process.exit(1);
}

const before = env.split("\n").filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => l.split("=")[0]);

const line = `${KEY}=${secret}`;
const re = new RegExp(`^${KEY}=.*$`, "m");
let next;
let action;
if (re.test(env)) {
  const current = env.match(re)[0].slice(KEY.length + 1);
  if (current === secret) {
    console.log(`${KEY} already set to this value — nothing to do.`);
    process.exit(0);
  }
  next = env.replace(re, line);
  action = "replaced";
} else {
  next = env.endsWith("\n") ? `${env}${line}\n` : `${env}\n${line}\n`;
  action = "appended";
}

const backup = `${ENV_PATH}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
copyFileSync(ENV_PATH, backup);
writeFileSync(ENV_PATH, next);

const after = next.split("\n").filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => l.split("=")[0]);
const added = after.filter((k) => !before.includes(k));
const removed = before.filter((k) => !after.includes(k));

console.log(`${action} ${KEY}=${secret.slice(0, 11)}…`);
console.log(`backup   ${backup}`);
console.log(`keys     ${before.length} → ${after.length}${added.length ? `  (+${added.join(", ")})` : ""}`);
if (removed.length) {
  console.error(`WARNING: keys disappeared: ${removed.join(", ")} — restore from ${backup}.`);
  process.exit(1);
}
console.log("\nRestart `npm run dev` — Next reads .env.local at boot, not per request.");
