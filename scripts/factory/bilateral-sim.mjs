#!/usr/bin/env node
/**
 * bilateral-sim.mjs
 *
 * Non-mutating factory simulation for comparing direct chat handling against
 * typed-contract plus compressed transport handling.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodePacket, encodePacket, toSexprPreview } from "./compression-codec.mjs";

function parseArgs(argv) {
  const args = { prompt: "", write: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--prompt" && argv[i + 1]) args.prompt = argv[++i];
    else if (argv[i] === "--write") args.write = true;
    else args.prompt = [args.prompt, argv[i]].filter(Boolean).join(" ");
  }
  if (!args.prompt.trim()) {
    args.prompt =
      "verify the Telechurch Zo bootstrap install without mutating live files";
  }
  return args;
}

function classifyMode(prompt) {
  const p = prompt.trim().toLowerCase();
  if (/^(discuss|explain|compare|review)\b/.test(p)) return "DISCUSS";
  if (/^(verify|check|audit|inspect)\b/.test(p)) return "VERIFY";
  if (/^(build|ship|deploy|execute|run)\b/.test(p)) return "BUILD";
  if (/^(fix|add|update|remove|delete)\b/.test(p)) return "MICRO";
  return "PLAN";
}

function classifyRisk(prompt) {
  const p = prompt.toLowerCase();
  const liveMutation = /\b(deploy|publish|send|delete|remove|bill|charge|invite|disable|write|edit|mutate)\b/.test(p);
  const toolChain = /\b(scan|find|grep|recursive|all files|sync|bootstrap|mcp|zo)\b/.test(p);
  if (liveMutation) return { risk: "high", reason: "possible-live-mutation" };
  if (toolChain) return { risk: "medium", reason: "tool-or-remote-chain" };
  return { risk: "low", reason: "bounded-or-discussion" };
}

function chooseOwner(prompt) {
  const p = prompt.toLowerCase();
  if (/\b(zo|telechurch|hive|bootstrap|persona|rules|mcp|talkback|heartbeat)\b/.test(p)) {
    return "refer-zo-bootstrap";
  }
  if (/\b(vscode|codex|extension|refer-script-factory)\b/.test(p)) {
    return "refer-script-factory";
  }
  return "current-chat";
}

function createContract(prompt) {
  const normalized = prompt.trim();
  const hash = createHash("sha256").update(normalized, "utf8").digest("hex");
  const stamp = new Date().toISOString();
  const mode = classifyMode(normalized);
  const risk = classifyRisk(normalized);
  const owner = chooseOwner(normalized);
  const contractId = `factory.sim.${stamp.replace(/[-:.]/g, "").replace("Z", "Z")}.${hash.slice(0, 10)}`;

  return {
    schema: "refer.factory.simulation.v1",
    contract_id: contractId,
    created_at: stamp,
    raw_input_sha256: hash,
    raw_input_chars: normalized.length,
    owner_factory: owner,
    mode,
    risk: risk.risk,
    risk_reason: risk.reason,
    intent: normalized.slice(0, 180),
    constraints: [
      "non-mutating simulation",
      "typed contract is source of truth",
      "compressed transport is derived only",
      "talkback must report gaps",
    ],
    acceptance: [
      "direct path and contract path are visible",
      "transport payload is derived from contract",
      "learning packet names next script/doc improvement",
    ],
  };
}

function simulate(prompt) {
  const contract = createContract(prompt);
  const transport = encodePacket("factory_sim", contract);
  const decoded = decodePacket(transport.payload);

  return {
    direct_path: {
      lane: "current-chat-direct",
      prompt,
      cost: "highest-context-loss",
      risk: "manual work may not train either factory",
    },
    contracted_path: {
      lane: "typed-contract-to-compressed-transport",
      contract,
      transport: {
        ...transport,
        sexpr_preview: toSexprPreview("factory_sim", contract),
        roundtrip_ok: JSON.stringify(decoded.packet) === JSON.stringify(contract),
      },
    },
    zo_path_stub: {
      lane: "zo-intake-automation",
      target: "Telechurch Zo or selected hive node",
      expected_input: transport.payload,
      expected_output: "talkback packet with status, evidence, gaps, and next script candidate",
      mutation: "none in simulation",
    },
    learning_packet: {
      kind: "factory-learning",
      should_create_or_update: [
        "typed intake contract schema",
        "transport compression adapter",
        "talkback result schema",
        "automation lane that processes queued contracts",
      ],
      next_best_script: "dispatch-contract.mjs",
    },
  };
}

const args = parseArgs(process.argv.slice(2));
const result = simulate(args.prompt);
const output = `${JSON.stringify(result, null, 2)}\n`;
process.stdout.write(output);

if (args.write) {
  const dir = join(process.cwd(), "datasets", "chat-contracts", "simulations");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${result.contracted_path.contract.contract_id}.json`);
  writeFileSync(file, output, "utf8");
  process.stderr.write(`Wrote simulation: ${file}\n`);
}
