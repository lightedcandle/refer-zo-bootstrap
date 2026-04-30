#!/usr/bin/env node
/**
 * fetch-zo-talkback.mjs
 *
 * Pulls talkback files from a Zo computer through MCP read_file and stores
 * them locally. This is the return half of the file/API tandem lane.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { decodePacket } from "./compression-codec.mjs";
import { logTokenUse } from "./token-log-bridge.mjs";

function parseArgs(argv) {
  const args = {
    instance: "telechurch",
    contractId: "",
    remoteRoot: "/home/workspace",
    localInbox: "datasets/tandem-talkback/inbox",
    compressed: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--instance" && argv[i + 1]) args.instance = argv[++i];
    else if (argv[i] === "--contract-id" && argv[i + 1]) args.contractId = argv[++i];
    else if (argv[i] === "--remote-root" && argv[i + 1]) args.remoteRoot = argv[++i];
    else if (argv[i] === "--local-inbox" && argv[i + 1]) args.localInbox = argv[++i];
    else if (argv[i] === "--compressed") args.compressed = true;
  }
  if (!args.contractId) throw new Error("fetch requires --contract-id");
  return args;
}

function mcpCall(instance, tool, toolArgs) {
  const args64 = Buffer.from(JSON.stringify(toolArgs), "utf8").toString("base64");
  const output = execFileSync(
    process.execPath,
    ["tools/zo-mcp.mjs", "call", tool, "--instance", instance, "--args64", args64, "--json"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  return JSON.parse(output);
}

function extractText(result) {
  const content = result?.result?.result?.content || result?.result?.content;
  if (!Array.isArray(content)) return "";
  const text = content
    .map((item) => (item?.type === "text" ? item.text : JSON.stringify(item)))
    .join("\n");
  return normalizeZoReadText(text);
}

function normalizeZoReadText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed.startsWith("[")) return text;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.join("\n");
  } catch {
    return text;
  }
  return text;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const safeId = String(args.contractId).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const suffix = args.compressed ? ".sx1.txt" : ".json";
  const remotePath = `${args.remoteRoot.replace(/\/$/, "")}/datasets/tandem-talkback/outbox/${safeId}${suffix}`;
  const read = mcpCall(args.instance, "read_file", { target_file: remotePath });
  const text = extractText(read);
  if (!read.ok || !text) {
    throw new Error(`No talkback content returned for ${remotePath}`);
  }

  mkdirSync(args.localInbox, { recursive: true });
  const rawPath = join(args.localInbox, `${safeId}${suffix}`);
  writeFileSync(rawPath, text.endsWith("\n") ? text : `${text}\n`, "utf8");

  let decodedPath = "";
  let decoded = null;
  if (args.compressed) {
    decoded = decodePacket(normalizeZoReadText(text).trim());
    decodedPath = join(args.localInbox, `${safeId}.decoded.json`);
    writeFileSync(decodedPath, `${JSON.stringify(decoded, null, 2)}\n`, "utf8");
  }

  const result = {
    ok: true,
    instance: args.instance,
    contract_id: args.contractId,
    remote_path: remotePath,
    local_path: rawPath,
    decoded_path: decodedPath || undefined,
    decoded_domain: decoded?.domain,
  };
  result.token_log = logTokenUse({
    agent: "fetch-zo-talkback",
    script: "fetch-zo-talkback",
    inputChars: remotePath.length,
    outputChars: text.length + JSON.stringify(result).length,
    status: "done",
    contractId: args.contractId,
    zoComputer: args.instance,
    note: args.compressed
      ? "fetched compressed Zo talkback through file/API lane"
      : "fetched Zo talkback through file/API lane",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
