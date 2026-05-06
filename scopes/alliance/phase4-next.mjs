#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const appPath = resolve("scopes", "alliance", "site", "App.tsx");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase4");

function main() {
  const appText = existsSync(appPath) ? readFileSync(appPath, "utf8") : "";
  const checks = [
    ["phase4_routed_views", appText.includes("PHASE4_ROUTED_VIEWS:START") ? 1 : 0, 1, "routed view wrapper"],
    ["active_view_conditionals", appText.includes("activeView ===") ? 1 : 0, 1, "active view conditionals"],
    ["hash_navigation", appText.includes("window.location.hash") ? 1 : 0, 1, "hash navigation"]
  ];
  const gaps = checks
    .filter(([, current, target]) => current < target)
    .map(([key, current, target, label]) => ({ key, current, target, needed: target - current, label }));
  const next = {
    schema: "refer.alliance.phase4-next.v1",
    generated_at: new Date().toISOString(),
    phase: "phase4",
    rule: "Keep Phase 4 as client-side view routing. Do not add auth or persistence here.",
    next_actions: gaps.map((gap) => `Add ${gap.needed} ${gap.label}.`),
    gaps,
    ready_for_next_phase: gaps.length === 0,
    next_phase: gaps.length === 0
      ? "Prove Zo Dataset write capability or choose Supabase for persistent private records."
      : "Close routed-view gaps first.",
    evidence: [
      "app:checked",
      gaps.length === 0 ? "phase4_routing:minima_met" : "phase4_routing:gaps_present"
    ]
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase4-next-latest.json");
  writeFileSync(outPath, JSON.stringify(next, null, 2));
  console.log(JSON.stringify({ ok: true, next_path: outPath, next }, null, 2));
}

main();
