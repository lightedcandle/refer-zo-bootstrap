import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT_TOKEN_SCRIPT = resolve(HERE, "..", "..", "..", "scripts", "chat-surface", "token-useage.mjs");
const LOCAL_REPO_ROOT = resolve(HERE, "..", "..");
const LOCAL_LEDGER = resolve(LOCAL_REPO_ROOT, "datasets", "tandem-usage", "token-useage.jsonl");
const LOCAL_SUMMARY = resolve(LOCAL_REPO_ROOT, "datasets", "tandem-usage", "token-useage-summary.md");

export function logTokenUse({
  lane = "zo_bootstrap_spawned_agent",
  agent = "refer-zo-bootstrap",
  agentId = "",
  parent = "current_chat_window",
  account = process.env.REFER_TOKEN_ACCOUNT || process.env.CODEX_ACCOUNT || "",
  zoComputer = "",
  inputChars = 0,
  outputChars = 0,
  source = "estimated",
  status = "done",
  note = "",
  contractId = "",
  script = "",
} = {}) {
  if (!existsSync(ROOT_TOKEN_SCRIPT)) {
    return logLocalTokenUse({
      lane,
      agent: script ? `Script ${script}` : agent,
      agent_id: agentId,
      parent,
      account: account || (zoComputer ? `zo:${zoComputer}` : ""),
      zo_computer: zoComputer,
      input_chars: inputChars,
      output_chars: outputChars,
      source,
      status,
      note,
      contract_id: contractId,
    });
  }
  const args = [
    ROOT_TOKEN_SCRIPT,
    "log",
    "--lane",
    lane,
    "--agent",
    agent,
    "--parent",
    parent,
    "--input-chars",
    String(inputChars),
    "--output-chars",
    String(outputChars),
    "--source",
    source,
    "--status",
    status,
  ];
  if (agentId) args.push("--agent-id", agentId);
  if (script) args.push("--script", script);
  if (account) args.push("--account", account);
  if (zoComputer) args.push("--zo-computer", zoComputer);
  if (note) args.push("--note", note);
  if (contractId) args.push("--contract-id", contractId);
  try {
    const output = execFileSync(process.execPath, args, {
      cwd: resolve(HERE, "..", "..", ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: JSON.parse(output) };
  } catch (error) {
    return {
      ok: false,
      error: error?.stderr?.toString?.().slice(0, 500) || error?.message || String(error),
    };
  }
}

function logLocalTokenUse(record) {
  const output = {
    ts: new Date().toISOString(),
    lane: record.lane,
    lane_label: labelForLane(record.lane),
    agent: record.agent,
    agent_id: record.agent_id || "",
    account: record.account || "",
    zo_computer: record.zo_computer || "",
    parent: record.parent || "",
    input_tokens: estimateTokens(record.input_chars),
    output_tokens: estimateTokens(record.output_chars),
    total_tokens: estimateTokens(record.input_chars) + estimateTokens(record.output_chars),
    input_chars: Number(record.input_chars || 0),
    output_chars: Number(record.output_chars || 0),
    source: record.source || "estimated",
    status: record.status || "done",
    contract_id: record.contract_id || "",
    note: record.note || "",
  };
  mkdirSync(dirname(LOCAL_LEDGER), { recursive: true });
  appendFileSync(LOCAL_LEDGER, `${JSON.stringify(output)}\n`, "utf8");
  writeLocalSummary(readLocalLedger());
  return { ok: true, local: true, ledger: LOCAL_LEDGER, output };
}

function readLocalLedger() {
  if (!existsSync(LOCAL_LEDGER)) return [];
  return readFileSync(LOCAL_LEDGER, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeLocalSummary(records) {
  const totals = records.reduce(
    (acc, record) => {
      acc.calls += 1;
      acc.input_tokens += Number(record.input_tokens || 0);
      acc.output_tokens += Number(record.output_tokens || 0);
      acc.total_tokens += Number(record.total_tokens || 0);
      return acc;
    },
    { calls: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  );
  const recent = records.slice(-12).reverse();
  const lines = [
    "# Zo Tandem Usage",
    "",
    "Estimate rule: 4 characters = 1 token.",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Totals",
    "",
    `- Calls: ${totals.calls}`,
    `- Input: ${totals.input_tokens}`,
    `- Output: ${totals.output_tokens}`,
    `- Total: ${totals.total_tokens}`,
    "",
    "## Recent",
    "",
    "| Time | Agent | Account | In | Out | Status | Note |",
    "|---|---|---|---:|---:|---|---|",
    ...recent.map((record) =>
      `| ${record.ts} | ${escapeCell(record.agent)} | ${escapeCell(record.account)} | ${record.input_tokens} | ${record.output_tokens} | ${escapeCell(record.status)} | ${escapeCell(record.note || record.contract_id)} |`,
    ),
    "",
  ];
  writeFileSync(LOCAL_SUMMARY, `${lines.join("\n")}\n`, "utf8");
}

function estimateTokens(chars) {
  return Math.ceil(Math.max(Number(chars || 0), 0) / 4);
}

function labelForLane(lane) {
  const labels = {
    script_factory_spawned_agent: "Script Factory spawned agent",
    zo_bootstrap_spawned_agent: "Zo Bootstrap spawned agent",
    current_chat_window: "Current Chat window",
    zo_local_chat: "Zo local chat",
  };
  return labels[lane] || lane;
}

function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
