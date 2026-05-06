#!/usr/bin/env node
/**
 * route-manifest-bridge.mjs
 *
 * Generic Codex-to-Zo bridge for route injection manifests. The bridge can run
 * an optional scoped manifest command, reads generated manifests from a local
 * directory, and applies each manifest to the matching Zo Space route through
 * MCP. App-specific manifest generation must live outside the generic factory
 * runtime.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { logTokenUse } from "./token-log-bridge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const MCP = resolve(REPO_ROOT, "tools", "zo-mcp.mjs");
const RECORD_DIR = resolve(REPO_ROOT, "datasets", "build-activity", "records");

function parseArgs(argv) {
  const args = {
    instance: "alliance",
    route: "",
    dryRun: false,
    json: false,
    manifestDir: resolve(REPO_ROOT, "datasets", "script-artifacts", "route-manifests"),
    manifestCommand: "",
    manifestCwd: REPO_ROOT,
    remoteManifestCommand: "",
    remoteManifestCwd: "/home/workspace",
    recordLabel: "route-manifest-bridge",
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--instance" && argv[i + 1]) args.instance = argv[++i];
    else if (argv[i] === "--route" && argv[i + 1]) args.route = argv[++i];
    else if (argv[i] === "--manifest-dir" && argv[i + 1]) args.manifestDir = resolve(argv[++i]);
    else if (argv[i] === "--manifest-command" && argv[i + 1]) args.manifestCommand = argv[++i];
    else if (argv[i] === "--manifest-cwd" && argv[i + 1]) args.manifestCwd = resolve(argv[++i]);
    else if (argv[i] === "--remote-manifest-command" && argv[i + 1]) args.remoteManifestCommand = argv[++i];
    else if (argv[i] === "--remote-manifest-cwd" && argv[i + 1]) args.remoteManifestCwd = argv[++i];
    else if (argv[i] === "--record-label" && argv[i + 1]) args.recordLabel = argv[++i].replace(/[^a-z0-9_.-]/gi, "-");
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

function args64(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function mcp(instance, tool, params, timeoutMs = 60000) {
  const raw = execFileSync(
    process.execPath,
    [MCP, "call", tool, "--instance", instance, "--args64", args64(params), "--json", "--timeout-ms", String(timeoutMs)],
    { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const parsed = JSON.parse(raw);
  if (!parsed.ok) throw new Error(`${tool} failed: ${raw.slice(0, 500)}`);
  return parsed;
}

function toolText(result) {
  const content = result?.result?.result?.content || result?.result?.content || [];
  return content.map((item) => item.text || "").join("\n");
}

function decodeRoute(text) {
  const marker = " code='";
  const start = text.indexOf(marker);
  const end = text.lastIndexOf("' public=");
  if (start < 0 || end < 0 || end <= start) throw new Error("Could not parse route code from get_space_route output.");
  const prefix = text.slice(0, start);
  const pathMatch = prefix.match(/path='([^']+)'/);
  const publicMatch = text.slice(end).match(/public=(True|False)/);
  const encoded = text.slice(start + marker.length, end);
  return {
    path: pathMatch?.[1] || "",
    public: publicMatch?.[1] === "True",
    code: encoded
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\"),
  };
}

function readRoute(instance, route) {
  return decodeRoute(toolText(mcp(instance, "get_space_route", { path: route })));
}

function replaceOrInsertBlock(code, manifest) {
  const startMarker = manifest.start_marker || `{/* --- ROUTE_MANIFEST:${manifest.slug}:START --- */}`;
  const endMarker = manifest.end_marker || `{/* --- ROUTE_MANIFEST:${manifest.slug}:END --- */}`;
  const block = manifest.modal_jsx || manifest.jsx || manifest.block;
  if (!block) throw new Error(`Manifest ${manifest.slug || manifest.route} is missing modal_jsx/jsx/block.`);
  if (code.includes(startMarker) && code.includes(endMarker)) {
    const start = code.indexOf(startMarker);
    const end = code.indexOf(endMarker, start) + endMarker.length;
    return `${code.slice(0, start)}${block}${code.slice(end)}`;
  }

  const fallbackMarker = manifest.replace_from_marker || "{/* --- PHASE5_GATE: auth_required --- */}";
  const finalClose = manifest.before_final_close || "\n    </div>\n  );";
  if (code.includes(fallbackMarker)) {
    const start = code.lastIndexOf(fallbackMarker);
    const end = code.lastIndexOf(finalClose);
    if (end > start) return `${code.slice(0, start)}${block}${code.slice(end)}`;
  }
  const end = code.lastIndexOf(finalClose);
  if (end < 0) throw new Error(`Could not find route insertion point for ${manifest.route}`);
  return `${code.slice(0, end)}\n      ${block}${code.slice(end)}`;
}

function insertAfterFunctionStart(code, block) {
  const match = code.match(/export default function [^{]+{\n/);
  if (!match?.index && match?.index !== 0) throw new Error("Could not find default function start.");
  const pos = match.index + match[0].length;
  return `${code.slice(0, pos)}  ${block}\n${code.slice(pos)}`;
}

function patchRoute(code, manifest) {
  const entity = manifest.entity || manifest.slug;
  let next = code;
  if (manifest.state_var && !next.includes(manifest.state_probe || `show${entity}Modal`)) {
    next = insertAfterFunctionStart(next, manifest.state_var);
  }
  if (manifest.functions && !next.includes(manifest.function_probe || `function openCreate${entity}`)) {
    const returnPos = next.indexOf("\n  return (");
    if (returnPos < 0) throw new Error("Could not find return block.");
    next = `${next.slice(0, returnPos)}\n${manifest.functions}\n${next.slice(returnPos)}`;
  }
  if (manifest.button && !next.includes(manifest.button_probe || `onClick={openCreate${entity}}`)) {
    const buttonPattern = /(<\/div>\n\s*)({\/\* [^*]*Overview \*\/}|<div className="bg-zinc-900)/;
    next = next.replace(buttonPattern, `${manifest.button}\n        $1$2`);
  }
  return replaceOrInsertBlock(next, manifest);
}

function runCommand(command, cwd) {
  if (!command) return "";
  return execFileSync(command, { cwd, encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] });
}

function runRemoteCommand(instance, command, cwd) {
  if (!command) return "";
  return toolText(mcp(instance, "run_bash_command", { cmd: command, cwd }, 120000));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadManifests(dir, routeFilter) {
  const batchPath = resolve(dir, "batch-manifest.json");
  if (existsSync(batchPath)) {
    const batch = readJson(batchPath);
    const entries = (batch.entities || batch.manifests || [])
      .filter((entry) => !routeFilter || entry.route === routeFilter);
    return entries.map((entry) => {
      const file = entry.manifest_file || entry.file || `${entry.slug || slugFor(entry.name)}-manifest.json`;
      return readJson(resolve(dir, file));
    });
  }
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json") && file !== "batch-manifest.json")
    .map((file) => readJson(resolve(dir, file)))
    .filter((manifest) => !routeFilter || manifest.route === routeFilter);
}

function slugFor(name = "") {
  const map = {
    Organization: "org",
    Person: "person",
    Event: "event",
    Initiative: "initiative",
    Document: "doc",
    GovernanceItem: "governance",
    ComplianceTask: "compliance",
    Communication: "comm",
  };
  return map[name] || String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function applyRoute(instance, manifest, dryRun) {
  const route = readRoute(instance, manifest.route);
  const patched = patchRoute(route.code, manifest);
  const changed = patched !== route.code;
  if (!dryRun && changed) {
    mcp(instance, "write_space_route", {
      path: manifest.route,
      route_type: "page",
      public: route.public ? "true" : "false",
      code: patched,
    }, 120000);
  }
  return { route: manifest.route, entity: manifest.entity || manifest.slug || "", changed, public: route.public };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const localOutput = runCommand(args.manifestCommand, args.manifestCwd);
  const remoteOutput = runRemoteCommand(args.instance, args.remoteManifestCommand, args.remoteManifestCwd);
  const manifests = loadManifests(args.manifestDir, args.route);
  if (!manifests.length) throw new Error(`No route manifests found in ${args.manifestDir}`);

  const results = manifests.map((manifest) => applyRoute(args.instance, manifest, args.dryRun));
  const record = {
    schema: "refer.zo.route-manifest-bridge.v1",
    created_at: new Date().toISOString(),
    instance: args.instance,
    dry_run: args.dryRun,
    manifest_dir: args.manifestDir,
    manifest_command: args.manifestCommand || "",
    remote_manifest_command: args.remoteManifestCommand || "",
    local_manifest_output: localOutput ? localOutput.slice(0, 1000) : "",
    remote_manifest_output: remoteOutput ? remoteOutput.slice(0, 1000) : "",
    results,
    evidence: ["route_manifest:loaded", args.dryRun ? "route_write:dry_run" : "route_write:applied"],
  };
  if (!existsSync(RECORD_DIR)) mkdirSync(RECORD_DIR, { recursive: true });
  const recordPath = resolve(RECORD_DIR, `${args.recordLabel}-${Date.now()}.json`);
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  record.record_path = recordPath;
  record.token_log = logTokenUse({
    agent: "route-manifest-bridge",
    script: "route-manifest-bridge",
    inputChars: JSON.stringify(args).length,
    outputChars: JSON.stringify(record).length,
    status: "done",
    zoComputer: args.instance,
    note: "route manifests applied to Zo routes through generic factory bridge",
  });
  console.log(JSON.stringify(record, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
