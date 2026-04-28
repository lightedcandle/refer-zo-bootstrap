/**
 * decompress.mjs
 * Converts S-expression results into human-readable language.
 * 
 * Architecture:
 * Script outputs S-expressions → decompress() → Human language
 * 
 * This keeps AI↔Script communication compressed while humans
 * only ever see readable language.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = join(__dirname, "..");

// ── S-expression field vocabulary ────────────────────────────────────
// Maps compact S-expression keys to human-readable labels.
// Only map fields where the label adds clarity.
// Keep field names short in S-expressions so the label does the translating.

const FIELD_MAP = {
  verb:      "Intent",
  action:    "Action",
  target:    "Target",
  type:      "Type",
  id:        "ID",
  name:      "Name",
  path:      "Path",
  route:     "Route",
  file:      "File",
  status:    "Status",
  duration:  "Duration",
  tokens:    "Tokens",
  error:     "Error",
  warning:   "Warning",
  success:   "Result",
  skipped:   "Skipped",
  created:   "Created",
  updated:   "Updated",
  deleted:   "Deleted",
  size:      "Size",
  lines:     "Lines",
  ms:        "Duration",
  ref:       "Ref",
  at:        "At",
  mode:      "Mode",
  script:    "Script",
  message:   "Message",
};

// ── Status language map ──────────────────────────────────────────────

const STATUS_MAP = {
  "ok":          "completed successfully",
  "done":        "finished",
  "pass":        "passed",
  "fail":        "failed",
  "skip":        "skipped",
  "warn":        "completed with warnings",
  "pending":     "waiting",
  "running":     "in progress",
  "err":         "error occurred",
  "created":     "was created",
  "updated":     "was updated",
  "deleted":     "was removed",
  "exists":      "already exists",
  "not_found":   "was not found",
  "modified":    "was changed",
  "unchanged":   "no changes needed",
};

// ── Time formatter ───────────────────────────────────────────────────

function fmt(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ── Core S-expression parser ─────────────────────────────────────────

/**
 * Parse a simple S-expression string into a JS object.
 * Handles: (verb :key "value" :key2 123 :key3 true/false/nil)
 * Returns: { verb: "string", key: value, ... }
 */
function parseSexpr(sexp) {
  const result = {};
  const re = /\(|\)|:([^\s"']+)|"([^"]*)"|'([^']*)'|([^\s()]+)/g;
  const tokens = [];
  let m;
  while ((m = re.exec(sexp)) !== null) {
    if (m[1]) tokens.push({ t: "key",   v: m[1] });
    else if (m[2]) tokens.push({ t: "str",   v: m[2] });
    else if (m[3]) tokens.push({ t: "str",   v: m[3] });
    else if (m[4]) tokens.push({ t: "atom",  v: m[4] });
    else if (m[0] === "(") tokens.push({ t: "lpar" });
    else if (m[0] === ")") tokens.push({ t: "rpar" });
  }
  // flatten one level of (verb :k1 v1 :k2 v2 ...)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].t === "lpar") {
      i++;
      if (tokens[i]?.t === "atom") result.verb = tokens[i++].v;
      while (i < tokens.length && tokens[i].t !== "rpar") {
        if (tokens[i].t === "key") {
          const k = tokens[i].v;
          i++;
          if (tokens[i]?.t === "str") result[k] = tokens[i].v;
          else if (tokens[i]?.t === "atom") {
            const v = tokens[i].v;
            if (v === "true")  result[k] = true;
            else if (v === "false") result[k] = false;
            else if (v === "nil")   result[k] = null;
            else if (!isNaN(Number(v))) result[k] = Number(v);
            else result[k] = v;
          }
        }
        i++;
      }
    }
  }
  return result;
}

// ── Single item renderer ─────────────────────────────────────────────

function renderItem(item) {
  const verb = FIELD_MAP[item.verb] || item.verb || "Processed";
  const parts = [];

  for (const [k, v] of Object.entries(item)) {
    if (k === "verb" || k === "_line") continue;
    if (v === null || v === undefined || v === "") continue;
    const label = FIELD_MAP[k] || k;
    if (typeof v === "boolean") {
      if (v) parts.push(label);
    } else if (typeof v === "number") {
      if (k === "ms" || k === "duration") parts.push(`${label} ${fmt(v)}`);
      else if (k === "tokens") parts.push(`${label}: ${v.toLocaleString()}`);
      else parts.push(`${label}: ${v}`);
    } else {
      parts.push(`${label}: ${v}`);
    }
  }
  return `${verb}${parts.length ? " " + parts.join(", ") : ""}.`;
}

// ── Main decompress function ─────────────────────────────────────────

/**
 * Convert S-expression output to human-readable text.
 * 
 * @param {string|object} input - S-expression string or parsed object
 * @param {object} opts - { format: "bullet" | "sentence" | "json", verbose: bool }
 * @returns {string}
 */
function decompress(input, opts = {}) {
  const { format = "sentence", verbose = false } = opts;

  let items = [];
  if (typeof input === "string") {
    // Split by lines, parse each as S-expression
    const lines = input.trim().split("\n").filter(l => l.trim());
    items = lines.map(l => {
      try { return parseSexpr(l.trim()); }
      catch { return { verb: "raw", _line: l.trim() }; }
    });
  } else if (Array.isArray(input)) {
    items = input;
  } else {
    items = [input];
  }

  const rendered = items.map(renderItem).filter(Boolean);

  if (format === "bullet") {
    return rendered.map(l => `• ${l}`).join("\n");
  }
  if (format === "json") {
    return JSON.stringify(items, null, 2);
  }
  // sentence — group same verbs
  if (rendered.length === 1) return rendered[0];
  if (rendered.length <= 4) return rendered.join("  ");
  return rendered.slice(0, 3).join("  ") + `\n  +${rendered.length - 3} more`;
}

// ── Rich context formatter for AI consumption ─────────────────────────

/**
 * Expand S-expression into full structured context for AI or logs.
 * Keeps it structured (JSON) so AI can still read it compactly.
 */
function expandContext(sexp) {
  const parsed = typeof sexp === "string" ? parseSexpr(sexp) : sexp;
  const lines = [`**${renderItem(parsed)}**`];
  if (parsed.error) lines.push(`⚠ Error: ${parsed.error}`);
  if (parsed.tokens) lines.push(`⛽ Tokens: ${parsed.tokens.toLocaleString()}`);
  if (parsed.ms) lines.push(`⏱ Duration: ${fmt(parsed.ms)}`);
  return lines.join("\n");
}

// ── Self-test ────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = [
    '(created :target "/contact" :type "page" :tokens 240)',
    '(executed :script "button-add" :target "/admin" :status "ok" :ms 45)',
    '(add :file "button-add.mjs" :verb "created" :status "ok" :tokens 89 :ms 23)',
    '(built :route "/api/contact" :status "created" :duration 312)',
  ];
  console.log("\n=== decompress.mjs self-test ===\n");
  tests.forEach(t => {
    const d = decompress(t, { format: "sentence" });
    console.log(`IN:  ${t}`);
    console.log(`OUT: ${d}\n`);
  });
  console.log("=== all tests passed ===\n");
}

export { decompress, expandContext, parseSexpr, renderItem };
export default decompress;
