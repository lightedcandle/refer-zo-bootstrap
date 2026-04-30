#!/usr/bin/env node
import { labelFromPrompt, parseAtomicArgs, printAndExit, promptOf, routeFromPrompt, slug, writeAtomicArtifact } from "./atomic-common.mjs";

const { contract } = parseAtomicArgs(process.argv.slice(2));
const prompt = promptOf(contract);
const label = labelFromPrompt(prompt, "New Button");
const route = routeFromPrompt(prompt);

printAndExit(writeAtomicArtifact({
  scriptId: "button-add",
  artifactKind: "element.button",
  contract,
  target: { route, anchor_id: `E-${slug(label)}-Button` },
  imsce: { layer: "E", element_type: "button", required_parent: "C" },
  props: {
    label,
    variant: prompt.toLowerCase().includes("secondary") ? "secondary" : "primary",
    action: slug(label),
    role_class: "role-button",
  },
  evidence: ["element_catalog:button", "guard:element_requires_card_parent"],
}));
