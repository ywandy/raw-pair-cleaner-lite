import { chmodSync, copyFileSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { getCurrentTauriTriple, getExecutableSuffix } from "./platform.mjs";

const rootDir = resolve(import.meta.dirname, "..");
const suffix = getExecutableSuffix();
const sourcePath = resolve(rootDir, "sidecar", "dist", `raw-pair-sidecar${suffix}`);
const stagedDir = resolve(rootDir, "src-tauri", "binaries");
const stagedPath = resolve(stagedDir, `raw-pair-sidecar-${getCurrentTauriTriple()}${suffix}`);

statSync(sourcePath);
mkdirSync(stagedDir, { recursive: true });
copyFileSync(sourcePath, stagedPath);
chmodSync(stagedPath, 0o755);

console.log(`Staged sidecar: ${stagedPath}`);
