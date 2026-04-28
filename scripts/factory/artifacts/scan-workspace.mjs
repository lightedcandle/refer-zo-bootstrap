/**
 * scan-workspace.mjs
 * Scans the workspace and emits a codebase tree.
 */

import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

export default async function execute(contract, opts = {}) {
  const { verbose = false } = opts;
  const baseDir = process.env.ZO_WORKSPACE_ROOT || "/home/workspace";
  
  const TREE_FILE = join(baseDir, ".codebase-tree.json");
  const MAX_DEPTH = 4;
  const IGNORE = ["node_modules", ".git", "Trash", ".DS_Store", "dist", "build", ".next"];
  
  function scan(dir, depth = 0, prefix = "") {
    if (depth > MAX_DEPTH) return [];
    
    const entries = [];
    let items;
    
    try {
      items = readdirSync(dir);
    } catch {
      return entries;
    }
    
    const filtered = items.filter(i => !IGNORE.includes(i));
    
    for (let i = 0; i < filtered.length; i++) {
      const name = filtered[i];
      const fullPath = join(dir, name);
      const isLast = i === filtered.length - 1;
      const connector = isLast ? "└── " : "├── ";
      
      let stat;
      try { stat = statSync(fullPath); } catch { continue; }
      
      if (stat.isDirectory()) {
        entries.push({ type: "dir", path: fullPath, name, depth });
        entries.push(...scan(fullPath, depth + 1, prefix + (isLast ? "    " : "│   ")));
      } else {
        const ext = name.split(".").pop();
        entries.push({ type: "file", path: fullPath, name, ext, size: stat.size, depth });
      }
    }
    
    return entries;
  }
  
  const tree = scan(baseDir);
  
  const output = {
    generated: new Date().toISOString(),
    root: baseDir,
    totalFiles: tree.filter(n => n.type === "file").length,
    totalDirs: tree.filter(n => n.type === "dir").length,
    entries: tree,
  };
  
  writeFileSync(TREE_FILE, JSON.stringify(output, null, 2));
  
  // Pretty print summary
  console.log("\n📁 Workspace Scan Results");
  console.log("─".repeat(50));
  console.log(`Root: ${baseDir}`);
  console.log(`Files: ${output.totalFiles}`);
  console.log(`Directories: ${output.totalDirs}`);
  console.log(`Tree saved to: ${TREE_FILE}`);
  
  // Show top-level structure
  console.log("\n📂 Top-level structure:");
  const topLevel = tree.filter(n => n.depth === 0);
  for (const item of topLevel) {
    console.log(`  ${item.type === "dir" ? "📁" : "📄"} ${item.name}`);
  }
  
  return {
    files: [{ path: TREE_FILE, action: "created" }],
    summary: {
      root: baseDir,
      files: output.totalFiles,
      dirs: output.totalDirs,
    },
    message: `Workspace scanned. ${output.totalFiles} files, ${output.totalDirs} directories.`,
  };
}
