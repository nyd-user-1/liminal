import { registerFixtures } from "@/lib/mock";
import type { Form, FormResponse } from "@/lib/types";

// Mirrors sql/002_seed.sql — forms (10) + form_responses (11): same uuids,
// titles, block schemas (incl. PHQ-9 scale questions) and answers. In the DB
// the schema column stores {"blocks":[…]}; the Form type carries the blocks
// array directly, so the repo unwraps on read and wraps on write.

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
