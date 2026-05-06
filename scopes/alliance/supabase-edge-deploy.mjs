#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const defaultEnvFile = "E:\\telechurch-e2e\\.env.master";
const defaultTelechurchRoot = "E:\\telechurch-e2e";
const functionName = "alliance-record-write";
const sourceFunction = resolve("scopes", "alliance", "supabase", "functions", functionName, "index.ts");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "supabase");

function parseArgs(argv) {
  const args = { envFile: defaultEnvFile, telechurchRoot: defaultTelechurchRoot, deploy: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--env-file" && argv[i + 1]) args.envFile = argv[++i];
    else if (argv[i] === "--telechurch-root" && argv[i + 1]) args.telechurchRoot = argv[++i];
    else if (argv[i] === "--deploy") args.deploy = true;
  }
  return args;
}

function parseEnv(path) {
  const env = {};
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function projectRef(url) {
  return String(url || "").match(/https?:\/\/([^.]+)\.supabase\.co/i)?.[1] || "";
}

function run(command, args, options) {
  const exe = process.platform === "win32" && command === "npx" ? "npx.cmd" : command;
  const result = spawnSync(exe, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  });
  return {
    status: result.status,
    ok: result.status === 0,
    stdout: scrub(result.stdout || ""),
    stderr: scrub(result.stderr || ""),
  };
}

function scrub(text) {
  return text
    .replace(/SERVICE_ROLE_KEY=[^\s]+/g, "SERVICE_ROLE_KEY=[redacted]")
    .replace(/SUPABASE_SERVICE_ROLE_KEY=[^\s]+/g, "SUPABASE_SERVICE_ROLE_KEY=[redacted]")
    .trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(sourceFunction)) throw new Error(`Missing source function: ${sourceFunction}`);
  if (!existsSync(args.envFile)) throw new Error(`Missing env file: ${args.envFile}`);
  if (!existsSync(args.telechurchRoot)) throw new Error(`Missing Telechurch root: ${args.telechurchRoot}`);

  const envMaster = parseEnv(args.envFile);
  const ref = projectRef(envMaster.SUPABASE_URL);
  const serviceRole = envMaster.SERVICE_ROLE_KEY || envMaster.SUPABASE_SERVICE_ROLE_KEY;
  if (!ref || !serviceRole || !envMaster.SUPABASE_ACCESS_TOKEN) {
    throw new Error("Missing Supabase project ref, service role key, or access token.");
  }

  const targetFunction = resolve(args.telechurchRoot, "supabase", "functions", functionName, "index.ts");
  await mkdir(dirname(targetFunction), { recursive: true });
  await copyFile(sourceFunction, targetFunction);

  const tempDir = resolve(args.telechurchRoot, ".refer-temp");
  const tempEnv = resolve(tempDir, "alliance-edge-secrets.env");
  mkdirSync(tempDir, { recursive: true });
  await writeFile(tempEnv, `SERVICE_ROLE_KEY=${serviceRole}\nSUPABASE_SERVICE_ROLE_KEY=${serviceRole}\n`, "utf8");

  const deployEnv = { ...process.env, SUPABASE_ACCESS_TOKEN: envMaster.SUPABASE_ACCESS_TOKEN };
  const results = [];
  if (args.deploy) {
    results.push({
      step: "secrets_set",
      ...run("npx", ["supabase", "secrets", "set", "--project-ref", ref, "--env-file", tempEnv], {
        cwd: args.telechurchRoot,
        env: deployEnv,
      }),
    });
    results.push({
      step: "functions_deploy",
      ...run("npx", ["supabase", "functions", "deploy", functionName, "--project-ref", ref], {
        cwd: args.telechurchRoot,
        env: deployEnv,
      }),
    });
  }
  await rm(tempEnv, { force: true });
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  const packet = {
    schema: "refer.alliance.supabase-edge-deploy.v1",
    generated_at: new Date().toISOString(),
    function_name: functionName,
    project_ref: ref,
    source_function: sourceFunction,
    telechurch_function: targetFunction,
    deployed: args.deploy,
    results,
    secret_values_printed: false,
    verdict: !args.deploy || results.every((item) => item.ok) ? "edge_function_ready" : "edge_function_deploy_failed",
  };
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "supabase-edge-deploy-latest.json");
  writeFileSync(outPath, JSON.stringify(packet, null, 2));
  console.log(JSON.stringify({ ok: packet.verdict === "edge_function_ready", packet_path: outPath, packet }, null, 2));
  if (packet.verdict !== "edge_function_ready") process.exit(1);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
