// Public-site FAQ content — pre-answers the objections that keep people from
// booking (insurance, cost, the first visit, therapy vs. medication). Plain
// data so the same answers can be reused across pages and, later, the portal.
// NEW (public marketing site). No "EHR" / software jargon in patient copy.

export interface Faq {
  q: string;
  a: string;
}

export const HOME_FAQS: Faq[] = [
  {
    q: "Will my provider take my insurance?",
    a: "Many do. You can filter to who's in-network with your plan before you book, so you see your expected cost up front — no surprise bill after the session. Bring your member ID and we'll confirm coverage when you schedule.",
  },
  {
    q: "What will this cost me?",
    a: "With an in-network provider, most people pay their plan's copay for a visit. Without insurance, self-pay rates are shown before you book. You'll always see the expected cost before you confirm — never after.",
  },
  {
    q: "What is the first appointment like?",
    a: "It's a conversation. Your provider asks what brought you in and what you're hoping for — nothing you have to prepare, no test to pass. It's completely normal to feel nervous walking in; naming that is often where the work starts.",
  },
  {
    q: "Should I do therapy, medication, or both?",
    a: "You don't have to decide alone. Some things respond best to talk therapy, some to medication, and some to both together. Your provider helps you figure out the right fit — and if you need both, they're coordinated in one place so you never repeat your story.",
  },
  {
    q: "Can I be seen virtually?",
    a: "Yes. Most providers offer secure video visits, and many also see clients in person across New York. You choose what works for you when you book, and you can switch between them later.",
  },
  {
    q: "How soon can I be seen?",
    a: "Often the same week. You'll see each provider's next available times before you book, so you can choose someone who fits your schedule and start without a long wait.",
  },
];

// Provider-facing FAQ (software language is allowed here — see /providers).
export const PROVIDER_FAQS: Faq[] = [
  {
    q: "What does it cost to join?",
    a: "Pricing is tailored to your practice and caseload. Reach out and we'll walk you through the model that fits — solo prescriber, group therapy practice, or something in between.",
  },
  {
    q: "Do I have to switch my whole system at once?",
    a: "No. Practices move over at their own pace. Scheduling, documentation, and billing live in one connected system, so you can start with what's most painful and grow from there.",
  },
  {
    q: "Does the directory actually send me clients?",
    a: "Yes — Liminal's public directory is how many New Yorkers find care. Listed providers receive booking requests directly, matched to the specialties and coverage they offer.",
  },
  {
    q: "Who owns the clinical record?",
    a: "You do. The record is yours and your patient's; Liminal is the connected system it lives in. Documentation, history, and billing stay together so the record works for you instead of against you.",
  },
];
