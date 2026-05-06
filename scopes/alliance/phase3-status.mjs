#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const contractPath = resolve("scopes", "alliance", "phase2-data-contract.json");
const appPath = resolve("scopes", "alliance", "site", "App.tsx");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase3");

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const contract = loadJson(contractPath);
  const appText = existsSync(appPath) ? readFileSync(appPath, "utf8") : "";
  const entities = Array.isArray(contract.entities) ? contract.entities : [];
  const routes = new Set(entities.map((entity) => entity.route).filter(Boolean));
  const datasets = new Set(entities.map((entity) => entity.local_dataset).filter(Boolean));
  const status = {
    schema: "refer.alliance.phase3-status.v1",
    generated_at: new Date().toISOString(),
    phase: "phase3",
    source_contract: contractPath,
    generated_app_present: appText.includes("const dataModel ="),
    phase3_site_forms_present: appText.includes("PHASE3_SITE_FORMS:START"),
    persistence_behavior: "browser_session_local_drafts",
    auth_behavior: "phase5_deferred",
    counts: {
      entities: entities.length,
      routes: routes.size,
      local_datasets: datasets.size
    },
    evidence: [
      "phase2_contract:present",
      appText.includes("PHASE3_SITE_FORMS:START") ? "phase3_site_forms:present" : "phase3_site_forms:missing",
      appText.includes("Save local draft") ? "local_draft_action:present" : "local_draft_action:missing",
      "supabase:not_required_for_phase3"
    ]
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase3-status-latest.json");
  writeFileSync(outPath, JSON.stringify(status, null, 2));
  console.log(JSON.stringify({ ok: true, status_path: outPath, status }, null, 2));
}

main();
