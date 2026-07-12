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
const PAYER = arg("payer", "UnitedHealthcare");
const NETWORK = arg("network", "");
const SOURCE_FILE = arg("source-file", "");
const FILE_DATE = arg("file-date", "");
const CPTS = new Set((arg("codes", "90791,90834,90837,99214,90853")).split(","));

if (!NPIS_PATH || !OUT_PATH) {
  console.error("Usage: ... --npis=<file> --out=<csv> [--codes=a,b,c]");
  process.exit(1);
}

const ourNpis = new Set(
  fs.readFileSync(NPIS_PATH, "utf8").split("\n").map((s) => s.trim()).filter(Boolean)
);
const retained = new Map(); // group_id -> [{tin, npis:[matched]}]

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
const out = fs.createWriteStream(OUT_PATH);
out.write(
  "npi,payer,plan_or_network,billing_code,negotiated_rate,negotiated_type,billing_class,place_of_service,tin,source_file,file_date\n"
);
const csv = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const writeOut = (line) =>
  out.write(line) || new Promise((res) => out.once("drain", res));

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
  console.error(
    `[${mins}m] ${mb} MB uncompressed | refs ${stats.refsSeen} (retained ${stats.refsRetained}) | items ${stats.itemsSeen} (cpt-hit ${stats.itemsMatchedCode}) | rows ${stats.rows}`
  );
};
const ticker = setInterval(logStatus, 15000);

function handleProviderReference(ref) {
  stats.refsSeen++;
  const groups = ref?.provider_groups;
  if (!Array.isArray(groups)) return;
  let kept = null;
  for (const g of groups) {
    if (!Array.isArray(g?.npi)) continue;
    let matched = null;
    for (const n of g.npi) {
      const s = String(n);
      if (ourNpis.has(s)) (matched ??= []).push(s);
    }
    if (matched) {
      (kept ??= []).push({
        tin: g.tin ? `${g.tin.type ?? ""}:${g.tin.value ?? ""}` : "",
        npis: matched,
      });
    }
  }
  if (kept) {
    retained.set(ref.provider_group_id, kept);
    stats.refsRetained++;
  }
}

async function emitRows(item) {
  for (const nr of item.negotiated_rates ?? []) {
    let sides = null;
    if (Array.isArray(nr.provider_references)) {
      for (const gid of nr.provider_references) {
        const kept = retained.get(gid);
        if (kept) (sides ??= []).push(...kept);
      }
    } else if (Array.isArray(nr.provider_groups)) {
      for (const g of nr.provider_groups) {
        if (!Array.isArray(g?.npi)) continue;
        const matched = g.npi.map(String).filter((s) => ourNpis.has(s));
        if (matched.length)
          (sides ??= []).push({
            tin: g.tin ? `${g.tin.type ?? ""}:${g.tin.value ?? ""}` : "",
            npis: matched,
          });
      }
    }
    if (!sides) continue;
    // CDPHP publishes the singular `negotiated_price`; CMS schema says plural
    for (const price of nr.negotiated_prices ?? nr.negotiated_price ?? []) {
      const pos = Array.isArray(price.service_code) ? price.service_code.join("|") : "";
      for (const side of sides) {
        for (const npi of side.npis) {
          const w = writeOut(
            [
              npi,
              csv(PAYER),
              csv(NETWORK),
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
const MARKER = Buffer.from('"in_network":');
const NL = 0x0a;
const CODE_RE = new RegExp(`"billing_code":"(${[...CPTS].join("|")})"`);
const HEAD_WINDOW = 4096;

let refsChain = chain([parser(), pick({ filter: "provider_references" }), streamArray()]);
refsChain.on("data", ({ value }) => handleProviderReference(value));
let refsDone = false;
const refsWrite = async (buf) => {
  if (refsChain.write(buf) !== true)
    await new Promise((res) => refsChain.once("drain", res));
};
const finishRefs = async (tail) => {
  refsDone = true;
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
const OPENER = Buffer.from('{"negotiation_arrangement"');
// cheap prefilter before the regex: longest common prefix of the target codes
// ('"billing_code":"9' for the 5 behavioral CPTs)
const codeList = [...CPTS];
let lcp = codeList[0] ?? "";
for (const c of codeList) {
  let k = 0;
  while (k < lcp.length && k < c.length && lcp[k] === c[k]) k++;
  lcp = lcp.slice(0, k);
}
const FAST_GATE = Buffer.from(`"billing_code":"${lcp}`);
let mode = "SEEK";
let parts = []; // current item bytes (opener excluded; re-prepended at parse)
let partsLen = 0;

function abort(why, sample) {
  clearInterval(ticker);
  console.error(`SCANNER ASSUMPTION BROKEN: ${why}`);
  if (sample) console.error("sample:", sample.toString("utf8", 0, 200));
  process.exit(3);
}

async function finishItem() {
  // full matched item = OPENER + accumulated parts, minus trailing junk
  let text = OPENER + Buffer.concat(parts, partsLen).toString("utf8").trim();
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
  if (head.includes(FAST_GATE) && CODE_RE.test(head.toString("utf8"))) return "CAPTURE";
  if (!head.includes('"billing_code":"')) {
    // an item whose billing_code escaped the head window — never silent
    abort(`item without billing_code in first ${HEAD_WINDOW} bytes`, head);
  }
  return "SKIP";
}

// `carry` holds a potential opener prefix straddling chunk boundaries
let carry = Buffer.alloc(0);

async function scanChunk(buf) {
  const data = carry.length ? Buffer.concat([carry, buf]) : buf;
  carry = Buffer.alloc(0);
  let pos = 0;
  for (;;) {
    const q = data.indexOf(OPENER, pos);
    if (q === -1) {
      // no further item boundary in this chunk
      const keep = Math.max(pos, data.length - OPENER.length + 1);
      if (mode === "HEAD" || mode === "CAPTURE") {
        if (keep > pos) {
          parts.push(data.subarray(pos, keep));
          partsLen += keep - pos;
        }
        if (mode === "HEAD" && partsLen >= HEAD_WINDOW) {
          if (decide() === "CAPTURE") mode = "CAPTURE";
          else {
            parts = [];
            partsLen = 0;
            mode = "SKIP";
          }
        }
      }
      carry = Buffer.from(data.subarray(keep)); // may hold an opener prefix
      return;
    }
    // opener found: close the current item (if one is open), open the next
    if (mode === "HEAD" || mode === "CAPTURE") {
      if (q > pos) {
        parts.push(data.subarray(pos, q));
        partsLen += q - pos;
      }
      const verdict = mode === "CAPTURE" ? "CAPTURE" : decide();
      if (verdict === "CAPTURE") await finishItem();
      parts = [];
      partsLen = 0;
    }
    stats.itemsSeen++;
    mode = "HEAD";
    pos = q + OPENER.length;
  }
}

// ---------------------------------------------------------------------------
// Drive: stdin chunks -> refs chain until MARKER, then the scanner.
// ---------------------------------------------------------------------------
let overlap = Buffer.alloc(0); // carry MARKER.length-1 bytes across chunks

for await (const chunk of process.stdin) {
  stats.bytes += chunk.length;
  if (!refsDone) {
    const probe = overlap.length ? Buffer.concat([overlap, chunk]) : chunk;
    const at = probe.indexOf(MARKER);
    if (at === -1) {
      await refsWrite(chunk);
      overlap = probe.subarray(Math.max(0, probe.length - MARKER.length + 1));
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
// flush the final item (its tail bytes may sit in carry)
if (mode === "HEAD" || mode === "CAPTURE") {
  if (carry.length) {
    parts.push(carry);
    partsLen += carry.length;
  }
  const verdict = mode === "CAPTURE" ? "CAPTURE" : decide();
  if (verdict === "CAPTURE") await finishItem();
}

clearInterval(ticker);
logStatus();
out.end(() => {
  console.error(
    "DONE",
    JSON.stringify({ ...stats, elapsedMin: (Date.now() - stats.start) / 60000 })
  );
});
