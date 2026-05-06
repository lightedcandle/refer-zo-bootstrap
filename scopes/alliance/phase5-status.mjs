#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const serverPath = resolve("scopes", "alliance", "site", "server.ts");
const appPath = resolve("scopes", "alliance", "site", "App.tsx");
const probePath = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase5", "phase5-persistence-probe-latest.json");
const supabaseProbePath = resolve("datasets", "script-artifacts", "scoped", "alliance", "supabase", "supabase-probe-latest.json");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase5");

function main() {
  const serverText = existsSync(serverPath) ? readFileSync(serverPath, "utf8") : "";
  const appText = existsSync(appPath) ? readFileSync(appPath, "utf8") : "";
  const probe = existsSync(probePath) ? JSON.parse(readFileSync(probePath, "utf8")) : null;
  const supabaseProbe = existsSync(supabaseProbePath) ? JSON.parse(readFileSync(supabaseProbePath, "utf8")) : null;
  const edgeVerified = supabaseProbe?.persistence_verdict === "supabase_write_verified" && supabaseProbe?.post?.edge_function === "alliance-record-write";
  const status = {
    schema: "refer.alliance.phase5-status.v1",
    generated_at: new Date().toISOString(),
    phase: "phase5-persistence-gate",
    endpoint_present: serverText.includes("/api/alliance-drafts"),
    client_post_present: appText.includes("fetch(\"/api/alliance-drafts\""),
    latest_probe_verdict: probe?.persistence_verdict || "missing",
    latest_supabase_verdict: supabaseProbe?.persistence_verdict || "missing",
    edge_function_verified: edgeVerified,
    direct_supabase_from_zo: false,
    zo_dataset_api_visible: probe?.zo_dataset_api_visible ?? false,
    supabase_required_now: true,
    evidence: [
      serverText.includes("/api/alliance-drafts") ? "server_endpoint:present" : "server_endpoint:missing",
      appText.includes("fetch(\"/api/alliance-drafts\"") ? "client_post:present" : "client_post:missing",
      probe ? "persistence_probe:present" : "persistence_probe:missing",
      edgeVerified ? "supabase_edge:verified" : "supabase_edge:missing",
    ],
  };
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase5-status-latest.json");
  writeFileSync(outPath, JSON.stringify(status, null, 2));
  console.log(JSON.stringify({ ok: true, status_path: outPath, status }, null, 2));
}

main();
