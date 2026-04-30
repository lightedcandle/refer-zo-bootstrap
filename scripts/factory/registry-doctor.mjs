#!/usr/bin/env node
/**
 * registry-doctor.mjs
 *
 * Audits the active Script Factory registry and writes a health report. It is
 * intentionally conservative: it does not invent working implementations. It
 * records missing executables and can create not-implemented placeholders so
 * future intake has a durable local artifact to improve.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry, saveNormalizedRegistry } from "./local-script-registry.mjs";
import { logTokenUse } from "./token-log-bridge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const REPORT_DIR = resolve(REPO_ROOT, "datasets", "script-registry", "health");

function parseArgs(argv) {
  const args = { repair: false, json: false };
  for (const arg of argv) {
    if (arg === "--repair") args.repair = true;
    else if (arg === "--json") args.json = true;
  }
  return args;
}

function audit(args) {
  const registry = loadRegistry();
  const normalizedPath = saveNormalizedRegistry(registry);
  const findings = registry.records.map((record) => inspectRecord(record, args));
  const report = {
    schema: "refer.zo.script-registry-health.v1",
    ok: findings.every((finding) => finding.ok || finding.severity !== "blocking"),
    created_at: new Date().toISOString(),
    normalized_path: normalizedPath,
    record_count: registry.records.length,
    missing_executable_count: findings.filter((finding) => finding.code === "missing_executable").length,
    repaired_count: findings.filter((finding) => finding.repaired).length,
    findings,
  };
  mkdirSync(REPORT_DIR, { recursive: true });
  const path = resolve(REPORT_DIR, `registry-health-${Date.now()}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const output = { ok: report.ok, report_path: path, report };
  output.token_log = logTokenUse({
    agent: "registry-doctor",
    script: "registry-doctor",
    inputChars: JSON.stringify(registry).length,
    outputChars: JSON.stringify(report).length,
    status: report.ok ? "done" : "blocked",
    note: args.repair ? "audited registry and created placeholders" : "audited registry",
  });
  return output;
}

function inspectRecord(record, args) {
  if (record.type === "gate" || record.type === "utility") {
    return { ok: true, severity: "info", code: "non_executable_record", id: record.id, type: record.type };
  }
  if (record.requires_ai) {
    return { ok: true, severity: "warning", code: "requires_ai", id: record.id };
  }
  if (!record.script_file) {
    return { ok: false, severity: "warning", code: "missing_script_file", id: record.id };
  }
  const path = resolve(REPO_ROOT, record.script_file);
  if (existsSync(path)) {
    return { ok: true, severity: "info", code: "executable_present", id: record.id, path };
  }
  if (!args.repair) {
    return { ok: false, severity: "warning", code: "missing_executable", id: record.id, path };
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    [
      "#!/usr/bin/env node",
      "/**",
      ` * ${record.id}.mjs`,
      " * Registry-doctor placeholder. Implement before enabling production execution.",
      " */",
      "",
      `console.error(JSON.stringify({ ok: false, status: "not_implemented", script: ${JSON.stringify(record.id)} }));`,
      "process.exit(3);",
      "",
    ].join("\n"),
    "utf8",
  );
  return { ok: true, severity: "warning", code: "missing_executable", id: record.id, path, repaired: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = audit(args);
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
