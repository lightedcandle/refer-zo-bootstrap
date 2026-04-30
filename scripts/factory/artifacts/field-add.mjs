#!/usr/bin/env node
import { labelFromPrompt, parseAtomicArgs, printAndExit, promptOf, routeFromPrompt, slug, writeAtomicArtifact } from "./atomic-common.mjs";

const { contract } = parseAtomicArgs(process.argv.slice(2));
const prompt = promptOf(contract);
const label = labelFromPrompt(prompt, "New Field");
const lower = prompt.toLowerCase();

printAndExit(writeAtomicArtifact({
  scriptId: "field-add",
  artifactKind: "element.field",
  contract,
  target: { route: routeFromPrompt(prompt), anchor_id: `E-${slug(label)}-Field` },
  imsce: { layer: "E", element_type: "field", required_parent: "C" },
  props: {
    name: slug(label).replace(/-/g, "_"),
    label,
    input_type: lower.includes("email") ? "email" : lower.includes("date") ? "date" : lower.includes("phone") ? "tel" : "text",
    role_class: "role-input",
    required: lower.includes("required"),
  },
  evidence: ["element_catalog:field", "guard:element_requires_card_parent"],
}));
