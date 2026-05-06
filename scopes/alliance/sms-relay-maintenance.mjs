#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const defaultEnvFile = "E:\\telechurch-e2e\\.env.master";
const defaultNodeModulesRoot = "E:\\telechurch-e2e";

const args = parseArgs(process.argv.slice(2));

async function main() {
  if (args.command !== "clear-sms") {
    console.log(JSON.stringify({
      ok: true,
      commands: ["clear-sms --confirm CLEAR_SMS"],
    }, null, 2));
    return;
  }

  if (args.confirm !== "CLEAR_SMS") {
    throw new Error("Refusing to clear SMS state without --confirm CLEAR_SMS.");
  }

  const env = loadEnv(args.envFile || defaultEnvFile);
  const require = createRequire(resolve(args.nodeModulesRoot || defaultNodeModulesRoot, "package.json"));
  const { Client } = require("pg");
  const client = new Client({
    host: `db.${projectRef(env.SUPABASE_URL)}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const before = await counts(client);
    await client.query("begin");
    await client.query("delete from public.alliance_sms_delivery_events");
    await client.query("delete from public.alliance_sms_outbox");
    await client.query("delete from public.alliance_sms_inbox");
    await client.query("delete from public.alliance_records where entity = 'sms_message'");
    await client.query("delete from public.alliance_records where entity = 'sms_profile_context'");
    if (args.includeProfiles === "true") {
      await client.query("delete from public.alliance_records where entity = 'alliance_profile'");
    }
    await client.query("commit");
    const after = await counts(client);
    console.log(JSON.stringify({
      ok: true,
      secret_values_printed: false,
      cleared: {
        sms_tables: true,
        sms_message_records: true,
        sms_profile_contexts: true,
        alliance_profiles: args.includeProfiles === "true",
      },
      before,
      after,
    }, null, 2));
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function counts(client) {
  const result = await client.query(`
    select
      (select count(*)::int from public.alliance_sms_delivery_events) as delivery_events,
      (select count(*)::int from public.alliance_sms_outbox) as outbox,
      (select count(*)::int from public.alliance_sms_inbox) as inbox,
      (select count(*)::int from public.alliance_records where entity = 'sms_message') as sms_message_records,
      (select count(*)::int from public.alliance_records where entity = 'sms_profile_context') as sms_profile_contexts,
      (select count(*)::int from public.alliance_records where entity = 'alliance_profile') as alliance_profiles
  `);
  return result.rows[0];
}

function parseArgs(argv) {
  const parsed = {
    command: argv[0] || "help",
    envFile: defaultEnvFile,
    nodeModulesRoot: defaultNodeModulesRoot,
    confirm: "",
    includeProfiles: "false",
  };
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i] === "--env-file" && argv[i + 1]) parsed.envFile = argv[++i];
    else if (argv[i] === "--node-modules-root" && argv[i + 1]) parsed.nodeModulesRoot = argv[++i];
    else if (argv[i] === "--confirm" && argv[i + 1]) parsed.confirm = argv[++i];
    else if (argv[i] === "--include-profiles") parsed.includeProfiles = "true";
  }
  return parsed;
}

function loadEnv(path) {
  if (!existsSync(path)) throw new Error(`Missing env file: ${path}`);
  const env = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
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
  const ref = String(url || "").match(/https?:\/\/([^.]+)\.supabase\.co/i)?.[1] || "";
  if (!ref) throw new Error("Missing Supabase project ref.");
  return ref;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
