#!/usr/bin/env node
/**
 * @opcodes ['PARSE_ARGS', 'ROUTE_COMMAND']
 * @trigger list scan run capture
 * @description CLI entry point that routes commands to local Script Factory forges.
 * @forge-type orchestrator
 * @forge-name Factory CLI
 * @forge-id factory-cli
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { intake } from "./compress-prompt.mjs";
import { loadRegistry, matchScript, saveNormalizedRegistry } from "./local-script-registry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

function parseArgs(argv) {
  return {
    command: argv[0] || "help",
    rest: argv.slice(1),
  };
}

function runNode(script, args = []) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120000,
  });
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cleanRest = args.rest.filter((item) => !item.startsWith("--"));
  const prompt = [args.command, ...cleanRest].join(" ").trim();

  switch (args.command) {
    case "list": {
      const registry = loadRegistry();
      saveNormalizedRegistry(registry);
      printJson({ ok: true, count: registry.records.length, records: registry.records });
      return;
    }
    case "match": {
      const registry = loadRegistry();
      printJson({ ok: true, prompt: cleanRest.join(" "), match: matchScript(cleanRest.join(" "), registry) });
      return;
    }
    case "scan": {
      const script = resolve(HERE, "artifacts", "scan-workspace.mjs");
      process.stdout.write(runNode(script, ["--contract-json", JSON.stringify({ prompt: "scan workspace" })]));
      return;
    }
    case "heartbeat": {
      process.stdout.write(runNode(resolve(HERE, "heartbeat.mjs"), args.rest));
      return;
    }
    case "registry": {
      process.stdout.write(runNode(resolve(HERE, "local-script-registry.mjs"), args.rest));
      return;
    }
    case "doctor": {
      process.stdout.write(runNode(resolve(HERE, "registry-doctor.mjs"), args.rest));
      return;
    }
    case "promote-drafts": {
      process.stdout.write(runNode(resolve(HERE, "draft-promotion-runner.mjs"), args.rest.length ? args.rest : ["--all"]));
      return;
    }
    case "help":
    case "--help":
    case "-h": {
      printHelp();
      return;
    }
    default: {
      if (!prompt) {
        printHelp();
        return;
      }
      const registry = loadRegistry();
      const matched = matchScript(prompt, registry);
      const legacy = intake(prompt);
      printJson({
        ok: true,
        prompt,
        matched: matched?.record || null,
        intake: legacy,
        next: matched?.record?.script_file && existsSync(resolve(REPO_ROOT, matched.record.script_file))
          ? `run ${matched.record.script_file}`
          : "promote or scaffold a script gap",
      });
    }
  }
}

function printHelp() {
  console.log(`Script Factory CLI

Usage:
  node scripts/factory/factory.mjs list
  node scripts/factory/factory.mjs match "scan workspace"
  node scripts/factory/factory.mjs scan
  node scripts/factory/factory.mjs heartbeat --status
  node scripts/factory/factory.mjs doctor --json
  node scripts/factory/factory.mjs promote-drafts --all
  node scripts/factory/factory.mjs "<prompt>"
`);
}

main().catch((error) => {
  console.error(error?.stderr?.toString?.() || error?.message || String(error));
  process.exit(1);
});
