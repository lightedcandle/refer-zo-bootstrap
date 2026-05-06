#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const contractPath = resolve("scopes", "alliance", "phase2-data-contract.json");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase2");

function main() {
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  const entities = Array.isArray(contract.entities) ? contract.entities : [];
  const roles = Array.isArray(contract.auth_policy?.roles) ? contract.auth_policy.roles : [];
  const routes = new Set(entities.map((entity) => entity.route).filter(Boolean)).size;
  const datasets = new Set(entities.map((entity) => entity.local_dataset).filter(Boolean)).size;
  const gates = Array.isArray(contract.supabase_decision_gates) ? contract.supabase_decision_gates.length : 0;
  const minimums = contract.phase2_minimums || {};
  const checks = [
    ["entities", entities.length, minimums.entities || 0, "entities"],
    ["roles", roles.length, minimums.roles || 0, "role scopes"],
    ["routes", routes, minimums.routes || 0, "routes"],
    ["datasets", datasets, minimums.datasets || 0, "local datasets"],
    ["supabase_decision_gates", gates, minimums.supabase_decision_gates || 0, "Supabase decision gates"]
  ];
  const gaps = checks
    .filter(([, current, target]) => current < target)
    .map(([key, current, target, label]) => ({ key, current, target, needed: target - current, label }));

  const next = {
    schema: "refer.alliance.phase2-next.v1",
    generated_at: new Date().toISOString(),
    phase: contract.phase,
    rule: "Supabase is selected only through Edge Functions. Zo must not call Supabase table REST endpoints directly.",
    next_actions: gaps.map((gap) => `Add ${gap.needed} ${gap.label}.`),
    gaps,
    ready_for_next_phase: gaps.length === 0,
    next_phase: gaps.length === 0 ? contract.next_phase?.phase3 || "Generate route-level mock forms." : "Close Phase 2 contract gaps first.",
    evidence: [
      "contract:checked",
      gaps.length === 0 ? "phase2_contract:minima_met" : "phase2_contract:gaps_present"
    ]
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase2-next-latest.json");
  writeFileSync(outPath, JSON.stringify(next, null, 2));
  console.log(JSON.stringify({ ok: true, next_path: outPath, next }, null, 2));
}

main();
