#!/usr/bin/env node
/**
 * contract-inbox-runner.mjs
 *
 * Minimal Zo-side file transport runner. It reads a saved contract from Zo
 * Files, verifies/decompresses transport when present, and writes a talkback
 * packet to the talkback outbox. This gives Codex a cheap API lane that avoids
 * a full Zo chat round trip.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { decodePacket, encodePacket } from "./compression-codec.mjs";
import { logTokenUse } from "./token-log-bridge.mjs";

function parseArgs(argv) {
  const args = {
    once: false,
    contract: "",
    remoteRoot: process.env.ZO_WORKSPACE_ROOT || "/home/workspace",
    outbox: "",
    zoComputer: process.env.ZO_COMPUTER_NAME || "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--once") args.once = true;
    else if (argv[i] === "--contract" && argv[i + 1]) args.contract = argv[++i];
    else if (argv[i] === "--remote-root" && argv[i + 1]) args.remoteRoot = argv[++i];
    else if (argv[i] === "--outbox" && argv[i + 1]) args.outbox = argv[++i];
    else if (argv[i] === "--zo-computer" && argv[i + 1]) args.zoComputer = argv[++i];
  }
  if (!args.outbox) {
    args.outbox = join(args.remoteRoot, "datasets", "tandem-talkback", "outbox");
  }
  return args;
}

function loadContract(path) {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  const payload = parsed?.transport?.payload || parsed?.payload || "";
  if (!payload) return { envelope: parsed, packet: parsed, transport_domain: "" };
  const decoded = decodePacket(payload);
  return {
    envelope: parsed,
    packet: decoded.packet,
    transport_domain: decoded.domain,
  };
}

function createTalkback({ contractPath, envelope, packet, transportDomain, execution, buildIntake, scopeResolution }) {
  const contractId =
    packet.contract_id ||
    envelope.contract_id ||
    envelope.id ||
    `contract.${Date.now()}`;
  const status = execution.blockers.length ? "blocked" : "done";
  return {
    schema: "refer.talkback.result.v1",
    contract_id: contractId,
    status,
    changed: [],
    evidence: [
      `read_contract:${contractPath}`,
      transportDomain ? `decoded_transport:${transportDomain}` : "read_plain_json",
      "runner:contract-inbox-runner",
      execution.operations.length ? "executor:zo.bounded.v1" : "executor:none",
      ...(scopeResolution?.matched?.length ? ["node_scope:auto_resolved"] : ["node_scope:no_match"]),
      ...(buildIntake ? ["build_intake:recorded", "route_change:typed_intake_required"] : []),
    ],
    blockers: execution.blockers,
    execution,
    node_scope: scopeResolution,
    build_intake: buildIntake,
    next: status === "done" ? "ratify" : "resolve_blockers",
    created_at: new Date().toISOString(),
    summary: buildIntake
      ? "Contract received through Zo Files/API lane. Governed build intake was recorded for future route changes."
      : execution.operations.length
      ? "Contract received through Zo Files/API lane. Bounded non-mutating execution completed."
      : "Contract received through Zo Files/API lane. No bounded execution operations requested.",
  };
}

function recordBuildIntake(packet, args, scopeResolution) {
  const request = packet?.build_intake;
  if (!request) return null;
  const contractId = packet.contract_id || `contract.${Date.now()}`;
  const routes = Array.isArray(request.routes) ? request.routes.map(String) : [];
  const blocked = [];
  if (request.schema !== "refer.zo.build-intake.v1") blocked.push(`unsupported_build_intake_schema:${request.schema || "missing"}`);
  if (!request.change_id) blocked.push("missing_change_id");
  if (!request.summary) blocked.push("missing_summary");
  if (!routes.length) blocked.push("missing_routes");
  if (blocked.length) {
    return {
      schema: "refer.zo.build-intake.result.v1",
      ok: false,
      blockers: blocked,
      activity_path: "",
    };
  }

  const activity = {
    schema: "refer.zo.build-activity.v1",
    contract_id: contractId,
    change_id: request.change_id,
    node: packet.target_node || args.zoComputer || "zo",
    target_instance: packet.target_instance || args.zoComputer || "",
    created_at: new Date().toISOString(),
    source: "contract-inbox-runner",
    authority: "typed_contract",
    mode: packet.mode || request.mode || "BUILD",
    summary: request.summary,
    node_scope: scopeResolution,
    routes,
    route_policy: request.route_policy || "route changes require typed intake before mutation",
    evidence_required: request.evidence_required || [
      "typed intake",
      "talkback",
      "route ratification",
      "usage record",
    ],
    next: request.next || "perform route work only from this contract lane, then return talkback",
  };
  const dir = join(args.remoteRoot, "refer-zo-bootstrap", "datasets", "build-activity", "records");
  mkdirSync(dir, { recursive: true });
  const safeId = String(contractId).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const activityPath = join(dir, `${safeId}.json`);
  writeFileSync(activityPath, `${JSON.stringify(activity, null, 2)}\n`, "utf8");
  return {
    schema: "refer.zo.build-intake.result.v1",
    ok: true,
    change_id: request.change_id,
    routes,
    activity_path: activityPath,
    blockers: [],
  };
}

function resolveNodeScope(packet, args) {
  const scopes = readNodeScopes(args.remoteRoot);
  const active = scopes.filter((scope) => scope.status !== "paused" && scope.status !== "retired");
  const text = scopeText(packet);
  const scored = active
    .map((scope) => ({ scope, score: scoreScope(scope, text) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  const matched = scored.slice(0, 3).map(({ scope, score }) => ({
    scope_id: scope.scope_id,
    label: scope.label,
    status: scope.status,
    confidence: scope.confidence,
    score,
    categories: scope.categories || [],
  }));
  return {
    schema: "refer.zo.node-scope-resolution.v1",
    resolved_at: new Date().toISOString(),
    mode: matched.length ? "auto_matched" : "unscoped",
    matched,
    available_scope_count: active.length,
    rule: "The runner automatically resolves active local node scopes from contract text and records the result in talkback.",
  };
}

function readNodeScopes(remoteRoot) {
  const dirs = [
    join(remoteRoot, "refer-zo-bootstrap", "datasets", "node-scope", "records"),
    join("datasets", "node-scope", "records"),
  ];
  const records = [];
  const seen = new Set();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((entry) => entry.endsWith(".json") && !isSensitiveName(entry))) {
      try {
        const record = JSON.parse(readFileSync(join(dir, name), "utf8"));
        const key = record.scope_id || name;
        if (seen.has(key)) continue;
        seen.add(key);
        records.push(record);
      } catch {
        // Bad scope records should not block contract execution.
      }
    }
  }
  return records;
}

function scopeText(packet) {
  return [
    packet?.contract_id,
    packet?.task,
    packet?.mode,
    ...(Array.isArray(packet?.scope) ? packet.scope : []),
    ...(Array.isArray(packet?.acceptance) ? packet.acceptance : []),
    packet?.build_intake?.summary,
    ...(Array.isArray(packet?.build_intake?.routes) ? packet.build_intake.routes : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreScope(scope, text) {
  let score = 0;
  const fields = [
    scope.scope_id,
    scope.label,
    scope.purpose,
    ...(Array.isArray(scope.categories) ? scope.categories : []),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  for (const field of fields) {
    for (const token of tokenize(field)) {
      if (token.length >= 4 && text.includes(token)) score += 1;
    }
  }
  return score;
}

function tokenize(value) {
  return String(value || "")
    .split(/[^a-z0-9]+/i)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function runBoundedExecution(packet, args) {
  const requested = packet?.execution?.operations || [];
  const execution = {
    schema: "refer.zo.bounded-execution.v1",
    executor: packet?.execution?.executor || "none",
    mode: packet?.execution?.mode || "none",
    operations: [],
    blockers: [],
  };
  if (!requested.length) return execution;
  if (packet?.execution?.executor !== "zo.bounded.v1") {
    execution.blockers.push(`unsupported_executor:${packet?.execution?.executor || "missing"}`);
    return execution;
  }
  if (packet?.execution?.mode !== "non_mutating") {
    execution.blockers.push(`unsupported_mode:${packet?.execution?.mode || "missing"}`);
    return execution;
  }

  for (const operation of requested) {
    try {
      execution.operations.push(runOperation(operation, args.remoteRoot));
    } catch (error) {
      execution.operations.push({
        op: operation?.op || "unknown",
        ok: false,
        error: error?.message || String(error),
      });
      execution.blockers.push(`${operation?.op || "unknown"}:${error?.message || String(error)}`);
    }
  }
  return execution;
}

function runOperation(operation, remoteRoot) {
  const op = operation?.op || "";
  if (op === "echo") {
    return {
      op,
      ok: true,
      text: String(operation.text || ""),
    };
  }
  if (op === "file_exists") {
    const path = safePath(operation.path, remoteRoot);
    return {
      op,
      ok: true,
      path,
      exists: existsSync(path),
    };
  }
  if (op === "list_dir") {
    const path = safePath(operation.path, remoteRoot);
    const stat = statSync(path);
    if (!stat.isDirectory()) throw new Error(`not_directory:${path}`);
    return {
      op,
      ok: true,
      path,
      entries: readdirSync(path, { withFileTypes: true })
        .filter((entry) => !isSensitiveName(entry.name))
        .slice(0, 100)
        .map((entry) => ({
          name: entry.name,
          kind: entry.isDirectory() ? "dir" : entry.isFile() ? "file" : "other",
        })),
    };
  }
  if (op === "read_json") {
    const path = safePath(operation.path, remoteRoot);
    const stat = statSync(path);
    if (!stat.isFile()) throw new Error(`not_file:${path}`);
    const text = readFileSync(path, "utf8");
    if (text.length > 20000) throw new Error(`file_too_large:${path}`);
    return {
      op,
      ok: true,
      path,
      json: JSON.parse(text),
    };
  }
  throw new Error(`unsupported_operation:${op}`);
}

function safePath(path, remoteRoot) {
  const root = resolve(remoteRoot);
  const target = resolve(String(path || ""));
  if (!target.startsWith(`${root}/`) && target !== root) {
    throw new Error(`path_outside_workspace:${target}`);
  }
  if (target.split(/[\\/]/).some(isSensitiveName)) {
    throw new Error(`sensitive_path_refused:${target}`);
  }
  return target;
}

function isSensitiveName(name) {
  return /^\.env/i.test(name) || /(?:secret|credential|private|certificate|token|apikey|api_key)/i.test(name);
}

function writeTalkback(outbox, talkback) {
  mkdirSync(outbox, { recursive: true });
  const id = String(talkback.contract_id).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const jsonPath = join(outbox, `${id}.json`);
  const compressedPath = join(outbox, `${id}.sx1.txt`);
  const compressed = encodePacket("talkback", talkback);
  writeFileSync(jsonPath, `${JSON.stringify(talkback, null, 2)}\n`, "utf8");
  writeFileSync(compressedPath, `${compressed.payload}\n`, "utf8");
  return { jsonPath, compressedPath, compressed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.once || !args.contract) {
    console.error("Usage: node scripts/factory/contract-inbox-runner.mjs --once --contract <path> [--remote-root /home/workspace]");
    process.exit(2);
  }
  const loaded = loadContract(args.contract);
  const scopeResolution = resolveNodeScope(loaded.packet, args);
  const execution = runBoundedExecution(loaded.packet, args);
  const buildIntake = recordBuildIntake(loaded.packet, args, scopeResolution);
  if (buildIntake?.blockers?.length) {
    execution.blockers.push(...buildIntake.blockers.map((blocker) => `build_intake:${blocker}`));
  }
  const talkback = createTalkback({
    contractPath: args.contract,
    envelope: loaded.envelope,
    packet: loaded.packet,
    transportDomain: loaded.transport_domain,
    execution,
    buildIntake,
    scopeResolution,
  });
  const written = writeTalkback(args.outbox, talkback);
  const result = {
    ok: true,
    contract_id: talkback.contract_id,
    outbox_json: written.jsonPath,
    outbox_sx1: written.compressedPath,
  };
  result.token_log = logTokenUse({
    agent: "contract-inbox-runner",
    script: "contract-inbox-runner",
    inputChars: JSON.stringify(loaded.envelope).length,
    outputChars: JSON.stringify(talkback).length,
    status: "done",
    contractId: String(talkback.contract_id),
    zoComputer: args.zoComputer,
    note: "runner read contract and wrote talkback file",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
