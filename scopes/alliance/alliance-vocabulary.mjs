#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const storyDir = resolve("..", "The Alliance Story");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "vocabulary");
const outJson = resolve(outDir, "alliance-vocabulary-latest.json");
const outMd = resolve(outDir, "alliance-vocabulary-latest.md");

const authorityDocs = [
  "The alliance Hub",
  "The Alliance Structure",
  "The Alliance Rhythm",
  "The Alliance Leadership",
  "The Alliance Members",
  "The Alliance Gifts",
  "alliance_invisible_app_architecture.md",
];

const vocabulary = [
  {
    term: "Invisible App",
    category: "architecture",
    meaning: "The Alliance experience where the user's phone, SMS, email, chat links, and personal pages act as the primary app surface.",
    routes_to: ["conversation-intake", "transport-layer", "personal-link-system"],
    source: "alliance_invisible_app_architecture.md",
  },
  {
    term: "Conversation Intake",
    category: "script-factory",
    meaning: "Every user message, planning prompt, or ministry request is converted into a structured intake record before work proceeds.",
    routes_to: ["script-factory-intake", "capability-engine", "audit-log"],
    source: "alliance_invisible_app_architecture.md",
  },
  {
    term: "Capability",
    category: "workflow",
    meaning: "A bounded app action such as collecting email, creating an appointment, confirming attendance, sending a giving link, or escalating to a leader.",
    routes_to: ["capability-registry", "supabase-edge-function", "zo-follow-up"],
    source: "alliance_invisible_app_architecture.md",
  },
  {
    term: "Capability Engine",
    category: "workflow",
    meaning: "The governed layer that selects and executes approved capabilities from classified conversation intent.",
    routes_to: ["intent-classifier", "capability-registry", "policy-guard"],
    source: "alliance_invisible_app_architecture.md",
  },
  {
    term: "Transport Adapter",
    category: "integration",
    meaning: "A provider-neutral wrapper for inbound and outbound messages across SMS, email, web chat, WhatsApp, and push.",
    routes_to: ["android-bridge", "email", "web-chat"],
    source: "alliance_invisible_app_architecture.md",
  },
  {
    term: "Android Bridge",
    category: "integration",
    meaning: "A low-cost provisional SMS provider that forwards phone messages into the Alliance transport layer.",
    routes_to: ["transport-adapter", "sms-inbound-webhook"],
    source: "alliance_invisible_app_architecture.md",
  },
  {
    term: "Personal Link",
    category: "identity",
    meaning: "A signed, non-raw-ID URL that lets a user continue a chat, confirm attendance, upload, give, or read a message.",
    routes_to: ["token-system", "dynamic-chat-page", "security-policy"],
    source: "alliance_invisible_app_architecture.md",
  },
  {
    term: "Progressive Identity",
    category: "identity",
    meaning: "The user is recognized and completed over time through natural conversation rather than a large registration form.",
    routes_to: ["users", "profiles", "conversation-thread"],
    source: "alliance_invisible_app_architecture.md",
  },
  {
    term: "Journey",
    category: "ministry-model",
    meaning: "A trackable ministry progression such as new visitor, service attendance, training, prayer follow-up, or giving follow-up.",
    routes_to: ["journey-system", "reminders", "follow-up-tasks"],
    source: "alliance_invisible_app_architecture.md",
  },
  {
    term: "Church Journey",
    category: "ministry-model",
    meaning: "The church progression from Visiting Church to Fellowship Church to Branch Church.",
    routes_to: ["organizations", "fellowship-clusters", "branch-covering"],
    source: "The Alliance Structure",
  },
  {
    term: "Seasonal Rhythm",
    category: "ministry-model",
    meaning: "The Alliance year cycle of outreach, fellowship, conference, assimilation, review, and relaunch.",
    routes_to: ["calendar", "events", "reminders", "board-review"],
    source: "The Alliance Rhythm",
  },
  {
    term: "Gift Flow",
    category: "ministry-model",
    meaning: "The movement of spiritual gifts, practical skills, mentorship, labor, and resources across churches for the strengthening of the body.",
    routes_to: ["member-gifts", "resource-exchange", "training"],
    source: "The Alliance Gifts",
  },
  {
    term: "Leader Escalation",
    category: "safety",
    meaning: "A guarded handoff from AI or automation to an approved leader for urgent prayer, counseling, crisis language, onboarding, or leadership matters.",
    routes_to: ["follow-up-tasks", "policy-guard", "notification"],
    source: "alliance_invisible_app_architecture.md",
  },
  {
    term: "STOP Policy",
    category: "safety",
    meaning: "Transport-level unsubscribe and communication consent handling for SMS and future channels.",
    routes_to: ["transport-layer", "message-policy", "audit-log"],
    source: "alliance_invisible_app_architecture.md",
  },
];

function readSources() {
  return authorityDocs.map((name) => {
    const path = resolve(storyDir, name);
    if (!existsSync(path)) throw new Error(`Missing Alliance vocabulary source: ${path}`);
    return { name, path, chars: readFileSync(path, "utf8").length };
  });
}

function writeMarkdown(packet) {
  const lines = [
    "# Alliance Vocabulary",
    "",
    "This vocabulary routes Alliance conversations through Script Factory terms before implementation.",
    "",
    "## Terms",
    "",
  ];
  for (const item of packet.terms) {
    lines.push(`### ${item.term}`, "");
    lines.push(`- Category: ${item.category}`);
    lines.push(`- Meaning: ${item.meaning}`);
    lines.push(`- Routes to: ${item.routes_to.join(", ")}`);
    lines.push(`- Source: ${item.source}`);
    lines.push("");
  }
  writeFileSync(outMd, `${lines.join("\n")}\n`);
}

function main() {
  const sources = readSources();
  const packet = {
    schema: "refer.alliance.vocabulary.v1",
    generated_at: new Date().toISOString(),
    purpose: "Make user vocabulary and Alliance invisible-app language available to local and Zo Script Factory intake.",
    rule: "Every Alliance conversation should first become a Script Factory intake record, then map ordinary user language to this vocabulary before choosing a capability, route, or build phase.",
    sources,
    terms: vocabulary,
    intake_sequence: [
      "capture conversation or prompt",
      "write intake record",
      "match vocabulary terms",
      "resolve Alliance story authority",
      "select script or scaffold script gap",
      "execute bounded capability or build plan",
      "record evidence and talkback",
    ],
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outJson, JSON.stringify(packet, null, 2));
  writeMarkdown(packet);
  console.log(JSON.stringify({
    ok: true,
    terms: vocabulary.length,
    sources: sources.length,
    vocabulary_json: outJson,
    vocabulary_md: outMd,
  }, null, 2));
}

main();
