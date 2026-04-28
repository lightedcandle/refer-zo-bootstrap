#!/usr/bin/env node
/**
 * interlink.mjs — Inter-Zo Remote Access
 *
 * Opens an MCP session to a target Zo using its API key,
 * then executes commands on the target as if locally.
 *
 * Usage:
 *   node interlink.mjs --target <profile> -- cmd "ls /home/workspace"
 *   node interlink.mjs --target <profile> -- read /home/workspace/AGENTS.md
 *   node interlink.mjs --target <profile> -- write /home/workspace/test.txt "hello"
 *   node interlink.mjs --target <profile> -- list-tools
 *   node interlink.mjs --target <profile> -- automation-status
 *
 * Environment:
 *   INTERLINK_<PROFILE>_KEY  — target Zo API key
 *   ZO_COMPUTER_REFER        — fallback
 */

const MCP_URL = "https://api.zo.computer/mcp";
const PROTOCOL_VERSION = "2024-11-05";

function resolveKey(target) {
  const envKey = `INTERLINK_${String(target).toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_KEY`;
  return process.env[envKey] || process.env.INTERLINK_KEY || process.env.ZO_COMPUTER_REFER;
}

async function openSession(key) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "interlink", version: "0.1.0" }
      }
    })
  });

  const sessionId = response.headers.get("mcp-session-id") ||
                    response.headers.get("Mcp-Session-Id");

  if (!response.ok || !sessionId) {
    throw new Error(`Session open failed: ${response.status} ${response.statusText}`);
  }

  return {
    sessionId,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      "mcp-session-id": sessionId,
    }
  };
}

async function rpc(headers, method, params, id) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  });
  return response.json();
}

async function execOnTarget(headers, command, args) {
  switch (command) {
    case "cmd":
    case "bash": {
      const result = await rpc(headers, "tools/call", {
        name: "run_bash_command",
        arguments: { cmd: args.join(" ") }
      }, Date.now());
      return formatResult(result);
    }

    case "read": {
      const result = await rpc(headers, "tools/call", {
        name: "read_file",
        arguments: { target_file: args[0] }
      }, Date.now());
      return formatResult(result);
    }

    case "write": {
      const targetFile = args[0];
      const content = args.slice(1).join(" ");
      const result = await rpc(headers, "tools/call", {
        name: "create_or_rewrite_file",
        arguments: { target_file: targetFile, content }
      }, Date.now());
      return formatResult(result);
    }

    case "list-tools": {
      const result = await rpc(headers, "tools/list", {}, Date.now());
      return formatResult(result);
    }

    case "automations":
    case "automation-status": {
      const result = await rpc(headers, "list_automations", {}, Date.now());
      return formatResult(result);
    }

    case "files": {
      const result = await rpc(headers, "tools/call", {
        name: "run_bash_command",
        arguments: { cmd: `ls ${args.join(" ")}` }
      }, Date.now());
      return formatResult(result);
    }

    case "heartbeat-status": {
      const result = await rpc(headers, "tools/call", {
        name: "run_bash_command",
        arguments: { cmd: "node /home/workspace/refer-factory/heartbeat.mjs --status 2>&1" }
      }, Date.now());
      return formatResult(result);
    }

    default:
      return `(error :code "unknown-command" :message "Command ${command} not supported")`;
  }
}

function formatResult(result) {
  if (!result) return "(error :code \"no-result\")";
  if (result.error) return `(error :code "${result.error.code}" :message "${result.error.message}")`;

  const content = result?.result?.content;
  if (!content) return `(ok :raw ${JSON.stringify(result).slice(0, 200)})`;

  if (Array.isArray(content)) {
    return content.map(item => item.text || JSON.stringify(item)).join("\n");
  }

  return JSON.stringify(result.result);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  console.log(`Interlink — Remote Zo Access

Usage:
  node interlink.mjs --target <profile> -- <command> [args...]

Commands:
  cmd <bash-command>        Run bash command on target
  bash <bash-command>       Alias for cmd
  read <file>              Read file from target
  write <file> <content>   Write file to target
  list-tools               List available tools on target
  automations              List automations on target
  heartbeat-status         Check factory heartbeat on target
  files [path]             List files in target workspace

Examples:
  node interlink.mjs --target telechurch -- cmd "ls /home/workspace"
  node interlink.mjs --target telechurch -- read /home/workspace/AGENTS.md
  node interlink.mjs --target telechurch -- write /home/workspace/test.txt "hello world"
  node interlink.mjs --target telechurch -- list-tools
  node interlink.mjs --target telechurch -- heartbeat-status

Environment:
  INTERLINK_<PROFILE>_KEY  — API key for target Zo (preferred)
  INTERLINK_KEY            — Fallback key
  ZO_COMPUTER_REFER        — Last resort
`);
  process.exit(0);
}

const targetIdx = args.indexOf("--target");
if (targetIdx === -1) {
  console.log("(error :code \"no-target\" :message \"--target <profile> required\")");
  process.exit(1);
}

const target = args[targetIdx + 1];
const dashDash = args.indexOf("--");
if (dashDash === -1) {
  console.log("(error :code \"no-command\" :message \"Missing -- separator and command\")");
  process.exit(1);
}

const commandArgs = args.slice(dashDash + 1);
const command = commandArgs[0];
const rest = commandArgs.slice(1);

const key = resolveKey(target);
if (!key) {
  console.log(`(error :code "no-key" :message "No key found for target '${target}'. Set INTERLINK_${target.toUpperCase()}_KEY")`);
  process.exit(1);
}

openSession(key).then(session => {
  return execOnTarget(session.headers, command, rest);
}).then(output => {
  console.log(output);
  process.exit(0);
}).catch(err => {
  console.log(`(error :code "interlink-fail" :message "${err.message}")`);
  process.exit(1);
});