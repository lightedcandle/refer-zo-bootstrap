/**
 * form-add.mjs
 * Creates a form component with configurable fields.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const FIELD_TEMPLATES = {
  Text: (name, label) => `
    <div className="space-y-1">
      <label htmlFor="${name}" className="block text-sm font-medium text-gray-300">${label}</label>
      <input
        type="text"
        id="${name}"
        name="${name}"
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>`,
  
  Number: (name, label) => `
    <div className="space-y-1">
      <label htmlFor="${name}" className="block text-sm font-medium text-gray-300">${label}</label>
      <input
        type="number"
        id="${name}"
        name="${name}"
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>`,
  
  Email: (name, label) => `
    <div className="space-y-1">
      <label htmlFor="${name}" className="block text-sm font-medium text-gray-300">${label}</label>
      <input
        type="email"
        id="${name}"
        name="${name}"
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>`,
  
  Select: (name, label) => `
    <div className="space-y-1">
      <label htmlFor="${name}" className="block text-sm font-medium text-gray-300">${label}</label>
      <select
        id="${name}"
        name="${name}"
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select...</option>
      </select>
    </div>`,
  
  Checkbox: (name, label) => `
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        id="${name}"
        name="${name}"
        className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-blue-600 focus:ring-blue-500"
      />
      <label htmlFor="${name}" className="text-sm text-gray-300">${label}</label>
    </div>`,
  
  Date: (name, label) => `
    <div className="space-y-1">
      <label htmlFor="${name}" className="block text-sm font-medium text-gray-300">${label}</label>
      <input
        type="date"
        id="${name}"
        name="${name}"
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>`,
  
  Textarea: (name, label) => `
    <div className="space-y-1">
      <label htmlFor="${name}" className="block text-sm font-medium text-gray-300">${label}</label>
      <textarea
        id="${name}"
        name="${name}"
        rows={4}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>`,
};

const FIELD_COUNTS = {
  "Minimal (2-3)": { Text: 1, Number: 1, Email: 1 },
  "Standard (5-7)": { Text: 2, Number: 1, Email: 1, Select: 1, Checkbox: 1 },
  "Full (10+)": { Text: 3, Number: 2, Email: 1, Select: 2, Checkbox: 1, Date: 1, Textarea: 1 },
};

export default async function execute(contract, opts = {}) {
  const { answers = {} } = contract;
  
  const formType = answers["form-type"] || "Add";
  const fieldCoverage = answers["fields"] || "Standard (5-7)";
  const submitStyle = answers["submit-style"] || "Single";
  
  const fields = FIELD_COUNTS[fieldCoverage] || FIELD_COUNTS["Standard (5-7)"];
  const fieldEntries = Object.entries(fields);
  
  // Generate field code
  const fieldCode = fieldEntries.map(([type, count]) => {
    const template = FIELD_TEMPLATES[type];
    if (!template) return "";
    return template(type.toLowerCase() + "-" + Math.random().toString(36).slice(2, 6), type + " Field");
  }).join("\n");
  
  // Submit button(s)
  const submitButtons = submitStyle === "Dual"
    ? `
      <div className="flex space-x-3">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"
        >
          Cancel
        </button>
      </div>`
    : `
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
      >
        Submit
      </button>`;
  
  const formCode = `<form className="space-y-4 max-w-xl">
${fieldCode}
  <div>
${submitButtons}
  </div>
</form>`;

  const result = {
    code: formCode,
    format: "tsx",
    fields: fieldEntries.map(([type]) => type),
    formType,
    fieldCoverage,
    submitStyle,
    message: `${formType} form created with ${fieldCoverage} (${fieldEntries.length} field types). Copy the code into your page.`,
  };
  
  return result;
}
