/**
 * @opcodes ['SERVE_MANIFEST', 'SERVE_NODES', 'SERVE_EVENTS']
 * @trigger hive api
 * @description Hive distribution API — serves manifest, nodes, events
 * @forge-type bridge
 * @forge-name Hive API
 * @forge-id hive-api
 * hive/api.mjs — Hive Distribution API Route
 *
 * Sits on the Hive Zo at `/api/hive`.
 * Receives heartbeat payloads from connected target Zos.
 * Returns update commands when target is behind.
 * Also handles ack from targets after applying updates.
 *
 * HDP-1 compatible.
 * Path: /api/hive (POST), /api/hive/ack (POST)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HIVE_ROOT = join(__dirname, "..", "..");
const MANIFEST_PATH = join(HIVE_ROOT, "scripts", "factory", "hive", "manifest.json");
const NODES_PATH = join(HIVE_ROOT, "scripts", "factory", "hive", "nodes.json");
const EVENT_LOG = join(HIVE_ROOT, "scripts", "factory", "hive", "hive-events.jsonl");

function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function saveManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function loadNodes() {
  try {
    return JSON.parse(readFileSync(NODES_PATH, "utf8"));
  } catch {
    return { nodes: [] };
  }
}

function saveNodes(nodes) {
  writeFileSync(NODES_PATH, JSON.stringify(nodes, null, 2));
}

function logEvent(type, nodeId, data) {
  const entry = JSON.stringify({
    t: new Date().toISOString(),
    type,
    node_id: nodeId,
    data,
  });
  writeFileSync(EVENT_LOG, entry + "\n", { flag: "a" });
}

function compareVersions(local, hive) {
  const lp = local.split(".").map(Number);
  const hp = hive.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const l = lp[i] || 0;
    const h = hp[i] || 0;
    if (l < h) return -1;
    if (l > h) return 1;
  }
  return 0;
}

function getPackageCommands(packageName, fromVersion, toVersion) {
  const manifest = loadManifest();
  const pkg = manifest.packages?.[packageName];
  if (!pkg) return [];

  // Build update commands from the package definition
  // Each package has a files list or we derive from version diff
  const commands = [];

  // Skills: copy each skill folder to Skills/<skill>/
  if (pkg.skills) {
    for (const skill of pkg.skills) {
      commands.push({
        op: "install_skill",
        skill,
        description: `Install ${skill} skill`,
      });
    }
  }

  // Scripts: copy from scripts/factory/
  if (pkg.scripts) {
    for (const script of pkg.scripts) {
      commands.push({
        op: "write",
        path: script,
        // Content is resolved at request time by reading from HIVE_ROOT + path
        description: `Update ${script}`,
      });
    }
  }

  return commands;
}

function resolveCommandContent(cmd) {
  // Resolve file content from HIVE_ROOT for write ops
  if (cmd.op === "write" && !cmd.content) {
    try {
      const fullPath = join(HIVE_ROOT, cmd.path);
      if (existsSync(fullPath)) {
        cmd.content = readFileSync(fullPath, "utf8");
      }
    } catch {
      // File not found on hive — skip
    }
  }
  return cmd;
}

// ── POST /api/hive ──────────────────────────────────────────────
async function handleHivePost(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const { node, packages, last_sync } = body;
  if (!node?.id) {
    return c.json({ ok: false, error: "node.id is required" }, 400);
  }

  const manifest = loadManifest();
  const nodes = loadNodes();

  // Register or update node
  const existingNode = nodes.nodes.find((n) => n.id === node.id);
  if (existingNode) {
    existingNode.name = node.name || existingNode.name;
    existingNode.last_seen = new Date().toISOString();
    existingNode.packages = packages;
  } else {
    nodes.nodes.push({
      id: node.id,
      name: node.name || node.id,
      registered_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      packages,
    });
  }
  saveNodes(nodes);
  logEvent("heartbeat", node.id, { packages, last_sync });

  // Determine updates needed
  const updates = [];
  for (const [pkgName, localVersion] of Object.entries(packages || {})) {
    const hivePkg = manifest.packages?.[pkgName];
    if (!hivePkg) continue;

    const cmp = compareVersions(localVersion, hivePkg.version);
    if (cmp < 0) {
      // Target is behind — build update commands
      const rawCmds = getPackageCommands(pkgName, localVersion, hivePkg.version);
      const resolvedCmds = rawCmds.map(resolveCommandContent).filter(
        (cmd) => cmd.content || cmd.op === "install_skill"
      );
      updates.push({
        package: pkgName,
        from_version: localVersion,
        to_version: hivePkg.version,
        commands: resolvedCmds,
      });
    }
  }

  const syncId = `sync-${Date.now()}-${node.id}`;
  const response = {
    ok: true,
    sync_id: syncId,
    hive_version: manifest.version,
    sync_needed: updates.length > 0,
    updates,
    messages: updates.length === 0
      ? ["Heartbeat sync complete — all packages current"]
      : [`Syncing ${updates.length} package(s) to target`],
  };

  return c.json(response);
}

// ── POST /api/hive/ack ──────────────────────────────────────────
async function handleHiveAck(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const { node_id, sync_id, applied, errors, new_versions } = body;
  logEvent("ack", node_id, { sync_id, applied, errors, new_versions });

  // Update node's known versions
  if (new_versions) {
    const nodes = loadNodes();
    const n = nodes.nodes.find((n) => n.id === node_id);
    if (n) {
      n.packages = { ...n.packages, ...new_versions };
      n.last_acked = new Date().toISOString();
      saveNodes(nodes);
    }
  }

  return c.json({ ok: true, received: true });
}

// ── GET /api/hive/nodes ─────────────────────────────────────────
async function handleNodesGet(c) {
  const nodes = loadNodes();
  return c.json({ ok: true, nodes: nodes.nodes });
}

// ── GET /api/hive/manifest ──────────────────────────────────────
async function handleManifestGet(c) {
  const manifest = loadManifest();
  return c.json({ ok: true, manifest });
}

// ── POST /api/hive/register ─────────────────────────────────────
// For manually registering a target Zo (e.g., via bootstrap)
async function handleRegister(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const { node_id, node_name, hive_token } = body;
  if (!node_id || !node_name) {
    return c.json({ ok: false, error: "node_id and node_name are required" }, 400);
  }

  // Optional token validation for registration
  if (hive_token) {
    const expected = process.env.HIVE_REGISTRATION_TOKEN || "refer-factory-reg";
    if (hive_token !== expected) {
      return c.json({ ok: false, error: "Invalid registration token" }, 401);
    }
  }

  const nodes = loadNodes();
  const existing = nodes.nodes.find((n) => n.id === node_id);
  if (existing) {
    return c.json({ ok: true, node: existing, note: "already registered" });
  }

  const newNode = {
    id: node_id,
    name: node_name,
    registered_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    packages: {},
  };
  nodes.nodes.push(newNode);
  saveNodes(nodes);

  logEvent("register", node_id, { name: node_name });
  return c.json({ ok: true, node: newNode });
}

// ── Route export for Hono ─────────────────────────────────────────
export default async (c) => {
  const path = c.req.path;
  const method = c.req.method;

  if (path === "/api/hive" && method === "POST") return handleHivePost(c);
  if (path === "/api/hive/ack" && method === "POST") return handleHiveAck(c);
  if (path === "/api/hive/nodes" && method === "GET") return handleNodesGet(c);
  if (path === "/api/hive/manifest" && method === "GET") return handleManifestGet(c);
  if (path === "/api/hive/register" && method === "POST") return handleRegister(c);

  return c.json({ ok: false, error: "Not found" }, 404);
};