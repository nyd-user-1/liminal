// Public provider-join / provider-home URLs, keyed by payer-name pattern
// (mirrors insurer-mark.tsx's MARKS convention). Where we're not confident of
// a payer's exact "join network" deep path, we link their general public
// provider site instead of guessing — never a fabricated URL.

export const PAYER_PORTALS: Array<[RegExp, string]> = [
  // Oxford is UHC-owned; UHC's provider-network operations cover both.
  [/unitedhealthcare|\buhc\b|oxford/i, "https://www.uhcprovider.com/en/join-our-network.html"],
  [/cigna/i, "https://cignaforhcp.cigna.com/"],
  [/fidelis/i, "https://www.fideliscare.org/Provider/Provider-Home"],
  [/metroplus/i, "https://www.metroplus.org/providers"],
  [/emblemhealth|carelon/i, "https://www.carelonbehavioralhealth.com/providers"],
  [/cdphp/i, "https://www.cdphp.com/providers"],
  [/excellus/i, "https://www.excellusbcbs.com/providers"],
  [/highmark.*western new york/i, "https://www.highmarkbcbswny.com/providers"],
  [/highmark.*northeastern new york|highmark blue shield/i, "https://www.highmarkbsneny.com/providers"],
];
