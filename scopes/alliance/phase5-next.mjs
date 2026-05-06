#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const statusPath = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase5", "phase5-status-latest.json");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase5");

function main() {
  const status = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, "utf8")).status || JSON.parse(readFileSync(statusPath, "utf8")) : {};
  const gaps = [];
  if (!status.endpoint_present) gaps.push({ key: "server_endpoint", needed: 1, label: "server persistence endpoint" });
  if (!status.client_post_present) gaps.push({ key: "client_post", needed: 1, label: "client draft POST" });
  if (status.latest_probe_verdict !== "zo_site_local_file_write_proven") {
    gaps.push({ key: "persistence_probe", needed: 1, label: "successful local-file write probe" });
  }
  if (!status.edge_function_verified) {
    gaps.push({ key: "supabase_edge_probe", needed: 1, label: "successful Supabase Edge Function write probe" });
  }
  const next = {
    schema: "refer.alliance.phase5-next.v1",
    generated_at: new Date().toISOString(),
    phase: "phase5-persistence-gate",
    rule: "Zo Site local-file persistence is sandbox evidence only. Real Alliance persistence goes through Supabase Edge Functions, not direct Zo-to-Supabase table calls.",
    next_actions: gaps.map((gap) => `Add ${gap.needed} ${gap.label}.`),
    gaps,
    ready_for_next_phase: gaps.length === 0,
    next_phase: gaps.length === 0
      ? "Continue into auth and role policy on top of the verified Supabase Edge Function write lane."
      : "Close persistence proof gaps first.",
    evidence: [
      "phase5_status:checked",
      gaps.length === 0 ? "persistence_gate:supabase_edge_verified" : "persistence_gate:gaps_present",
    ],
  };
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase5-next-latest.json");
  writeFileSync(outPath, JSON.stringify(next, null, 2));
  console.log(JSON.stringify({ ok: true, next_path: outPath, next }, null, 2));
}

main();
