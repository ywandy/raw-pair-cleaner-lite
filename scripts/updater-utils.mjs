import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SIGNATURE_SUFFIX = ".sig";

export async function discoverUpdaterArtifacts(rootDir) {
  const signatures = await findFiles(rootDir, (filePath) => filePath.endsWith(SIGNATURE_SUFFIX));
  const artifacts = [];

  for (const signaturePath of signatures.sort()) {
    const artifactPath = signaturePath.slice(0, -SIGNATURE_SUFFIX.length);
    const relativePath = normalizePath(path.relative(rootDir, artifactPath));
    artifacts.push({
      platform: inferUpdaterPlatform(relativePath),
      absolutePath: artifactPath,
      relativePath,
      signature: (await readFile(signaturePath, "utf8")).trim()
    });
  }

  return artifacts;
}

export function buildLatestJson({ version, notes, pubDate, baseUrl, artifacts }) {
  if (!version) throw new Error("version is required.");
  if (!baseUrl) throw new Error("baseUrl is required.");
  if (!artifacts || artifacts.length === 0) {
    throw new Error("At least one updater artifact is required.");
  }

  const platforms = {};
  for (const artifact of artifacts) {
    if (platforms[artifact.platform]) {
      throw new Error(`Duplicate updater artifacts for platform ${artifact.platform}`);
    }
    platforms[artifact.platform] = {
      signature: artifact.signature,
      url: joinUrl(baseUrl, artifact.relativePath)
    };
  }

  return {
    version,
    notes: notes ?? "",
    pub_date: pubDate ?? new Date().toISOString(),
    platforms
  };
}

export function inferUpdaterPlatform(artifactPath, platform = process.platform, arch = process.arch) {
  const normalized = normalizePath(artifactPath).toLowerCase();

  if (normalized.includes("darwin-aarch64") || normalized.includes("aarch64-apple-darwin") || (normalized.includes("macos/") && normalized.includes("aarch64")) || (normalized.includes("macos/") && normalized.includes("_arm64"))) {
    return "darwin-aarch64";
  }
  if (normalized.includes("darwin-x86_64") || normalized.includes("x86_64-apple-darwin") || (normalized.includes("macos/") && normalized.includes("x86_64")) || (normalized.includes("macos/") && normalized.includes("_x64"))) {
    return "darwin-x86_64";
  }
  if (normalized.includes("macos/") && platform === "darwin") {
    return arch === "arm64" ? "darwin-aarch64" : "darwin-x86_64";
  }
  if (normalized.includes("windows-x86_64") || normalized.includes("x86_64-pc-windows") || normalized.includes("windows/") || normalized.includes("nsis/") || normalized.includes("msi/")) {
    return "windows-x86_64";
  }
  if (normalized.includes("linux-x86_64") || normalized.includes("x86_64-unknown-linux") || normalized.includes("appimage/") || normalized.includes("_amd64")) {
    return "linux-x86_64";
  }

  throw new Error(`Unable to infer updater platform from artifact path: ${artifactPath}`);
}

export function createReleaseArtifactName({ version, platform, artifactPath }) {
  if (!version) throw new Error("version is required.");
  if (!platform) throw new Error("platform is required.");

  return `raw-pair-cleaner-lite_${version}_${platform}${getUpdaterArtifactSuffix(artifactPath)}`;
}

export function joinUrl(baseUrl, relativePath) {
  const encodedPath = normalizePath(relativePath)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${baseUrl.replace(/\/+$/, "")}/${encodedPath}`;
}

async function findFiles(rootDir, predicate) {
  const results = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && predicate(entryPath)) {
        results.push(entryPath);
      }
    }
  }

  await walk(rootDir);
  return results;
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function getUpdaterArtifactSuffix(artifactPath) {
  const normalized = normalizePath(artifactPath);
  const knownSuffixes = [
    ".app.tar.gz",
    ".AppImage.tar.gz",
    ".nsis.zip",
    ".msi.zip",
    ".tar.gz",
    ".zip"
  ];
  const suffix = knownSuffixes.find((candidate) => normalized.endsWith(candidate));
  if (!suffix) {
    throw new Error(`Unsupported updater artifact suffix: ${artifactPath}`);
  }

  return suffix;
}
