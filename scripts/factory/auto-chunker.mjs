#!/usr/bin/env node
 * @opcodes ['DETECT_COMPLEXITY', 'TOKENIZE', 'SPLIT_SENTENCES', 'WRITE_CHUNK_SESSION']
 * @trigger split chunk complex request
 * @description Auto-detects chunking needs and splits requests by complexity and token weight
 * @forge-type gate
 * @forge-name Auto Chunker
 * @forge-id auto-chunker
/**
 * auto-chunker.mjs — Risky Request Auto-Chunker
 *
 * Detects "risky" operations that need chunking and auto-splits them.
 * Bounded operations go direct. Risky operations get broken into
 * deterministic chunks with state persistence.
 *
 * Risky = any operation that compounds tool calls, iterates, or has
 * unknown output size. NOT classified by weight — just by risk signature.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHUNKS_DIR = join(__dirname, "chunks");
const SESSION_FILE = join(CHUNKS_DIR, "session.jsonl");

// ─── Risky Signal Detection ─────────────────────────────────────────────────

const RISKY_PATTERNS = [
  /find\s+/i,                          // file system traversal
  /grep\s+/i,                           // content search
  /scan/i,                              // scanning operations
  /glob/i,                              // glob patterns
  /readdir/i,                           // directory listing
  /readFile/i,                           // file read chain
  /list_files/i,                         // tool call chains
  /\.(forEach|map|filter|reduce)/i,     // iteration
  /while\s*\(/i,                        // while loops
  /for\s*\(/i,                          // for loops
  /recursive/i,                          // recursive operations
  /\|\s*\w+\s*\|/i,                    // piped commands
  /\bcp\b/i,                            // copy operations
  /\bmv\b/i,                            // move operations
  /\brm\b/i,                            // remove operations
  /\bsync\b/i,                          // sync operations
  /\.mjs\b.*\.mjs\b/i,                // multi-file script chains
  /tool_call/i,                          // tool call chains
  /concurrent/i,                          // concurrent execution
  /parallel/i,                           // parallel ops
  /spawn/i,                              // process spawning
  /exec/i,                               // command execution
  /build.*deploy/i,                      // build+deploy chains
  /deploy.*publish/i,                     // deploy chains
  /mcp.*mcp/i,                           // MCP call chains
  /update_space/i,                        // space mutation chains
  /write_space/i,                         // space write chains
  /git.*push/i,                           // git push
  /git.*pull/i,                           // git pull
  /git.*clone/i,                          // git clone
  /curl.*curl/i,                          // multi curl chains
];

const BOUNDED_PATTERNS = [
  /^add\s+\w+\s+\w+/i,                // "add button X"
  /^just\s+/i,                           // "just fix it"
  /^quick\s+/i,                          // "quick update"
  /^fix\s+\w+/i,                         // "fix X"
  /^create\s+(file|route|page|api)/i,   // single create
  /^read\s+(file|one)/i,                 // single read
  /^list\s+(one|a)/i,                    // single list
  /^show\s+(me\s+)?\w+/i,               // "show me X"
  /^what\s+is\s+\w+/i,                  // "what is X"
  /^check\s+\w+/i,                       // "check X"
];

function isRisky(prompt) {
  return RISKY_PATTERNS.some(p => p.test(prompt));
}

function isBounded(prompt) {
  return BOUNDED_PATTERNS.some(p => p.test(prompt));
}

// ─── Chunking Strategy ─────────────────────────────────────────────────────

const MAX_CHUNK_INPUT_TOKENS = 4000;   // safety cap per chunk
const WORDS_PER_TOKEN = 0.75;
const CHUNK_STATES = ["pending", "running", "done", "failed"];

function countTokens(text) {
  return Math.ceil(text.length / WORDS_PER_TOKEN);
}

function splitIntoChunks(prompt, context = "") {
  const base = context ? `${context}\n\nPROMPT: ${prompt}` : prompt;
  const tokens = countTokens(base);

  if (tokens <= MAX_CHUNK_INPUT_TOKENS) {
    return [{ index: 0, text: prompt, context, strategy: "direct" }];
  }

  // Split by sentence boundary for clean cuts
  const sentences = base.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);
    if (currentTokens + sentenceTokens > MAX_CHUNK_INPUT_TOKENS && current.length > 0) {
      chunks.push(current.join(" "));
      current = [sentence];
      currentTokens = sentenceTokens;
    } else {
      current.push(sentence);
      currentTokens += sentenceTokens;
    }
  }
  if (current.length) chunks.push(current.join(" "));

  return chunks.map((text, i) => ({
    index: i,
    text: prompt,
    context,
    chunk_text: text,
    strategy: "chunks",
    total: chunks.length,
    part: i + 1,
  }));
}

// ─── Session Persistence ───────────────────────────────────────────────────

function loadSession(requestId) {
  const file = join(CHUNKS_DIR, `${requestId}.json`);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}

function saveSession(session) {
  const file = join(CHUNKS_DIR, `${session.request_id}.json`);
  writeFileSync(file, JSON.stringify(session, null, 2), "utf8");
}

function appendLog(requestId, entry) {
  if (!existsSync(CHUNKS_DIR)) import("node:fs").then(m => m.mkdirSync(CHUNKS_DIR, { recursive: true }));
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  writeFileSync(join(CHUNKS_DIR, `${requestId}.log`), line + "\n", { flag: "a" });
}

// ─── Main API ─────────────────────────────────────────────────────────────

export function classify(prompt) {
  if (isBounded(prompt)) return { risk: "bounded", needs_chunking: false, reason: "single-action" };
  if (isRisky(prompt)) return { risk: "risky", needs_chunking: true, reason: detectRiskReason(prompt) };
  return { risk: "unknown", needs_chunking: true, reason: "unclassifiable-prompt" };
}

function detectRiskReason(prompt) {
  for (const p of RISKY_PATTERNS) if (p.test(prompt)) return p.toString().replace(/\//g, "");
  return "unknown";
}

export function planChunks(requestId, prompt, context = "") {
  const chunks = splitIntoChunks(prompt, context);
  const session = {
    request_id: requestId,
    prompt,
    context,
    risk: classify(prompt).risk,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    state: "active",
    current_chunk: 0,
    total_chunks: chunks.length,
    chunks: chunks.map((c, i) => ({
      index: i,
      state: i === 0 ? "pending" : "pending",
      input: c.text,
      context: c.context || "",
      output: null,
      error: null,
      started_at: null,
      completed_at: null,
    })),
  };
  saveSession(session);
  appendLog(requestId, { event: "planned", total: chunks.length });
  return session;
}

export function markChunkStart(requestId, chunkIndex) {
  const session = loadSession(requestId);
  if (!session) return;
  session.chunks[chunkIndex].state = "running";
  session.chunks[chunkIndex].started_at = new Date().toISOString();
  session.state = "active";
  session.current_chunk = chunkIndex;
  session.updated_at = new Date().toISOString();
  saveSession(session);
}

export function markChunkDone(requestId, chunkIndex, output) {
  const session = loadSession(requestId);
  if (!session) return;
  session.chunks[chunkIndex].state = "done";
  session.chunks[chunkIndex].output = output;
  session.chunks[chunkIndex].completed_at = new Date().toISOString();
  session.updated_at = new Date().toISOString();
  const allDone = session.chunks.every(c => c.state === "done");
  if (allDone) session.state = "completed";
  saveSession(session);
  appendLog(requestId, { event: "chunk_done", chunk: chunkIndex, done: allDone });
}

export function markChunkFailed(requestId, chunkIndex, error) {
  const session = loadSession(requestId);
  if (!session) return;
  session.chunks[chunkIndex].state = "failed";
  session.chunks[chunkIndex].error = error;
  session.chunks[chunkIndex].completed_at = new Date().toISOString();
  session.state = "failed";
  session.updated_at = new Date().toISOString();
  saveSession(session);
  appendLog(requestId, { event: "chunk_failed", chunk: chunkIndex, error });
}

export function getNextChunk(requestId) {
  const session = loadSession(requestId);
  if (!session || session.state === "completed" || session.state === "failed") return null;
  const next = session.chunks.find(c => c.state === "pending");
  return next ? { chunk: next, current_chunk: session.current_chunk, total: session.total_chunks } : null;
}

export function getSession(requestId) {
  return loadSession(requestId);
}

export function getProgress(requestId) {
  const s = loadSession(requestId);
  if (!s) return null;
  const done = s.chunks.filter(c => c.state === "done").length;
  return { done, total: s.total_chunks, state: s.state, pct: Math.round((done / s.total_chunks) * 100) };
}

export default { classify, planChunks, markChunkStart, markChunkDone, markChunkFailed, getNextChunk, getSession, getProgress };
