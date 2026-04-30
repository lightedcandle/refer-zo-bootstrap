#!/usr/bin/env node
/**
 * ship-contract-to-zo.mjs
 *
 * Writes a typed contract and its compressed packet to a Zo computer through
 * MCP file APIs. Optional trigger uses run_bash_command, not Zo chat.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import { encodePacket } from "./compression-codec.mjs";
import { logTokenUse } from "./token-log-bridge.mjs";

function parseArgs(argv) {
  const args = {
    instance: "telechurch",
    domain: "zo_task",
    mode: "VERIFY",
    task: "",
    file: "",
    remoteRoot: "/home/workspace",
    localOutbox: "datasets/tandem-contracts/outbox",
    dryRun: false,
    trigger: false,
    triggerCmd: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--instance" && argv[i + 1]) args.instance = argv[++i];
    else if (argv[i] === "--domain" && argv[i + 1]) args.domain = argv[++i];
    else if (argv[i] === "--mode" && argv[i + 1]) args.mode = argv[++i];
    else if (argv[i] === "--task" && argv[i + 1]) args.task = argv[++i];
    else if (argv[i] === "--file" && argv[i + 1]) args.file = argv[++i];
    else if (argv[i] === "--remote-root" && argv[i + 1]) args.remoteRoot = argv[++i];
    else if (argv[i] === "--local-outbox" && argv[i + 1]) args.localOutbox = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--trigger") args.trigger = true;
    else if (argv[i] === "--trigger-cmd" && argv[i + 1]) args.triggerCmd = argv[++i];
  }
  return args;
}

function stamp() {
  return new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
}

function createContract(args) {
  if (args.file) return JSON.parse(readFileSync(args.file, "utf8"));
  const task = args.task.trim();
  if (!task) {
    throw new Error("Provide --task or --file");
  }
  const hash = createHash("sha256").update(task, "utf8").digest("hex");
  return {
    schema: "refer.zo.file_contract.v1",
    contract_id: `zo.file.${stamp()}.${hash.slice(0, 10)}`,
    created_at: new Date().toISOString(),
    owner_factory: "refer-zo-bootstrap",
    authority: "local_source",
    mode: args.mode,
    task,
    scope: ["zo-file-transport", "tandem-contract-inbox", "tandem-talkback-outbox"],
    out_of_scope: ["Zo chat round trip", "secrets", "production mutation"],
    acceptance: [
      "contract is written to Zo Files through MCP",
      "compressed transport round-trips locally",
      "Zo runner writes talkback to file outbox",
    ],
  };
}

function mcpCall(instance, tool, toolArgs) {
  const args64 = Buffer.from(JSON.stringify(toolArgs), "utf8").toString("base64");
  const output = execFileSync(
    process.execPath,
    ["tools/zo-mcp.mjs", "call", tool, "--instance", instance, "--args64", args64, "--json"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  return JSON.parse(output);
}

function writeLocal(outbox, id, envelope, payload) {
  mkdirSync(outbox, { recursive: true });
  const base = String(id).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const jsonPath = join(outbox, `${base}.json`);
  const sxPath = join(outbox, `${base}.sx1.txt`);
  writeFileSync(jsonPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  writeFileSync(sxPath, `${payload}\n`, "utf8");
  return { jsonPath, sxPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = createContract(args);
  const encoded = encodePacket(args.domain, contract);
  const decodedProbe = encoded.payload;
  const envelope = {
    schema: "refer.zo.file_transport.envelope.v1",
    contract_id: contract.contract_id || contract.id,
    created_at: new Date().toISOString(),
    domain: args.domain,
    contract,
    transport: encoded,
  };

  const id = envelope.contract_id || basename(args.file || "contract");
  const safeId = String(id).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const remoteInbox = `${args.remoteRoot.replace(/\/$/, "")}/datasets/tandem-contracts/inbox`;
  const remoteJson = `${remoteInbox}/${safeId}.json`;
  const remoteSx = `${remoteInbox}/${safeId}.sx1.txt`;
  const local = writeLocal(args.localOutbox, safeId, envelope, decodedProbe);

  const writeJson = args.dryRun
    ? { ok: true, dry_run: true }
    : mcpCall(args.instance, "create_or_rewrite_file", {
        target_file: remoteJson,
        content: `${JSON.stringify(envelope, null, 2)}\n`,
      });
  const writeSx = args.dryRun
    ? { ok: true, dry_run: true }
    : mcpCall(args.instance, "create_or_rewrite_file", {
        target_file: remoteSx,
        content: `${encoded.payload}\n`,
      });

  let trigger = null;
  if (args.trigger && !args.dryRun) {
    const command =
      args.triggerCmd ||
      `cd ${args.remoteRoot}/refer-zo-bootstrap && node scripts/factory/contract-inbox-runner.mjs --once --contract ${remoteJson} --zo-computer ${args.instance}`;
    trigger = mcpCall(args.instance, "run_bash_command", { cmd: command });
  }

  const result = {
    ok: Boolean(writeJson.ok && writeSx.ok && (!trigger || trigger.ok)),
    dry_run: args.dryRun,
    instance: args.instance,
    contract_id: id,
    remote_json: remoteJson,
    remote_sx1: remoteSx,
    local_json: local.jsonPath,
    local_sx1: local.sxPath,
    compression: encoded.stats,
    trigger,
  };
  result.token_log = logTokenUse({
    agent: "ship-contract-to-zo",
    script: "ship-contract-to-zo",
    inputChars: JSON.stringify(envelope).length,
    outputChars: JSON.stringify(result).length,
    status: result.ok ? "done" : "failed",
    contractId: String(id),
    zoComputer: args.instance,
    note: args.dryRun
      ? "dry-run contract ship; no Zo API mutation"
      : args.trigger
        ? "contract shipped through Zo Files and runner triggered"
        : "contract shipped through Zo Files",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
