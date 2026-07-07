// Public-site care content — the source of truth for the /care/[topic] pages,
// the homepage "browse by need" rows, and the nav's Care panel. Kept as plain
// data so the same first-person copy could later be imported by the portal
// (Section 5 of the marketing brief). NEW (public marketing site).
//
// Voice: the patient's OWN words, first person, de-stigmatizing, concrete.
// Never the words "EHR" / "records system" / software jargon on these pages.

export type TopicKind = "care-type" | "condition";
export type CareOffered = "Therapy" | "Medication" | "Both";
export type ProviderType = "therapist" | "psychiatrist" | "prescriber";

export interface Topic {
  slug: string;
  kind: TopicKind;
  /** Short label for nav + cards. */
  label: string;
  /** Kicker above the hero headline. */
  eyebrow: string;
  /** The patient's own words — the hero headline. */
  firstPerson: string;
  /** One or two sentences continuing that voice, reassuring. */
  lede: string;
  /** "What care looks like here" — a short paragraph. */
  intro: string;
  /** Concrete bullets under the intro. */
  looksLike: string[];
  /** Which care types this topic is offered as. */
  careOffered: CareOffered[];
  /** Directory search term for the "browse all NY providers" link. */
  matchQuery: string;
  /** Which provider type to count from the live directory (real number). */
  providerType?: ProviderType;
  /** What the first appointment is actually like — normalizes nervousness. */
  firstVisit: string;
  metaTitle: string;
  metaDescription: string;
}

// ── Care types (Therapy · Medication · Both) ────────────────────────────────
const CARE_TYPES: Topic[] = [
  {
    slug: "therapy",
    kind: "care-type",
    label: "Therapy",
    eyebrow: "Talk therapy",
    firstPerson: "I want to talk to someone who actually listens.",
    lede: "Therapy is a standing hour that belongs to you — to sort through what's heavy, understand the patterns, and build ways to carry it.",
    intro:
      "You're matched with a licensed therapist who fits what you're working through — anxiety, a hard season, a relationship, a loss. Sessions are weekly or every other week, virtual or in person, on a schedule that holds around your life.",
    looksLike: [
      "A licensed therapist matched to your needs, not the first open slot",
      "Weekly or biweekly sessions, virtual or in person",
      "Evidence-based approaches — CBT, EMDR, ACT, DBT — chosen for you",
      "The same person each time, who remembers where you left off",
    ],
    careOffered: ["Therapy"],
    matchQuery: "Therapist",
    providerType: "therapist",
    firstVisit:
      "The first session is mostly listening. Your therapist asks what brought you in and what you're hoping for — there's no test to pass and nothing you have to have figured out first.",
    metaTitle: "Therapy in New York — Liminal",
    metaDescription:
      "Match with a licensed therapist in New York. Weekly or biweekly sessions, virtual or in person, in-network with major plans.",
  },
  {
    slug: "medication",
    kind: "care-type",
    label: "Medication management",
    eyebrow: "Psychiatric care",
    firstPerson: "I think medication might help — I just need someone who knows.",
    lede: "A psychiatric provider evaluates carefully, explains the options in plain language, and adjusts with you over time. No guesswork, no being rushed.",
    intro:
      "Medication management is prescribing done thoughtfully. A psychiatrist or psychiatric nurse practitioner reviews your history, talks through the trade-offs, and follows up — because getting it right is a conversation, not a single appointment.",
    looksLike: [
      "A thorough first evaluation with a psychiatrist or PMHNP",
      "Plain-language explanation of options, benefits, and side effects",
      "Regular follow-ups to adjust — you're never left to figure it out alone",
      "Coordination with your therapist when you see both",
    ],
    careOffered: ["Medication"],
    matchQuery: "Psychiatrist",
    providerType: "prescriber",
    firstVisit:
      "The first visit is a longer evaluation — your history, what you've tried, how you're feeling now. You leave understanding the plan and why, not just holding a prescription.",
    metaTitle: "Medication management in New York — Liminal",
    metaDescription:
      "Psychiatric medication management in New York with psychiatrists and PMHNPs. Careful evaluation, plain-language options, ongoing follow-up.",
  },
  {
    slug: "both",
    kind: "care-type",
    label: "Therapy + medication",
    eyebrow: "Coordinated care",
    firstPerson: "I don't want to choose between therapy and medication.",
    lede: "You shouldn't have to. When you need both, they work best together — and here they're coordinated in one place, not stitched across two systems.",
    intro:
      "Some things respond best to therapy and medication at once. When that's you, your therapist and prescriber share the same picture of your care — so the two sides of your treatment actually talk to each other.",
    looksLike: [
      "A therapist and a prescriber who coordinate on your care",
      "One place for both — no switching apps or repeating your story",
      "Aligned plans, so therapy and medication pull in the same direction",
      "Virtual or in person, on a schedule that fits both",
    ],
    careOffered: ["Both"],
    matchQuery: "Psychiatrist",
    providerType: "psychiatrist",
    firstVisit:
      "You start with whichever visit is booked first; the other provider is looped in from the start. Nothing has to be explained twice — the people caring for you already share the story.",
    metaTitle: "Therapy and medication, coordinated — Liminal",
    metaDescription:
      "Therapy and psychiatric medication in one coordinated place in New York. Your therapist and prescriber share the same picture of your care.",
  },
];

// ── Conditions (first-person "browse by need") ──────────────────────────────
const CONDITIONS: Topic[] = [
  {
    slug: "anxiety",
    kind: "condition",
    label: "Anxiety & stress",
    eyebrow: "Anxiety & stress",
    firstPerson: "The worry won't switch off.",
    lede: "The racing thoughts, the tight chest, the nights you can't wind down — they're treatable, and you don't have to white-knuckle through them.",
    intro:
      "Care for anxiety starts with understanding what sets it off and giving you tools that work in the moment. For some people that's therapy; for others it's therapy and medication together. You'll figure out which with someone who does this every day.",
    looksLike: [
      "Practical tools for the moments anxiety spikes",
      "CBT and exposure approaches with clinicians who specialize in them",
      "The option of medication when it makes sense — never by default",
      "A plan that fits your life, not a one-size worksheet",
    ],
    careOffered: ["Therapy", "Medication", "Both"],
    matchQuery: "Anxiety",
    providerType: "therapist",
    firstVisit:
      "You'll talk through what anxiety looks like for you and when it started. It's normal to feel nervous walking in — that's exactly the kind of thing your provider is there for.",
    metaTitle: "Anxiety & stress care in New York — Liminal",
    metaDescription:
      "Treatment for anxiety and stress in New York — therapy, medication, or both, with clinicians who specialize in it. In-network with major plans.",
  },
  {
    slug: "depression",
    kind: "condition",
    label: "Depression & mood",
    eyebrow: "Depression & mood",
    firstPerson: "Getting through the day takes everything I have.",
    lede: "When the color drains out of things and even small tasks feel enormous, that's not a character flaw. It's something care can genuinely lift.",
    intro:
      "Depression care meets you where your energy actually is. Therapy helps you find footing again; for many people, medication helps lift the floor so the rest of the work is possible. You and your provider decide together.",
    looksLike: [
      "Therapy that starts small and builds — no pressure to overhaul your life",
      "Medication evaluation when the weight is more than talk can move",
      "Providers who take low energy and motivation seriously, not personally",
      "Regular check-ins so care adjusts as you do",
    ],
    careOffered: ["Therapy", "Medication", "Both"],
    matchQuery: "Depression",
    providerType: "psychiatrist",
    firstVisit:
      "The first session asks how long it's been like this and how it's showing up. You don't need the right words — describing an ordinary day is enough to start.",
    metaTitle: "Depression & mood care in New York — Liminal",
    metaDescription:
      "Treatment for depression and mood in New York — therapy, medication, or both. Providers who take it seriously and follow up. In-network with major plans.",
  },
  {
    slug: "adhd",
    kind: "condition",
    label: "ADHD",
    eyebrow: "ADHD",
    firstPerson: "My attention has a mind of its own.",
    lede: "The missed deadlines, the half-finished projects, the sense of running late inside your own head — there's a name for it, and there's real help.",
    intro:
      "ADHD care begins with a proper evaluation, not a five-minute questionnaire. From there it can include coaching and strategies, medication, or both — built around how your attention actually works.",
    looksLike: [
      "A thorough evaluation before anything else",
      "Medication management with a prescriber when it fits",
      "Practical strategies for focus, follow-through, and time",
      "Care that treats ADHD as wiring to work with, not a failing to fix",
    ],
    careOffered: ["Therapy", "Medication", "Both"],
    matchQuery: "ADHD",
    providerType: "prescriber",
    firstVisit:
      "The evaluation looks at your history going back to childhood and how attention affects you now. Bring examples from real life — that's the most useful thing you can share.",
    metaTitle: "ADHD evaluation & care in New York — Liminal",
    metaDescription:
      "ADHD evaluation, medication management, and coaching in New York. A proper assessment and a plan built around how your attention works.",
  },
  {
    slug: "trauma",
    kind: "condition",
    label: "Trauma & PTSD",
    eyebrow: "Trauma & PTSD",
    firstPerson: "Something I lived through still runs the show.",
    lede: "When the past keeps interrupting the present — the flashbacks, the hypervigilance, the numbness — specialized care can help it loosen its grip.",
    intro:
      "Trauma-informed care moves at your pace and never asks you to relive more than you're ready for. Clinicians trained in EMDR and CPT help the memories lose their charge, so they become part of your story instead of the whole thing.",
    looksLike: [
      "Trauma-trained clinicians (EMDR, CPT, and related approaches)",
      "A pace you set — safety and trust come before anything hard",
      "Tools for the flashbacks, the startle, the sleepless nights",
      "Medication support when it helps steady the ground",
    ],
    careOffered: ["Therapy", "Both"],
    matchQuery: "Trauma",
    providerType: "therapist",
    firstVisit:
      "The first session is about safety and fit — not the trauma itself. You share only what you want to; a good trauma therapist will never push you past your pace.",
    metaTitle: "Trauma & PTSD care in New York — Liminal",
    metaDescription:
      "Trauma-informed therapy in New York — EMDR, CPT, and clinicians trained to move at your pace. In-network with major plans.",
  },
  {
    slug: "relationships",
    kind: "condition",
    label: "Relationships & family",
    eyebrow: "Relationships & family",
    firstPerson: "The people closest to me are the hardest part.",
    lede: "The same argument on repeat, the distance that crept in, the family patterns you swore you'd never carry — a neutral third person can help you find a way through.",
    intro:
      "Relationship and family care gives the hard conversations somewhere to land. Whether you come on your own or together, you'll work on the patterns underneath — communication, trust, the roles everyone fell into.",
    looksLike: [
      "Individual, couples, or family sessions — whatever the situation needs",
      "A neutral space where every side is actually heard",
      "Work on the patterns, not just the latest fight",
      "Skills you take back into the relationship, not just the room",
    ],
    careOffered: ["Therapy"],
    matchQuery: "Couples",
    providerType: "therapist",
    firstVisit:
      "The first session maps what's happening and what each person wants. It's normal to disagree in the room — that's useful information, not a bad start.",
    metaTitle: "Relationship & family therapy in New York — Liminal",
    metaDescription:
      "Couples, family, and individual relationship therapy in New York. A neutral space to work on the patterns underneath. In-network with major plans.",
  },
  {
    slug: "grief",
    kind: "condition",
    label: "Grief & loss",
    eyebrow: "Grief & loss",
    firstPerson: "The world moved on. I haven't.",
    lede: "Grief doesn't run on anyone else's timeline. Whether the loss was months ago or years, there's care for carrying it.",
    intro:
      "Grief care isn't about getting over anything. It's about finding a way to hold the loss that lets you keep living — with someone who won't rush you or tell you how you should feel.",
    looksLike: [
      "Space to grieve on your timeline, not a prescribed one",
      "Support for loss of every kind — a person, a relationship, a future",
      "Help when grief tips into something heavier",
      "A provider who sits with it rather than trying to fix it",
    ],
    careOffered: ["Therapy"],
    matchQuery: "Grief and Loss",
    providerType: "therapist",
    firstVisit:
      "You talk about who or what you lost, and what the days have been like since. Tears are welcome and so is numbness — there's no right way to arrive.",
    metaTitle: "Grief & loss support in New York — Liminal",
    metaDescription:
      "Grief and bereavement counseling in New York. Care that moves at your pace, for loss of every kind. In-network with major plans.",
  },
  {
    slug: "sleep",
    kind: "condition",
    label: "Sleep",
    eyebrow: "Sleep",
    firstPerson: "I'm exhausted, but I can't sleep.",
    lede: "Lying awake at 3 a.m. wears down everything else. Sleep problems are treatable — often without anything more than the right approach.",
    intro:
      "Sleep care looks at what's actually keeping you up — anxiety, racing thoughts, a schedule out of sync — and treats the cause. CBT-I is remarkably effective, and medication is there when it's genuinely needed.",
    looksLike: [
      "CBT-I, the evidence-based approach for insomnia",
      "A look at what's driving it — stress, mood, or habit",
      "Medication considered carefully, not as the first move",
      "Practical changes you can start this week",
    ],
    careOffered: ["Therapy", "Medication", "Both"],
    matchQuery: "Sleep",
    providerType: "therapist",
    firstVisit:
      "You'll walk through your nights and what you've already tried. Keeping a rough sleep log beforehand helps, but it's not required to begin.",
    metaTitle: "Sleep & insomnia care in New York — Liminal",
    metaDescription:
      "Insomnia and sleep treatment in New York — CBT-I and careful medication when needed. Treat the cause, not just the symptom.",
  },
  {
    slug: "bipolar",
    kind: "condition",
    label: "Bipolar disorder",
    eyebrow: "Bipolar disorder",
    firstPerson: "My moods swing further than they should.",
    lede: "The highs that go too high, the lows that flatten everything — with the right care, the swings get steadier and life gets more predictable.",
    intro:
      "Bipolar care pairs careful psychiatric management with therapy that helps you read your own patterns. Consistency is everything, so ongoing follow-up and a provider who knows you are the heart of it.",
    looksLike: [
      "Psychiatric management from a provider experienced with bipolar",
      "Therapy to track patterns and protect the steady stretches",
      "Follow-up that stays consistent through highs and lows",
      "A plan built for the long run, adjusted as life changes",
    ],
    careOffered: ["Medication", "Both"],
    matchQuery: "Bipolar Disorder",
    providerType: "psychiatrist",
    firstVisit:
      "The first evaluation traces your mood history over time — the ups as much as the downs. Family members' observations can help, if you have them to share.",
    metaTitle: "Bipolar disorder care in New York — Liminal",
    metaDescription:
      "Bipolar disorder treatment in New York — experienced psychiatric management plus therapy. Consistent follow-up for the long run.",
  },
  {
    slug: "lgbtqia",
    kind: "condition",
    label: "LGBTQIA+ affirming",
    eyebrow: "LGBTQIA+ affirming care",
    firstPerson: "I want a provider who gets who I am.",
    lede: "Care where you don't have to explain or defend the basics — identity-affirming providers who start from respect, not curiosity.",
    intro:
      "Affirming care means a provider who understands the specific stresses of being LGBTQIA+ and centers who you are throughout. You choose the fit; we make it easy to find someone who gets it from the first session.",
    looksLike: [
      "Providers who are genuinely affirming, not just accepting",
      "Support for identity, coming out, transition, and the stress around them",
      "Care that never treats who you are as the problem",
      "Filter to affirming clinicians before you book",
    ],
    careOffered: ["Therapy", "Medication", "Both"],
    matchQuery: "LGBTQIA+",
    providerType: "therapist",
    firstVisit:
      "You set the terms of what you share and when. An affirming provider follows your lead on language and identity from the very first minute.",
    metaTitle: "LGBTQIA+ affirming care in New York — Liminal",
    metaDescription:
      "LGBTQIA+ affirming therapy and psychiatry in New York. Providers who center who you are. In-network with major plans.",
  },
];

export const TOPICS: Topic[] = [...CARE_TYPES, ...CONDITIONS];

export const CARE_TYPE_TOPICS = CARE_TYPES;
export const CONDITION_TOPICS = CONDITIONS;

export function getTopic(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

export function topicSlugs(): string[] {
  return TOPICS.map((t) => t.slug);
}
