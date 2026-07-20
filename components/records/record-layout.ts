// Geometry shared by the two hosts that render a client record.
//
// The practitioner's record (components/records/client-record.tsx) puts the
// IdentityCard in a left rail; the patient portal's Overview (the client
// record's Overview tab) puts the same person's Contact card in the same slot.
// They are one card in two hosts, so the width is a constant both import rather
// than a `lg:w-80` each of them happens to spell the same way — change it here
// and the two surfaces stay identical by construction.
//
// This is a PLAIN module on purpose. It cannot live in identity-card.tsx: that
// file is a client component, so a server component importing a value from it
// gets a client-reference stub instead of the string, and the class silently
// renders as garbage rather than a width. Constants shared across the boundary
// belong in a module that declares neither side.

/** Width of a record's identity rail (Tailwind: 20rem / 320px at lg+). */
export const RECORD_RAIL_W = "lg:w-80";
