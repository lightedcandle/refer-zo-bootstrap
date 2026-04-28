/**
 * page-add.mjs
 * Creates a new Zo Space page route.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

export default async function execute(contract, opts = {}) {
  const { verbose = false } = opts;
  const { answers = {}, intent = "" } = contract;
  
  const path = answers["page-path"] || "/new-page";
  const pageType = answers["page-type"] || "Private";
  const hasSidebar = answers["has-sidebar"] !== "No";
  const pageName = path.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^\/|\/$/g, "");
  
  const isPublic = pageType === "Public" ? "true" : "false";
  const isApi = pageType === "API" ? "api" : "page";
  
  let code;
  
  if (isApi === "api") {
    code = `import type { Context } from "hono";

export default (c: Context) => {
  return c.json({ message: "Hello from ${path}", path: "${path}" });
};`;
  } else {
    code = `import { useState } from "react";

export default function ${toPascalCase(pageName)}() {
  const [count, setCount] = useState(0);
  
  return (
    <div className="min-h-screen bg-zinc-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-4">${pageName}</h1>
      <p className="text-gray-400 mb-6">Page created via factory script.</p>
      
      <div className="bg-zinc-800 rounded-xl p-6">
        <p className="mb-4">Count: {count}</p>
        <button 
          onClick={() => setCount(c => c + 1)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          Increment
        </button>
      </div>
    </div>
  );
}

function toPascalCase(str) {
  return str.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}`;
  }
  
  // Determine output directory
  const baseDir = process.env.ZO_SPACE_DIR || process.cwd();
  const routePath = path.replace(/^\//, "");
  const outputDir = join(baseDir, routePath.split("/")[0] === "" ? "" : routePath);
  const outputFile = join(outputDir, "page.tsx");
  
  try {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(outputFile, code);
  } catch (e) {
    // Write to workspace instead
    const wsDir = process.env.ZO_WORKSPACE_ROOT || "/home/workspace";
    const wsOut = join(wsDir, "output", routePath);
    mkdirSync(wsOut, { recursive: true });
    writeFileSync(join(wsOut, "page.tsx"), code);
  }
  
  const result = {
    files: [{ path: outputFile, action: "created" }],
    commands: [],
    format: isApi === "api" ? "API route (Hono)" : "Page (React)",
    public: isPublic,
    message: `Page "${path}" (${pageType}) created. Deploy to activate.`,
  };
  
  return result;
}

function toPascalCase(str) {
  return str.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}
