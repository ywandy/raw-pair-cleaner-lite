#!/usr/bin/env node
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_VERSION_SOURCES = [
  {
    name: "package.json",
    read: async (rootDir) => (await readJson(path.join(rootDir, "package.json"))).version
  },
  {
    name: "sidecar/package.json",
    read: async (rootDir) => (await readJson(path.join(rootDir, "sidecar", "package.json"))).version
  },
  {
    name: "shared/constants.ts",
    read: async (rootDir) => matchRequired(
      await readFile(path.join(rootDir, "shared", "constants.ts"), "utf8"),
      /APP_VERSION\s*=\s*["']([^"']+)["']/,
      "APP_VERSION"
    )
  },
  {
    name: "src-tauri/tauri.conf.json",
    read: async (rootDir) => (await readJson(path.join(rootDir, "src-tauri", "tauri.conf.json"))).version
  },
  {
    name: "src-tauri/Cargo.toml",
    read: async (rootDir) => matchRequired(
      await readFile(path.join(rootDir, "src-tauri", "Cargo.toml"), "utf8"),
      /^\s*version\s*=\s*["']([^"']+)["']/m,
      "Cargo package version"
    )
  }
];

const DEFAULT_REQUIRED_DOCS = [
  "docs/UPDATER_RELEASE.md",
  "docs/INTERNAL_RELEASE_CHECKLIST.md",
  "docs/PRODUCTION_DISTRIBUTION.md"
];

const DEFAULT_HARD_DELETE_SCAN_PATHS = [
  "sidecar/src",
  "src",
  "shared",
  "src-tauri/src"
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs"]);
const IGNORED_PATH_PARTS = new Set([
  ".git",
  "dist",
  "dist-release",
  "dist-updater",
  "node_modules",
  "target"
]);

export async function readVersionSources(rootDir = process.cwd()) {
  const sources = [];
  for (const source of DEFAULT_VERSION_SOURCES) {
    sources.push({
      name: source.name,
      version: await source.read(rootDir)
    });
  }
  return sources;
}

export function validateVersionSync(sources) {
  const versions = new Set(sources.map((source) => source.version));
  if (versions.size <= 1) return [];

  return [
    `Version mismatch: ${sources.map((source) => `${source.name}=${source.version}`).join(", ")}`
  ];
}

export function validateExpectedVersion(sources, expectedVersion) {
  if (!expectedVersion) return [];
  if (sources.every((source) => source.version === expectedVersion)) return [];

  return [
    `Expected release version ${expectedVersion} does not match version sources: ${formatVersionSources(sources)}`
  ];
}

export async function findForbiddenHardDeleteCalls(rootDir = process.cwd(), searchPaths = DEFAULT_HARD_DELETE_SCAN_PATHS) {
  const findings = [];
  for (const searchPath of searchPaths) {
    const absolutePath = path.join(rootDir, searchPath);
    if (!(await exists(absolutePath))) continue;
    await walkSourceFiles(absolutePath, async (filePath) => {
      findings.push(...findForbiddenHardDeleteCallsInFile(rootDir, filePath, await readFile(filePath, "utf8")));
    });
  }
  return findings.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
}

export async function validateLatestJson(latestPath, options = {}) {
  const issues = [];
  const latest = await readJson(latestPath);

  if (!latest.version || typeof latest.version !== "string") {
    issues.push("latest.json version is required.");
  } else if (options.expectedVersion && latest.version !== options.expectedVersion) {
    issues.push(`latest.json version ${latest.version} does not match expected ${options.expectedVersion}.`);
  }

  if (!latest.platforms || typeof latest.platforms !== "object" || Array.isArray(latest.platforms)) {
    issues.push("latest.json platforms object is required.");
    return issues;
  }

  const platformEntries = Object.entries(latest.platforms);
  if (platformEntries.length === 0) {
    issues.push("latest.json must declare at least one platform.");
  }

  for (const requiredPlatform of options.requiredPlatforms ?? []) {
    if (!latest.platforms[requiredPlatform]) {
      issues.push(`latest.json is missing required platform ${requiredPlatform}.`);
    }
  }

  for (const [platform, value] of platformEntries) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      issues.push(`latest.json platform ${platform} must be an object.`);
      continue;
    }

    if (!value.url || typeof value.url !== "string") {
      issues.push(`latest.json platform ${platform} url is required.`);
    } else if (!value.url.startsWith("https://")) {
      issues.push(`latest.json platform ${platform} url must be HTTPS.`);
    }

    if (!value.signature || typeof value.signature !== "string") {
      issues.push(`latest.json platform ${platform} signature is required.`);
    } else if (/^https?:\/\//i.test(value.signature)) {
      issues.push(`latest.json platform ${platform} signature must be raw .sig text, not a URL.`);
    }
  }

  return issues;
}

export async function checkRequiredDocs(rootDir = process.cwd(), requiredDocs = DEFAULT_REQUIRED_DOCS) {
  const issues = [];
  for (const documentPath of requiredDocs) {
    if (!(await exists(path.join(rootDir, documentPath)))) {
      issues.push(`Required release document is missing: ${documentPath}`);
    }
  }
  return issues;
}

export async function runReleaseGate(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const issues = [];
  const sources = await readVersionSources(rootDir);
  issues.push(...validateVersionSync(sources));
  issues.push(...validateExpectedVersion(sources, options.expectedVersion));

  if (options.versionOnly) {
    return { issues, sources };
  }

  issues.push(...(await checkRequiredDocs(rootDir, options.requiredDocs ?? DEFAULT_REQUIRED_DOCS)));

  const hardDeleteFindings = await findForbiddenHardDeleteCalls(rootDir, options.hardDeleteScanPaths ?? DEFAULT_HARD_DELETE_SCAN_PATHS);
  for (const finding of hardDeleteFindings) {
    issues.push(`Forbidden hard-delete API: ${finding.file}:${finding.line} ${finding.match}`);
  }

  issues.push(...(await validateLatestJsonWhenPresent(rootDir, options.latestPath, options.expectedVersion ?? sources[0]?.version)));

  return { issues, sources, hardDeleteFindings };
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function validateLatestJsonWhenPresent(rootDir, explicitLatestPath, expectedVersion) {
  const latestPath = explicitLatestPath ? path.resolve(rootDir, explicitLatestPath) : path.join(rootDir, "dist-release", "latest.json");
  const distReleaseDir = path.join(rootDir, "dist-release");

  if (await exists(latestPath)) {
    return validateLatestJson(latestPath, { expectedVersion });
  }

  if (!explicitLatestPath && await hasUpdaterSignatures(distReleaseDir)) {
    return ["Updater signatures exist in dist-release, but dist-release/latest.json is missing."];
  }

  return [];
}

async function hasUpdaterSignatures(directoryPath) {
  if (!(await exists(directoryPath))) return false;
  let found = false;
  await walkFiles(directoryPath, async (filePath) => {
    if (filePath.endsWith(".sig")) found = true;
  });
  return found;
}

function findForbiddenHardDeleteCallsInFile(rootDir, filePath, source) {
  const relativePath = normalizePath(path.relative(rootDir, filePath));
  const fileHasForbiddenFsBinding = /(?:import\s*\{[^}]*\b(?:rm|rmdir|unlink)(?:Sync)?\b[^}]*\}\s*from\s*["']node:fs(?:\/promises)?["'])|(?:\b(?:require|import)\s*\(\s*["']node:fs(?:\/promises)?["']\s*\))/.test(source);
  const findings = [];

  source.split(/\r?\n/).forEach((lineText, index) => {
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    const isForbidden =
      /import\s*\{[^}]*\b(?:rm|rmdir|unlink)(?:Sync)?\b[^}]*\}\s*from\s*["']node:fs(?:\/promises)?["']/.test(trimmed) ||
      /\bfs\.(?:rm|rmdir|unlink)(?:Sync)?\s*\(/.test(trimmed) ||
      (fileHasForbiddenFsBinding && /\b(?:rm|rmdir|unlink)(?:Sync)?\s*\(/.test(trimmed)) ||
      /\b(?:std|tokio)::fs::remove_(?:file|dir|dir_all)\s*\(/.test(trimmed);

    if (isForbidden) {
      findings.push({
        file: relativePath,
        line: index + 1,
        match: trimmed
      });
    }
  });

  return findings;
}

async function walkSourceFiles(directoryPath, onFile) {
  await walkFiles(directoryPath, async (filePath) => {
    if (isIgnoredPath(filePath)) return;
    if (isTestFile(filePath)) return;
    if (!SOURCE_EXTENSIONS.has(path.extname(filePath))) return;
    await onFile(filePath);
  });
}

async function walkFiles(directoryPath, onFile) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_PATH_PARTS.has(entry.name)) continue;
      await walkFiles(entryPath, onFile);
    } else if (entry.isFile()) {
      await onFile(entryPath);
    }
  }
}

function isIgnoredPath(filePath) {
  return filePath.split(path.sep).some((part) => IGNORED_PATH_PARTS.has(part));
}

function isTestFile(filePath) {
  const normalized = normalizePath(filePath);
  return (
    normalized.includes("/tests/") ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path.basename(filePath))
  );
}

function matchRequired(source, pattern, label) {
  const match = source.match(pattern);
  if (!match?.[1]) throw new Error(`Unable to read ${label}.`);
  return match[1];
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function formatVersionSources(sources) {
  return sources.map((source) => `${source.name}=${source.version}`).join(", ");
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--version-only") {
      parsed.versionOnly = true;
      continue;
    }
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runReleaseGate(args);

  if (result.issues.length > 0) {
    console.error("Release gate failed:");
    for (const issue of result.issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(args.versionOnly ? "Version check passed." : "Release gate passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
