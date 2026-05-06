#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const appPath = resolve("scopes", "alliance", "site", "App.tsx");
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase4");

function main() {
  const appText = existsSync(appPath) ? readFileSync(appPath, "utf8") : "";
  const status = {
    schema: "refer.alliance.phase4-status.v1",
    generated_at: new Date().toISOString(),
    phase: "phase4",
    generated_app_present: appText.includes("function App()"),
    routed_views_present: appText.includes("PHASE4_ROUTED_VIEWS:START"),
    hash_navigation_present: appText.includes("window.location.hash"),
    view_count: (appText.match(/id: "/g) || []).length,
    visible_model: "one_active_view_at_a_time",
    evidence: [
      appText.includes("PHASE4_ROUTED_VIEWS:START") ? "phase4_routed_views:present" : "phase4_routed_views:missing",
      appText.includes("activeView ===") ? "active_view_conditionals:present" : "active_view_conditionals:missing",
      appText.includes("window.location.hash") ? "hash_navigation:present" : "hash_navigation:missing"
    ]
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase4-status-latest.json");
  writeFileSync(outPath, JSON.stringify(status, null, 2));
  console.log(JSON.stringify({ ok: true, status_path: outPath, status }, null, 2));
}

main();
