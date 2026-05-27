#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildLatestJson, discoverUpdaterArtifacts } from "./updater-utils.mjs";

const args = parseArgs(process.argv.slice(2));
const rootDir = path.resolve(args.artifacts ?? "src-tauri/target/release/bundle");
const outPath = path.resolve(args.out ?? "dist-updater/latest.json");
const packageJson = await readPackageJson();
const artifacts = await discoverUpdaterArtifacts(rootDir);
const latestJson = buildLatestJson({
  version: args.version ?? packageJson.version,
  notes: args.notes ?? "",
  pubDate: args.pubDate,
  baseUrl: args.baseUrl ?? requiredEnv("RAW_PAIR_UPDATE_BASE_URL"),
  artifacts
});

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(latestJson, null, 2)}\n`, "utf8");
console.log(`Wrote ${outPath}`);

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function requiredArg(value, name) {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function readPackageJson() {
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required.`);
  return value;
}
