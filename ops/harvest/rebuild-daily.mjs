#!/usr/bin/env node
// Standalone entry for JUST the nightly matview rebuild — the exact
// runDailyRebuild() the harvestd runner runs as its last phase, callable on its
// own. Two callers:
//   • .github/workflows/nightly-rebuild.yml — the CLOUD BELT (laptop-away nights)
//   • an operator locally: `node ops/harvest/rebuild-daily.mjs`
//
// It reuses runDailyRebuild wholesale — same shared sync-plan.mjs chain (10
// REFRESH CONCURRENTLY + 4 ANALYZE), same sound skip-guard (rebuild only if
// something loaded since the last ok daily), same sync_runs ledger — so the
// belt can never diverge from the suspenders. DATABASE_URL comes from the env
// (the runner also falls back to .env.local); psql must be on PATH. Exit 0 on
// success or a clean skip, 1 on any failed step.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDailyRebuild } from "./runner.mjs";

// runDailyRebuild writes progress under .harvest/runner/logs — ensure it exists
// on a fresh checkout (CI) before the first append.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
fs.mkdirSync(path.join(ROOT, ".harvest", "runner", "logs"), { recursive: true });

const result = await runDailyRebuild();
console.log(JSON.stringify(result));
process.exit(result.ok ? 0 : 1);
