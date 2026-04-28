/**
 * INTAKE ENGINE v2 — Two-Mode with Satisfaction Block
 * 
 * DISCUSS MODE: No execution. Free-flowing conversation. Script bypass.
 * BUILD MODE: Execution gate. Satisfaction block required before firing scripts.
 * 
 * Contract schema:
 * {
 *   intent: "DISCUSS" | "BUILD" | "VENT" | "QUESTION",
 *   op: "NONE" | "ADD_ROUTE" | "ADD_FORM" | "DEPLOY" | ...,
 *   target: string,
 *   params: string[],
 *   context: string,
 *   satisfactionBlock: string | null,  // required before BUILD
 *   tokens_saved: number               // tokens reduced by compression
 * }
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { printIntakeQuestions, printContract, printExecutionResult, printAIGateway } from "./lib/ui.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_FILE = join(SCRIPTS_DIR, "script-registry.json");
const PROCESS_FILE = join(SCRIPTS_DIR, "process-events.jsonl");
const LEGEND_FILE = join(SCRIPTS_DIR, "script-legend.md");
const SELF_REPAIR = [
  "What did we need that did not exist yet?",
  "What was ambiguous?",
  "What had to be manually inferred?",
  "What should become a script, context asset, test, status, or doctrine rule?",
];
const SCRIPTS_DIR = join(__dirname, "artifacts");
const LOG_FILE = join(__dirname, "execution-log.jsonl");
const FACTORY_LOG = join(__dirname, "factory-log.jsonl");

// ── Utilities ──────────────────────────────────────────────────────────────────

export function loadRegistry() {
  if (!existsSync(REGISTRY_FILE)) return { version: "1.0", scripts: [], updatedAt: "" };
  return JSON.parse(readFileSync(REGISTRY_FILE, "utf8"));
}

export function saveRegistry(registry) {
  registry.updatedAt = new Date().toISOString();
  writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

export function log(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n";
  writeFileSync(LOG_FILE, line, { flag: "a" });
}

export function factoryLog(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n";
  writeFileSync(FACTORY_LOG, line, { flag: "a" });
}

/**
 * Match user prompt to a script by trigger keywords.
 * Returns null if no match.
 */
export function matchScript(prompt, registry = null) {
  if (!registry) registry = loadRegistry();
  const p = prompt.toLowerCase();
  
  for (const script of registry.scripts) {
    for (const trigger of script.trigger) {
      if (p.includes(trigger.toLowerCase())) {
        return script;
      }
    }
  }
  return null;
}

/**
 * Build a contract from answered questions.
 */
export function buildContract(script, answers) {
  return {
    scriptId: script.id,
    timestamp: new Date().toISOString(),
    answers,
    // Intent preserved from original prompt
    intent: null, // filled by caller
  };
}

/**
 * Execute a script by ID with a pre-built contract.
 */
export async function executeScript(scriptId, contract, verbose = false) {
  const scriptFile = join(SCRIPTS_DIR, `${scriptId}.mjs`);
  
  if (!existsSync(scriptFile)) {
    return { ok: false, error: `Script artifact not found: ${scriptId}.mjs` };
  }
  
  try {
    // Dynamic import the script
    const mod = await import(`file://${scriptFile}`);
    const executor = mod.default || mod.execute;
    
    if (typeof executor !== "function") {
      return { ok: false, error: `Script ${scriptId} has no execute function` };
    }
    
    if (verbose) console.log(`\n▶ Executing: ${scriptId}`);
    
    const result = await executor(contract, { verbose });
    
    // Log success
    log({ type: "execution", scriptId, status: "done", result });
    
    return { ok: true, scriptId, result };
    
  } catch (err) {
    log({ type: "execution", scriptId, status: "failed", error: err.message });
    return { ok: false, scriptId, error: err.message };
  }
}

/**
 * The AI gateway. Called when a script can't handle something.
 * Returns the minimal payload to send to AI.
 */
export function aiGateway(script, contract, userPrompt, questionToAsk) {
  return {
    approved: true,
    scriptId: script?.id || null,
    contract,
    minimalPrompt: userPrompt,
    questionToAsk, // e.g. "Which Supabase table should this connect to?"
    // What AI should produce:
    deliverable: "A script file in scripts/factory/artifacts/<name>.mjs",
    autoCapture: true, // AI should write the script
    registrationHint: script ? {
      id: script.id,
      trigger: script.trigger,
      description: script.description,
      category: script.category,
      questions: script.questions,
    } : null,
  };
}

/**
 * Register a new script that AI auto-created.
 */
export function registerScript(scriptDef) {
  const registry = loadRegistry();
  
  // Check if already exists
  const existing = registry.scripts.find(s => s.id === scriptDef.id);
  if (existing) {
    // Update
    Object.assign(existing, scriptDef);
    factoryLog({ type: "script_updated", id: scriptDef.id });
  } else {
    registry.scripts.push(scriptDef);
    factoryLog({ type: "script_registered", id: scriptDef.id });
  }
  
  saveRegistry(registry);
  return { ok: true, id: scriptDef.id, action: existing ? "updated" : "created" };
}

/**
 * List all available scripts.
 */
export function listScripts() {
  const registry = loadRegistry();
  return registry.scripts.map(s => ({
    id: s.id,
    trigger: s.trigger.join(", "),
    description: s.description,
    category: s.category,
    hasQuestions: s.questions.length > 0,
  }));
}

// ── Main Intake Entry ─────────────────────────────────────────────────────────

/**
 * Main intake function. Call this with the user prompt.
 * 
 * @param {string} userPrompt - The raw user prompt
 * @param {object} options - { verbose, autoAnswer }
 * @returns {object} { stage, script, contract, questions, result, aiPayload }
 */
export async function intake(userPrompt, options = {}) {
  const { verbose = false, autoAnswer = false } = options;
  
  factoryLog({ type: "intake_start", prompt: userPrompt });
  
  // Step 1: Match to script
  const registry = loadRegistry();
  const script = matchScript(userPrompt, registry);
  
  if (!script) {
    // No script found — go to AI gateway
    const aiPayload = aiGateway(null, null, userPrompt, 
      "I don't have a script for this yet. What would you like to build?");
    
    factoryLog({ type: "no_script_match", prompt: userPrompt, stage: "AI_GATEWAY" });
    
    return { 
      stage: "AI_GATEWAY", 
      script: null, 
      aiPayload,
      message: "No script found. Escalating to AI." 
    };
  }
  
  if (verbose) console.log(`\n📋 Script matched: ${script.id}`);
  
  // Step 2: Ask questions
  if (script.questions.length > 0) {
    if (verbose) printIntakeQuestions(script);
    
    let answers = {};
    
    if (autoAnswer) {
      // Auto-answer: pick first option for each required question
      for (const q of script.questions) {
        if (q.required && q.options && q.options.length > 0) {
          answers[q.id] = q.options[0];
        }
      }
      if (verbose) console.log("\n⚡ Auto-answered:", answers);
    } else {
      // In interactive mode, questions are asked by the CLI wrapper
      // For now, return the questions for the caller to handle
      return {
        stage: "QUESTIONS",
        script,
        questions: script.questions,
        message: `Please answer the questions above, then call executeScript("${script.id}", answers)`,
      };
    }
  }
  
  // Step 3: Build contract
  const answers = {}; // populated in QUESTIONS stage
  const contract = buildContract(script, answers);
  contract.intent = userPrompt;
  
  if (verbose) printContract(contract);
  
  // Step 4: Execute
  const result = await executeScript(script.id, contract, verbose);
  
  if (result.ok) {
    factoryLog({ type: "execution_complete", scriptId: script.id, stage: "DONE" });
    return { stage: "DONE", script, contract, result: result.result };
  } else {
    // Script failed — escalate to AI
    const aiPayload = aiGateway(script, contract, userPrompt, 
      `Script ${script.id} failed: ${result.error}. How should we fix this?`);
    
    factoryLog({ type: "script_failed", scriptId: script.id, error: result.error, stage: "AI_GATEWAY" });
    
    return { stage: "AI_GATEWAY", script, contract, aiPayload, error: result.error };
  }
}

// ── CLI Wrapper ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const userPrompt = args.join(" ");
  
  if (!userPrompt) {
    console.log("Usage: node intake-engine.mjs \"add a form\" [--verbose] [--auto-answer]");
    console.log("\nAvailable scripts:");
    const scripts = listScripts();
    for (const s of scripts) {
      console.log(`  ${s.id.padEnd(20)} ${s.trigger}`);
    }
    return;
  }
  
  const verbose = args.includes("--verbose");
  const autoAnswer = args.includes("--auto-answer");
  
  const result = await intake(userPrompt, { verbose, autoAnswer });
  
  console.log("\n" + "=".repeat(60));
  console.log(`STAGE: ${result.stage}`);
  
  if (result.stage === "QUESTIONS") {
    console.log("\nQuestions need answers. Run:");
    console.log(`  node intake-engine.mjs "${userPrompt}" --answer`);
  } else if (result.stage === "DONE") {
    printExecutionResult(result.result);
  } else if (result.stage === "AI_GATEWAY") {
    printAIGateway(result.aiPayload);
  }
}

main().catch(err => {
  console.error(`Intake error: ${err.message}`);
  process.exit(1);
});
