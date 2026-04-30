#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs(argv) {
  const args = {
    zoComputer: process.env.ZO_COMPUTER_NAME || "telechurch",
    ledger: "datasets/tandem-usage/token-useage.jsonl",
    summary: "datasets/tandem-usage/token-useage-summary.md",
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--zo-computer" && argv[i + 1]) args.zoComputer = argv[++i];
    else if (argv[i] === "--ledger" && argv[i + 1]) args.ledger = argv[++i];
    else if (argv[i] === "--summary" && argv[i + 1]) args.summary = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
  }
  return args;
}

function readLedger(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeSummary(path, records) {
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
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const args = parseArgs(process.argv.slice(2));
const ledgerPath = resolve(args.ledger);
const summaryPath = resolve(args.summary);
const records = readLedger(ledgerPath);
let changed = 0;
const updated = records.map((record) => {
  if (record.account && record.zo_computer) return record;
  changed += 1;
  return {
    ...record,
    account: record.account || `zo:${args.zoComputer}`,
    zo_computer: record.zo_computer || args.zoComputer,
  };
});

if (!args.dryRun) {
  writeFileSync(
    ledgerPath,
    updated.map((record) => JSON.stringify(record)).join("\n") + (updated.length ? "\n" : ""),
    "utf8",
  );
  writeSummary(summaryPath, updated);
}

console.log(JSON.stringify({ ok: true, changed, zo_computer: args.zoComputer, dry_run: args.dryRun }, null, 2));
