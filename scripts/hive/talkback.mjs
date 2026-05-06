#!/usr/bin/env node
/**
 * Root hive talkback entrypoint.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { main } from "../factory/hive/talkback.mjs";

export { askNode, handleIncomingRequest, parseSexpr, main } from "../factory/hive/talkback.mjs";
export { default } from "../factory/hive/talkback.mjs";

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.log(`(error :code "talkback-failed" :message "${error.message}")`);
    process.exit(1);
  });
}
