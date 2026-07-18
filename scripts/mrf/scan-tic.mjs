#!/usr/bin/env node
// MRF PoC — FAST single-pass TiC scanner. Same contract as
// stream-uhc-behavioral.mjs (the reference implementation it is validated
// against), but ~50x faster on UHC files by exploiting their layout:
//
//   - top-level header is pretty-printed; `provider_references` is front-loaded
//     and small (~67 MB) -> parsed with stream-json, bounded by our NPI list;
//   - each `in_network` item is ONE physical line (`\n\t{...},`), with
//     `billing_code` in the first few hundred bytes, before the multi-MB
//     `negotiated_rates` array -> we skip line-to-line with Buffer.indexOf
//     (SIMD memchr) and JSON.parse only the handful of matching lines.
//
// Defensive: any line that looks like an item but has no billing_code in its
// head window, or a matched line that fails to parse, aborts loudly (exit 3)
// rather than silently under-reporting. Fall back to the reference script if
// that ever fires.
//
//   curl -sL <url> | gunzip -c | node scripts/mrf/scan-tic.mjs \
//     --npis=.harvest/mrf/npis.txt --out=.harvest/mrf/out.csv \
//     --payer="..." --network="..." --source-file=<name> --file-date=YYYY-MM-DD

import fs from "node:fs";
import path from "node:path";
import chain from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";

const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};

const NPIS_PATH = arg("npis");
const OUT_PATH = arg("out");
// --payer=auto -> use the file's own reporting_entity_name (captured from the
// header) — required on BCBS hosts, which serve other states' entities under
// one subdomain (an "empirebcbs" URL can carry Anthem-Colorado content).
let PAYER = arg("payer", "UnitedHealthcare");
const PAYER_AUTO = PAYER === "auto";
const NETWORK = arg("network", "");
// --refs=scan -> byte-scan provider_references as `{"provider_group_id"…}`
// objects + JSON.parse each (BCBS id-first layout, ~20x faster than
// stream-json). Default `stream` keeps the validated stream-json path (UHC
// files are id-LAST — the scan needle would mis-delimit them; keep stream).
const REFS_MODE = arg("refs", "stream");
// --emit-unmatched=<file> -> also collect NPIs seen in provider groups that
// are NOT in our list (telehealth-gap measurement, docs/TASK-TELEHEALTH-GAP.md).
// Capped so a national file can't eat the heap; cap hit is reported loudly.
const UNMATCHED_PATH = arg("emit-unmatched", "");
// --tin-names=<file> -> the tin-name sidecar sql/019 has been waiting for.
// The TiC provider_groups `tin` object carries the org's own name:
//   "tin":{"type":"ein","value":"51-0111166","business_name":"NOVACARE REHABILITATION"}
// This is the ONLY authoritative name for an ein-TIN: CMS suppresses EINs in
// the public NPPES file, so an EIN cannot be resolved to an org any other way —
// every other route (NPPES rosters, FHIR crosswalks) is inference. Names ride
// on ein-type tins; npi-type tins carry none and don't need one (NPPES resolves
// those directly).
//
// Independent of --out: the name lives on the group, not on a rate row, so it
// is captured for EVERY group in the file, including groups whose NPIs we don't
// track and groups that never reach a CPT we want.
const TIN_NAMES_PATH = arg("tin-names", "");
// --tins=<file> -> only keep names for these tins (one canonical tin per line).
// Bounds the heap on national files, where the ein universe runs to millions
// and we only ever care about the ~31k that appear in our own rate data.
const TINS_PATH = arg("tins", "");
const UNMATCHED_CAP = 3_000_000;
const unmatched = UNMATCHED_PATH ? new Set() : null;
let unmatchedCapped = false;
const SOURCE_FILE = arg("source-file", "");
const FILE_DATE = arg("file-date", "");
// Default code set widened 2026-07-17 (Brendan's call) from the original five
// (90791,90834,90837,99214,90853) to the full behavioral billing picture:
// diagnostic pair, all psychotherapy durations, the prescriber add-on trio,
// crisis, family therapy, interactive-complexity + screener add-ons, and the
// E/M ladder both new and established. Rows scale with codes but the NPI list
// still bounds the scan; pass --codes to narrow for a targeted rescan.
const CPTS = new Set(
  (arg(
    "codes",
    "90791,90792,90832,90833,90834,90836,90837,90838,90839,90840,90846,90847,90853,90785,96127,99204,99205,99213,99214,99215",
  )).split(","),
);

// Two-pass mode for ref-dense files (Empire NY 39-series: ~10.5 KB heap per
// retained group x 600k+ matched groups — no heap cap can work, NYS-25):
//   pass A  --collect-gids=<file>  stream once, SKIP provider_references
//            entirely, write the group-ids the CPT-matched items reference;
//   pass B  --gids=<file>          normal run retaining ONLY those groups.
// Retained memory drops from GBs (every group our NPIs appear in) to MBs
// (only the groups our five codes actually price).
const COLLECT_GIDS_PATH = arg("collect-gids", "");
const GIDS_PATH = arg("gids", "");
if (COLLECT_GIDS_PATH && GIDS_PATH) {
  console.error("--collect-gids and --gids are the two passes — use one at a time");
  process.exit(1);
}
const collectedGids = COLLECT_GIDS_PATH ? new Set() : null;
const wantedGids = GIDS_PATH
  ? new Set(fs.readFileSync(GIDS_PATH, "utf8").split("\n").map((s) => s.trim()).filter(Boolean))
  : null;
if (wantedGids) console.error(`gids wanted: ${wantedGids.size} (pass B)`);

if (!NPIS_PATH || (!OUT_PATH && !COLLECT_GIDS_PATH && !TIN_NAMES_PATH)) {
  console.error(
    "Usage: ... --npis=<file> --out=<csv> [--codes=a,b,c] [--collect-gids=<file> | --gids=<file>]\n" +
      "       ... --tin-names=<csv> [--tins=<file>]   (name sidecar; --out optional)"
  );
  process.exit(1);
}

const ourNpis = new Set(
  fs.readFileSync(NPIS_PATH, "utf8").split("\n").map((s) => s.trim()).filter(Boolean)
);
// numeric->canonical-string map: TiC files carry npi as JSON numbers. Testing
// the number avoids a String() allocation per NPI, and returning the CANONICAL
// string interns matches — an NPI matched in 5,000 groups must reference one
// string, not allocate 5,000 (Empire-NY refs OOM'd 5GB on exactly that).
const ourNpiCanon = new Map([...ourNpis].map((s) => [Number(s), s]));
const tinCache = new Map(); // intern tins for the same reason
// Canonical tin string: lowercased type + digits/letters only in the value.
// Payers format EINs inconsistently ('83-2675429') — unnormalized tins split
// one org across several keys (Headway rode two spellings until 2026-07-13).
const normTin = (t) =>
  t ? `${String(t.type ?? "").toLowerCase()}:${String(t.value ?? "").toLowerCase().replace(/[^0-9a-z]/g, "")}` : "";
const internTin = (t) => {
  let v = tinCache.get(t);
  if (v === undefined) {
    tinCache.set(t, t);
    v = t;
  }
  return v;
};

// ── tin-name sidecar ─────────────────────────────────────────────────────────
const wantedTins = TINS_PATH
  ? new Set(fs.readFileSync(TINS_PATH, "utf8").split("\n").map((s) => s.trim()).filter(Boolean))
  : null;
if (TIN_NAMES_PATH)
  console.error(`tin-names: capturing${wantedTins ? ` (${wantedTins.size} tins wanted)` : " (all tins)"}`);
const tinNames = TIN_NAMES_PATH ? new Map() : null;
/** First writer wins: a file can repeat a group, and the spellings agree. */
const captureTinName = (g) => {
  if (!tinNames) return;
  const name = g?.tin?.business_name;
  if (!name) return;
  const tin = normTin(g.tin);
  if (!tin || (wantedTins && !wantedTins.has(tin)) || tinNames.has(tin)) return;
  tinNames.set(tin, String(name).trim());
};
const retained = new Map(); // group_id -> [{tin, npis:[matched]}]

// pass A emits no rows — only the gid list. --out=- streams CSV to stdout so
// it can pipe straight into stream-load.mjs (no intermediate file) — the
// pipe-to-loader path for dense payers like Aetna whose CSVs won't fit disk.
// (Progress/DONE all go to stderr, so stdout stays clean CSV.)
let out;
if (OUT_PATH === "-") out = process.stdout;
else if (OUT_PATH) { fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true }); out = fs.createWriteStream(OUT_PATH); }
else out = null;
out?.write(
  "npi,payer,plan_or_network,billing_code,negotiated_rate,negotiated_type,billing_class,place_of_service,tin,source_file,file_date\n"
);
const csv = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// No-op when there's no --out (a --tin-names-only pass still walks every item;
// it just has nowhere to put rows, and shouldn't crash trying).
const writeOut = (line) =>
  out ? out.write(line) || new Promise((res) => out.once("drain", res)) : undefined;

/** Flush the name sidecar. Called on every exit path — a scan that bails on a
 *  layout check has still learned every name it read up to that point, and
 *  those names are expensive to re-fetch. */
const flushTinNames = () => {
  if (!tinNames) return;
  fs.mkdirSync(path.dirname(TIN_NAMES_PATH), { recursive: true });
  const rows = [...tinNames].map(([tin, name]) => `${csv(tin)},${csv(name)}\n`);
  fs.writeFileSync(TIN_NAMES_PATH, `tin,business_name\n${rows.join("")}`);
  console.error(`tin-names: wrote ${tinNames.size} names -> ${TIN_NAMES_PATH}`);
};

const stats = {
  bytes: 0,
  refsSeen: 0,
  refsRetained: 0,
  itemsSeen: 0,
  itemsMatchedCode: 0,
  rows: 0,
  byCode: Object.fromEntries([...CPTS].map((c) => [c, 0])),
  start: Date.now(),
};
const logStatus = () => {
  const mb = (stats.bytes / 1e6).toFixed(0);
  const mins = ((Date.now() - stats.start) / 60000).toFixed(1);
  // memory ticker: heapMB + container sizes — the 39-series OOM diagnostic
  const heap = (process.memoryUsage().heapUsed / 1048576).toFixed(0);
  console.error(
    `[${mins}m] ${mb} MB uncompressed | refs ${stats.refsSeen} (retained ${stats.refsRetained}) | items ${stats.itemsSeen} (cpt-hit ${stats.itemsMatchedCode}) | rows ${stats.rows} | heap ${heap}MB` +
      (unmatched ? ` | unmatched ${unmatched.size}` : "")
  );
};
const ticker = setInterval(logStatus, 15000);

function handleProviderReference(ref) {
  stats.refsSeen++;
  // Names first, and BEFORE the pass-B gid filter + the npi filter below: the
  // business_name belongs to the group, not to any rate row we keep, so a ref
  // we discard for rates can still be the only place a TIN is ever named.
  if (tinNames && Array.isArray(ref?.provider_groups)) for (const g of ref.provider_groups) captureTinName(g);
  // pass B: only the groups pass A proved our items reference
  if (wantedGids && !wantedGids.has(String(ref?.provider_group_id))) return;
  const groups = ref?.provider_groups;
  if (!Array.isArray(groups)) return;
  let kept = null;
  for (const g of groups) {
    if (!Array.isArray(g?.npi)) continue;
    let matched = null;
    for (const n of g.npi) {
      if (typeof n === "number") {
        const c = ourNpiCanon.get(n);
        if (c !== undefined) (matched ??= []).push(c);
        else if (unmatched && n > 999999999) {
          if (unmatched.size < UNMATCHED_CAP) unmatched.add(n);
          else unmatchedCapped = true;
        }
      } else if (ourNpis.has(String(n).trim())) {
        (matched ??= []).push(String(n).trim());
      }
    }
    if (matched) {
      (kept ??= []).push({
        tin: internTin(normTin(g.tin)),
        npis: matched,
      });
    }
  }
  if (kept) {
    // carry the ref's own network_name (BCBS refs are per-network) so rows
    // can be labeled with the file's truth instead of the manifest guess
    const net = Array.isArray(ref.network_name) ? ref.network_name.join(";") : "";
    retained.set(ref.provider_group_id, { groups: kept, net });
    stats.refsRetained++;
  }
}

async function emitRows(item) {
  // pass A: record which groups the matched items price — nothing else
  if (collectedGids) {
    for (const nr of item.negotiated_rates ?? []) {
      if (Array.isArray(nr.provider_references)) {
        for (const gid of nr.provider_references) collectedGids.add(String(gid));
      }
    }
    return;
  }
  for (const nr of item.negotiated_rates ?? []) {
    let sides = null;
    if (Array.isArray(nr.provider_references)) {
      for (const gid of nr.provider_references) {
        const r = retained.get(gid);
        if (r) for (const k of r.groups) (sides ??= []).push(r.net ? { ...k, net: r.net } : k);
      }
    } else if (Array.isArray(nr.provider_groups)) {
      for (const g of nr.provider_groups) {
        // Inline groups (no provider_references section) name TINs too.
        captureTinName(g);
        if (!Array.isArray(g?.npi)) continue;
        const matched = g.npi.map(String).filter((s) => ourNpis.has(s));
        if (matched.length)
          (sides ??= []).push({
            tin: normTin(g.tin),
            npis: matched,
          });
      }
    }
    if (!sides) continue;
    // CDPHP publishes singular `negotiated_price` (array); HCP publishes it
    // as a bare object; CMS schema says plural array. Normalize all three.
    const priceList =
      nr.negotiated_prices ??
      (Array.isArray(nr.negotiated_price)
        ? nr.negotiated_price
        : nr.negotiated_price
          ? [nr.negotiated_price]
          : []);
    for (const price of priceList) {
      const pos = Array.isArray(price.service_code) ? price.service_code.join("|") : "";
      for (const side of sides) {
        for (const npi of side.npis) {
          const w = writeOut(
            [
              npi,
              csv(PAYER),
              // --network=auto -> label rows with the ref's own network_name
              csv(NETWORK === "auto" ? side.net || "" : NETWORK),
              item.billing_code,
              price.negotiated_rate,
              price.negotiated_type ?? "",
              price.billing_class ?? "",
              pos,
              csv(side.tin),
              csv(SOURCE_FILE),
              FILE_DATE,
            ].join(",") + "\n"
          );
          if (w !== true) await w;
          stats.rows++;
          if (stats.byCode[item.billing_code] !== undefined) stats.byCode[item.billing_code]++;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Phase R: stream-json over the header until `"in_network":` appears.
// ---------------------------------------------------------------------------
// key only — some vendors emit `"in_network" : [` with whitespace, so the
// colon is verified separately after the match
const MARKER = Buffer.from('"in_network"');
const isColonAfter = (buf, at) => {
  let j = at + MARKER.length;
  while (j < buf.length && (buf[j] === 0x20 || buf[j] === 0x09 || buf[j] === 0x0a || buf[j] === 0x0d)) j++;
  return j < buf.length ? buf[j] === 0x3a : null; // null = undecidable at chunk edge
};
const NL = 0x0a;
// whitespace-tolerant: vendors emit both `"billing_code":"90837"` and
// `"billing_code": "90837"`
const CODE_RE = new RegExp(`"billing_code"\\s*:\\s*"(${[...CPTS].join("|")})"`);
const HEAD_WINDOW = 4096;

let refsChain = null;
let refsDone = false;

if (REFS_MODE === "stream" && !collectedGids) {
  refsChain = chain([parser(), pick({ filter: "provider_references" }), streamArray()]);
  refsChain.on("data", ({ value }) => handleProviderReference(value));
  // a malformed header/refs section must fail loudly, not as an unhandled event
  refsChain.on("error", (err) => {
    if (refsDone) return; // expected truncation error during finishRefs
    clearInterval(ticker);
    console.error(`REFS PARSE ERROR (header/provider_references malformed): ${err.message}`);
    process.exit(2);
  });
}
const refsWrite = async (buf) => {
  if (refsChain.write(buf) !== true)
    await new Promise((res) => refsChain.once("drain", res));
};

// ── refs fast path (--refs=scan): ref objects open with `{"provider_group_id"`
// on the BCBS platform (id-first). Delimit on that key like phase N delimits
// items, JSON.parse each object whole, feed the existing handler.
const KEY_REF = Buffer.from('"provider_group_id"');
const RESERVE_R = KEY_REF.length + 80;
let modeR = "SEEK"; // SEEK before first object; OBJ while accumulating one
let partsR = [];
let partsRLen = 0;
let carryR = Buffer.alloc(0);
let refObjectsParsed = 0;
let refFalseHits = 0; // id key seen but not at an object brace (id-last layout)

function finishRefObj() {
  let text = Buffer.concat(partsR, partsRLen).toString("utf8").trim();
  partsR = [];
  partsRLen = 0;
  let obj = null;
  for (let chop = 0; chop < 10; chop++) {
    try {
      obj = JSON.parse(text);
      break;
    } catch {
      const last = text[text.length - 1];
      if (last === "]" || last === "}" || last === ",") text = text.slice(0, -1).trimEnd();
      else break;
    }
  }
  if (!obj) {
    clearInterval(ticker);
    console.error("REFS SCAN: ref object failed to parse — wrong layout for --refs=scan");
    console.error("sample:", text.slice(0, 200));
    process.exit(2);
  }
  refObjectsParsed++;
  handleProviderReference(obj);
}

function scanRefsChunk(buf) {
  const data = carryR.length ? Buffer.concat([carryR, buf]) : buf;
  carryR = Buffer.alloc(0);
  let segStart = 0;
  let pos = 0;
  for (;;) {
    const q = data.indexOf(KEY_REF, pos);
    if (q === -1) {
      if (modeR === "OBJ") {
        const cut = Math.max(pos, data.length - RESERVE_R);
        if (cut > segStart) {
          partsR.push(data.subarray(segStart, cut));
          partsRLen += cut - segStart;
        }
        carryR = Buffer.from(data.subarray(cut));
      } else {
        carryR = Buffer.from(data.subarray(Math.max(pos, data.length - RESERVE_R)));
      }
      return;
    }
    let j = q - 1;
    while (j >= 0 && isWs(data[j])) j--;
    if (j < 0 || data[j] !== 0x7b) {
      refFalseHits++;
      pos = q + KEY_REF.length; // id key mid-object (UHC id-last) — not a boundary here
      continue;
    }
    const brace = j;
    if (modeR === "OBJ") {
      if (brace > segStart) {
        partsR.push(data.subarray(segStart, brace));
        partsRLen += brace - segStart;
      }
      finishRefObj();
    }
    modeR = "OBJ";
    partsR = [];
    partsRLen = 0;
    segStart = brace;
    pos = q + KEY_REF.length;
  }
}

const finishRefs = async (tail) => {
  refsDone = true;
  if (collectedGids) return; // pass A never parsed the refs bytes
  if (REFS_MODE === "scan") {
    if (tail?.length) scanRefsChunk(tail);
    if (modeR === "OBJ") {
      if (carryR.length) {
        partsR.push(carryR);
        partsRLen += carryR.length;
      }
      finishRefObj();
    }
    if (refObjectsParsed === 0 && refFalseHits > 0) {
      // the id key exists but never opens an object -> id-LAST layout;
      // running scan mode here would silently drop every provider group
      clearInterval(ticker);
      console.error("REFS SCAN: id-last layout detected (0 objects, id keys mid-object) — use --refs=stream");
      process.exit(2);
    }
    return;
  }
  if (tail?.length) await refsWrite(tail);
  // end + flush so trailing provider_references still in the pipeline land in
  // `retained`; the parser then errors on the truncated root — expected.
  await new Promise((res) => {
    refsChain.on("error", res);
    refsChain.on("end", res);
    refsChain.on("close", res);
    refsChain.end();
  });
  refsChain = null;
};

// ---------------------------------------------------------------------------
// Phase N: opener-delimited scanner over in_network. Every vendor generator
// we've met (UHC one-item-per-line, CDPHP newline-inside-item) emits
// `{"negotiation_arrangement"` as the first key of every item, so consecutive
// occurrences of that needle delimit items exactly — no line assumptions.
// Modes: SEEK/SKIP (searching for next opener, nothing retained) ->
// HEAD (accumulating undecided item) -> CAPTURE (matched item, buffer whole).
// ---------------------------------------------------------------------------
// Item boundary = a `{` followed by (optional whitespace and) the
// negotiation_arrangement key — compact (UHC/CDPHP/Empire) and pretty-printed
// (Fidelis-ES: `{\r\n  "negotiation_arrangement": …`) files both match.
const KEY = Buffer.from('"negotiation_arrangement"');
const RESERVE = KEY.length + 80; // carry window: key prefix + brace backtrack room
const FAST_GATE = Buffer.from('"billing_code"'); // cheap prefilter, spacing-agnostic
const isWs = (b) => b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d;
let mode = "SEEK";
let parts = []; // current item bytes, brace onward
let partsLen = 0;

function abort(why, sample) {
  clearInterval(ticker);
  console.error(`SCANNER ASSUMPTION BROKEN: ${why}`);
  if (sample) console.error("sample:", sample.toString("utf8", 0, 200));
  process.exit(3);
}

// items above this size can't go through Buffer.concat/JSON.parse (2GB string
// limit -> SIGABRT); stream their negotiated_rates instead. Empire NY items
// referencing tens of thousands of groups exceed it.
const HUGE_ITEM = Number(process.env.HUGE_ITEM_BYTES || 200 * 1024 * 1024);

async function finishItemStreaming() {
  const head = Buffer.concat(parts, Math.min(partsLen, HEAD_WINDOW)).toString("utf8");
  const cm = head.match(/"billing_code"\s*:\s*"([^"]+)"/);
  const code = cm?.[1];
  const myParts = parts;
  parts = [];
  partsLen = 0;
  if (!code || !CPTS.has(code)) return; // false-positive capture — drop
  stats.itemsMatchedCode++;
  // right-trim inter-item junk (`,` + ws) back to the final `}` — v3's parser
  // aborts the pipeline on trailing bytes BEFORE flushing any entries
  while (myParts.length) {
    let last = myParts[myParts.length - 1];
    let e = last.length;
    while (e > 0 && (isWs(last[e - 1]) || last[e - 1] === 0x2c)) e--;
    if (e === 0) {
      myParts.pop();
      continue;
    }
    if (e < last.length) myParts[myParts.length - 1] = last.subarray(0, e);
    break;
  }
  const c = chain([parser(), pick({ filter: "negotiated_rates" }), streamArray()]);
  let sawEntry = false;
  const feeder = (async () => {
    for (const p of myParts) {
      if (c.write(p) !== true) await new Promise((r) => c.once("drain", r));
    }
    c.end();
  })();
  try {
    for await (const { value } of c) {
      sawEntry = true;
      await emitRows({ billing_code: code, negotiated_rates: [value] });
    }
  } catch (err) {
    // trailing inter-item bytes (`,` + ws) after the root object are expected;
    // anything before we saw entries is a real parse problem
    if (!sawEntry) abort(`huge-item streaming parse failed: ${err.message}`);
  }
  await feeder.catch(() => {});
}

async function finishItem() {
  if (partsLen > HUGE_ITEM) return finishItemStreaming();
  // full matched item accumulated in parts (brace onward), minus trailing junk
  let text = Buffer.concat(parts, partsLen).toString("utf8").trim();
  parts = [];
  partsLen = 0;
  let item = null;
  for (let chop = 0; chop < 10; chop++) {
    try {
      item = JSON.parse(text);
      break;
    } catch {
      const last = text[text.length - 1];
      if (last === "]" || last === "}" || last === ",") text = text.slice(0, -1).trimEnd();
      else break;
    }
  }
  if (!item) abort("matched item failed to parse after trims");
  // head-window test can false-positive (code text inside description) —
  // re-check the parsed item so behavior matches the reference implementation
  if (!CPTS.has(String(item.billing_code))) return;
  stats.itemsMatchedCode++;
  await emitRows(item);
}

// decide on the first HEAD_WINDOW bytes of the current item
function decide() {
  const head = Buffer.concat(parts, Math.min(partsLen, HEAD_WINDOW));
  if (!head.includes(FAST_GATE)) {
    // an item whose billing_code escaped the head window — never silent
    abort(`item without billing_code in first ${HEAD_WINDOW} bytes`, head);
  }
  return CODE_RE.test(head.toString("utf8")) ? "CAPTURE" : "SKIP";
}

// `carry` holds the reserve tail straddling chunk boundaries: a potential key
// prefix plus enough room to backtrack to the item's opening brace
let carry = Buffer.alloc(0);

async function scanChunk(buf) {
  const data = carry.length ? Buffer.concat([carry, buf]) : buf;
  carry = Buffer.alloc(0);
  let segStart = 0; // start of unpushed bytes for the open item
  let pos = 0; // search cursor
  for (;;) {
    const q = data.indexOf(KEY, pos);
    if (q === -1) {
      // No further boundary in this chunk: push all but the reserve tail.
      // The cut is floored at `pos` (the cursor past the current item's key)
      // so an already-processed boundary is never re-carried and re-matched
      // in the next chunk — re-matching would close a phantom empty item.
      if (mode === "HEAD" || mode === "CAPTURE") {
        const cut = Math.max(pos, data.length - RESERVE);
        if (cut > segStart) {
          parts.push(data.subarray(segStart, cut));
          partsLen += cut - segStart;
        }
        if (mode === "HEAD" && partsLen >= HEAD_WINDOW) {
          if (decide() === "CAPTURE") mode = "CAPTURE";
          else {
            parts = [];
            partsLen = 0;
            mode = "SKIP";
          }
        }
        carry = Buffer.from(data.subarray(cut));
      } else {
        carry = Buffer.from(data.subarray(Math.max(pos, data.length - RESERVE)));
      }
      return;
    }
    // key found — an item boundary only if an opening brace precedes it
    let j = q - 1;
    while (j >= 0 && isWs(data[j])) j--;
    if (j < 0 || data[j] !== 0x7b /* { */) {
      pos = q + KEY.length; // key text inside a string value — not a boundary
      continue;
    }
    const brace = j;
    // close the open item (its bytes end at the brace)
    if (mode === "HEAD" || mode === "CAPTURE") {
      if (brace > segStart) {
        parts.push(data.subarray(segStart, brace));
        partsLen += brace - segStart;
      }
      const verdict = mode === "CAPTURE" ? "CAPTURE" : decide();
      if (verdict === "CAPTURE") await finishItem();
    }
    // open the next item at the brace
    stats.itemsSeen++;
    mode = "HEAD";
    parts = [];
    partsLen = 0;
    segStart = brace;
    pos = q + KEY.length;
  }
}

// ---------------------------------------------------------------------------
// Drive: stdin chunks -> refs chain until MARKER, then the scanner.
// ---------------------------------------------------------------------------
let overlap = Buffer.alloc(0); // carry MARKER.length-1 bytes across chunks
let headerScanned = false;

for await (const chunk of process.stdin) {
  stats.bytes += chunk.length;
  if (!headerScanned) {
    headerScanned = true;
    // capture the file's own reporting entity from the first chunk
    const m = chunk
      .toString("utf8", 0, Math.min(chunk.length, 4096))
      .match(/"reporting_entity_name"\s*:\s*"([^"]*)"/);
    if (PAYER_AUTO) {
      if (!m) {
        clearInterval(ticker);
        console.error("--payer=auto but no reporting_entity_name in the first 4KB");
        process.exit(2);
      }
      PAYER = m[1];
      console.error(`payer(auto) = ${PAYER}`);
    }
  }
  if (!refsDone) {
    const probe = overlap.length ? Buffer.concat([overlap, chunk]) : chunk;
    let at = -1;
    for (let s = 0; ; ) {
      const c = probe.indexOf(MARKER, s);
      if (c === -1) break;
      const colon = isColonAfter(probe, c);
      if (colon === true) {
        at = c;
        break;
      }
      if (colon === null) break; // marker at chunk edge — resolve next chunk
      s = c + 1; // matched a lookalike key (value string etc.) — keep looking
    }
    if (at === -1) {
      if (collectedGids) {
        // pass A: refs bytes skipped entirely — that's the whole point
      } else if (REFS_MODE === "scan") scanRefsChunk(chunk);
      else await refsWrite(chunk);
      // keep enough overlap to re-see an edge marker plus its colon window
      overlap = probe.subarray(Math.max(0, probe.length - MARKER.length - 8));
      continue;
    }
    // found the in_network key: flush the refs tail (bytes of this chunk that
    // precede the marker were never written yet), then switch to the scanner
    await finishRefs(chunk.subarray(0, Math.max(0, at - overlap.length)));
    mode = "SEEK";
    await scanChunk(probe.subarray(at + MARKER.length));
  } else {
    await scanChunk(chunk);
  }
}
if (!refsDone) {
  // never report a silent zero when the file simply isn't shaped like we think
  clearInterval(ticker);
  console.error(
    'SCANNER: "in_network" key never found — different layout or no in_network section. Verify with the reference parser.'
  );
  flushTinNames();
  process.exit(4);
}
// flush the final item (its tail bytes may sit in carry)
if (mode === "HEAD" || mode === "CAPTURE") {
  if (carry.length) {
    parts.push(carry);
    partsLen += carry.length;
  }
  const verdict = mode === "CAPTURE" ? "CAPTURE" : decide();
  if (verdict === "CAPTURE") await finishItem();
}
if (stats.itemsSeen === 0) {
  // reached in_network but matched no item opener: either the array is
  // genuinely empty, or items don't start with negotiation_arrangement.
  // Never let that pass as a silent zero — exit 5 = verify with reference.
  clearInterval(ticker);
  logStatus();
  console.error(
    "SCANNER: in_network reached but ZERO item openers matched — empty array or different item key order. Verify with the reference parser."
  );
  flushTinNames();
  process.exit(5);
}

clearInterval(ticker);
logStatus();
if (unmatched) {
  if (unmatchedCapped) console.error(`UNMATCHED CAPPED at ${UNMATCHED_CAP} — counts are a floor`);
  const ws = fs.createWriteStream(UNMATCHED_PATH);
  for (const n of unmatched) ws.write(n + "\n");
  ws.end();
  console.error(`unmatched NPIs written: ${unmatched.size} -> ${UNMATCHED_PATH}`);
}
if (collectedGids) {
  fs.mkdirSync(path.dirname(COLLECT_GIDS_PATH), { recursive: true });
  fs.writeFileSync(COLLECT_GIDS_PATH, [...collectedGids].join("\n") + (collectedGids.size ? "\n" : ""));
  console.error(`gids collected: ${collectedGids.size} -> ${COLLECT_GIDS_PATH}`);
}
flushTinNames();
const done = () =>
  console.error(
    "DONE",
    JSON.stringify({ ...stats, elapsedMin: (Date.now() - stats.start) / 60000 })
  );
if (out) out.end(done);
else done();
