#!/usr/bin/env node
 * @opcodes ['DETECT_MODE', 'CHECK_SATISFACTION', 'NOVEL_COMPLEX_SPLIT', 'CHUNK_SPLIT', 'STORE_CONTRACT']
 * @trigger add build discuss micro
 * @description Gatekeeper — routes prompts, approves AI involvement
 * @forge-type gate
 * @forge-name Intake Engine
 * @forge-id intake-engine
/**
 * INTAKE ENGINE v5 — Three-Mode + S-Expressions + Decompression + Auto-Chunking
 *
 * DISCUSS MODE:   bypasses scripts — free-form AI chat
 * MICRO MODE:    ≤1 file — fires directly, no gate
 * BUILD MODE:    full scope — satisfaction required → Build Director → compressed S-expression
 *
 * Architecture:
 *   Human English → Intake → classify() weight → [bounded] direct execute
 *                                                  → [risky]  auto-chunker → chunked execution
 *                 → S-expression (compressed) → Script → S-expression output
 *                 → Decompress → Human language back to user
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { classify } from "./auto-chunker.mjs";
import { store } from "./dataset-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = __dirname;
const REGISTRY_FILE = join(SCRIPTS_DIR, "script-registry.json");
const CHUNKS_DIR = join(SCRIPTS_DIR, "chunks");

function ensureChunksDir() {
  if (!existsSync(CHUNKS_DIR)) mkdirSync(CHUNKS_DIR, { recursive: true });
}

// ── Mode detection ──────────────────────────────────────────────────────────

function detectMode(prompt) {
  const p = prompt.toLowerCase();
  if (/^\s*(add|just|quick|fix|fixing|update|change|delete|remove)\s+[\w\/]/.test(p)) return "MICRO";
  if (/^\s*(build|execute|run|lets?\s*go|do it|ship|deploy|make it|go ahead)\s/i.test(p)) return "BUILD";
  return "DISCUSS";
}

const SATISFACTION_KEYS = ["target","type","where","what","who","how","error state","success","route","file","endpoint"];

function hasSatisfaction(prompt) {
  const p = prompt.toLowerCase();
  return SATISFACTION_KEYS.some(k => p.includes(k));
}

// ── Registry ────────────────────────────────────────────────────────────────

function loadRegistry() {
  try { return JSON.parse(readFileSync(REGISTRY_FILE, "utf8")); }
  catch { return { version: "1.0", scripts: [] }; }
}

function matchScript(prompt, registry) {
  const p = prompt.toLowerCase();
  for (const entry of registry.scripts || []) {
    if ((entry.triggers || []).some(t => p.includes(t.toLowerCase()))) return entry;
  }
  return null;
}

// ── Intent contract ─────────────────────────────────────────────────────────

function intentContract(prompt, mode, matched) {
  const ts = new Date().toISOString();
  if (matched) return {
    intent: "script-execute", mode,
    script_id: matched.id, script_name: matched.name,
    satisfaction: hasSatisfaction(prompt),
    prompt, timestamp: ts, s_expression: null,
  };
  const s_exp = compressPrompt(prompt);
  return {
    intent: mode === "BUILD" ? "ai-build" : "ai-discuss",
    mode, prompt, timestamp: ts,
    s_expression: s_exp,
    satisfaction: hasSatisfaction(prompt),
  };
}

// ── S-expression compression ────────────────────────────────────────────────

function compressPrompt(prompt) {
  // Minimal compression: strip articles, lowercase, trim whitespace
  return prompt
    .replace(/\b(the|a|an|to|and|or|but)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ── Chunk session management ──────────────────────────────────────────────────

function createChunkSession(prompt, chunks) {
  ensureChunksDir();
  const sessionId = `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const session = {
    session_id: sessionId,
    original_prompt: prompt,
    total_chunks: chunks.length,
    chunks: chunks.map((chunk, i) => ({
      index: i,
      prompt: chunk,
      status: "pending",
      result: null,
      started_at: null,
      completed_at: null,
      error: null,
    })),
    created_at: new Date().toISOString(),
    current_index: 0,
  };
  writeFileSync(join(CHUNKS_DIR, `${sessionId}.json`), JSON.stringify(session, null, 2));
  // Create empty log
  writeFileSync(join(CHUNKS_DIR, `${sessionId}.log`), "", { flag: "w" });
  return session;
}

function loadChunkSession(sessionId) {
  const path = join(CHUNKS_DIR, `${sessionId}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveChunkSession(session) {
  writeFileSync(join(CHUNKS_DIR, `${session.session_id}.json`), JSON.stringify(session, null, 2));
}

function appendChunkLog(sessionId, line) {
  writeFileSync(join(CHUNKS_DIR, `${sessionId}.log`), `${line}\n`, { flag: "a" });
}

function getNextPendingChunk(session) {
  return session.chunks.find(c => c.status === "pending") || null;
}

function markChunkDone(session, index, result) {
  session.chunks[index].status = "done";
  session.chunks[index].result = result;
  session.chunks[index].completed_at = new Date().toISOString();
  saveChunkSession(session);
  appendChunkLog(session.session_id, `[${new Date().toISOString()}] chunk ${index} done: ${JSON.stringify(result).slice(0, 200)}`);
}

function markChunkFailed(session, index, error) {
  session.chunks[index].status = "failed";
  session.chunks[index].error = error;
  session.chunks[index].completed_at = new Date().toISOString();
  saveChunkSession(session);
  appendChunkLog(session.session_id, `[${new Date().toISOString()}] chunk ${index} FAILED: ${error}`);
}

function isSessionComplete(session) {
  return session.chunks.every(c => c.status === "done" || c.status === "failed");
}

// ── Main intake ───────────────────────────────────────────────────────────────

export function intake(prompt) {
  const mode = detectMode(prompt);
  const registry = loadRegistry();
  const matched = matchScript(prompt, registry);
  const contract = intentContract(prompt, mode, matched);

  // ── Weight classification (risky vs bounded) ──
  const { risk, reason } = classify(prompt);

  // ── Log EVERY request to chat-contracts ─────────────────────────────────
  try {
    const record = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      session_id: `c_${Date.now()}`,
      timestamp: new Date().toISOString(),
      prompt: prompt.slice(0, 500),
      mode,
      risk,
      chunks: 1,
      chunk_ids: null,
      status: "pending",
    };
    store.log("chat-contracts", record);
    console.log("[intake] logged | mode:", mode, "| risk:", risk);
  } catch (e) {
    console.error("[intake] dataset log error:", e.message);
  }

  // ── Novel/complex diversion → PLAN before BUILD ──
  if (detectNovelComplex(prompt)) {
    return {
      ...contract,
      intent: "plan-only",
      mode: "PLAN",
      needs_chunking: false,
      reason: "novel-complex",
    };
  }

  // ── Chunking decision — classify by RISK, not by mode ──
  // Any risky prompt gets chunked regardless of DISCUSS/BUILD/MICRO mode.
  // DISCUSS bypasses scripts but not chunking when risk is high.
  if (risk === "risky") {
    // Split into chunks
    const sentences = prompt.split(/(?<=[.!?])\s+/).filter(Boolean);
    const chunks = sentences.length > 1
      ? sentences
      : prompt.split(/,\s*/).filter(s => s.trim().length > 10);

    if (chunks.length > 1) {
      const session = createChunkSession(prompt, chunks);
      return {
        ...contract,
        needs_chunking: true,
        chunk_session_id: session.session_id,
        total_chunks: chunks.length,
        chunks: session.chunks,
        current_index: 0,
        risk,
        reason,
      };
    }
  }

  // ── Single chunk or DISCUSS (no chunking) ──
  return {
    ...contract,
    needs_chunking: false,
    chunk_session_id: null,
    total_chunks: 1,
    chunks: null,
    risk,
    reason,
  };
}

// ── Public helpers for Director ───────────────────────────────────────────────

export { loadChunkSession, getNextPendingChunk, markChunkDone, markChunkFailed, isSessionComplete, classify };

export function listScripts() {
  const reg = loadRegistry();
  return (reg.scripts || []).map(s => ({
    id: s.id,
    name: s.name,
    trigger: (s.trigger_intents || []).join(", "),
    hasQuestions: (s.questions || []).length > 0,
  }));
}

function detectNovelComplex(prompt) {
  const p = prompt.toLowerCase();
  const novelSignals = [
    /\b(complete|full|whole|entire)\b/i,
    /\b(system|platform|module|subsystem)\b/i,
    /\b(with\s+\w+\s+and\s+\w+)/i,
  ];
  const count = novelSignals.filter(s => s.test(p)).length;
  const wordCount = prompt.split(/\s+/).length;
  return count >= 2 || wordCount > 20;
}