// Canonical entity types — mirror the DB schema (snake_case columns →
// camelCase fields). Dates/timestamps travel as ISO strings; money as cents.

export type Role = "admin" | "practitioner" | "client";
export type AvatarHue = "teal" | "amber" | "pink" | "blue";

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  passwordHash: string;
  avatarHue: AvatarHue;
  phone: string | null;
  timezone: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClientStatus = "lead" | "active" | "archived";

export interface Client {
  id: string;
  userId: string | null; // portal login
  firstName: string;
  lastName: string;
  dob: string | null; // YYYY-MM-DD
  email: string | null;
  phone: string | null;
  address: string | null;
  gender: string | null;
  pronouns: string | null;
  status: ClientStatus;
  tags: string[];
  primaryPractitionerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  color: string; // categorical slot (see ColorSwatch palette)
  telehealth: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LocationKind = "office" | "telehealth";

export interface Location {
  id: string;
  name: string;
  address: string | null;
  kind: LocationKind;
  createdAt: string;
  updatedAt: string;
}

export interface Availability {
  id: string;
  practitionerId: string;
  weekday: number; // 0–6, Sunday = 0
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "arrived"
  | "completed"
  | "cancelled"
  | "no_show";
export type BookedVia = "staff" | "portal" | "link";

export interface Appointment {
  id: string;
  clientId: string;
  practitionerId: string;
  serviceId: string;
  locationId: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  videoRoom: string | null;
  bookedVia: BookedVia;
  notesBrief: string | null;
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NoteTemplateKind = "soap" | "dap" | "progress" | "intake" | "free";
export type NoteStatus = "draft" | "signed" | "locked";

export interface Note {
  id: string;
  clientId: string;
  appointmentId: string | null;
  authorId: string;
  template: NoteTemplateKind;
  title: string;
  bodyMd: string;
  status: NoteStatus;
  signedAt: string | null;
  deletedAt: string | null; // soft-delete (clinical data)
  createdAt: string;
  updatedAt: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  template: NoteTemplateKind;
  bodyMd: string; // prompt skeleton
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptSegment {
  t0: number;
  t1: number;
  speaker: string;
  text: string;
}

export type TranscriptStatus = "recording" | "processing" | "ready";

export interface Transcript {
  id: string;
  appointmentId: string;
  segments: TranscriptSegment[];
  summaryMd: string | null;
  status: TranscriptStatus;
  createdAt: string;
  updatedAt: string;
}

export type FormBlockType =
  | "text"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "date"
  | "signature"
  | "scale"
  | "info";

export interface FormBlock {
  id: string;
  type: FormBlockType;
  label: string;
  options?: string[];
  required?: boolean;
}

export type FormStatus = "draft" | "published";

export interface Form {
  id: string;
  title: string;
  description: string | null;
  schema: FormBlock[];
  status: FormStatus;
  createdAt: string;
  updatedAt: string;
}

export type FormResponseStatus = "sent" | "in_progress" | "submitted";

export interface FormResponse {
  id: string;
  formId: string;
  clientId: string;
  answers: Record<string, unknown>;
  status: FormResponseStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export interface Invoice {
  id: string;
  number: string; // INV-2026-0001
  clientId: string;
  appointmentId: string | null;
  status: InvoiceStatus;
  issuedOn: string | null; // YYYY-MM-DD
  dueOn: string | null; // YYYY-MM-DD
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  stripeCheckoutId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  qty: number;
  unitCents: number;
  amountCents: number;
}

export type PaymentMethod = "card" | "cash" | "insurance" | "other";

export interface Payment {
  id: string;
  invoiceId: string;
  amountCents: number;
  method: PaymentMethod;
  stripePaymentIntent: string | null;
  paidAt: string;
  createdAt: string;
}

export interface Payer {
  id: string;
  name: string;
  payerCode: string;
  createdAt: string;
  updatedAt: string;
}

export type PolicyKind = "primary" | "secondary";
export type PolicyStatus = "unverified" | "verified" | "inactive";

export interface InsurancePolicy {
  id: string;
  clientId: string;
  payerId: string;
  memberId: string;
  groupId: string | null;
  kind: PolicyKind;
  status: PolicyStatus;
  copayCents: number | null;
  createdAt: string;
  updatedAt: string;
}

export type ThreadStatus = "open" | "closed";

export interface Thread {
  id: string;
  clientId: string;
  subject: string;
  status: ThreadStatus;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export type FileKind = "upload" | "form_pdf" | "superbill";

export interface FileRecord {
  id: string;
  clientId: string;
  uploaderId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  url: string;
  kind: FileKind;
  createdAt: string;
}

export interface AuditEvent {
  id: number;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  at: string;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: string;
}

// ── External provider directory (NY open data) ─────────────────────────────────

export type DirectorySource = "medicaid" | "omh" | "nyc_dohmh";

export interface DirectoryProvider {
  id: string;
  npi: string | null;
  name: string;
  profession: string | null;
  licenseNo: string | null;
  taxonomy: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  zip: string | null;
  phone: string | null;
  source: DirectorySource;
  sourceId: string;
  updatedAt: string;
  // NPPES enrichment (optional — Medicaid rows leave these null/undefined).
  primaryTaxonomy?: string | null;
  subspecialty?: string | null;
  taxonomies?: string[] | null;
  credential?: string | null;
  gender?: string | null;
  licenseState?: string | null;
  entityType?: string | null;
  isSoleProprietor?: boolean | null;
  parentOrg?: string | null;
  enumerationDate?: string | null;
  deactivatedAt?: string | null;
}

export interface DirectoryProgram {
  id: string;
  agency: string | null;
  facility: string | null;
  programName: string;
  programType: string | null;
  populations: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  zip: string | null;
  phone: string | null;
  source: DirectorySource;
  sourceId: string;
  updatedAt: string;
}

export type ReferralStatus = "draft" | "sent" | "accepted" | "declined";

export interface Referral {
  id: string;
  clientId: string;
  providerId: string | null;
  programId: string | null;
  reason: string | null;
  status: ReferralStatus;
  createdBy: string | null;
  createdAt: string;
  // Joined for display:
  targetName?: string;
  targetKind?: "provider" | "program";
}

export type ProviderApplicationStatus = "new" | "reviewing" | "contacted" | "closed";

export interface ProviderApplication {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  licenseType: string | null;
  state: string | null;
  npi: string | null;
  message: string | null;
  status: ProviderApplicationStatus;
  createdAt: string;
}
