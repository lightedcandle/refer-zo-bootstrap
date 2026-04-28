/**
 * git-commit.mjs
 * Runs git add + commit with a structured message.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

export default async function execute(contract, opts = {}) {
  const { answers = {} } = contract;
  
  const commitType = answers["commit-type"] || "feat";
  const commitMessage = answers["commit-message"] || "Update";
  
  const fullMessage = `${commitType}: ${commitMessage}`;
  
  try {
    // Stage all changes
    execSync("git add -A", { encoding: "utf8" });
    
    // Commit
    const output = execSync(`git commit -m "${fullMessage}"`, { encoding: "utf8" });
    
    return {
      commands: [`git add -A`, `git commit -m "${fullMessage}"`],
      message: `Committed: ${fullMessage}`,
      output: output || "No changes to commit",
    };
  } catch (err) {
    const msg = err.message || "";
    
    if (msg.includes("nothing to commit")) {
      return {
        commands: [],
        message: "Nothing to commit. Working tree clean.",
        output: msg,
      };
    }
    
    return {
      commands: [`git add -A`, `git commit -m "${fullMessage}"`],
      error: err.message,
      message: `Commit failed: ${err.message}`,
    };
  }
}
