import { registerFixtures } from "@/lib/mock";
import type { Form, FormResponse } from "@/lib/types";

// Mirrors sql/002_seed.sql — forms (10) + form_responses (11), plus the 6
// forms added in sql/012_seed_forms.sql (GAD-7, Consent to Treatment &
// Privacy, Telehealth Consent, Release of Information, Financial Policy /
// Card-on-File, Medication History): same uuids, titles, block schemas
// (incl. PHQ-9/GAD-7 scale questions) and answers. In the DB the schema
// column stores {"blocks":[…]}; the Form type carries the blocks array
// directly, so the repo unwraps on read and wraps on write.

const T = (n: string) => `00000000-0000-4000-8000-00000000${n}`;
const SEEDED = "2026-06-20T09:00:00-04:00";

const forms: Array<Omit<Form, "createdAt" | "updatedAt">> = [
  {
    id: T("10001"),
    title: "New Client Intake",
    description: "Demographics, history, and consent — please complete before your first visit.",
    status: "published",
    schema: [
      { id: "intro", type: "info", label: "Welcome to Liminal Psychiatry. Your answers are confidential and reviewed only by your care team.", required: false },
      { id: "full_name", type: "text", label: "Full legal name", required: true },
      { id: "dob", type: "date", label: "Date of birth", required: true },
      { id: "gender", type: "select", label: "Gender", options: ["Female", "Male", "Non-binary", "Prefer to self-describe", "Prefer not to say"], required: false },
      { id: "pronouns", type: "text", label: "Pronouns", required: false },
      { id: "reason", type: "textarea", label: "What brings you in? What would you like help with?", required: true },
      { id: "psych_history", type: "textarea", label: "Previous psychiatric or therapy care (providers, diagnoses, hospitalizations)", required: false },
      { id: "medications", type: "textarea", label: "Current medications and doses (including supplements)", required: false },
      { id: "allergies", type: "text", label: "Medication allergies", required: false },
      { id: "safety", type: "radio", label: "In the past month, have you had thoughts of harming yourself?", options: ["No", "Yes", "Prefer to discuss in session"], required: true },
      { id: "consent", type: "checkbox", label: "I consent to evaluation and treatment and have reviewed the practice policies and privacy notice.", required: true },
      { id: "signature", type: "signature", label: "Signature", required: true },
    ],
  },
  {
    id: T("10002"),
    title: "PHQ-9 Depression Screen",
    description: "Over the last 2 weeks, how often have you been bothered by the following problems?",
    status: "published",
    schema: [
      { id: "scoring", type: "info", label: "Answer each item 0-3: 0 = Not at all, 1 = Several days, 2 = More than half the days, 3 = Nearly every day. Total score: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe, 20-27 severe.", required: false },
      { id: "q1", type: "scale", label: "Little interest or pleasure in doing things", options: ["0", "1", "2", "3"], required: true },
      { id: "q2", type: "scale", label: "Feeling down, depressed, or hopeless", options: ["0", "1", "2", "3"], required: true },
      { id: "q3", type: "scale", label: "Trouble falling or staying asleep, or sleeping too much", options: ["0", "1", "2", "3"], required: true },
      { id: "q4", type: "scale", label: "Feeling tired or having little energy", options: ["0", "1", "2", "3"], required: true },
      { id: "q5", type: "scale", label: "Poor appetite or overeating", options: ["0", "1", "2", "3"], required: true },
      { id: "q6", type: "scale", label: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down", options: ["0", "1", "2", "3"], required: true },
      { id: "q7", type: "scale", label: "Trouble concentrating on things, such as reading the newspaper or watching television", options: ["0", "1", "2", "3"], required: true },
      { id: "q8", type: "scale", label: "Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving around a lot more than usual", options: ["0", "1", "2", "3"], required: true },
      { id: "q9", type: "scale", label: "Thoughts that you would be better off dead or of hurting yourself in some way", options: ["0", "1", "2", "3"], required: true },
    ],
  },
  {
    id: T("10003"),
    title: "GAD-7 Anxiety Screen",
    description: "Over the last 2 weeks, how often have you been bothered by the following problems?",
    status: "published",
    schema: [
      { id: "scoring", type: "info", label: "Answer each item 0-3: 0 = Not at all, 1 = Several days, 2 = More than half the days, 3 = Nearly every day. Total score: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe.", required: false },
      { id: "q1", type: "scale", label: "Feeling nervous, anxious, or on edge", options: ["0", "1", "2", "3"], required: true },
      { id: "q2", type: "scale", label: "Not being able to stop or control worrying", options: ["0", "1", "2", "3"], required: true },
      { id: "q3", type: "scale", label: "Worrying too much about different things", options: ["0", "1", "2", "3"], required: true },
      { id: "q4", type: "scale", label: "Trouble relaxing", options: ["0", "1", "2", "3"], required: true },
      { id: "q5", type: "scale", label: "Being so restless that it is hard to sit still", options: ["0", "1", "2", "3"], required: true },
      { id: "q6", type: "scale", label: "Becoming easily annoyed or irritable", options: ["0", "1", "2", "3"], required: true },
      { id: "q7", type: "scale", label: "Feeling afraid as if something awful might happen", options: ["0", "1", "2", "3"], required: true },
    ],
  },
  {
    id: T("10004"),
    title: "Consent to Treatment & Privacy",
    description: "Please review and sign before your first visit.",
    status: "published",
    schema: [
      { id: "intro", type: "info", label: "This form documents your consent to be evaluated and treated by your Liminal care team, and your acknowledgment of our privacy practices.", required: false },
      { id: "full_name", type: "text", label: "Full legal name", required: true },
      { id: "date", type: "date", label: "Date", required: true },
      { id: "consent_treatment", type: "checkbox", label: "I consent to psychiatric and/or therapeutic evaluation and treatment by my care team at Liminal.", required: true },
      { id: "privacy_ack", type: "checkbox", label: "I have received and reviewed Liminal's Notice of Privacy Practices describing how my health information may be used and disclosed.", required: true },
      { id: "revoke_ack", type: "checkbox", label: "I understand I may revoke this consent in writing at any time, except to the extent my care team has already relied on it.", required: true },
      { id: "signature", type: "signature", label: "Signature", required: true },
    ],
  },
  {
    id: T("10005"),
    title: "Telehealth Consent",
    description: "Please review before your first telehealth visit.",
    status: "published",
    schema: [
      { id: "intro", type: "info", label: "Telehealth lets you meet with your provider by live video or audio instead of in person. It carries some differences from in-person care worth understanding before your first session.", required: false },
      { id: "location", type: "text", label: "City/state you will typically be located in for telehealth visits", required: true },
      { id: "emergency_plan", type: "radio", label: "Telehealth is not appropriate for psychiatric emergencies. Have you discussed an emergency/crisis plan (nearest ER, 988) with your provider?", options: ["Yes, we have discussed a plan", "No, I would like to discuss this before my first telehealth visit"], required: true },
      { id: "tech_limits", type: "checkbox", label: "I understand telehealth visits may have technical limitations (audio/video interruptions, connectivity issues) and that privacy on my end of the connection is my responsibility.", required: true },
      { id: "consent_telehealth", type: "checkbox", label: "I consent to receive psychiatric and/or therapy services by live video or audio telehealth.", required: true },
      { id: "signature", type: "signature", label: "Signature", required: true },
    ],
  },
  {
    id: T("10006"),
    title: "Release of Information",
    description: "Authorize Liminal to send or request records on your behalf.",
    status: "published",
    schema: [
      { id: "intro", type: "info", label: "Use this form to authorize Liminal to release your records to, or request records from, another person or organization.", required: false },
      { id: "client_name", type: "text", label: "Client full legal name", required: true },
      { id: "dob", type: "date", label: "Date of birth", required: true },
      { id: "recipient", type: "textarea", label: "Name, organization, and contact information of who information will be released to or obtained from", required: true },
      { id: "info_types", type: "checkbox", label: "Information to be released", options: ["Diagnosis", "Treatment summary", "Medication list", "Progress/therapy notes", "Full record"], required: true },
      { id: "purpose", type: "select", label: "Purpose of release", options: ["Continuity of care", "Coordination with another provider", "Legal/insurance request", "Personal request", "Other"], required: true },
      { id: "expires", type: "date", label: "This authorization expires on (leave blank for 1 year from signing)", required: false },
      { id: "signature", type: "signature", label: "Signature", required: true },
    ],
  },
  {
    id: T("10007"),
    title: "Financial Policy & Card-on-File Authorization",
    description: "Please review our financial policy and authorize a card on file.",
    status: "published",
    schema: [
      { id: "policy", type: "info", label: "Payment is due at time of service. Cancellations or reschedules within 24 hours of an appointment, and no-shows, are billed a $75 fee. Liminal is out-of-network with most insurers; we can provide a superbill for self-submission. A valid card is kept on file (collected securely through our payment portal, never through this form) for copays, coinsurance, and fees.", required: false },
      { id: "policy_ack", type: "checkbox", label: "I have read and agree to the financial policy above, including the $75 late-cancellation/no-show fee.", required: true },
      { id: "card_auth", type: "checkbox", label: "I authorize Liminal to keep a card on file and charge it for copays, coinsurance, and no-show fees per this policy.", required: true },
      { id: "cardholder_name", type: "text", label: "Name on card", required: true },
      { id: "signature", type: "signature", label: "Signature", required: true },
    ],
  },
  {
    id: T("10008"),
    title: "Medication History",
    description: "Current and past medications, allergies, and pharmacy.",
    status: "published",
    schema: [
      { id: "intro", type: "info", label: "This helps your prescriber understand what you have tried before and avoid interactions or repeat trials.", required: false },
      { id: "current_meds", type: "textarea", label: "Current medications, doses, and prescribing provider", required: false },
      { id: "past_meds", type: "textarea", label: "Past psychiatric medications tried (include response/side effects if known)", required: false },
      { id: "allergies", type: "text", label: "Medication allergies or intolerances", required: false },
      { id: "pharmacy", type: "text", label: "Preferred pharmacy (name + location)", required: false },
      { id: "otc", type: "radio", label: "Do you take any over-the-counter medications, vitamins, or supplements?", options: ["No", "Yes"], required: true },
      { id: "otc_detail", type: "textarea", label: "If yes, please list", required: false },
    ],
  },
];

const responses: Array<Omit<FormResponse, "createdAt" | "updatedAt">> = [
  {
    id: T("11001"),
    formId: T("10002"),
    clientId: T("2001"), // Casey Morgan
    answers: { q1: 1, q2: 1, q3: 2, q4: 1, q5: 0, q6: 1, q7: 1, q8: 0, q9: 0 },
    status: "submitted",
    submittedAt: "2026-06-24T19:42:00-04:00",
  },
  {
    id: T("11002"),
    formId: T("10001"),
    clientId: T("2009"), // Eli Rosen (lead)
    answers: {},
    status: "sent",
    submittedAt: null,
  },
];

registerFixtures("forms", (store) => {
  for (const f of forms) store.forms.set(f.id, { ...f, createdAt: SEEDED, updatedAt: SEEDED });
  for (const r of responses) {
    store.formResponses.set(r.id, { ...r, createdAt: "2026-06-23T11:40:00-04:00", updatedAt: r.submittedAt ?? "2026-06-23T11:40:00-04:00" });
  }
});
