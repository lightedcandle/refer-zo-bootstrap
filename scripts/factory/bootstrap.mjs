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

async function ensureZoDashboard(scriptsTarget, workspace) {
  // Generate a random alphanumeric password (12 chars, safe for identifiers)
  const { randomBytes } = await import("node:crypto");
  const password = randomBytes(8).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);

  const dashboardContent = `import { useState } from "react";

export default function ReferDashboard() {
  const [locked, setLocked] = useState(true);
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const DEFAULT_PASS = "${password}";
  const CORRECT_PASS = DEFAULT_PASS;

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pass === CORRECT_PASS) {
      setLocked(false);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (locked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.153c0 2.046-.347 4-.977 5.855M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">REFER Dashboard</h1>
            <p className="text-zinc-400 text-sm">Enter your admin passkey to continue</p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <input
                type="password"
                value={pass}
                onChange={(e) => { setPass(e.target.value); setError(false); }}
                placeholder="Passkey"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 text-center tracking-widest focus:outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-red-400 text-sm text-center">Invalid passkey. Try again.</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
            >
              Enter Dashboard
            </button>
          </form>
          <p className="mt-6 text-center text-zinc-600 text-xs">Private — Zo Computer Refer System</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">REFER Dashboard</h1>
            <p className="text-zinc-400 mt-1">Token Tracker & Factory Monitor</p>
          </div>
          <button
            onClick={() => setLocked(true)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg text-sm transition-colors"
          >
            🔒 Lock
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
              <span className="text-zinc-400 text-sm font-medium">Token Balance</span>
            </div>
            <p className="text-4xl font-bold text-green-400" id="token-balance">—</p>
            <p className="text-zinc-500 text-sm mt-1">tokens remaining</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-zinc-400 text-sm font-medium">Session Usage</span>
            </div>
            <p className="text-4xl font-bold text-blue-400" id="session-usage">—</p>
            <p className="text-zinc-500 text-sm mt-1">tokens this session</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-zinc-400 text-sm font-medium">Est. Max Tokens</span>
            </div>
            <p className="text-4xl font-bold text-yellow-400">2M</p>
            <p className="text-zinc-500 text-sm mt-1">monthly ceiling</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">📊 Fuel Gauge</h2>
          <div className="relative h-4 bg-zinc-800 rounded-full overflow-hidden">
            <div id="fuel-bar" className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-700" style={{ width: "100%" }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span>0</span>
            <span id="fuel-pct">100%</span>
            <span>2M</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">📜 Last Session</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Date</span>
              <span className="text-sm" id="last-date">—</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Input Chars</span>
              <span className="text-sm" id="last-input-chars">—</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Output Chars</span>
              <span className="text-sm" id="last-output-chars">—</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Est. Tokens Used</span>
              <span className="text-sm font-semibold text-blue-400" id="last-tokens">—</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">🗂️ Scripts Registry</h2>
          <div id="scripts-registry" className="space-y-2 text-sm text-zinc-400">
            <p className="text-zinc-600 italic">Loading registry...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

  const fs = await import("node:fs");
  // Save dashboard route source + password for Zo AI to deploy
  const dashPath = join(workspace, "refer-dashboard-route.txt");
  const metaPath = join(workspace, "refer-dashboard-meta.json");
  fs.writeFileSync(dashPath, dashboardContent);
  fs.writeFileSync(metaPath, JSON.stringify({ password, routePath: "/referdashboard" }, null, 2));
  console.log("  Dashboard route source saved to workspace.");
  return password;
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

  // ── 7. Install factory system ──────────────────────────────
  console.log("\n--- Installing Script Factory system ---");
  const factoryDir = join(scriptsTarget, "factory");
  ensureDir(factoryDir);
  ensureDir(join(factoryDir, "artifacts"));
  ensureDir(join(factoryDir, "lib"));

  // Copy factory core files
  const factoryFiles = [
    ["intake-engine.mjs", join(factoryDir, "intake-engine.mjs")],
    ["auto-capture.mjs", join(factoryDir, "auto-capture.mjs")],
    ["factory.mjs", join(factoryDir, "factory.mjs")],
    ["lib/ui.mjs", join(factoryDir, "lib/ui.mjs")],
    ["lib/constants.js", join(factoryDir, "lib/constants.js")],
  ];

  for (const [src, dest] of factoryFiles) {
    const srcPath = join(SCRIPTS_DIR, src);
    if (existsSync(srcPath)) {
      cpSync(srcPath, dest, { overwrite: true });
      console.log(`  Installed: ${src}`);
    }
  }

  // Copy preset scripts
  const artifactsDir = join(factoryDir, "artifacts");
  const presets = [
    "button-add.mjs",
    "page-add.mjs",
    "form-add.mjs",
    "scan-workspace.mjs",
    "git-commit.mjs",
    "deploy-pages.mjs",
  ];
  for (const preset of presets) {
    const srcPath = join(ARTIFACTS_DIR, preset);
    if (existsSync(srcPath)) {
      cpSync(srcPath, join(artifactsDir, preset), { overwrite: true });
      console.log(`  Preset: ${preset}`);
    }
  }

  // Ensure registry exists
  const registryPath = join(factoryDir, "script-registry.json");
  if (!existsSync(registryPath)) {
    const { generateRegistry } = await import(join(factoryDir, "auto-capture.mjs")).catch(() => ({ generateRegistry: null }));
    writeFileSync(registryPath, JSON.stringify({
      version: "1.0",
      updatedAt: new Date().toISOString(),
      scripts: [
        { id: "page-add", trigger: ["add page", "new page", "create page"], description: "Add a new page", category: "page", questions: [{ id: "page-path", label: "Page path", type: "text", required: true }, { id: "page-type", label: "Type", type: "select", options: ["Public", "Private", "API"], required: true }], output: "Zo Space route" },
        { id: "form-add", trigger: ["add form", "new form", "form"], description: "Add a form", category: "component", questions: [{ id: "form-type", label: "Form type", type: "select", options: ["Add", "Edit", "Search"], required: true }, { id: "fields", label: "Fields", type: "select", options: ["Minimal", "Standard", "Full"], required: true }], output: "Form component" },
        { id: "button-add", trigger: ["add button", "button"], description: "Add a button", category: "element", questions: [{ id: "label", label: "Label", type: "text", required: true }, { id: "variant", label: "Variant", type: "select", options: ["Primary", "Secondary", "Ghost"], required: true }], output: "Button code" },
        { id: "scan-workspace", trigger: ["scan", "workspace"], description: "Scan workspace", category: "tool", questions: [], output: "Tree file" },
        { id: "git-commit", trigger: ["commit", "save"], description: "Git commit", category: "git", questions: [{ id: "message", label: "Commit message", type: "text", required: true }], output: "git commit" },
        { id: "deploy-pages", trigger: ["deploy", "publish"], description: "Deploy to Cloudflare", category: "deploy", questions: [{ id: "target", label: "Target", type: "select", options: ["staging", "production"], required: true }], output: "wrangler deploy" },
      ],
    }, null, 2));
    console.log("  Registry initialized.");
  }

  console.log("  Factory ready. Run: node scripts/factory/factory.mjs list");

  // ── 8. Create Zo dashboard page ──────────────────────────────────
  console.log("\n--- Creating Zo dashboard ---");
  const dashMeta = await ensureZoDashboard(scriptsTarget, WORKSPACE);

  // ── 9. Write install state ───────────────────────────────────────
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
    dashboard_password: dashMeta,
  };
  writeFileSync(join(WORKSPACE, "refer-install-state.json"), JSON.stringify(state, null, 2));

  console.log(`\n✅ Bootstrap complete for profile: ${profile}`);
  console.log(`   Profile root: ${profileRoot}`);
  console.log(`   Scripts: ${scriptsTarget}`);
  console.log(`   Dashboard: https://apostlej.zo.space/referdashboard`);
  console.log(`   Dashboard password: ${dashMeta}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Edit the route code in Zo Space to deploy /referdashboard`);
  console.log(`   2. Check refer-dashboard-meta.json for the generated password`);
  console.log(`   3. Run: node scripts/token/token-dashboard.mjs --stats`);
}

main(process.argv.slice(2)).catch(err => {
  console.error(`Bootstrap failed: ${err.message}`);
  process.exit(1);
});