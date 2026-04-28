#!/usr/bin/env node
/**
 * bootstrap.mjs
 * Git-based Zo bootstrap for refer-zo-bootstrap.
 * Clones or pulls the repo, then installs skills, law, authority surfaces, scripts, and dashboard.
 *
 * Usage:
 *   node scripts/factory/bootstrap.mjs --profile alliance
 *   node scripts/factory/bootstrap.mjs --repo "https://github.com/user/fork.git" --profile myapp
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const LAW_DIR = join(REPO_ROOT, "law", "REFER.OS");
const SCRIPTS_DIR = join(REPO_ROOT, "scripts");
const ARTIFACTS_DIR = join(SCRIPTS_DIR, "factory", "artifacts");
const CANONICAL_REGISTRY = join(SCRIPTS_DIR, "factory", "registry.json");
const MANIFEST = join(SKILLS_DIR, "library-manifest.json");

function run(cmd, cwd = REPO_ROOT) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function parseArgs(argv) {
  const out = { repo: null, profile: null, local: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo" && argv[i + 1]) out.repo = argv[++i];
    if (argv[i] === "--profile" && argv[i + 1]) out.profile = argv[++i];
    if (argv[i] === "--local") out.local = true;
  }
  return out;
}

function loadManifest() {
  if (!existsSync(MANIFEST)) throw new Error("library-manifest.json not found.");
  return JSON.parse(readFileSync(MANIFEST, "utf8"));
}

function ensureDir(dir) { mkdirSync(dir, { recursive: true }); }

function buildAgentBinder(profile) {
  return `# ${profile.toUpperCase()} Agent Binder

Profile: ${profile}
Repo: refer-zo-bootstrap
Updated: ${new Date().toISOString().slice(0, 10)}

## Startup Sequence
1. Read agent.md if present
2. Read AGENTS.md if present
3. Read Skills/refer-os/SKILL.md as entry wrapper
4. Read REFER.OS/refer.md as router

## Three-Mode Operation
- DISCUSS: Intention only — go through intake, compress context, return guidance. No execution.
- BUILD: Go through intake, compress, S-expression contract, then AI executes.
- MICRO: Direct script — no AI, no intake. Script executes immediately.

## S-Expression Contracts
All prompts compress to S-expressions before AI involvement:
  (intent :action <verb> :target <path> :params (key value))

## Scripts First
Scripts do the repetitive work. AI reasons and decides.
Install skills via: node scripts/factory/sync-skill.mjs --skill <name>
`;
}

function buildOperatingRules(profile) {
  return `# ${profile} VIPC Operating Rules

## Non-Negotiable
1. Read agent.md and AGENTS.md before substantive work
2. Three-mode operation: DISCUSS | BUILD | MICRO — always through intake
3. Scripts first; AI second — prefer scripts for known work
4. No production mutation without explicit user approval
5. Stub/sandbox/production must be clearly labeled
6. Token budget is tracked

## S-Expression Pipeline
Every prompt flows through intake for compression:
  prompt → compress → S-expression → (route to MICRO/BUILD/DISCUSS)

## Token Discipline
Track every session. Watch fuel gauge. Prefer scripts over repeated AI calls.
`;
}

function buildRepoMap(profile) {
  return `# ${profile} Repo Connection Map

Profile: ${profile}
Updated: ${new Date().toISOString().slice(0, 10)}

## Canonical Repo
https://github.com/lightedcandle/refer-zo-bootstrap

## Tech Stack
- Zo Computer: Development environment
- Zo Space: Admin surface
- Zo Sites + Cloudflare: Production surface
- GitHub: Source control

## Scripts
Find scripts at: Skills/scripts/
Run factory: node Skills/scripts/factory/factory.mjs
Run heartbeat: node Skills/scripts/factory/heartbeat.mjs --tick
`;
}

function buildDesignSystem() {
  return `# Design System

## Brand Posture
Neutral, accessible, modern. Dark-friendly.

## Typography
System font stack.

## Responsive
- Mobile: 390px
- Tablet: 768px
- Desktop: 1024px

## Do Not Change
Read the project design system doc before inventing brand direction.
`;
}

function buildCodexHandoff() {
  return `# Codex Handoff Prompt Template

## Contract
[Brief description]

## Context
[What led here]

## Scope
In: [included]
Out: [excluded]

## Targets
- [file/route/component]

## Constraints
- [non-negotiable rules]

## Success Criteria
- [ ] [criterion]
`;
}

async function buildDashboardMeta(workspace) {
  const password = randomBytes(8).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  const meta = { password, routePath: "/referdashboard", generatedAt: new Date().toISOString() };
  writeFileSync(join(workspace, "refer-dashboard-meta.json"), JSON.stringify(meta, null, 2));
  return password;
}

async function main(argv) {
  const { profile } = parseArgs(argv);
  if (!profile) {
    console.error("Usage: node bootstrap.mjs --profile <name> [--repo <url>]");
    process.exit(1);
  }

  const PROFILE = profile.toUpperCase();
  const WORKSPACE = process.env.ZO_WORKSPACE_ROOT || process.cwd();
  const profileRoot = join(WORKSPACE, PROFILE);
  const skillsRoot = join(WORKSPACE, "Skills");
  const scriptsTarget = join(skillsRoot, "scripts");

  console.log(`\nBootstrap for: ${profile}`);
  console.log(`Workspace: ${WORKSPACE}`);

  // ── 1. Authority surfaces ─────────────────────────────────────────
  console.log("\n--- Authority surfaces ---");
  ensureDir(profileRoot);
  ensureDir(join(profileRoot, "Templates"));
  ensureDir(skillsRoot);

  writeFileSync(join(WORKSPACE, "agent.md"), buildAgentBinder(profile));
  writeFileSync(join(profileRoot, `${profile}-vipc-operating-rules.md`), buildOperatingRules(profile));
  writeFileSync(join(profileRoot, `${profile}-repo-connection-map.md`), buildRepoMap(profile));
  writeFileSync(join(profileRoot, `${profile}-design-system.md"), buildDesignSystem());
  writeFileSync(join(profileRoot, "Templates", "codex-handoff-prompt.md"), buildCodexHandoff());
  console.log("  Authority surfaces created.");

  // ── 2. Skills ────────────────────────────────────────────────────
  console.log("\n--- Syncing skills ---");
  const manifest = loadManifest();
  for (const skill of manifest.universal_skills) {
    const src = join(SKILLS_DIR, skill);
    if (existsSync(src)) {
      cpSync(src, join(skillsRoot, skill), { recursive: true, overwrite: true });
      console.log(`  Synced: ${skill}`);
    }
  }

  // ── 3. Law ────────────────────────────────────────────────────────
  console.log("\n--- Syncing REFER law ---");
  if (existsSync(LAW_DIR)) {
    const lawTarget = join(WORKSPACE, "REFER.OS");
    rmSync(lawTarget, { recursive: true, force: true });
    cpSync(LAW_DIR, lawTarget, { recursive: true });
    console.log(`  REFER law → ${lawTarget}`);
  }

  // ── 4. Manifest ───────────────────────────────────────────────────
  cpSync(MANIFEST, join(skillsRoot, "library-manifest.json"), { overwrite: true });

  // ── 5. Scripts ───────────────────────────────────────────────────
  console.log("\n--- Installing scripts ---");
  ensureDir(scriptsTarget);
  ensureDir(join(scriptsTarget, "factory"));
  ensureDir(join(scriptsTarget, "factory", "artifacts"));
  ensureDir(join(scriptsTarget, "factory", "lib"));

  const factoryFiles = [
    "intake-engine.mjs",
    "auto-capture.mjs",
    "factory.mjs",
    "heartbeat.mjs",
    "lib/ui.mjs",
    "lib/decompress.mjs",
    "lib/constants.js",
    "registry.json",
    "script-registry.json",
  ];

  for (const file of factoryFiles) {
    const src = join(SCRIPTS_DIR, "factory", file);
    if (existsSync(src)) {
      cpSync(src, join(scriptsTarget, "factory", file), { overwrite: true });
      console.log(`  Script: ${file}`);
    }
  }

  // Preset scripts
  if (existsSync(ARTIFACTS_DIR)) {
    for (const file of ["button-add.mjs", "page-add.mjs", "form-add.mjs", "scan-workspace.mjs", "git-commit.mjs", "deploy-pages.mjs"]) {
      const src = join(ARTIFACTS_DIR, file);
      if (existsSync(src)) {
        cpSync(src, join(scriptsTarget, "factory", "artifacts", file), { overwrite: true });
        console.log(`  Preset: ${file}`);
      }
    }
  }

  // Canonical registry
  if (existsSync(CANONICAL_REGISTRY)) {
    cpSync(CANONICAL_REGISTRY, join(scriptsTarget, "registry.json"), { overwrite: true });
    console.log("  Canonical registry synced.");
  }

  // ── 6. Dashboard password ─────────────────────────────────────────
  console.log("\n--- Dashboard meta ---");
  const dashPassword = await buildDashboardMeta(WORKSPACE);
  console.log(`  Password generated: ${dashPassword}`);

  // ── 7. Install state ──────────────────────────────────────────────
  writeFileSync(join(WORKSPACE, "refer-install-state.json"), JSON.stringify({
    machine_label: `${profile}-vipc`,
    installed_refer_version: manifest.refer_version,
    installed_skill_library_version: manifest.library_version,
    update_channel: manifest.update_channel,
    last_checked_at: new Date().toISOString(),
    last_installed_at: new Date().toISOString(),
    bootstrap_complete: true,
    startup_binding_installed: true,
    startup_binding_version: 1,
    profile,
    active_runtime_root: skillsRoot,
    dashboard_password: dashPassword,
  }, null, 2));

  console.log(`\n✅ Bootstrap complete for: ${profile}`);
  console.log(`   Dashboard: https://apostlej.zo.space/referdashboard`);
  console.log(`   Password: ${dashPassword}`);
  console.log(`\n📋 Next: deploy /referdashboard in Zo Space, then bookmark it.`);
}

main(process.argv.slice(2)).catch(err => {
  console.error(`Bootstrap failed: ${err.message}`);
  process.exit(1);
});
