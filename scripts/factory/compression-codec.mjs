#!/usr/bin/env node
/**
 * Domain-aware, lossless machine transport compression.
 *
 * Typed JSON contracts remain authoritative. This codec only produces compact
 * transport packets for machine work and decompresses them back into typed
 * objects for inspection, verification, or human summaries.
 */
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";

const VERSION = "sx1";

const COMMON_KEY_ALIASES = {
  schema: "z",
  contract_id: "i",
  agent_task_id: "a",
  parent_contract_id: "p",
  created_at: "t",
  updated_at: "ut",
  raw_input_sha256: "h",
  raw_input_chars: "hc",
  owner_factory: "o",
  target_repo: "r",
  authority: "au",
  mode: "m",
  risk: "k",
  risk_reason: "kr",
  intent: "n",
  task: "q",
  scope: "s",
  out_of_scope: "os",
  constraints: "c",
  acceptance: "ac",
  target_paths: "tp",
  allowed_mutations: "am",
  expected_outputs: "eo",
  context_refs: "x",
  intake_record: "xi",
  codebase_tree: "xc",
  agent_context: "xa",
  script_legend: "xl",
  reporting: "g",
  dataset_ref: "gd",
  return_contract: "gr",
  report_to: "rt",
  dataset_targets: "dt",
  transport: "u",
  format: "f",
  payload: "y",
  status: "st",
  changed: "ch",
  evidence: "ev",
  blockers: "b",
  next: "nx",
  kind: "kd",
  should_create_or_update: "su",
  next_best_script: "ns",
};

const DOMAIN_KEY_ALIASES = {
  codex_task: {},
  zo_task: {},
  talkback: {},
  factory_sim: {},
};

const VALUE_ALIASES = {
  "refer-script-factory": "rsf",
  "refer-zo-bootstrap": "rzb",
  "current-chat": "cc",
  "build-director": "bd",
  "local_source": "ls",
  "done": "D",
  "failed": "F",
  "blocked": "B",
  "ratify": "R",
  "review": "V",
  "spawn_followup": "S",
  "pause": "P",
  "DISCUSS": "d",
  "BUILD": "b",
  "MICRO": "m",
  "PLAN": "p",
  "VERIFY": "v",
  "low": "l",
  "medium": "md",
  "high": "h",
  "tool-or-remote-chain": "tr",
  "possible-live-mutation": "lm",
  "bounded-or-discussion": "bd",
  "non-mutating simulation": "nm",
  "typed contract is source of truth": "tc",
  "compressed transport is derived only": "ct",
  "talkback must report gaps": "tb",
};

const REVERSE_VALUE_ALIASES = Object.fromEntries(
  Object.entries(VALUE_ALIASES).map(([key, value]) => [value, key]),
);

function keyAliasesFor(domain) {
  return { ...COMMON_KEY_ALIASES, ...(DOMAIN_KEY_ALIASES[domain] || {}) };
}

function reverseAliases(aliases) {
  return Object.fromEntries(Object.entries(aliases).map(([key, value]) => [value, key]));
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function aliasValue(value, aliases) {
  if (typeof value === "string") return VALUE_ALIASES[value] || value;
  if (Array.isArray(value)) return value.map((item) => aliasValue(item, aliases));
  if (value && typeof value === "object") return aliasObject(value, aliases);
  return value;
}

function unaliasValue(value, aliases) {
  if (typeof value === "string") return REVERSE_VALUE_ALIASES[value] || value;
  if (Array.isArray(value)) return value.map((item) => unaliasValue(item, aliases));
  if (value && typeof value === "object") return unaliasObject(value, aliases);
  return value;
}

function aliasObject(object, aliases) {
  if (Array.isArray(object)) return object.map((item) => aliasValue(item, aliases));
  const output = {};
  for (const [key, value] of Object.entries(object || {})) {
    output[aliases[key] || key] = aliasValue(value, aliases);
  }
  return output;
}

function unaliasObject(object, aliases) {
  if (Array.isArray(object)) return object.map((item) => unaliasValue(item, aliases));
  const reverse = reverseAliases(aliases);
  const output = {};
  for (const [key, value] of Object.entries(object || {})) {
    output[reverse[key] || key] = unaliasValue(value, aliases);
  }
  return output;
}

export function encodePacket(domain, packet) {
  const aliases = keyAliasesFor(domain);
  const sourceJson = JSON.stringify(packet);
  const compactJson = JSON.stringify(aliasObject(packet, aliases));
  const payload = `${VERSION}:${domain}:${base64UrlEncode(deflateRawSync(Buffer.from(compactJson, "utf8"), { level: 9 }))}`;
  const sourceBytes = Buffer.byteLength(sourceJson, "utf8");
  const payloadBytes = Buffer.byteLength(payload, "utf8");
  return {
    format: `${VERSION}.${domain}`,
    payload,
    stats: {
      source_bytes: sourceBytes,
      aliased_bytes: Buffer.byteLength(compactJson, "utf8"),
      payload_bytes: payloadBytes,
      saved_bytes: sourceBytes - payloadBytes,
      ratio: Number((payloadBytes / Math.max(sourceBytes, 1)).toFixed(3)),
    },
  };
}

export function decodePacket(payload) {
  const [version, domain, body] = String(payload || "").split(":");
  if (version !== VERSION || !domain || !body) {
    throw new Error(`Unsupported compressed packet: ${String(payload).slice(0, 40)}`);
  }
  const aliases = keyAliasesFor(domain);
  const compactJson = inflateRawSync(base64UrlDecode(body)).toString("utf8");
  return { domain, packet: unaliasObject(JSON.parse(compactJson), aliases) };
}

export function toSexprPreview(domain, packet) {
  const compact = aliasObject(packet, keyAliasesFor(domain));
  const fields = Object.entries(compact)
    .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => `:${key} ${sexprValue(value)}`)
    .join(" ");
  return `(${domain} ${fields})`;
}

function sexprValue(value) {
  if (value === null || value === undefined) return "nil";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parseCliArgs(argv) {
  const args = { command: argv[0] || "", domain: "factory_sim", json: "", file: "", payload: "" };
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i] === "--domain" && argv[i + 1]) args.domain = argv[++i];
    else if (argv[i] === "--json" && argv[i + 1]) args.json = argv[++i];
    else if (argv[i] === "--file" && argv[i + 1]) args.file = argv[++i];
    else if (argv[i] === "--payload" && argv[i + 1]) args.payload = argv[++i];
  }
  return args;
}

function samplePacket() {
  return {
    schema: "refer.factory.simulation.v1",
    contract_id: "factory.sim.sample",
    owner_factory: "refer-zo-bootstrap",
    mode: "VERIFY",
    risk: "medium",
    risk_reason: "tool-or-remote-chain",
    intent: "verify the Telechurch Zo bootstrap install without mutating live files",
    constraints: [
      "non-mutating simulation",
      "typed contract is source of truth",
      "compressed transport is derived only",
      "talkback must report gaps",
    ],
  };
}

export function selfTest() {
  for (const domain of ["factory_sim", "codex_task", "zo_task", "talkback"]) {
    const packet = samplePacket();
    const encoded = encodePacket(domain, packet);
    const decoded = decodePacket(encoded.payload);
    if (JSON.stringify(decoded.packet) !== JSON.stringify(packet)) {
      throw new Error(`${domain} round trip failed`);
    }
  }
  return true;
}

async function main(argv) {
  const args = parseCliArgs(argv);
  if (args.command === "self-test") {
    selfTest();
    console.log("compression-codec self-test passed");
    return;
  }
  if (args.command === "encode") {
    const raw = args.file ? readFileSync(args.file, "utf8") : args.json;
    if (!raw) throw new Error("encode requires --json or --file");
    console.log(JSON.stringify(encodePacket(args.domain, JSON.parse(raw)), null, 2));
    return;
  }
  if (args.command === "decode") {
    if (!args.payload) throw new Error("decode requires --payload");
    console.log(JSON.stringify(decodePacket(args.payload), null, 2));
    return;
  }
  console.error("Usage: node scripts/factory/compression-codec.mjs self-test|encode|decode [--domain name] [--json json|--file path|--payload sx1:...]");
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  });
}
