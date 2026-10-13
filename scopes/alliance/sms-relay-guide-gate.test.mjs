#!/usr/bin/env node
/**
 * Proves two things about the guide gate in alliance-sms-relay, without a
 * network, a database or a phone:
 *
 *   1. A number OUTSIDE the gate is handled exactly as before. The relay source
 *      at a baseline commit and the working source are each run over the same
 *      texts against the same pretend database, and every request either one
 *      makes, and every reply it gives, must match.
 *   2. Inside the gate the guide path does what the design says: a question is
 *      written down, collected, answered or handed to the pastor, the pastor's
 *      reply returns to the visitor, and no text goes to a number outside it.
 *
 *   node scopes/alliance/sms-relay-guide-gate.test.mjs [--baseline <git rev>]
 *
 * The relay is one Deno file. It is run here under Node by standing in for the
 * three things it asks Deno for (env, serve) and for fetch. Run from the
 * refer-zo-bootstrap root. All phone numbers here are invented (555).
 *
 * What it does not prove: anything about the real database, the deployed
 * function, the phone, or the model. It is the source's logic only.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE = resolve("scopes", "alliance", "supabase", "functions", "alliance-sms-relay", "index.ts");
const args = process.argv.slice(2);
const baseline = args.includes("--baseline") ? args[args.indexOf("--baseline") + 1] : "05dc525";

const N = {
  self: "4045550100",
  visitor: "4045550101",
  pastor: "4045550102",
  visitor2: "4045550103",
  registered: "4045550150",
  stranger: "4045550199",
};

// ---- the child: one relay, one pretend world, one script of requests --------
if (process.env.RELAY_CHILD) {
  const spec = JSON.parse(process.env.RELAY_CHILD);
  const db = { alliance_records: [], alliance_sms_outbox: [], alliance_sms_inbox: [], alliance_sms_delivery_events: [], org_standing_answers: [], profiles: [] };
  const trace = [];
  let seq = 0;
  let clock = Date.now();
  const nowIso = () => new Date((clock += 1000)).toISOString();
  const pick = (row, path) => path.split(/->>?/).reduce((v, key) => (v == null ? undefined : v[key]), row);
  const matches = (row, key, cond) => {
    const value = pick(row, key);
    if (cond.startsWith("eq.")) return String(value ?? "") === cond.slice(3);
    if (cond.startsWith("lt.")) return String(value ?? "") < cond.slice(3);
    if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").includes(String(value ?? ""));
    if (cond.startsWith("ilike.")) return String(value ?? "").toLowerCase().includes(cond.slice(6).replace(/\*/g, "").toLowerCase());
    throw new Error(`pretend database cannot answer ${key}=${cond}`);
  };
  const scrub = (text) => String(text)
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<time>")
    .replace(/v1\.[\w-]+\.[\w-]+/g, "<token>")
    .replace(/\/a\/[A-Z0-9]+/g, "/a/<code>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{22,}/g, "<uuid>")
    .replace(/\b\d{12,}\b/g, "<ms>")
    .replace(/"(code|short_form_code|edit_form_short_code)":"[A-Z0-9]+"/g, '"$1":"<code>"')
    .replace(/alliance-short-link:[A-Z0-9]+/g, "alliance-short-link:<code>")
    .replace(/Alliance short link [A-Z0-9]+/g, "Alliance short link <code>")
    .replace(/alliance-sms-guide:(\d+):\w+/g, "alliance-sms-guide:$1:<t>");

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const method = (init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    trace.push(scrub(`${method} ${url.host}${url.pathname}?${decodeURIComponent(url.searchParams.toString())} ${body ? JSON.stringify(body) : ""}`));
    const respond = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

    if (url.host === "hub.test") {
      if (url.pathname === "/api/events") return respond({ events: [], shape: "canonical" });
      if (url.pathname === "/phone/pulse") return respond({ ok: true });
      if (url.pathname === "/phone/inbound") return respond({ ok: true, response_kind: "blocked", response_text: "" });
      return respond({ ok: false }, 404);
    }
    if (url.pathname === "/rest/v1/rpc/org_standing_answers_in_force") {
      if (spec.failSavedRead) return respond({ message: "pretend failure" }, 500);
      return respond(db.org_standing_answers.filter((r) => r.org_id === body.p_org_id && r.status === "saved"));
    }
    const table = url.pathname.replace("/rest/v1/", "");
    const rows = db[table];
    if (!rows) return respond({ message: `no table ${table}` }, 404);
    if (spec.failProfiles && table === "profiles" && (spec.failProfiles === true || trace.filter((t) => t.includes("/rest/v1/profiles")).length <= spec.failProfiles)) return respond({ message: "pretend failure" }, 500);
    if (spec.failInsertOf && method === "POST" && body?.entity === spec.failInsertOf) return respond({ message: "pretend failure" }, 500);
    const filters = [...url.searchParams.entries()].filter(([k]) => !["select", "order", "limit"].includes(k));
    const hit = (row) => filters.every(([k, v]) => matches(row, k, v));
    if (method === "POST") {
      const row = { id: `row-${++seq}`, created_at: nowIso(), updated_at: nowIso(), queued_at: nowIso(), received_at: nowIso(), ...body };
      rows.push(row);
      return respond([row], 201);
    }
    if (method === "PATCH") {
      const changed = rows.filter(hit);
      for (const row of changed) Object.assign(row, body, { updated_at: nowIso() });
      return respond(changed);
    }
    let found = rows.filter(hit);
    const order = url.searchParams.get("order");
    if (order) {
      const [col, dir] = order.split(".");
      found = [...found].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === "desc" ? -1 : 1));
    }
    const limit = Number(url.searchParams.get("limit") || 0);
    return respond(limit ? found.slice(0, limit) : found);
  };

  const env = {
    SUPABASE_URL: "http://db.test",
    SERVICE_ROLE_KEY: "service",
    ALLIANCE_SMS_RELAY_TOKEN: "relay-token",
    ALLIANCE_PROFILE_FORM_BASE_URL: "http://hub.test/profile",
    ALLIANCE_BRIDGE_PHONE_NUMBER: N.self,
    ALLIANCE_REGEX_TEST_PHONES: N.pastor,
    ...spec.env,
  };
  let handler;
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
  await import(pathToFileURL(spec.module).href);

  for (const row of spec.seed || []) db[row.table].push({ created_at: nowIso(), updated_at: nowIso(), ...row.row });
  const out = [];
  for (const step of spec.steps) {
    if (step.backdate) {
      for (const row of db.alliance_records) {
        if (row.entity !== "sms_guide_question") continue;
        row.created_at = "2026-10-01T00:00:00.000Z";
        if (row.values?.handoff?.opened_at && step.backdate === "handoffs") row.values.handoff.opened_at = "2026-10-01T00:00:00.000Z";
      }
      continue;
    }
    if (step.seed) { db[step.seed.table].push({ id: `row-${++seq}`, created_at: nowIso(), updated_at: nowIso(), ...step.seed.row }); continue; }
    // "q:2" means the second guide question stored in this run.
    if (typeof step.body?.id === "string" && step.body.id.startsWith("q:")) {
      step.body.id = db.alliance_records.filter((r) => r.entity === "sms_guide_question")[Number(step.body.id.slice(2)) - 1]?.id || "missing";
    }
    const before = trace.length;
    const res = await handler(new Request(`http://relay.test/functions/v1/alliance-sms-relay${step.path}`, {
      method: step.method || "POST",
      headers: { "content-type": "application/json", "x-dispatcher-token": "relay-token" },
      body: step.body ? JSON.stringify(step.body) : undefined,
    }));
    const text = await res.text();
    out.push({ step: step.name || step.path, status: res.status, reply: scrub(text), raw: JSON.parse(text), requests: trace.slice(before) });
  }
  process.stdout.write(JSON.stringify({
    out,
    outbox: db.alliance_sms_outbox.map((r) => ({ to: r.to_phone, message: r.message, scrubbed: scrub(r.message), kind: r.metadata?.raw?.kind || r.metadata?.raw?.source || "" })),
    saved: db.org_standing_answers,
    guide: db.alliance_records.filter((r) => r.entity === "sms_guide_question").map((r) => ({ id: r.id, status: r.status, values: r.values })),
  }));
  process.exit(0);
}

// ---- the parent -------------------------------------------------------------
const work = mkdtempSync(join(tmpdir(), "relay-guide-gate-"));
const oldModule = join(work, "old.ts");
const newModule = join(work, "new.ts");
writeFileSync(oldModule, execFileSync("git", ["show", `${baseline}:scopes/alliance/supabase/functions/alliance-sms-relay/index.ts`], { encoding: "utf8", maxBuffer: 1 << 24 }));
copyFileSync(SOURCE, newModule);

function run(module, spec) {
  const result = spawnSync(process.execPath, ["--no-warnings", new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")], {
    env: { ...process.env, RELAY_CHILD: JSON.stringify({ module, ...spec }) },
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  if (result.status !== 0) throw new Error(`relay run failed: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : `\n     ${detail}`}`);
};
const inbound = (from, body, date) => ({ path: "/phone/inbound", name: `${from}: ${body}`, body: { from: `+1${from}`, body, date } });
const guideEnv = {
  ALLIANCE_GUIDE_TEST_VISITOR_PHONES: `${N.visitor},${N.visitor2}`,
  ALLIANCE_GUIDE_TEST_PASTOR_PHONE: N.pastor,
  ALLIANCE_GUIDE_CHURCH_ID: "church-1",
  ALLIANCE_GUIDE_CHURCH_NAME: "Canary",
};
const registeredSeed = [{
  table: "alliance_records",
  row: { id: "ctx-1", entity: "sms_profile_context", route: `alliance-profile-context:1${N.registered}`, status: "completed", values: { phone: `1${N.registered}`, state: "completed", status: "completed", profile_id: "user-0150-abc", profile: { id: "user-0150-abc", first_name: "Ruth" } } },
}];

// 1. Outside the gate: old source and new source, same texts, same world.
const outsiders = [
  inbound(N.stranger, "hello", 1),
  inbound(N.stranger, "what time is service on sunday", 2),
  inbound(N.stranger, "i dont think i can keep going anymore", 3),
  inbound(N.stranger, "how do i join", 4),
  inbound(N.stranger, "one more", 5),
  inbound(N.stranger, "and another after the pause", 6),
  inbound(N.stranger, "RESET", 7),
  inbound(N.stranger, "STOP", 8),
  inbound(N.registered, "hi", 9),
  inbound(N.registered, "profile", 10),
  inbound(N.registered, "please edit my details", 11),
  inbound(N.registered, "give", 12),
  inbound(N.registered, "do you do baptisms and how much does it cost", 13),
  inbound(N.registered, "can a pastor call me", 14),
  inbound(N.self, "echo of our own text", 15),
  inbound(N.stranger, "hello", 1),
  { path: "/sms/send", name: "an app queues a text", body: { to: N.stranger, message: "Service starts soon." } },
  { path: "/phone/next", method: "GET", name: "phone collects a text" },
  { path: "/phone/report", name: "phone reports it sent", body: { id: "row-1", status: "sent" } },
  { path: `/sms/latest?from=${N.stranger}`, method: "GET", name: "latest inbound" },
];
const oldRun = run(oldModule, { env: guideEnv, seed: registeredSeed, steps: outsiders });
const newRun = run(newModule, { env: guideEnv, seed: registeredSeed, steps: outsiders });
for (let i = 0; i < outsiders.length; i += 1) {
  const a = oldRun.out[i];
  const b = newRun.out[i];
  const same = a.status === b.status && a.reply === b.reply && JSON.stringify(a.requests) === JSON.stringify(b.requests);
  check(`outside the gate, unchanged: ${a.step}`, same, same ? "" : `old ${a.reply.slice(0, 160)}\n     new ${b.reply.slice(0, 160)}\n     old made ${a.requests.length} requests, new made ${b.requests.length}`);
}
check("outside the gate: the same texts were queued, in the same order", JSON.stringify(oldRun.outbox.map((m) => [m.to, m.scrubbed])) === JSON.stringify(newRun.outbox.map((m) => [m.to, m.scrubbed])));
check("outside the gate: no guide record was written", newRun.guide.length === 0);
check("outside the gate: the run did real work (texts were queued)", oldRun.outbox.length >= 8, `only ${oldRun.outbox.length} queued`);

// The pulse is not identical by design: with the guide on it also sweeps.
const pulseOld = run(oldModule, { env: guideEnv, steps: [{ path: "/phone/pulse", body: { type: "minute" } }] });
const pulseNew = run(newModule, { env: guideEnv, steps: [{ path: "/phone/pulse", body: { type: "minute" } }] });
check("pulse: same reply to the phone", pulseOld.out[0].reply === pulseNew.out[0].reply);
check("pulse: the only extra work is two reads of guide records", pulseNew.out[0].requests.length === pulseOld.out[0].requests.length + 2
  && pulseNew.out[0].requests.slice(-2).every((r) => r.startsWith("GET") && r.includes("sms_guide_question")));

// 2. Guide off (no secrets): the test numbers are ordinary numbers again.
const offSteps = [inbound(N.visitor, "how do i join", 1), inbound(N.pastor, "hello", 2), { path: "/phone/pulse", body: { type: "minute" } }];
const offOld = run(oldModule, { steps: offSteps });
const offNew = run(newModule, { steps: offSteps });
check("guide off: test numbers take today's path, request for request", JSON.stringify(offOld.out.map((o) => [o.reply, o.requests])) === JSON.stringify(offNew.out.map((o) => [o.reply, o.requests])));
check("guide off: /guide/next says so", run(newModule, { steps: [{ path: "/guide/next", method: "GET" }] }).out[0].raw.guide === "off");

// 3. The pastor's number with nothing open: today's path plus one look for open questions.
const pastorIdleOld = run(oldModule, { env: guideEnv, steps: [inbound(N.pastor, "hello", 1)] });
const pastorIdleNew = run(newModule, { env: guideEnv, steps: [inbound(N.pastor, "hello", 1)] });
const extra = pastorIdleNew.out[0].requests.filter((r) => !pastorIdleOld.out[0].requests.includes(r));
check("pastor with nothing open: today's path, plus one read", pastorIdleOld.out[0].reply === pastorIdleNew.out[0].reply && extra.length === 1 && extra[0].includes("handoff_open"));

// 4. The guide path.
const answer = (id, response) => ({ path: "/guide/answer", name: `answer ${id}`, body: { id, response } });
const A = { contract: "assistant/1", kind: "answer", text: "To join a church in Telechurch Live, open the church's page and tap Join This Church.", used_facts: ["A2"] };
const H = (reason, text, extraFields = {}) => ({ contract: "assistant/1", kind: "handoff", text, handoff: { reason, urgent: reason === "crisis", decided_by: "screen" }, ...extraFields });
const withLine = "I'm so sorry you are carrying this. I am passing your message to the pastor of Canary right now. If you are in danger or thinking of harming yourself, call or text 988 now, or call 911.";
const notSaved = H("not_saved", "That answer has not been saved for Canary yet, so I am passing your question to the pastor, who will respond to you.", { gap: { question: "what time is service on sunday", topic: "service_times" } });
const flow = run(newModule, {
  env: guideEnv,
  steps: [
    inbound(N.visitor, "how do i join", 1),
    { path: "/guide/next", method: "GET", name: "collect 1" },
    { path: "/guide/next", method: "GET", name: "collect again" },
    answer("q:1", A),
    inbound(N.visitor, "what time is service on sunday", 2),
    { path: "/guide/next", method: "GET", name: "collect 2" },
    answer("q:2", notSaved),
    inbound(N.pastor, "Sundays at 10:30. Come as you are.", 3),
    inbound(N.pastor, "hello", 4),
  ],
});
const byName = (r, name) => r.out.find((o) => o.step === name);
check("visitor's text is written down and nothing is sent yet", flow.out[0].raw.profile.reason === "guide_question_waiting" && flow.out[0].raw.ok === true && flow.out[0].requests.every((r) => !r.includes("alliance_sms_outbox")));
const q1 = byName(flow, "collect 1").raw.question;
check("the collector gets the question and no phone number", q1 && q1.question === "how do i join" && q1.first_contact === true && !JSON.stringify(q1).includes(N.visitor));
check("a question is handed out once", byName(flow, "collect again").raw.question === null);
const o2 = flow.outbox;
check("an answer is sent to the visitor unchanged", o2[0].to.endsWith(N.visitor) && o2[0].message === A.text);
check("the second text is not a first contact", byName(flow, "collect 2").raw.question.first_contact === false);
check("handoff: the visitor hears the answerer's words unchanged", o2[1].to.endsWith(N.visitor) && o2[1].message === notSaved.text);
check("handoff: the pastor is told, with the question and a number, and not the visitor's number", o2[2].to.endsWith(N.pastor) && o2[2].message.includes("#1") && o2[2].message.includes("what time is service on sunday") && !o2[2].message.includes(N.visitor));
check("pastor's reply goes back to the visitor in the pastor's name", o2[3].to.endsWith(N.visitor) && o2[3].message === "From the pastor of Canary: Sundays at 10:30. Come as you are.");
check("pastor is told it was sent", o2[4].to.endsWith(N.pastor) && o2[4].message.startsWith("Sent."));
check("the question is closed and keeps the reply", flow.guide[1].status === "handoff_closed" && flow.guide[1].values.pastor_reply.startsWith("Sundays") && flow.guide[0].status === "answered");
check("with nothing open again, the pastor's next text is not treated as a reply", !JSON.stringify(flow.out[8].raw).includes("guide_pastor_reply") && !o2.slice(5).some((m) => m.to.endsWith(N.visitor)));

// The pastor saves a reply by text, and the next question is handed it.
const saving = run(newModule, {
  env: guideEnv,
  steps: [
    inbound(N.pastor, "SAVE service times", 1),
    inbound(N.visitor, "what time is service on sunday", 2),
    answer("q:1", notSaved),
    inbound(N.pastor, "Sundays at 10:30. Come as you are.", 3),
    inbound(N.pastor, "save", 4),
    inbound(N.pastor, "SAVE service times", 5),
    inbound(N.pastor, "SAVE service times", 6),
    inbound(N.visitor, "when do you meet", 7),
    { path: "/guide/next", method: "GET", name: "collect after saving" },
  ],
});
const toPastor = saving.outbox.filter((m) => m.to.endsWith(N.pastor)).map((m) => m.message);
check("SAVE with nothing to save is not the guide's: today's path", !JSON.stringify(saving.out[0].raw).includes("guide_pastor") && saving.saved.length === 1);
check("after a reply the pastor is offered SAVE", toPastor.some((m) => m.startsWith("Sent.") && m.includes("reply SAVE")));
check("SAVE with no subject: the pastor is asked for one, nothing is saved yet", saving.out[4].raw.profile.reason === "guide_pastor_save_needs_subject" && toPastor.some((m) => m.includes("add a word or two")));
const row = saving.saved[0];
check("SAVE with a subject writes one standing answer for the church, in the pastor's words", row && row.org_id === "church-1" && row.topic === "service_times" && row.label === "service times" && row.answer === "Sundays at 10:30. Come as you are." && row.lifespan === "standing" && row.source === "reply" && row.status === "saved");
check("the saved answer holds none of the visitor's words and no number", row && !JSON.stringify(row).includes("what time is service") && !JSON.stringify(row).includes(N.visitor));
check("the same reply is not saved twice", saving.saved.length === 1 && !JSON.stringify(saving.out[6].raw).includes("guide_pastor_answer_saved"));
const handed = byName(saving, "collect after saving").raw.question;
check("the next question is handed the saved answer", handed.saved_answers.length === 1 && handed.saved_answers[0].id === "S1" && handed.saved_answers[0].about === "service times" && handed.saved_answers[0].say.startsWith("Sundays at 10:30"));
const savedDown = run(newModule, { env: guideEnv, failSavedRead: true, steps: [inbound(N.visitor, "when do you meet", 1), { path: "/guide/next", method: "GET", name: "collect" }] });
check("saved answers unreadable: the question is still handed out, with none", byName(savedDown, "collect").raw.question?.question === "when do you meet" && savedDown.out[1].raw.question.saved_answers.length === 0);

// A pastor who texted STOP is not texted.
const stopSeed = (source, flag) => [{ table: "profiles", row: { id: "p1", phone: `+1${N.pastor}`, global_follow_sms: flag, global_follow_sms_source: source } }];
const stopSteps = [
  inbound(N.visitor, "what time is service on sunday", 1),
  answer("q:1", notSaved),
  { backdate: "handoffs" },
  { path: "/phone/pulse", name: "pulse after the limit", body: { type: "minute" } },
];
const stopped = run(newModule, { env: guideEnv, seed: stopSeed("stop", false), steps: stopSteps });
check("pastor said STOP: the visitor still hears the handoff", stopped.outbox.length === 1 && stopped.outbox[0].to.endsWith(N.visitor) && stopped.outbox[0].message === notSaved.text);
check("pastor said STOP: no text goes to the pastor, not the notice and not the reminder", !stopped.outbox.some((m) => m.to.endsWith(N.pastor)));
check("pastor said STOP: the held notice is written on the question", stopped.guide[0].values.handoff.pastor_notice === "pastor_text_channel_closed" && stopped.guide[0].status === "handoff_open");
check("pastor said STOP: the visitor is not told the pastor was reminded", !stopped.outbox.some((m) => m.message.startsWith("Your message is with the pastor")));
const flagOffNoStop = run(newModule, { env: guideEnv, seed: stopSeed(null, false), steps: stopSteps.slice(0, 2) });
check("flag off for another reason is not a STOP: the pastor is texted", flagOffNoStop.outbox.some((m) => m.to.endsWith(N.pastor)) && flagOffNoStop.guide[0].values.handoff.pastor_notice === "texted");
const restarted = run(newModule, { env: guideEnv, seed: stopSeed("start", true), steps: stopSteps.slice(0, 2) });
check("pastor texted START again: the pastor is texted", restarted.outbox.some((m) => m.to.endsWith(N.pastor)));
const unknown = run(newModule, {
  env: guideEnv,
  failProfiles: 1,
  steps: [inbound(N.visitor, "what time is service on sunday", 1), answer("q:1", notSaved), { path: "/phone/pulse", name: "next pulse", body: { type: "minute" } }, { path: "/phone/pulse", name: "pulse after", body: { type: "minute" } }],
});
check("STOP check unreadable: the pastor is not texted then, and the notice is held", unknown.out[1].requests.every((r) => !(r.includes("alliance_sms_outbox") && r.includes(N.pastor))));
check("STOP check unreadable: the notice is sent on the next pulse, once", unknown.outbox.filter((m) => m.to.endsWith(N.pastor)).length === 1 && unknown.guide[0].values.handoff.pastor_notice === "texted");

// Rule 6, and the crisis line added once and never twice.
const guard = run(newModule, {
  env: guideEnv,
  steps: [
    inbound(N.visitor, "what should i wear", 1),
    answer("q:1", { ...A, text: "There is no dress code.", used_facts: [] }),
    inbound(N.visitor2, "i dont think i can keep going anymore", 2),
    answer("q:2", H("crisis", withLine)),
    inbound(N.visitor2, "everything is too much, i want to die", 3),
    answer("q:3", H("crisis", "I am passing your message to the pastor of Canary right now.")),
  ],
});
const g = guard.outbox;
check("an answer naming no saved fact is refused: the visitor gets the fixed sentence instead", g[0].message === "Thank you for your message. I am passing it to the pastor of Canary, who will respond to you." && !g.some((m) => m.message.includes("dress code") && m.to.endsWith(N.visitor)));
check("urgent handoff that already carries the crisis line: not added twice", g[2].message === withLine && g[2].message.match(/988/g).length === 1);
check("urgent handoff missing the crisis line: added once", (g[4].message.match(/988/g) || []).length === 1 && g[4].message.includes("911"));
check("urgent handoff: the pastor's notice says URGENT", g[3].message.startsWith("URGENT.") && g[5].message.startsWith("URGENT."));

// Nobody collects: the pulse hands it to the pastor with the fixed sentence.
const silent = run(newModule, {
  env: guideEnv,
  steps: [
    inbound(N.visitor, "where are you located", 1),
    inbound(N.visitor2, "i want to die", 2),
    { path: "/phone/pulse", name: "pulse too soon", body: { type: "minute" } },
    { backdate: "questions" },
    { path: "/phone/pulse", name: "pulse after the wait", body: { type: "minute" } },
    { path: "/phone/pulse", name: "pulse again", body: { type: "minute" } },
    answer("q:1", A),
    inbound(N.pastor, "we are at the corner", 3),
    inbound(N.pastor, "#2 I am calling you now", 4),
    inbound(N.pastor, "#1 We are at the corner of Maple and 3rd", 5),
  ],
});
const s = silent.outbox;
const toV1 = s.filter((m) => m.to.endsWith(N.visitor));
const toV2 = s.filter((m) => m.to.endsWith(N.visitor2));
check("answerer unreachable: nothing is sent before the wait is up", byName(silent, "pulse too soon").requests.every((r) => !r.includes("alliance_sms_outbox")));
check("answerer unreachable: the visitor gets exactly the contract's sentence", toV1[0].message === "Thank you for your message. I am passing it to the pastor of Canary, who will respond to you.");
check("answerer unreachable and the door's list reads a crisis: the line is added", toV2[0].message.includes("988") && toV2[0].message.includes("911"));
check("a second pulse sends nothing more", byName(silent, "pulse again").requests.every((r) => !r.includes("alliance_sms_outbox")));
check("an answer arriving after the handoff is not sent", silent.out.find((o) => o.step.startsWith("answer ")).raw.applied === false && !toV1.some((m) => m.message === A.text));
check("two open and no number: the pastor is asked which, nothing reaches a visitor", s.some((m) => m.to.endsWith(N.pastor) && m.message.startsWith("More than one question is open")) && !toV1.concat(toV2).some((m) => m.message.includes("we are at the corner")));
check("a numbered reply reaches the right visitor", toV2[1]?.message === "From the pastor of Canary: I am calling you now" && toV1[1]?.message === "From the pastor of Canary: We are at the corner of Maple and 3rd");

// The reminder, once.
const nudge = run(newModule, {
  env: guideEnv,
  steps: [
    inbound(N.visitor, "do you do baptisms", 1),
    answer("q:1", notSaved),
    { path: "/phone/pulse", name: "pulse before the limit", body: { type: "minute" } },
    { backdate: "handoffs" },
    { path: "/phone/pulse", name: "pulse after the limit", body: { type: "minute" } },
    { path: "/phone/pulse", name: "pulse again", body: { type: "minute" } },
  ],
});
const forgotten = nudge.outbox.filter((m) => m.message.startsWith("Your message is with the pastor of Canary and has not been forgotten."));
check("pastor has not replied: the visitor is told once, and the pastor is reminded at the same moment", forgotten.length === 1 && nudge.outbox.filter((m) => m.message.startsWith("Reminder:")).length === 1);

// The gate itself.
const everyRun = [flow, saving, stopped, flagOffNoStop, restarted, unknown, guard, silent, nudge];
const allowed = [N.visitor, N.visitor2, N.pastor];
check("every text the guide path queued went to a number inside the gate", everyRun.every((r) => r.outbox.every((m) => allowed.some((n) => m.to.endsWith(n)))));
const leak = run(newModule, {
  env: guideEnv,
  steps: [
    { seed: { table: "alliance_records", row: { entity: "sms_guide_question", status: "waiting", values: { visitor_phone: `1${N.stranger}`, question: "planted", church_id: "church-1" } } } },
    answer("q:1", A),
  ],
});
check("a planted record naming an outside number cannot be texted", leak.outbox.length === 0 && leak.out[0].status === 500);

// Any failure in the guide path falls through to today's behaviour.
const broken = run(newModule, { env: guideEnv, failInsertOf: "sms_guide_question", steps: [inbound(N.visitor, "how do i join", 1)] });
const brokenOld = run(oldModule, { env: guideEnv, steps: [inbound(N.visitor, "how do i join", 1)] });
check("guide path fails: the visitor gets exactly what they would have got before", JSON.stringify(broken.outbox.map((m) => [m.to, m.scrubbed])) === JSON.stringify(brokenOld.outbox.map((m) => [m.to, m.scrubbed])) && broken.outbox.length === 1);

rmSync(work, { recursive: true, force: true });
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
