#!/usr/bin/env node
/**
 * @opcodes ["BATCH_MANIFEST", "PHASE3_BUILD"]
 * @trigger phase3 phase3-all phase3-batch all-forms
 * @description Alliance-scoped Phase 3 modal manifest generator for Alliance Hub operation routes.
 * @scope alliance
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(process.cwd(), "datasets", "script-artifacts", "scoped", "alliance", "phase3-batch");

const entities = [
  { name: "Organization", route: "/dashboard/organizations", slug: "org", label: "Church" },
  { name: "Person", route: "/dashboard/people", slug: "person", label: "Person" },
  { name: "Event", route: "/dashboard/calendar", slug: "event", label: "Event" },
  { name: "Initiative", route: "/dashboard/initiatives", slug: "initiative", label: "Ministry" },
  { name: "Document", route: "/dashboard/documents", slug: "doc", label: "Document" },
  { name: "GovernanceItem", route: "/dashboard/governance", slug: "governance", label: "Governance Item" },
  { name: "ComplianceTask", route: "/dashboard/compliance", slug: "compliance", label: "Compliance Task" },
  { name: "Communication", route: "/dashboard/communications", slug: "comm", label: "Communication" },
];

const fieldSets = {
  Organization: [
    ["name", "Church Name", "text", true, "e.g. Antioch Fellowship"],
    ["type", "Church Type", "select", false, "", ["Local Church", "Mission Church", "Chapel", "Plant", "Satellite"]],
    ["region", "Region / District", "text", false, "e.g. Northeast Region"],
    ["status", "Status", "select", false, "", ["Active", "Prospect", "On-Hold", "Inactive"]],
    ["leader", "Senior Pastor / Leader", "text", false, "e.g. Bishop James"],
    ["leaderTitle", "Leader Title", "select", false, "", ["Pastor", "Bishop", "Apostle", "Elder", "Founder"]],
    ["email", "Contact Email", "email", false, "contact@church.org"],
    ["phone", "Phone", "tel", false, "(555) 000-0000"],
    ["address", "Address", "textarea", false, "123 Main St, City, State 00000"],
  ],
  Person: [
    ["fullName", "Full Name", "text", true, "e.g. Rev. Mary Thomas"],
    ["title", "Title / Role", "select", false, "", ["Pastor", "Bishop", "Elder", "Deacon", "Secretary", "Apostle", "Member"]],
    ["email", "Email", "email", false, "pastor@church.org"],
    ["phone", "Phone", "tel", false, "(555) 000-0000"],
    ["church", "Church / Organization", "text", false, "e.g. Antioch Fellowship"],
    ["region", "Region", "text", false, "e.g. Northeast"],
    ["lifecycle", "Lifecycle Status", "select", false, "", ["Active", "On-Leave", "Transitioning", "Inactive", "Ordained", "Licensed", "Candidate"]],
    ["ordinationDate", "Ordination Date", "date", false, ""],
  ],
  Event: [
    ["title", "Event Name", "text", true, "e.g. Annual Ministers Conference 2026"],
    ["type", "Event Type", "select", false, "", ["Conference", "Meeting", "Training", "Worship", "Regional Rally", "Board Meeting"]],
    ["startDate", "Start Date", "date", true, ""],
    ["endDate", "End Date", "date", false, ""],
    ["location", "Location", "text", false, "e.g. Telechurch Studio or City, State"],
    ["audience", "Audience", "select", false, "", ["All Churches", "Pastors Only", "Leaders Only", "General Assembly", "Board Only"]],
    ["capacity", "Capacity", "number", false, "e.g. 150"],
    ["registration", "Registration Required", "select", false, "", ["Yes - RSVP Required", "No - Open", "By Invitation"]],
  ],
  Initiative: [
    ["title", "Ministry Title", "text", true, "e.g. Church Planting Initiative 2026"],
    ["type", "Ministry Type", "select", false, "", ["Outreach", "Discipleship", "Church Planting", "Youth", "Women", "Men", "Global Missions"]],
    ["status", "Status", "select", false, "", ["Active", "Planning", "On-Hold", "Completed"]],
    ["owner", "Ministry Leader", "text", false, "e.g. Apostle J"],
    ["churches", "Participating Churches", "text", false, "e.g. Antioch, Grace, New Harvest"],
    ["goal", "Primary Goal", "text", false, "e.g. Plant 5 new churches by 2027"],
    ["startDate", "Start Date", "date", false, ""],
    ["endDate", "Target End Date", "date", false, ""],
  ],
  Document: [
    ["title", "Document Title", "text", true, "e.g. Alliance Bylaws 2026"],
    ["category", "Category", "select", false, "", ["Charter", "Policy", "Report", "Minutes", "Template", "Covenant", "Doctrine", "Compliance"]],
    ["privacy", "Privacy Tier", "select", false, "", ["Public", "Members Only", "Leaders Only", "Board Only", "Executive Only"]],
    ["effectiveDate", "Effective Date", "date", false, ""],
    ["owner", "Document Owner", "text", false, "e.g. Secretary / Apostle J"],
    ["description", "Description / Summary", "textarea", false, "Brief description of the document..."],
  ],
  GovernanceItem: [
    ["title", "Item Title", "text", true, "e.g. Motion: Approve 2026 Budget"],
    ["type", "Item Type", "select", false, "", ["Motion", "Vote", "Decision", "Amendment", "Dispute", "Policy Update"]],
    ["status", "Status", "select", false, "", ["Draft", "Pending Vote", "Approved", "Rejected", "Tabled", "Ratified"]],
    ["owner", "Item Owner / Sponsor", "text", false, "e.g. Secretary / Board Chair"],
    ["dueDate", "Due Date", "date", false, ""],
    ["description", "Description", "textarea", false, "Details of the governance item..."],
    ["visibility", "Visibility", "select", false, "", ["All Members", "Leaders Only", "Board Only", "Executive Only"]],
  ],
  ComplianceTask: [
    ["title", "Task Title", "text", true, "e.g. Submit Annual Credentialing Report"],
    ["organization", "Church / Organization", "text", false, "e.g. Antioch Fellowship"],
    ["standard", "Standard / Requirement", "select", false, "", ["Credentialing", "Annual Report", "Doctrine Alignment", "Financial Disclosure", "Safeguarding Policy"]],
    ["status", "Status", "select", false, "", ["Pending", "In Progress", "Submitted", "Approved", "Non-Compliant", "Exempt"]],
    ["dueDate", "Due Date", "date", true, ""],
    ["description", "Evidence / Notes", "textarea", false, "Supporting notes or evidence of compliance..."],
  ],
  Communication: [
    ["title", "Communication Title", "text", true, "e.g. June Newsletter"],
    ["type", "Channel / Type", "select", false, "", ["Email", "SMS", "Letter", "Announcement", "Pastoral Letter", "Public Statement"]],
    ["status", "Status", "select", false, "", ["Draft", "Pending Approval", "Approved", "Scheduled", "Sent", "Archived"]],
    ["audience", "Target Audience", "select", false, "", ["All Churches", "Pastors Only", "Leaders Only", "General Assembly", "Board Only", "Public"]],
    ["approvedBy", "Approved By", "text", false, "e.g. Apostle J"],
    ["scheduledDate", "Scheduled Date", "date", false, ""],
    ["summary", "Message Summary", "textarea", false, "Brief summary of the communication content..."],
  ],
};

function field(tuple) {
  const [name, label, type, required, placeholder, options] = tuple;
  return { name, label, type, required, placeholder, options: options || [] };
}

function renderField(f) {
  const req = f.required ? " *" : "";
  const common = `id="field-${f.name}" name="${f.name}" className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"`;
  if (f.type === "select") {
    return `    <div className="mb-4">
      <label className="block text-sm font-medium text-zinc-300 mb-1">${f.label}${req}</label>
      <select ${common}>
        <option value="">Select...</option>
        ${f.options.map((o) => `<option value="${o}">${o}</option>`).join("\n        ")}
      </select>
    </div>`;
  }
  if (f.type === "textarea") {
    return `    <div className="mb-4">
      <label className="block text-sm font-medium text-zinc-300 mb-1">${f.label}${req}</label>
      <textarea ${common} rows="3" placeholder="${f.placeholder || ""}"></textarea>
    </div>`;
  }
  return `    <div className="mb-4">
      <label className="block text-sm font-medium text-zinc-300 mb-1">${f.label}${req}</label>
      <input type="${f.type}" ${common} placeholder="${f.placeholder || ""}" />
    </div>`;
}

function manifestFor(entity) {
  const fields = (fieldSets[entity.name] || []).map(field);
  const varName = entity.name;
  const modal = `{/* --- PHASE3_MODAL:${entity.slug}:START --- */}
      {show${varName}Modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <h2 className="text-lg font-semibold text-white">{editTarget ? "Edit ${entity.label}" : "Add ${entity.label}"}</h2>
              <button onClick={close${varName}Modal} className="text-zinc-400 hover:text-white text-xl">x</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); close${varName}Modal(); }} className="p-4">
${fields.map(renderField).join("\n")}
              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition">{editTarget ? "Save Changes" : "Create ${entity.label}"}</button>
                <button type="button" onClick={close${varName}Modal} className="px-4 py-2 border border-zinc-600 text-zinc-300 rounded-lg hover:bg-zinc-800 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- PHASE3_MODAL:${entity.slug}:END --- */}`;
  return {
    entity: entity.name,
    route: entity.route,
    slug: entity.slug,
    label: entity.label,
    field_count: fields.length,
    fields: fields.map((f) => f.name),
    state_var: `const [show${varName}Modal, setShow${varName}Modal] = useState(false);\n  const [editTarget, setEditTarget] = useState(null);`,
    functions: `  function openCreate${varName}() {\n    setEditTarget(null);\n    setShow${varName}Modal(true);\n  }\n  function openEdit${varName}(item) {\n    setEditTarget(item);\n    setShow${varName}Modal(true);\n  }\n  function close${varName}Modal() {\n    setShow${varName}Modal(false);\n    setEditTarget(null);\n  }`,
    button: `<button onClick={openCreate${varName}} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition">+ Add ${entity.label}</button>`,
    modal_jsx: modal,
    auth_guards: [`create:${entity.slug} WRITE`, `update:${entity.slug} WRITE`, `write:${entity.slug}`],
  };
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const manifests = entities.map(manifestFor);
for (const manifest of manifests) {
  writeFileSync(resolve(OUT, `${manifest.slug}-manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

const summary = {
  ok: true,
  status: "done",
  forge: "phase3-batch",
  scope: "alliance",
  entities: manifests.map((m) => ({ name: m.entity, route: m.route, fields: m.field_count, status: "ready" })),
  output_dir: OUT,
  next: "Run the generic route-manifest bridge with this manifest directory to apply these manifests to Zo Space routes.",
};
writeFileSync(resolve(OUT, "batch-manifest.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
