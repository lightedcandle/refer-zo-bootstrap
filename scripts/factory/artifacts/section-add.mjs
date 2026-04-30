#!/usr/bin/env node
import { labelFromPrompt, parseAtomicArgs, printAndExit, promptOf, routeFromPrompt, slug, writeAtomicArtifact } from "./atomic-common.mjs";

const { contract } = parseAtomicArgs(process.argv.slice(2));
const prompt = promptOf(contract);
const label = labelFromPrompt(prompt, "New Section");

printAndExit(writeAtomicArtifact({
  scriptId: "section-add",
  artifactKind: "section",
  contract,
  target: { route: routeFromPrompt(prompt), section_id: `S-${slug(label)}` },
  imsce: { layer: "S", required_parent: "M", allowed_children: ["C"] },
  props: {
    label,
    region: prompt.toLowerCase().includes("footer") ? "footer" : prompt.toLowerCase().includes("hero") ? "hero" : "content",
    card_slots: [],
  },
  evidence: ["structure:section_requires_modal_parent", "guard:no_direct_elements_in_section"],
}));
