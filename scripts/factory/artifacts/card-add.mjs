#!/usr/bin/env node
import { labelFromPrompt, parseAtomicArgs, printAndExit, promptOf, routeFromPrompt, slug, writeAtomicArtifact } from "./atomic-common.mjs";

const { contract } = parseAtomicArgs(process.argv.slice(2));
const prompt = promptOf(contract);
const label = labelFromPrompt(prompt, "New Card");

printAndExit(writeAtomicArtifact({
  scriptId: "card-add",
  artifactKind: "card",
  contract,
  target: { route: routeFromPrompt(prompt), card_id: `C-${slug(label)}-D1` },
  imsce: { layer: "C", density: prompt.toLowerCase().includes("list") ? "DX" : "D1", required_parent: "S", allowed_children: ["E"] },
  props: {
    label,
    layout_kind: prompt.toLowerCase().includes("split") ? "split" : "stack",
    slots: ["title", "body", "actions"],
    role_class: "role-card",
  },
  evidence: ["structure:card_requires_section_parent", "cards:data_spec"],
}));
