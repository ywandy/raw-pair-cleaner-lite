import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { getCurrentPkgTarget, getExecutableSuffix, getPnpmCommand } from "./platform.mjs";

const rootDir = resolve(import.meta.dirname, "..");
const sidecarDir = resolve(rootDir, "sidecar");
const outputPath = resolve(sidecarDir, "dist", `raw-pair-sidecar${getExecutableSuffix()}`);
const pnpmCommand = getPnpmCommand();

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    const detail = result.error ? `: ${result.error.message}` : "";
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}${detail}`);
  }
}

mkdirSync(resolve(sidecarDir, "dist"), { recursive: true });
run(pnpmCommand, ["--dir", "sidecar", "build"], rootDir);
run(
  pnpmCommand,
  [
    "--dir",
    "sidecar",
    "exec",
    "pkg",
    "dist/sidecar/src/index.js",
    "--targets",
    getCurrentPkgTarget(),
    "--output",
    outputPath
  ],
  rootDir
);
