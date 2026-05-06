#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const contractPath = resolve("scopes", "alliance", "phase2-data-contract.json");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase2");

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function uniqueCount(values) {
  return new Set(values.filter(Boolean)).size;
}

function main() {
  const contract = loadJson(contractPath);
  const entities = Array.isArray(contract.entities) ? contract.entities : [];
  const roles = Array.isArray(contract.auth_policy?.roles) ? contract.auth_policy.roles : [];
  const routes = uniqueCount(entities.map((entity) => entity.route));
  const datasets = uniqueCount(entities.map((entity) => entity.local_dataset));
  const gates = Array.isArray(contract.supabase_decision_gates) ? contract.supabase_decision_gates.length : 0;
  const status = {
    schema: "refer.alliance.phase2-status.v1",
    generated_at: new Date().toISOString(),
    phase: contract.phase,
    source_contract: contractPath,
    contract_present: existsSync(contractPath),
    persistence_strategy: contract.persistence_strategy?.current || "unknown",
    auth_behavior: contract.auth_policy?.phase2_behavior || "unknown",
    counts: {
      entities: entities.length,
      roles: roles.length,
      routes,
      datasets,
      supabase_decision_gates: gates
    },
    minimums: contract.phase2_minimums || {},
    evidence: [
      "phase2_contract:present",
      contract.persistence_strategy?.current === "supabase_edge_selected" ? "persistence:supabase_edge_selected" : "persistence:review_needed",
      contract.auth_policy?.phase2_behavior === "public_read_mock_write" ? "auth:public_read_mock_write" : "auth:review_needed",
      gates > 0 ? "supabase_gates:declared" : "supabase_gates:missing"
    ]
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase2-status-latest.json");
  writeFileSync(outPath, JSON.stringify(status, null, 2));
  console.log(JSON.stringify({ ok: true, status_path: outPath, status }, null, 2));
}

main();
