#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("scopes", "alliance", "site-manifest.json");
const appPath = resolve("scopes", "alliance", "site", "App.tsx");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "site");

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

function hasGeneratedApp() {
  if (!existsSync(appPath)) return false;
  const text = readFileSync(appPath, "utf8");
  return text.includes("const site =") && text.includes("Ready for today's Alliance work");
}

function main() {
  const manifest = loadJson(manifestPath);
  const status = {
    schema: "refer.alliance.phase1-status.v1",
    generated_at: new Date().toISOString(),
    phase: manifest.phase,
    source_manifest: manifestPath,
    generated_app_present: hasGeneratedApp(),
    auth_behavior: manifest.auth?.behavior || "unknown",
    public_until_auth_last: manifest.auth?.behavior === "public_now",
    counts: {
      roles: countArray(manifest.roles),
      access_cards: countArray(manifest.access_cards),
      modules: countArray(manifest.modules),
      today_items: countArray(manifest.today),
      churches: countArray(manifest.churches),
      gatherings: countArray(manifest.gatherings),
      documents: countArray(manifest.documents),
      work_queues: countArray(manifest.work_queues),
      pastor_council: countArray(manifest.pastor_council),
      member_resources: countArray(manifest.member_resources),
      forms: countArray(manifest.forms)
    },
    evidence: [
      "phase1_manifest:present",
      hasGeneratedApp() ? "generated_app:present" : "generated_app:missing",
      manifest.auth?.behavior === "public_now" ? "auth:public_now" : "auth:review_needed"
    ]
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase1-status-latest.json");
  writeFileSync(outPath, JSON.stringify(status, null, 2));
  console.log(JSON.stringify({ ok: true, status_path: outPath, status }, null, 2));
}

main();
