/**
 * @opcodes ['HANDLE_REGISTER', 'HANDLE_DISPATCH', 'HANDLE_STATUS']
 * @trigger register dispatch heartbeat
 * @description Hive endpoint — handles cell registration, chunk dispatch, heartbeat, status queries
 * @forge-type gate
 * @forge-name Hive Receive
 * @forge-id hive-receive
 * hive/receive.mjs — Hive reception handler for apostlej
 *
 * Receives chunk payloads from dispatcher, POSTs to each node.
 * Endpoints:
 *   POST /api/hive  — receive + distribute chunks
 *   GET  /api/hive/status — liveness probe
 */

const HIVE_SECRET = process.env.HIVE_SECRET || "";
const NODES_FILE = "/home/workspace/refer-zo-bootstrap/scripts/factory/hive/nodes.json";
const SELF_FILE  = "/home/workspace/refer-zo-bootstrap/scripts/factory/hive/self.json";
const LOG_FILE   = "/home/workspace/refer-zo-bootstrap/scripts/factory/hive/hive-events.jsonl";
const TIMEOUT_MS = 280000;

function log(type, nodeId, msg, extra={}) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), type, nodeId, msg, ...extra });
  try { require("fs").appendFileSync(LOG_FILE, entry + "\n"); } catch {}
  console.log(`[${type}]${nodeId ? " "+nodeId : ""}: ${msg}`);
}

function requireAuth(headers) {
  const token = (headers.authorization || headers.Authorization || "").replace(/^Bearer\s+/i, "");
  return token === HIVE_SECRET;
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function readJson(path) {
  try { return JSON.parse(require("fs").readFileSync(path, "utf8")); } catch { return null; }
}

async function dispatchChunk(nodeUrl, chunk, sessionId, index) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const url = `${nodeUrl.replace(/\/$/, "")}/api/hive/chunk?session=${sessionId}&index=${index}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HIVE_SECRET}`, "X-Hive-Source": "apostlej" },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (resp.ok) return { ok: true, nodeUrl, index, result: await resp.json().catch(()=>({})) };
      const text = await resp.text().catch(()=>"");
      log("WARN", null, `node ${nodeUrl} HTTP ${resp.status}: ${text.slice(0,120)}`);
    } catch (err) {
      log("WARN", null, `fetch ${nodeUrl} failed: ${err.message}`);
    }
    if (attempt < 1) await new Promise(r => setTimeout(r, 5000));
  }
  return { ok: false, nodeUrl, index, error: "max retries exceeded" };
}

async function handleGet(url) {
  const qs = new URLSearchParams(url.split("?")[1] || "");
  const self = readJson(SELF_FILE) || {};
  const nodesRaw = readJson(NODES_FILE) || { nodes: [] };
  const nodeList = Array.isArray(nodesRaw) ? nodesRaw : (nodesRaw.nodes || []);

  if (qs.get("status") === "1" || url.includes("/api/hive/status")) {
    return json({
      node: self.name || "apostlej",
      version: self.version || "1.0.0",
      secretConfigured: !!HIVE_SECRET,
      nodesOnline: nodeList.filter(n => n.status === "online").length,
      nodesTotal: nodeList.length,
      uptime: process.hrtime().join("."),
    });
  }

  if (qs.get("chunk") === "1" && qs.get("session")) {
    const encoded = qs.get("data") || "";
    let chunk;
    try { chunk = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")); }
    catch { return json({ error: "invalid chunk encoding" }, 400); }
    const session = qs.get("session");
    const index = parseInt(qs.get("index") || "0", 10);
    log("RELAY", null, `relaying chunk ${index} for ${session} to ${nodeList.length} nodes`);
    const results = await Promise.all(nodeList.filter(n => n.status==="online").map(n => dispatchChunk(n.url, chunk, session, index)));
    return json({ dispatched: results.length, results, chunkIndex: index });
  }

  return json({ endpoint: "apostlej-hive", mode: "receiver", configured: !!HIVE_SECRET, nodes: nodeList.length });
}

async function handlePost(nodeUrl, body) {
  const auth = (nodeUrl.headers || {}).authorization || (nodeUrl.Authorization) || "";
  if (!HIVE_SECRET || !requireAuth({ authorization: auth })) {
    log("AUTH", null, "unauthorized POST");
    return json({ error: "unauthorized" }, 401);
  }
  let payload;
  try { payload = JSON.parse(body); } catch { return json({ error: "invalid JSON" }, 400); }

  const { chunks=[], sessionId, mode="dispatch" } = payload;
  const self = readJson(SELF_FILE) || {};
  const nodesRaw = readJson(NODES_FILE) || { nodes: [] };
  const nodeList = Array.isArray(nodesRaw) ? nodesRaw : (nodesRaw.nodes || []);

  log("RECEIVE", null, `received ${chunks.length} chunks session=${sessionId} mode=${mode}`);

  if (mode === "status") {
    return json({ node: self.name||"apostlej", status: "online", secretConfigured: !!HIVE_SECRET, nodeCount: nodeList.length });
  }
  if (mode === "register") {
    const { nodeUrl: regUrl, name, version, skills=[] } = payload;
    if (!regUrl || !name) return json({ error: "nodeUrl and name required" }, 400);
    const entry = { url: regUrl, name, version: version||"1.0.0", skills, status: "online", lastSeen: new Date().toISOString(), registeredAt: new Date().toISOString() };
    const existing = nodeList.findIndex(n => n.url === regUrl);
    if (existing >= 0) nodeList[existing] = entry; else nodeList.push(entry);
    try { require("fs").writeFileSync(NODES_FILE, JSON.stringify({ nodes: nodeList }, null, 2)); } catch {}
    log("REGISTER", name, `registered (total: ${nodeList.length})`);
    return json({ ok: true, nodeCount: nodeList.length, entry });
  }
  if (mode === "dispatch" || chunks.length > 0) {
    const results = await Promise.all(chunks.map((c,i) => dispatchChunk(nodeUrl, c, sessionId, i)));
    const ok = results.filter(r=>r.ok).length;
    log("DISPATCH", null, `${ok}/${results.length} dispatched OK`);
    return json({ total: results.length, successful: ok, failed: results.length-ok, results, sessionId });
  }
  return json({ ok: true, mode: "acknowledged" });
}

export default {
  async fetch(request, env={}) {
    const secret = env.HIVE_SECRET || HIVE_SECRET;
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, "");
    const nodeUrl = `https://${url.host}`;
    if (request.method === "GET" && pathname === "/api/hive") return handleGet(url.search ? `${pathname}${url.search}` : pathname);
    if (request.method === "POST" && pathname === "/api/hive") return handlePost(nodeUrl, await request.text().catch(()=>""));
    return json({ error: "not found" }, 404);
  }
};