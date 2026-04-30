#!/usr/bin/env node
import { labelFromPrompt, parseAtomicArgs, printAndExit, promptOf, routeFromPrompt, slug, writeAtomicArtifact } from "./atomic-common.mjs";

const { contract } = parseAtomicArgs(process.argv.slice(2));
const prompt = promptOf(contract);
const label = labelFromPrompt(prompt, "New Page");
const route = routeFromPrompt(prompt, `/${slug(label)}`);

printAndExit(writeAtomicArtifact({
  scriptId: "page-add",
  artifactKind: "page",
  contract,
  target: { route, page_id: `I-${slug(label)}` },
  imsce: { layer: "I", modal: "2P", sections: ["hero", "content", "footer"] },
  props: {
    label,
    route,
    page_modal_id: `M-${slug(label)}-Page`,
    default_sections: ["hero", "content", "footer"],
  },
  evidence: ["structure:page_index", "structure:page_modal_2p"],
}));
