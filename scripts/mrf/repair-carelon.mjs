#!/usr/bin/env node
// Carelon/Beacon MRF repair filter — their serializer does not escape quotes
// inside business_name values (`"business_name":"TAMELA "TAMMY" ROBY LMFT"`),
// which breaks every JSON parser. The refs section is line-structured, so we
// stream line-by-line and escape inner quotes in business_name values only.
// Repair count goes to stderr on exit; pipe the fixed stream onward:
//   cat beacon.json | node repair-carelon.mjs | node scan-tic.mjs ...

import readline from "node:readline";

let repaired = 0;
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const fix = (line) =>
  line.replace(/("business_name":")(.*?)("\s*\}\s*\})/g, (m, a, v, c) => {
    if (!v.includes('"')) return m;
    repaired++;
    return a + v.replaceAll('"', '\\"') + c;
  });

const write = (s) =>
  process.stdout.write(s) || new Promise((res) => process.stdout.once("drain", res));

for await (const line of rl) {
  const w = write((line.includes('"business_name"') ? fix(line) : line) + "\n");
  if (w !== true) await w;
}
console.error(`repair-carelon: ${repaired} business_name values repaired`);
