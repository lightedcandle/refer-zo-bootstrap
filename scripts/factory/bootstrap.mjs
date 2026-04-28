#!/usr/bin/env node
/**
 * bootstrap.mjs
 * Git-based Zo bootstrap for refer-zo-bootstrap.
 * Clones or pulls the repo, then installs skills, law, and authority surfaces.
 * 
 * Usage:
 *   node scripts/factory/bootstrap.mjs --repo "https://github.com/user/refer-zo-bootstrap.git" --profile "alliance"
 *   node scripts/factory/bootstrap.mjs --repo "./" --profile "alliance"   # local mode
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const LAW_DIR = join(REPO_ROOT, "law", "REFER.OS");
const TEMPLATES_DIR = join(REPO_ROOT, "Templates");
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
  if (!existsSync(MANIFEST)) throw new Error("library-manifest.json not found in repo.");
  return JSON.parse(readFileSync(MANIFEST, "utf8"));
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

// ── Script registry ──────────────────────────────────────────────
const SCRIPTS = {
  "token-tracker": join(__dirname, "..", "token", "token-tracker.mjs"),
  "token-dashboard": join(__dirname, "..", "token", "token-dashboard.mjs"),
  "sync-skill": join(__dirname, "sync-skill.mjs"),
  "scan-workspace": join(__dirname, "scan-workspace.mjs"),
  "emit-contract": join(__dirname, "emit-contract.mjs"),
  "register-artifact": join(__dirname, "register-artifact.mjs"),
  "bootstrap": join(__dirname, "bootstrap.mjs"),
};

async function installScripts(targetScriptsDir) {
  ensureDir(targetScriptsDir);
  for (const [name, src] of Object.entries(SCRIPTS)) {
    if (existsSync(src)) {
      cpSync(src, join(targetScriptsDir, `${name}.mjs`), { overwrite: true });
      console.log(`  Script installed: ${name}.mjs`);
    }
  }
}

// ── Authority surfaces ──────────────────────────────────────────
function buildAgentBinder(profile) {
  return `# ${profile.toUpperCase()} Agent Binder

Profile: ${profile}
Repo: refer-zo-bootstrap (git-cloned)
Profile folder: \`${profile.toUpperCase()}/\`
Updated: ${new Date().toISOString().slice(0, 10)}

## Startup Sequence
1. Read \`agent.md\` if present
2. Read \`AGENTS.md\` if present  
3. Read \`Skills/refer-os/SKILL.md\` as entry wrapper
4. Read \`REFER.OS/refer.md\` as router

## Factory-First Doctrine
Scripts do the repetitive work. AI reasons and decides.
- Use scripts for: bootstrap, sync, scan, emit, register
- Use AI for: judgment, novel work, exception handling

## Scripts Available
\`scripts/\` folder contains portable script packs:
- token-tracker.mjs — track token usage
- token-dashboard.mjs — generate fuel dashboard
- scan-workspace.mjs — emit codebase tree
- emit-contract.mjs — derive Send Contract from Plan

## Skills
Skills wrap repeatable AI behavior, not authority.
Install skills via: \`node scripts/factory/sync-skill.mjs --skill <name>\`
`;
}

function buildOperatingRules(profile) {
  return `# ${profile} VIPC Operating Rules

## Non-Negotiable
1. Read agent.md and AGENTS.md before substantive work when present
2. Scripts are first; AI is second — prefer scripts for known work
3. No direct database mutation without explicit user approval
4. No production deploy without Codex handoff and user approval
5. Stub/sandbox/production must be clearly labeled
6. Token budget is tracked — watch fuel gauge before heavy operations

## Factory-First Execution
When a transformation is known and script exists:
1. Select the script
2. Parameterize it
3. Run it
4. Audit the output
5. Register if reusable

When no script exists:
1. Use AI to solve the problem
2. If the solution is repeatable, author a script
3. Register the script for future use

## Startup
- Bind to refer-os SKILL.md as entry
- Route via refer-zo-intake-router for classification
- Keep compact returns by default

## Token Discipline
- Track every session with scripts/token/token-tracker.mjs
- Watch fuel gauge (scripts/token/token-dashboard.mjs)
- Prefer scripts over repeated AI calls to conserve tokens
`;
}

function buildRepoMap(profile) {
  return `# ${profile} Repo Connection Map

Profile: ${profile}
Updated: ${new Date().toISOString().slice(0, 10)}

## Canonical Repo
Clone from: https://github.com/lightedcandle/refer-zo-bootstrap.git

## Tech Stack (fill in per project)
- Auth: Supabase
- Database: Supabase PostgreSQL  
- Hosting: Cloudflare Pages
- Email: Resend
- SMS: Twilio
- CI/CD: GitHub Actions

## Production URL
TBD — configure per project

## Development
- Zo Computer is dev environment
- Zo Space is admin surface (local dev)
- Zo Sites + Cloudflare is production surface

## Schema Docs
Store schema docs in: \`<PROFILE>/docs/schema/\`
`;
}

function buildDesignSystem() {
  return `# Design System

## Brand Posture
Define per project. Default: neutral, accessible, modern.

## Color Direction
Define per project. Default: dark-friendly, high contrast.

## Typography
Define per project. Default: system font stack.

## Responsive Breakpoints
- Mobile: 390px
- Tablet: 768px  
- Desktop: 1024px

## Do Not Change
Do not invent brand direction. Read the project's design system doc.
`;
}

function buildCodexHandoff() {
  return `# Codex Handoff Prompt Template

## Contract
[Brief description of what needs to happen]

## Context
[What led to this, what's already done]

## Scope
**In:** [what's included]
**Out:** [what's explicitly excluded]

## Targets
- [file/route/component 1]
- [file/route/component 2]

## Constraints
- [non-negotiable rules]
- [known limitations]

## Success Criteria
- [ ] [criterion 1]
- [ ] [criterion 2]

## Scripts Available
Scripts should be used first for known operations.
`;
}

async function main(argv) {
  const { repo, profile, local } = parseArgs(argv);

  if (!profile) {
    console.error("Usage: node scripts/factory/bootstrap.mjs --repo <url-or-path> --profile <name>");
    process.exit(1);
  }

  const PROFILE = profile.toUpperCase();
  const WORKSPACE = process.env.ZO_WORKSPACE_ROOT || process.cwd();
  const profileRoot = join(WORKSPACE, PROFILE);
  const skillsRoot = join(WORKSPACE, "Skills");
  const scriptsTarget = join(skillsRoot, "scripts");

  console.log(`\nBootstrap for profile: ${profile}`);
  console.log(`Workspace: ${WORKSPACE}`);
  console.log(`Profile root: ${profileRoot}`);

  // ── 1. Clone or update repo ─────────────────────────────────────
  const repoDest = join(REPO_ROOT, "refer-zo-bootstrap");
  if (!local && !existsSync(join(repoDest, ".git"))) {
    console.log("\n--- Cloning repo ---");
    run(`git clone ${repo || "https://github.com/lightedcandle/refer-zo-bootstrap.git"} ${repoDest}`);
  } else if (existsSync(join(repoDest, ".git"))) {
    console.log("\n--- Pulling latest ---");
    try { run("git pull origin main", repoDest); } catch { /* ignore */ }
  }

  // ── 2. Load manifest ─────────────────────────────────────────────
  console.log("\n--- Loading manifest ---");
  const manifest = loadManifest();
  console.log(`Skills: ${manifest.universal_skills.join(", ")}`);

  // ── 3. Create authority surfaces ─────────────────────────────────
  console.log("\n--- Creating authority surfaces ---");
  ensureDir(profileRoot);
  ensureDir(join(profileRoot, "Templates"));
  ensureDir(skillsRoot);

  writeFileSync(join(WORKSPACE, "agent.md"), buildAgentBinder(profile));
  writeFileSync(join(profileRoot, `${profile}-vipc-operating-rules.md`), buildOperatingRules(profile));
  writeFileSync(join(profileRoot, `${profile}-repo-connection-map.md`), buildRepoMap(profile));
  writeFileSync(join(profileRoot, `${profile}-design-system.md`), buildDesignSystem());
  writeFileSync(join(profileRoot, "Templates", "codex-handoff-prompt.md"), buildCodexHandoff());
  console.log("  Authority surfaces created.");

  // ── 4. Sync skills ────────────────────────────────────────────────
  console.log("\n--- Syncing skills ---");
  for (const skill of manifest.universal_skills) {
    const src = join(SKILLS_DIR, skill);
    if (existsSync(src)) {
      cpSync(src, join(skillsRoot, skill), { recursive: true, overwrite: true });
      console.log(`  Synced: ${skill}`);
    }
  }

  // ── 5. Sync law ──────────────────────────────────────────────────
  console.log("\n--- Syncing REFER law ---");
  if (existsSync(LAW_DIR)) {
    const lawTarget = join(WORKSPACE, "REFER.OS");
    rmSync(lawTarget, { recursive: true, force: true });
    cpSync(LAW_DIR, lawTarget, { recursive: true });
    console.log(`  REFER law synced to: ${lawTarget}`);
  }

  // ── 6. Sync manifest ──────────────────────────────────────────────
  cpSync(MANIFEST, join(skillsRoot, "library-manifest.json"), { overwrite: true });
  console.log("  Manifest synced.");

  // ── 7. Install scripts ────────────────────────────────────────────
  console.log("\n--- Installing scripts ---");
  await installScripts(scriptsTarget);

  // ── 8. Write install state ────────────────────────────────────────
  const state = {
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
  };
  writeFileSync(join(WORKSPACE, "refer-install-state.json"), JSON.stringify(state, null, 2));

  console.log(`\n✅ Bootstrap complete for profile: ${profile}`);
  console.log(`   Profile root: ${profileRoot}`);
  console.log(`   Scripts: ${scriptsTarget}`);
  console.log(`   Run: node scripts/token/token-dashboard.mjs --stats`);
}

main(process.argv.slice(2)).catch(err => {
  console.error(`Bootstrap failed: ${err.message}`);
  process.exit(1);
});