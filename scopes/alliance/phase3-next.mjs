#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const contractPath = resolve("scopes", "alliance", "phase2-data-contract.json");
const appPath = resolve("scopes", "alliance", "site", "App.tsx");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase3");

function main() {
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  const appText = existsSync(appPath) ? readFileSync(appPath, "utf8") : "";
  const entities = Array.isArray(contract.entities) ? contract.entities : [];
  const routes = new Set(entities.map((entity) => entity.route).filter(Boolean)).size;
  const gaps = [];
  if (!appText.includes("PHASE3_SITE_FORMS:START")) {
    gaps.push({ key: "phase3_site_forms", current: 0, target: 1, needed: 1, label: "generated Phase 3 form section" });
  }
  if (!appText.includes("Save local draft")) {
    gaps.push({ key: "local_draft_action", current: 0, target: 1, needed: 1, label: "local draft save action" });
  }
  if (entities.length < 8) {
    gaps.push({ key: "entities", current: entities.length, target: 8, needed: 8 - entities.length, label: "contract entities" });
  }
  if (routes < 8) {
    gaps.push({ key: "routes", current: routes, target: 8, needed: 8 - routes, label: "route-backed forms" });
  }

  const next = {
    schema: "refer.alliance.phase3-next.v1",
    generated_at: new Date().toISOString(),
    phase: "phase3",
    rule: "Phase 3 creates browser-local drafts only. Do not persist user data or add auth until Phase 5.",
    next_actions: gaps.map((gap) => `Add ${gap.needed} ${gap.label}.`),
    gaps,
    ready_for_next_phase: gaps.length === 0,
    next_phase: gaps.length === 0
      ? "Prove whether Zo Sites can write to a Zo Dataset, then choose local dataset writes or Supabase."
      : "Close Phase 3 local draft form gaps first.",
    evidence: [
      "app:checked",
      gaps.length === 0 ? "phase3_forms:minima_met" : "phase3_forms:gaps_present"
    ]
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase3-next-latest.json");
  writeFileSync(outPath, JSON.stringify(next, null, 2));
  console.log(JSON.stringify({ ok: true, next_path: outPath, next }, null, 2));
}

main();
