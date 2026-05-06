#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const storyDir = resolve("..", "The Alliance Story");
const manifestPath = resolve("scopes", "alliance", "site-manifest.json");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "story");
const outJson = resolve(outDir, "alliance-scoping-plan-latest.json");
const outMd = resolve(outDir, "alliance-scoping-plan-latest.md");

const docOrder = [
  "The alliance Hub",
  "The Alliance Structure",
  "The Alliance Rhythm",
  "The Alliance Leadership",
  "The Alliance Members",
  "The Alliance Gifts",
  "alliance_invisible_app_architecture.md",
];

function readStoryDocs() {
  return docOrder.map((name) => {
    const path = resolve(storyDir, name);
    if (!existsSync(path)) throw new Error(`Missing Alliance story document: ${path}`);
    const text = readFileSync(path, "utf8");
    return {
      id: slug(name),
      title: name.replace(/^The alliance/i, "The Alliance"),
      path,
      chars: text.length,
      sha256: createHash("sha256").update(text).digest("hex"),
      text,
    };
  });
}

function slug(value) {
  return value.toLowerCase().replace(/^the\s+/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildScoping() {
  return {
    summary:
      "Scoping converts the Alliance story into appable programs: each vision point becomes a trackable workflow, role, record, automation, or cadence inside the Hub.",
    scripture_frame: [
      "Ephesians 4:11-16 - gifts are given for the equipping of the saints and the building up of the body.",
      "1 Corinthians 12:12-27 - many members form one body, and each part supplies what another part lacks.",
      "Acts 2:42-47 - fellowship, prayer, generosity, and daily witness create a living community.",
      "Proverbs 11:14 - wise counsel and shared governance preserve the people.",
    ],
    chapters: [
      {
        title: "The Living Hub",
        source: "The Alliance Hub",
        color: "emerald",
        narrative:
          "The Hub is the visible operating system for the Alliance. It codifies mission, relationships, rhythms, communications, records, giving, and AI-assisted follow-up so the Alliance can move with order instead of scattered administration.",
      },
      {
        title: "Church Structure",
        source: "The Alliance Structure",
        color: "indigo",
        narrative:
          "Branch Churches shepherd fellowship clusters. Visiting Churches become Fellowship Churches, Fellowship Churches mature into Branch Churches, and all clusters converge through the shared Alliance calendar.",
      },
      {
        title: "Seasonal Rhythm",
        source: "The Alliance Rhythm",
        color: "amber",
        narrative:
          "The year moves through outreach, fellowship, harvest, conference, assimilation, review, and relaunch. Winter emphasizes leadership, spring women, summer men, and autumn youth.",
      },
      {
        title: "Leadership Brotherhood",
        source: "The Alliance Leadership",
        color: "rose",
        narrative:
          "Pastors and board members carry the governing heartbeat. The system must help them stay present, accountable, encouraged, prepared, and connected to the needs of every church.",
      },
      {
        title: "Member Movement",
        source: "The Alliance Members",
        color: "sky",
        narrative:
          "Members become the grassroots force of outreach and fellowship. The app must help them know where they belong, what season they are in, how to serve, and what next step to take.",
      },
      {
        title: "Gifts And Provision",
        source: "The Alliance Gifts",
        color: "violet",
        narrative:
          "The Alliance circulates spiritual gifts, practical skills, business resources, training, mentorship, and support so each church is strengthened by what the wider body supplies.",
      },
      {
        title: "Invisible App",
        source: "alliance_invisible_app_architecture.md",
        color: "sky",
        narrative:
          "The Alliance should not depend on giant dashboards first. Conversations, SMS, email, personal links, and lightweight web sessions become the front door while the system tracks identity, journeys, reminders, attendance, giving, and follow-up behind the scenes.",
      },
    ],
    programs: [
      {
        id: "church-journey",
        name: "Church Journey Program",
        source_docs: ["The Alliance Structure", "The alliance Hub"],
        app_module: "Organizations",
        outcome: "Track every church from visitor to fellowship church to branch church.",
        operations: [
          "Create church profile and region",
          "Assign branch pastor or relational covering",
          "Record current journey stage",
          "Schedule follow-up visits and invitations",
          "Review readiness for next stage",
        ],
        records: ["organization", "relationship", "journey_stage", "follow_up", "readiness_review"],
        automations: ["welcome church", "stage review reminder", "branch pastor follow-up"],
      },
      {
        id: "fellowship-clusters",
        name: "Fellowship Cluster Program",
        source_docs: ["The Alliance Structure"],
        app_module: "Organizations",
        outcome: "Help each Branch Church nurture a manageable regional fellowship cluster.",
        operations: [
          "Map churches to cluster",
          "Plan local fellowship services",
          "Track shared outreach events",
          "Monitor regional participation",
          "Surface cluster health to leadership",
        ],
        records: ["branch_church", "cluster", "cluster_event", "participation", "health_note"],
        automations: ["cluster activity digest", "inactive church nudge", "regional event reminder"],
      },
      {
        id: "seasonal-rhythm",
        name: "Seasonal Rhythm Program",
        source_docs: ["The Alliance Rhythm", "The Alliance Members"],
        app_module: "Calendar",
        outcome: "Run the yearly cycle from outreach through conference, assimilation, review, and relaunch.",
        operations: [
          "Set seasonal focus",
          "Open outreach phase",
          "Publish conference schedule",
          "Collect registrations and attendance",
          "Launch assimilation follow-up",
          "Prepare board review",
        ],
        records: ["season", "focus", "event", "registration", "attendance", "assimilation_task", "review_packet"],
        automations: ["season launch brief", "conference countdown", "post-conference follow-up", "council review packet"],
      },
      {
        id: "leadership-governance",
        name: "Leadership And Governance Program",
        source_docs: ["The Alliance Leadership", "The Alliance Rhythm"],
        app_module: "Governance",
        outcome: "Keep board meetings, council responsibilities, decisions, care assignments, and accountability visible.",
        operations: [
          "Prepare agenda",
          "Track attendance and participation",
          "Capture motions, decisions, and minutes",
          "Assign care and crisis follow-up",
          "Review leader engagement",
        ],
        records: ["meeting", "agenda_item", "motion", "minutes", "assignment", "leader_engagement"],
        automations: ["agenda close reminder", "minutes draft reminder", "leader absence follow-up", "care assignment nudge"],
      },
      {
        id: "member-activation",
        name: "Member Activation Program",
        source_docs: ["The Alliance Members"],
        app_module: "People",
        outcome: "Move members from awareness into outreach, service, training, fellowship, and belonging.",
        operations: [
          "Create member participation profile",
          "Capture gifts and interests",
          "Invite to seasonal outreach",
          "Route service opportunities",
          "Track discipleship and training progress",
        ],
        records: ["person", "gift_profile", "interest", "invitation", "service_assignment", "training_progress"],
        automations: ["new member welcome", "gift match suggestion", "service invitation", "training reminder"],
      },
      {
        id: "gifts-resource-exchange",
        name: "Gifts And Resource Exchange Program",
        source_docs: ["The Alliance Gifts"],
        app_module: "Initiatives",
        outcome: "Make ministry gifts, practical skills, business resources, and support requests visible and usable across churches.",
        operations: [
          "Catalog ministry gifts and practical skills",
          "Receive church needs",
          "Match helpers to requests",
          "Track mentorship and training cohorts",
          "Record testimony and outcomes",
        ],
        records: ["gift", "skill", "resource_need", "match", "mentorship", "testimony"],
        automations: ["resource match alert", "mentor check-in", "training cohort reminder", "need aging alert"],
      },
      {
        id: "communications-notifications",
        name: "Communications And Notification Program",
        source_docs: ["The alliance Hub"],
        app_module: "Communications",
        outcome: "Use email, SMS, notifications, and direct replies to keep participation simple.",
        operations: [
          "Segment audiences by role and church",
          "Send seasonal briefs",
          "Receive replies and confirmations",
          "Notify leaders of needed action",
          "Archive send history and response status",
        ],
        records: ["audience", "message", "channel", "reply", "notification", "send_history"],
        automations: ["welcome sequence", "attendance confirmation", "leader task alert", "weekly Alliance brief"],
      },
      {
        id: "financial-stewardship",
        name: "Financial Stewardship Program",
        source_docs: ["The alliance Hub", "The Alliance Gifts"],
        app_module: "Documents",
        outcome: "Support giving, sponsorships, offerings, event contributions, and designated causes with clarity.",
        operations: [
          "Define giving purpose",
          "Route funds by church, event, ministry, outreach, or cause",
          "Issue receipts and acknowledgements",
          "Summarize support by initiative",
          "Report stewardship to authorized leaders",
        ],
        records: ["giving_purpose", "contribution", "designation", "receipt", "stewardship_report"],
        automations: ["gift acknowledgement", "event contribution summary", "sponsorship follow-up"],
      },
      {
        id: "zo-operational-assist",
        name: "Zo Operational Assistance Program",
        source_docs: ["The alliance Hub"],
        app_module: "Compliance",
        outcome: "Use Zo to watch activity, suggest next steps, prepare packets, and reduce repetitive administration.",
        operations: [
          "Monitor new records and pending tasks",
          "Detect missing follow-up",
          "Prepare agendas and summaries",
          "Queue reminders",
          "Escalate stale or urgent work",
        ],
        records: ["automation_rule", "watch_event", "task_signal", "summary_packet", "escalation"],
        automations: ["daily operational scan", "stale task escalation", "meeting packet draft", "post-event follow-up queue"],
      },
      {
        id: "conversation-first-intake",
        name: "Conversation-First Intake Program",
        source_docs: ["alliance_invisible_app_architecture.md"],
        app_module: "Communications",
        outcome: "Route every Alliance conversation through Script Factory intake, vocabulary matching, and governed capabilities.",
        operations: [
          "Normalize inbound SMS, email, and web chat",
          "Identify or create the provisional user",
          "Create or load the conversation thread",
          "Match ordinary language to Alliance vocabulary",
          "Select an approved capability or scaffold a script gap",
          "Record evidence, memory summary, and follow-up",
        ],
        records: ["conversation_intake", "user", "conversation_thread", "conversation_message", "vocabulary_match", "capability_run"],
        automations: ["hello alliance intake", "progressive identity prompt", "capability routing", "leader escalation"],
      },
      {
        id: "personal-link-engagement",
        name: "Personal Link Engagement Program",
        source_docs: ["alliance_invisible_app_architecture.md"],
        app_module: "People",
        outcome: "Use secure personal links so the user's phone becomes the primary Alliance app surface.",
        operations: [
          "Generate signed continuation links",
          "Validate token and purpose",
          "Render personal chat and CTA cards",
          "Handle attendance, prayer, service format, and giving actions",
          "Expire, revoke, and audit link usage",
        ],
        records: ["personal_link", "token_hash", "thread", "cta_card", "link_audit"],
        automations: ["send continuation link", "attendance CTA", "service-day link", "expired-link recovery"],
      },
    ],
    end_to_end_flow: [
      "A church visits or connects through a Branch Church.",
      "The Branch Pastor records the relationship and invites the church into local fellowship.",
      "The seasonal outreach phase opens and members receive simple prompts to invite, serve, and participate.",
      "Fellowship events and training opportunities build toward the seasonal conference.",
      "Conference registrations, attendance, giving, and ministry needs are tracked.",
      "After the conference, assimilation tasks route new people and churches into discipleship and relationship follow-up.",
      "The Board or Alliance Council reviews results, resolves decisions, and prepares the next season.",
      "Zo watches gaps, drafts reminders, prepares packets, and helps keep the rhythm moving.",
      "Conversation intake turns user replies and new directions into Script Factory records so future work grows the shared vocabulary instead of disappearing into chat.",
    ],
    hub_requirements: [
      "Role-based experiences for public visitors, members, leaders, churches, and admins",
      "Church relationship graph with Visiting, Fellowship, and Branch stages",
      "Seasonal calendar engine with outreach, conference, assimilation, review, and relaunch states",
      "Member gift and service profile",
      "Resource request and matching workflow",
      "Board meeting agenda, minutes, motions, decisions, and assignments",
      "Email, SMS, notification, and reply intake lanes",
      "Giving and stewardship records",
      "Supabase Edge Function persistence for private records",
      "Zo automation monitoring and follow-up packets",
      "Conversation-first intake with vocabulary matching and capability routing",
      "Secure personal links for chat, attendance, giving, service formats, and uploads",
    ],
  };
}

function updateManifest(scoping, docs) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.about = {
    headline: "The Alliance is a living body moving in shared rhythm.",
    intro:
      "The Alliance Hub exists to make the vision of the Alliance visible, understandable, and actionable. It gathers churches, pastors, members, gifts, outreach, governance, giving, communication, and follow-up into one coordinated digital ecosystem.",
    scripture:
      "From whom the whole body fitly joined together and compacted by that which every joint supplieth... maketh increase of the body unto the edifying of itself in love. - Ephesians 4:16",
    chapters: scoping.chapters,
  };
  manifest.scoping = {
    summary: scoping.summary,
    scripture_frame: scoping.scripture_frame,
    programs: scoping.programs,
    end_to_end_flow: scoping.end_to_end_flow,
    hub_requirements: scoping.hub_requirements,
    source_documents: docs.map(({ id, title, path, chars, sha256 }) => ({
      id,
      title,
      file: basename(path),
      chars,
      sha256,
    })),
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function writeMarkdown(scoping, docs) {
  const lines = [
    "# Alliance Scoping Plan",
    "",
    scoping.summary,
    "",
    "## Source Documents",
    "",
    ...docs.map((doc) => `- ${doc.title}: ${doc.chars} chars, sha256 ${doc.sha256}`),
    "",
    "## Appable Programs",
    "",
  ];
  for (const program of scoping.programs) {
    lines.push(`### ${program.name}`, "");
    lines.push(`- Outcome: ${program.outcome}`);
    lines.push(`- App module: ${program.app_module}`);
    lines.push(`- Source docs: ${program.source_docs.join(", ")}`);
    lines.push(`- Operations: ${program.operations.join("; ")}`);
    lines.push(`- Records: ${program.records.join(", ")}`);
    lines.push(`- Automations: ${program.automations.join(", ")}`);
    lines.push("");
  }
  lines.push("## End To End Flow", "");
  scoping.end_to_end_flow.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  lines.push("", "## Hub Requirements", "");
  scoping.hub_requirements.forEach((item) => lines.push(`- ${item}`));
  writeFileSync(outMd, `${lines.join("\n")}\n`);
}

function main() {
  const docs = readStoryDocs();
  const scoping = buildScoping();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outJson, JSON.stringify({
    schema: "refer.alliance.scoping-plan.v1",
    generated_at: new Date().toISOString(),
    story_dir: storyDir,
    source_documents: docs.map(({ id, title, path, chars, sha256 }) => ({ id, title, path, chars, sha256 })),
    scoping,
  }, null, 2));
  writeMarkdown(scoping, docs);
  updateManifest(scoping, docs);
  console.log(JSON.stringify({
    ok: true,
    docs_scanned: docs.length,
    programs: scoping.programs.length,
    manifest_updated: manifestPath,
    scoping_json: outJson,
    scoping_md: outMd,
  }, null, 2));
}

main();
