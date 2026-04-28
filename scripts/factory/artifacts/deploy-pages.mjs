/**
 * deploy-pages.mjs
 * Deploys the Zo Site to Cloudflare Pages via Wrangler.
 */

import { execSync, spawnSync } from "node:child_process";

export default async function execute(contract, opts = {}) {
  const { answers = {} } = contract;
  
  const target = answers["target"] || "staging";
  const includeDb = answers["include-db"] === "Yes";
  
  const steps = [];
  const errors = [];
  
  // Step 1: Run Supabase migrations if requested
  if (includeDb) {
    try {
      execSync("supabase db push", { encoding: "utf8", stdio: "pipe" });
      steps.push({ cmd: "supabase db push", status: "ok", output: "Migrations pushed" });
    } catch (e) {
      errors.push({ cmd: "supabase db push", error: e.message });
      steps.push({ cmd: "supabase db push", status: "error", output: e.message });
    }
  }
  
  // Step 2: Build
  try {
    const buildCmd = "npm run build";
    execSync(buildCmd, { encoding: "utf8", stdio: "pipe" });
    steps.push({ cmd: buildCmd, status: "ok", output: "Build complete" });
  } catch (e) {
    errors.push({ cmd: "npm run build", error: e.message });
    steps.push({ cmd: "npm run build", status: "error", output: e.message });
    return {
      steps,
      errors,
      message: `Build failed. Fix errors before deploying.`,
    };
  }
  
  // Step 3: Deploy
  const deployCmd = target === "production"
    ? "wrangler pages deploy dist --project-name=YOUR-PROJECT"
    : "wrangler pages deploy dist --project-name=YOUR-PROJECT --branch=staging";
  
  try {
    execSync(deployCmd, { encoding: "utf8", stdio: "pipe" });
    steps.push({ cmd: deployCmd, status: "ok", output: `Deployed to ${target}` });
  } catch (e) {
    errors.push({ cmd: deployCmd, error: e.message });
    steps.push({ cmd: deployCmd, status: "error", output: e.message });
  }
  
  const success = errors.length === 0;
  
  return {
    target,
    steps,
    errors,
    message: success
      ? `Deployed to ${target} successfully.`
      : `Deployed with ${errors.length} error(s). Check output above.`,
    deployUrl: success && target === "production"
      ? "https://your-project.pages.dev"
      : `https://your-project--${target}.pages.dev`,
  };
}
