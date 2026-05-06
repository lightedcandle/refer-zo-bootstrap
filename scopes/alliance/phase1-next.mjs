#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("scopes", "alliance", "site-manifest.json");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "site");

const minimums = {
  roles: 4,
  access_cards: 4,
  modules: 8,
  today: 4,
  churches: 6,
  gatherings: 5,
  documents: 6,
  work_queues: 8,
  pastor_council: 6,
  member_resources: 6,
  forms: 6
};

const labels = {
  roles: "role lanes",
  access_cards: "access cards",
  modules: "work areas",
  today: "today items",
  churches: "church rows",
  gatherings: "gatherings",
  documents: "documents",
  work_queues: "role work queue items",
  pastor_council: "pastor council items",
  member_resources: "member resources",
  forms: "open forms"
};

function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const gaps = [];
  for (const [key, min] of Object.entries(minimums)) {
    const count = Array.isArray(manifest[key]) ? manifest[key].length : 0;
    if (count < min) {
      gaps.push({
        key,
        label: labels[key],
        current: count,
        target: min,
        needed: min - count
      });
    }
  }

  const next = {
    schema: "refer.alliance.phase1-next.v1",
    generated_at: new Date().toISOString(),
    phase: manifest.phase,
    auth_rule: "Keep all behavior public for Phase 1; only show a sign-in-later note.",
    next_actions: gaps.map((gap) => `Add ${gap.needed} ${gap.label}.`),
    gaps,
    ready_for_next_phase: gaps.length === 0,
    evidence: [
      "manifest:checked",
      gaps.length === 0 ? "phase1_content:minima_met" : "phase1_content:gaps_present"
    ]
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase1-next-latest.json");
  writeFileSync(outPath, JSON.stringify(next, null, 2));
  console.log(JSON.stringify({ ok: true, next_path: outPath, next }, null, 2));
}

main();
