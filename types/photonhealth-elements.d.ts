// @photonhealth/elements ships dist/index.d.ts but its package.json "exports"
// map has no "types" condition, so TS can't resolve it under
// moduleResolution: "bundler". The package registers custom elements as a side
// effect and we only ever `import("@photonhealth/elements")` for that effect —
// there is no API surface to type. Declaring the module is enough; the custom
// elements themselves are typed at their JSX call sites.
declare module "@photonhealth/elements";
