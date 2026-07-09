import { Resend } from "resend";
import { formatDateLong, formatTime } from "@/lib/format";

// Transactional email via Resend. Lazy singleton keyed on LIMINAL_RESEND_API_KEY
// (the "LIMINAL_" prefix avoids clobbering any host-level RESEND_API_KEY) so
// importing this module never throws when the key is absent — sendEmail
// no-ops (returns false) and the app keeps working without email.
//
// Emails carry scheduling logistics + portal links only — never clinical
// content (message bodies, form answers, notes).
//
// From-address: LIMINAL_EMAIL_FROM. Until a domain is verified in Resend the
// default is Resend's shared dev sender, which only delivers to the account
// owner's inbox — fine for development, set the env var in production.

export const EMAIL_FROM = process.env.LIMINAL_EMAIL_FROM ?? "Liminal <onboarding@resend.dev>";

let client: Resend | null = null;
export function resend(): Resend | null {
  const key = process.env.LIMINAL_RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/** Absolute origin for links in emails (env override → Vercel prod URL → dev). */
export function appBaseUrl(): string {
  if (process.env.LIMINAL_BASE_URL) return process.env.LIMINAL_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3010";
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

// ── branded shell ─────────────────────────────────────────────────────────────
// Navy band + warm-paper body + teal button, table-based + inline styles for
// email-client compatibility.

const NAVY = "#1C2440";
const TEAL = "#3F8290";
const INK = "#212A47";
const PAPER = "#FAF7F1";

function shell(opts: { heading: string; bodyHtml: string; cta?: { label: string; href: string } }): string {
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;"><tr><td style="border-radius:8px;background:${TEAL};">
         <a href="${opts.cta.href}" style="display:inline-block;padding:12px 28px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${opts.cta.label}</a>
       </td></tr></table>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:${PAPER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
      <tr><td style="background:${NAVY};border-radius:12px 12px 0 0;padding:20px 32px;">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:.3px;">Liminal</span>
      </td></tr>
      <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px;">
        <h1 style="margin:0 0 14px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:${INK};">${opts.heading}</h1>
        <div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${INK};">${opts.bodyHtml}</div>
        ${cta}
      </td></tr>
      <tr><td style="padding:18px 8px 0;text-align:center;font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;color:#8A8F9E;">
        Liminal · 31 E 17th St, Suite 402, New York, NY
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function appointmentLines(a: {
  serviceName: string;
  practitionerName: string;
  startsAt: string;
  endsAt: string;
  locationLabel?: string | null;
  telehealth?: boolean;
}): string {
  const where = a.telehealth ? "Telehealth (join from your portal)" : a.locationLabel;
  return `<p style="margin:0 0 6px;"><strong>${esc(a.serviceName)}</strong> with ${esc(a.practitionerName)}</p>
    <p style="margin:0 0 6px;">${formatDateLong(a.startsAt)} · ${formatTime(a.startsAt)}–${formatTime(a.endsAt)}</p>
    ${where ? `<p style="margin:0;">${esc(where)}</p>` : ""}`;
}

// ── the emails ────────────────────────────────────────────────────────────────

export async function sendBookingConfirmation(opts: {
  to: string;
  firstName: string;
  serviceName: string;
  practitionerName: string;
  startsAt: string;
  endsAt: string;
  locationLabel?: string | null;
  telehealth?: boolean;
  setPasswordUrl?: string | null;
}): Promise<boolean> {
  const newAccount = opts.setPasswordUrl
    ? `<p style="margin:18px 0 0;">We've created a client portal account for you — set a password to manage your appointment, complete forms, and message us.</p>`
    : `<p style="margin:18px 0 0;">You can manage this appointment any time from your client portal.</p>`;
  return sendEmail({
    to: opts.to,
    subject: `You're booked — ${formatDateLong(opts.startsAt)} at ${formatTime(opts.startsAt)}`,
    html: shell({
      heading: `You're booked, ${esc(opts.firstName)}`,
      bodyHtml: appointmentLines(opts) + newAccount,
      cta: opts.setPasswordUrl
        ? { label: "Set your password", href: opts.setPasswordUrl }
        : { label: "Open your portal", href: `${appBaseUrl()}/portal/appointments` },
    }),
  });
}

export async function sendPasswordEmail(opts: {
  to: string;
  firstName: string;
  url: string;
  purpose: "set" | "reset";
}): Promise<boolean> {
  const isNew = opts.purpose === "set";
  return sendEmail({
    to: opts.to,
    subject: isNew ? "Set up your Liminal client portal" : "Reset your Liminal password",
    html: shell({
      heading: isNew ? `Welcome, ${esc(opts.firstName)}` : `Reset your password`,
      bodyHtml: isNew
        ? `<p style="margin:0;">Set a password to activate your client portal — appointments, secure messages, forms, and invoices in one place.</p>`
        : `<p style="margin:0;">We received a request to reset your password. If this wasn't you, you can safely ignore this email.</p>`,
      cta: { label: isNew ? "Set your password" : "Choose a new password", href: opts.url },
    }),
  });
}
