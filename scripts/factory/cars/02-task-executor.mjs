import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * cars/02-task-executor.mjs
 * If tasks exist in state, execute the next pending one.
 * Runs only when there is work. Costs tokens only when executing.
 */

export default async function taskExecutor(state, meta) {
  const start = Date.now();
  const task = state.tasks?.find(t => t.status === "pending");

  if (!task) {
    return { status: "idle", duration_ms: Date.now() - start, task_executed: null, task: null };
  }

  task.status = "running";
  task.started_at = new Date().toISOString();

  const SCRIPTS_DIR = join(process.cwd(), "scripts/factory/artifacts");
  const scriptPath = join(SCRIPTS_DIR, `${task.script_id || "default"}.mjs`);

  if (!existsSync(scriptPath)) {
    task.status = "failed";
    task.error = `script not found: ${task.script_id}`;
    task.completed_at = new Date().toISOString();
    return { status: "failed", duration_ms: Date.now() - start, task_executed: null, task, alert: `task ${task.id} failed: script missing` };
  }

  try {
    const { spawn } = await import("node:child_process");
    const child = spawn("node", [scriptPath], { stdio: "inherit" });
    await new Promise((res, rej) => {
      child.on("close", code => code === 0 ? res() : rej(new Error(`exit ${code}`)));
    });

    task.status = "completed";
    task.completed_at = new Date().toISOString();

    return { status: "completed", duration_ms: Date.now() - start, task_executed: task.id, task };

  } catch (err) {
    task.status = "failed";
    task.error = err.message;
    task.completed_at = new Date().toISOString();
    return { status: "failed", duration_ms: Date.now() - start, task_executed: null, task, alert: `task ${task.id} failed: ${err.message}` };
  }
}