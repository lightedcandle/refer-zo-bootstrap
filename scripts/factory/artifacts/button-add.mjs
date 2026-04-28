/**
 * button-add.mjs
 * Adds a button component to a target file or creates a new one.
 */

export default async function execute(contract, opts = {}) {
  const { verbose = false } = opts;
  const { answers = {} } = contract;
  
  const label = answers["button-label"] || "Button";
  const variant = answers["button-variant"] || "Primary";
  const size = answers["button-size"] || "md";
  const target = answers["target-file"] || null;
  
  const variantMap = {
    "Primary": "bg-blue-600 hover:bg-blue-700 text-white",
    "Secondary": "bg-gray-200 hover:bg-gray-300 text-gray-800",
    "Ghost": "bg-transparent hover:bg-gray-100 text-gray-700 border border-gray-300",
  };
  
  const sizeMap = {
    "sm": "px-3 py-1.5 text-sm",
    "md": "px-4 py-2 text-base",
    "lg": "px-6 py-3 text-lg",
  };
  
  const classes = [variantMap[variant], sizeMap[size], "rounded-lg font-medium transition-colors cursor-pointer"].join(" ");
  
  const code = `<button className="${classes}">
  ${label}
</button>`;
  
  const result = {
    files: [],
    code,
    format: "tsx",
    message: `Button "${label}" (${variant}, ${size}) ready to paste into your component.`,
  };
  
  if (target) {
    // Read target and inject button
    try {
      const { readFileSync, writeFileSync } = await import("node:fs");
      let content = readFileSync(target, "utf8");
      
      // Find insertion point (before last export default or at end)
      const insertAt = content.lastIndexOf("export default");
      if (insertAt > 0) {
        content = content.slice(0, insertAt) + code + "\n\n" + content.slice(insertAt);
      } else {
        content += "\n" + code;
      }
      
      writeFileSync(target, content);
      result.files.push({ path: target, action: "injected" });
      result.message = `Button injected into ${target}`;
    } catch (e) {
      result.message = `Could not inject into ${target}: ${e.message}. Button code ready above.`;
    }
  }
  
  if (verbose) {
    console.log(code);
  }
  
  return result;
}
