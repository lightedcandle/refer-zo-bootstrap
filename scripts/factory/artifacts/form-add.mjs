#!/usr/bin/env node
import { labelFromPrompt, parseAtomicArgs, printAndExit, promptOf, routeFromPrompt, slug, writeAtomicArtifact } from "./atomic-common.mjs";

const { contract } = parseAtomicArgs(process.argv.slice(2));
const prompt = promptOf(contract);
const label = labelFromPrompt(prompt, "New Form");
const route = routeFromPrompt(prompt);
const lower = prompt.toLowerCase();
const fields = [
  lower.includes("email") ? { name: "email", label: "Email", input_type: "email", role_class: "role-input" } : null,
  lower.includes("phone") ? { name: "phone", label: "Phone", input_type: "tel", role_class: "role-input" } : null,
  { name: "name", label: "Name", input_type: "text", role_class: "role-input" },
].filter(Boolean);

printAndExit(writeAtomicArtifact({
  scriptId: "form-add",
  artifactKind: "form",
  contract,
  target: { route, form_id: `C-${slug(label)}-Form` },
  imsce: { layer: "C", contains: "E.field", required_parent: "S" },
  props: {
    label,
    fields,
    submit_button: { label: "Submit", role_class: "role-button-primary" },
  },
  evidence: ["structure:card_contains_fields", "element_catalog:field", "element_catalog:button"],
}));
