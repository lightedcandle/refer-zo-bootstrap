#!/usr/bin/env node
import { labelFromPrompt, parseAtomicArgs, printAndExit, promptOf, routeFromPrompt, slug, writeAtomicArtifact } from "./atomic-common.mjs";

const { contract } = parseAtomicArgs(process.argv.slice(2));
const prompt = promptOf(contract);
const label = labelFromPrompt(prompt, "New Text");
const lower = prompt.toLowerCase();

printAndExit(writeAtomicArtifact({
  scriptId: "text-add",
  artifactKind: lower.includes("heading") ? "element.heading" : "element.text",
  contract,
  target: { route: routeFromPrompt(prompt), anchor_id: `E-${slug(label)}-Text` },
  imsce: { layer: "E", element_type: "text", required_parent: "C" },
  props: {
    text: label,
    role_class: lower.includes("heading") ? "role-heading" : lower.includes("caption") ? "role-caption" : "role-body",
  },
  evidence: ["element_catalog:text", "guard:text_lives_on_card_or_element"],
}));
