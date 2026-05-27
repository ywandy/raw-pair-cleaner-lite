import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  DeleteManifest,
  DeleteManifestCandidate
} from "../../../shared/protocol";
import type { DeleteMode, MediaFile } from "../../../shared/types";

export function resolveSidecarDataDir(dataDir?: string): string {
  return dataDir && dataDir.length > 0
    ? dataDir
    : path.join(os.tmpdir(), "raw-pair-cleaner-lite", "sidecar");
}

export function getManifestPath(scanId: string, dataDir?: string): string {
  return path.join(resolveSidecarDataDir(dataDir), "manifests", `${scanId}.json`);
}

export async function writeDeleteManifest(options: {
  scanId: string;
  rootPath: string;
  deleteMode: DeleteMode;
  candidates: MediaFile[];
  dataDir?: string;
  now?: () => Date;
}): Promise<string> {
  const manifestPath = getManifestPath(options.scanId, options.dataDir);
  const manifest: DeleteManifest = {
    protocolVersion: 1,
    scanId: options.scanId,
    rootPath: options.rootPath,
    deleteMode: options.deleteMode,
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
    candidates: options.candidates.map(toManifestCandidate)
  };

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifestPath;
}

export async function readDeleteManifest(scanId: string, dataDir?: string): Promise<DeleteManifest> {
  const manifestPath = getManifestPath(scanId, dataDir);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as DeleteManifest;

  validateDeleteManifest(manifest, scanId);

  return manifest;
}

function toManifestCandidate(file: MediaFile): DeleteManifestCandidate {
  return {
    path: file.path,
    size: file.size,
    modifiedAt: file.modifiedAt
  };
}

function validateDeleteManifest(manifest: DeleteManifest, expectedScanId: string): void {
  if (manifest.protocolVersion !== 1) {
    throw new Error("Unsupported delete manifest protocol version.");
  }
  if (manifest.scanId !== expectedScanId) {
    throw new Error("Delete manifest scanId does not match the trash request.");
  }
  if (!manifest.rootPath) {
    throw new Error("Delete manifest rootPath is required.");
  }
  if (!Array.isArray(manifest.candidates)) {
    throw new Error("Delete manifest candidates must be an array.");
  }
}
