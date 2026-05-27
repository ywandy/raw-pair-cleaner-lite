#!/usr/bin/env node
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import {
  createReleaseArtifactName,
  discoverUpdaterArtifacts
} from "./updater-utils.mjs";

const args = parseArgs(process.argv.slice(2));
const rootDir = path.resolve(args.root ?? "src-tauri/target/release/bundle");
const outDir = path.resolve(args.out ?? "dist-release");
const version = args.version ?? (await readPackageJson()).version;
const updaterArtifacts = await discoverUpdaterArtifacts(rootDir);

await mkdir(outDir, { recursive: true });

for (const artifact of updaterArtifacts) {
  const releaseName = createReleaseArtifactName({
    version,
    platform: artifact.platform,
    artifactPath: artifact.relativePath
  });
  await copyFile(artifact.absolutePath, path.join(outDir, releaseName));
  await copyFile(`${artifact.absolutePath}.sig`, path.join(outDir, `${releaseName}.sig`));
}

for (const installer of await discoverInstallers(rootDir)) {
  await copyFile(installer.absolutePath, path.join(outDir, installer.releaseName));
}

console.log(`Collected release artifacts in ${outDir}`);

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

async function discoverInstallers(rootDir) {
  const results = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!isInstaller(entryPath)) continue;

      results.push({
        absolutePath: entryPath,
        releaseName: path.basename(entryPath).replace(/\s+/g, "-")
      });
    }
  }

  await walk(rootDir);
  return results;
}

function isInstaller(filePath) {
  return (
    filePath.endsWith(".dmg") ||
    filePath.endsWith(".exe") ||
    filePath.endsWith(".msi") ||
    filePath.endsWith(".AppImage")
  );
}

async function readPackageJson() {
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
}
