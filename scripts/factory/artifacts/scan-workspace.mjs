#!/usr/bin/env node
import { parseAtomicArgs, printAndExit, scanWorkspace, writeAtomicArtifact } from "./atomic-common.mjs";

const { contract } = parseAtomicArgs(process.argv.slice(2));
const files = scanWorkspace();

printAndExit(writeAtomicArtifact({
  scriptId: "scan-workspace",
  artifactKind: "workspace.scan",
  contract,
  target: { root: "refer-zo-bootstrap" },
  imsce: { layer: "repo", note: "non-UI inspection artifact" },
  props: {
    file_count: files.length,
    files,
  },
  evidence: ["scanner:bounded_workspace_scan", "sensitive_paths:skipped"],
}));
