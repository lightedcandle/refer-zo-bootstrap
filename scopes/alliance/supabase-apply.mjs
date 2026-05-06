#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const defaultEnvFile = "E:\\telechurch-e2e\\.env.master";
const defaultNodeModulesRoot = "E:\\telechurch-e2e";
const migrationPath = resolve("scopes", "alliance", "supabase", "001_alliance_core.sql");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "supabase");

function parseArgs(argv) {
  const args = { envFile: defaultEnvFile, nodeModulesRoot: defaultNodeModulesRoot, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--env-file" && argv[i + 1]) args.envFile = argv[++i];
    else if (argv[i] === "--node-modules-root" && argv[i + 1]) args.nodeModulesRoot = argv[++i];
    else if (argv[i] === "--apply") args.apply = true;
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

function assertSafeMigration(sql) {
  const forbidden = /\b(drop\s+(table|schema|database)|truncate|delete\s+from)\b/i;
  if (forbidden.test(sql)) {
    throw new Error("Refusing migration with destructive SQL.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.envFile)) throw new Error(`Missing env file: ${args.envFile}`);
  const env = parseEnv(args.envFile);
  const ref = projectRef(env.SUPABASE_URL);
  if (!ref || !env.SUPABASE_DB_PASSWORD) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_DB_PASSWORD in env file.");
  }
  const sql = readFileSync(migrationPath, "utf8");
  assertSafeMigration(sql);

  const packet = {
    schema: "refer.alliance.supabase-apply.v1",
    generated_at: new Date().toISOString(),
    migration: migrationPath,
    env_source: args.envFile.replace(/[^\\\/]+$/, ".env.master"),
    project_ref: ref,
    applied: false,
    verified: false,
    evidence: ["migration:loaded", "env:loaded_without_printing_secrets"],
  };

  if (args.apply) {
    const require = createRequire(resolve(args.nodeModulesRoot, "package.json"));
    const { Client } = require("pg");
    const client = new Client({
      host: `db.${ref}.supabase.co`,
      port: 5432,
      user: "postgres",
      password: env.SUPABASE_DB_PASSWORD,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      await client.query(sql);
      const verify = await client.query(`
        select
          to_regclass('public.alliance_records') is not null as records_exists,
          to_regclass('public.alliance_audit_events') is not null as audit_exists,
          (select relrowsecurity from pg_class where oid = 'public.alliance_records'::regclass) as records_rls,
          (select relrowsecurity from pg_class where oid = 'public.alliance_audit_events'::regclass) as audit_rls
      `);
      packet.applied = true;
      packet.verification = verify.rows[0];
      packet.verified = Boolean(
        verify.rows[0]?.records_exists &&
        verify.rows[0]?.audit_exists &&
        verify.rows[0]?.records_rls &&
        verify.rows[0]?.audit_rls
      );
      packet.evidence.push("migration:applied", packet.verified ? "rls:enabled" : "rls:review_needed");
    } finally {
      await client.end();
    }
  } else {
    packet.evidence.push("dry_run:true");
  }

  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "supabase-apply-latest.json");
  writeFileSync(outPath, JSON.stringify(packet, null, 2));
  console.log(JSON.stringify({ ok: !args.apply || packet.verified, apply_path: outPath, packet }, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
