/**
 * SCRIPT FACTORY — Core System
 * 
 * How it works:
 * 
 * 1. User prompt enters the INTAKE ENGINE
 * 2. Intake matches intent to a script by trigger keywords
 * 3. Script has embedded QUESTIONS (no AI needed)
 * 4. Questions build a CONTRACT
 * 5. Script executes the contract
 * 6. If script can't handle it → AI APPROVAL GATE
 * 7. AI only gets minimal contract + one question
 * 8. AI solves it
 * 9. AI AUTO-WRITES a script for next time (auto-capture)
 * 10. Script is registered
 * 11. System never asks AI the same thing twice
 */

export const SCRIPTS_DIR = "./scripts/factory";
export const REGISTRY_FILE = "./scripts/factory/script-registry.json";
export const ARTIFACTS_DIR = "./scripts/factory/artifacts";
export const LOG_FILE = "./scripts/factory/execution-log.jsonl";

// Script states
export const STATUS = {
  PENDING: "pending",
  INTAKE: "intake",
  CONTRACT: "contract",
  EXECUTING: "executing",
  DONE: "done",
  FAILED: "failed",
  AI_REQUESTED: "ai_requested",
};

// Script format version — bump when format changes
export const FORMAT_VERSION = "1.0";
