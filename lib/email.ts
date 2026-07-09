import { Resend } from "resend";

// Transactional email via Resend. Lazy singleton keyed on LIMINAL_RESEND_API_KEY
// (the "LIMINAL_" prefix avoids clobbering any host-level RESEND_API_KEY) so
// importing this module never throws when the key is absent — sendEmail
// no-ops (returns false) and the app keeps working without email.

export const EMAIL_FROM = "Liminal <no-reply@liminal.demo>";

let client: Resend | null = null;
export function resend(): Resend | null {
  const key = process.env.LIMINAL_RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/** Send an email; returns false (silently) when email is not configured. */
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const r = resend();
  if (!r) return false;
  try {
    await r.emails.send({ from: EMAIL_FROM, to: opts.to, subject: opts.subject, html: opts.html });
    return true;
  } catch (e) {
    console.error("sendEmail failed", e);
    return false; // email is best-effort; never break the calling flow
  }
}
