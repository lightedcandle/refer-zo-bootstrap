#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const defaultEnvFile = "E:\\telechurch-e2e\\.env.master";
const defaultNodeModulesRoot = "E:\\telechurch-e2e";
const defaultTelechurchRoot = "E:\\telechurch-e2e";
const defaultBridgeEnv = resolve("..", "alliance-android-sms-bridge", ".env.local");
const functionName = "alliance-sms-relay";
const migrationPath = resolve("scopes", "alliance", "supabase", "002_alliance_sms_relay.sql");
const sourceFunction = resolve("scopes", "alliance", "supabase", "functions", functionName, "index.ts");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "supabase");

function parseArgs(argv) {
  const args = {
    envFile: defaultEnvFile,
    nodeModulesRoot: defaultNodeModulesRoot,
    telechurchRoot: defaultTelechurchRoot,
    bridgeEnv: defaultBridgeEnv,
    apply: false,
    deploy: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--env-file" && argv[i + 1]) args.envFile = argv[++i];
    else if (argv[i] === "--node-modules-root" && argv[i + 1]) args.nodeModulesRoot = argv[++i];
    else if (argv[i] === "--telechurch-root" && argv[i + 1]) args.telechurchRoot = argv[++i];
    else if (argv[i] === "--bridge-env" && argv[i + 1]) args.bridgeEnv = argv[++i];
    else if (argv[i] === "--apply") args.apply = true;
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

function projectRef(url) {
  return String(url || "").match(/https?:\/\/([^.]+)\.supabase\.co/i)?.[1] || "";
}

function run(command, args, options) {
  const exe = command;
  const result = spawnSync(exe, args, {
    cwd: options.cwd,
    env: cleanEnv(options.env),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return {
    status: result.status,
    ok: result.status === 0,
    stdout: scrub(result.stdout || ""),
    stderr: scrub(result.stderr || ""),
    error: result.error?.message,
  };
}

function cleanEnv(env) {
  return Object.fromEntries(
    Object.entries(env || process.env)
      .filter((entry) => typeof entry[1] === "string")
      .map(([key, value]) => [key, value]),
  );
}

function scrub(text) {
  return text
    .replace(/SERVICE_ROLE_KEY=[^\s]+/g, "SERVICE_ROLE_KEY=[redacted]")
    .replace(/ALLIANCE_SMS_RELAY_TOKEN=[^\s]+/g, "ALLIANCE_SMS_RELAY_TOKEN=[redacted]")
    .trim();
}

function assertSafeMigration(sql) {
  const forbidden = /\b(drop\s+(table|schema|database)|truncate|delete\s+from)\b/i;
  if (forbidden.test(sql)) throw new Error("Refusing migration with destructive SQL.");
}

async function applyMigration(args, ref, envMaster, packet) {
  const sql = readFileSync(migrationPath, "utf8");
  assertSafeMigration(sql);
  const require = createRequire(resolve(args.nodeModulesRoot, "package.json"));
  const { Client } = require("pg");
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: envMaster.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    const verify = await client.query(`
      select
        to_regclass('public.alliance_sms_outbox') is not null as outbox_exists,
        to_regclass('public.alliance_sms_inbox') is not null as inbox_exists,
        to_regclass('public.alliance_sms_delivery_events') is not null as events_exists,
        (select relrowsecurity from pg_class where oid = 'public.alliance_sms_outbox'::regclass) as outbox_rls,
        (select relrowsecurity from pg_class where oid = 'public.alliance_sms_inbox'::regclass) as inbox_rls,
        (select relrowsecurity from pg_class where oid = 'public.alliance_sms_delivery_events'::regclass) as events_rls
    `);
    packet.migration = { applied: true, verification: verify.rows[0] };
    packet.evidence.push("sms_migration:applied");
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.envFile)) throw new Error(`Missing env file: ${args.envFile}`);
  if (!existsSync(args.telechurchRoot)) throw new Error(`Missing Telechurch root: ${args.telechurchRoot}`);
  if (!existsSync(sourceFunction)) throw new Error(`Missing source function: ${sourceFunction}`);
  if (!existsSync(migrationPath)) throw new Error(`Missing migration: ${migrationPath}`);

  const envMaster = parseEnv(args.envFile);
  const bridgeEnv = existsSync(args.bridgeEnv) ? parseEnv(args.bridgeEnv) : {};
  const ref = projectRef(envMaster.SUPABASE_URL);
  const serviceRole = envMaster.SERVICE_ROLE_KEY || envMaster.SUPABASE_SERVICE_ROLE_KEY;
  const relayToken = bridgeEnv.ALLIANCE_DISPATCHER_TOKEN || envMaster.ALLIANCE_SMS_RELAY_TOKEN;
  const bridgePhoneNumber = bridgeEnv.ALLIANCE_BRIDGE_PHONE_NUMBER || envMaster.ALLIANCE_BRIDGE_PHONE_NUMBER || "";
  const profileFormBaseUrl = bridgeEnv.ALLIANCE_PROFILE_FORM_BASE_URL || envMaster.ALLIANCE_PROFILE_FORM_BASE_URL || "https://alliance.telechurchlive.com/profile";
  const profileFormSecret = bridgeEnv.ALLIANCE_PROFILE_FORM_SECRET || envMaster.ALLIANCE_PROFILE_FORM_SECRET || relayToken;
  if (!ref || !serviceRole || !envMaster.SUPABASE_ACCESS_TOKEN) throw new Error("Missing Supabase project ref, service role key, or access token.");
  if (!relayToken) throw new Error("Missing ALLIANCE_DISPATCHER_TOKEN in bridge env or ALLIANCE_SMS_RELAY_TOKEN in env file.");

  const packet = {
    schema: "refer.alliance.sms-relay-deploy.v1",
    generated_at: new Date().toISOString(),
    project_ref: ref,
    function_name: functionName,
    migration: { applied: false },
    deployed: args.deploy,
    secret_values_printed: false,
    evidence: ["env:loaded_without_printing_secrets", "relay_token:loaded_without_printing"],
    results: [],
  };

  if (args.apply) await applyMigration(args, ref, envMaster, packet);

  const targetFunction = resolve(args.telechurchRoot, "supabase", "functions", functionName, "index.ts");
  await mkdir(dirname(targetFunction), { recursive: true });
  await copyFile(sourceFunction, targetFunction);
  ensureFunctionJwtConfig(args.telechurchRoot);

  const tempDir = resolve(args.telechurchRoot, ".refer-temp");
  const tempEnv = resolve(tempDir, "alliance-sms-relay-secrets.env");
  mkdirSync(tempDir, { recursive: true });
  await writeFile(tempEnv, [
    `SERVICE_ROLE_KEY=${serviceRole}`,
    `ALLIANCE_SMS_RELAY_TOKEN=${relayToken}`,
    `ALLIANCE_PROFILE_FORM_BASE_URL=${profileFormBaseUrl}`,
    `ALLIANCE_PROFILE_FORM_SECRET=${profileFormSecret}`,
    bridgePhoneNumber ? `ALLIANCE_BRIDGE_PHONE_NUMBER=${bridgePhoneNumber}` : "",
  ].filter(Boolean).join("\n") + "\n", "utf8");

  const deployEnv = { ...process.env, SUPABASE_ACCESS_TOKEN: envMaster.SUPABASE_ACCESS_TOKEN };
  if (args.deploy) {
    packet.results.push({
      step: "secrets_set",
      ...run("npx", ["supabase", "secrets", "set", "--project-ref", ref, "--env-file", tempEnv], {
        cwd: args.telechurchRoot,
        env: deployEnv,
      }),
    });
    packet.results.push({
      step: "functions_deploy",
      ...run("npx", ["supabase", "functions", "deploy", functionName, "--project-ref", ref, "--no-verify-jwt"], {
        cwd: args.telechurchRoot,
        env: deployEnv,
      }),
    });
  }

  await rm(tempEnv, { force: true });
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  packet.verdict = (!args.apply || packet.migration.applied) && (!args.deploy || packet.results.every((item) => item.ok))
    ? "sms_relay_ready"
    : "sms_relay_failed";
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "sms-relay-deploy-latest.json");
  writeFileSync(outPath, JSON.stringify(packet, null, 2));
  console.log(JSON.stringify({ ok: packet.verdict === "sms_relay_ready", packet_path: outPath, packet }, null, 2));
  if (packet.verdict !== "sms_relay_ready") process.exit(1);
}

function ensureFunctionJwtConfig(telechurchRoot) {
  const configPath = resolve(telechurchRoot, "supabase", "config.toml");
  if (!existsSync(configPath)) return;
  const block = `[functions.${functionName}]\nverify_jwt = false\n`;
  let text = readFileSync(configPath, "utf8");
  const pattern = new RegExp(`\\n?\\[functions\\.${functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\n(?:[^[]|\\[(?!functions\\.))*`, "m");
  if (pattern.test(text)) {
    text = text.replace(pattern, `\n${block}\n`);
  } else {
    text = `${text.replace(/\s*$/, "\n\n")}${block}`;
  }
  writeFileSync(configPath, text, "utf8");
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
